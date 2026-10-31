import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  OnApplicationBootstrap,
  Param,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../../config/database.config';
import { BACKUP_KINDS, BackupKind, PENDING_RESTORE, backupDir, databasePath, newBackupName, parseBackupName } from './backup-files';
import { CloudBackupService } from './cloud-backup';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** An automatic backup is taken when the newest one is older than this */
const AUTO_EVERY = 4 * HOUR;

export type BackupInfo = {
  file: string;
  kind: BackupKind;
  createdAt: string;
  size: number;
  customers: number | null;
  entries: number | null;
  lastEntryAt: string | null;
  inCloud: boolean;
};

/**
 * Local database backups: a consistent snapshot (VACUUM INTO works while the
 * app is in use) every few hours, on demand, and before updates/restores.
 * Restoring swaps the file at the next start, before the database is opened.
 */
@Injectable()
export class BackupsService implements OnApplicationBootstrap {
  private readonly log = new Logger('Backups');
  private readonly dbPath = databasePath();
  private readonly dir = backupDir(this.dbPath);
  private running: Promise<BackupInfo> | null = null;

  constructor(
    private prisma: PrismaService,
    private cloud: CloudBackupService,
  ) {}

  onApplicationBootstrap() {
    // Catch up shortly after start (the PC may have been off at backup time)
    setTimeout(() => this.tick(), 15_000).unref();
  }

  /** Backs up when due, then sends the newest backup to the cloud (retrying a failed upload). */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async tick() {
    await this.backupIfDue().catch((e) => this.log.error(`Automatic backup failed: ${e}`));
    await this.cloud.uploadLatest().catch(() => {}); // the error is kept for Settings
  }

  async backupIfDue() {
    const newest = this.list()[0];
    if (newest && Date.now() - new Date(newest.createdAt).getTime() < AUTO_EVERY) return null;
    return this.create('auto');
  }

  /** Takes a snapshot; concurrent requests share the one in progress. */
  create(kind: BackupKind = 'manual'): Promise<BackupInfo> {
    this.running ??= this.snapshot(kind).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async snapshot(kind: BackupKind): Promise<BackupInfo> {
    fs.mkdirSync(this.dir, { recursive: true });
    const file = newBackupName(this.dir, kind);
    const target = path.join(this.dir, file);

    const [check] = await this.prisma.$queryRawUnsafe<{ quick_check: string }[]>('PRAGMA quick_check');
    if (check?.quick_check !== 'ok') throw new Error(`Database check failed: ${check?.quick_check ?? 'unknown'}`);

    await this.prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    const [customers, entries, last] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.entry.count({ where: { isDeleted: false } }),
      this.prisma.entry.findFirst({ where: { isDeleted: false }, orderBy: { startTime: 'desc' }, select: { startTime: true } }),
    ]);
    const meta = { customers, entries, lastEntryAt: last?.startTime.toISOString() ?? null };
    fs.writeFileSync(target.replace(/\.sqlite$/, '.json'), JSON.stringify(meta));
    this.log.log(`Backup saved: ${file}`);
    this.prune();
    this.cloud.uploadLatest().catch(() => {});
    return this.info(file)!;
  }

  private info(file: string, inCloud = this.cloud.uploadedFiles()): BackupInfo | null {
    const parsed = parseBackupName(file);
    const full = path.join(this.dir, file);
    if (!parsed || !fs.existsSync(full)) return null;
    let meta: Partial<Pick<BackupInfo, 'customers' | 'entries' | 'lastEntryAt'>> = {};
    try {
      meta = JSON.parse(fs.readFileSync(full.replace(/\.sqlite$/, '.json'), 'utf8'));
    } catch {
      // Copies made by the desktop app before an update have no counts
    }
    return {
      file,
      kind: parsed.kind,
      createdAt: parsed.createdAt.toISOString(),
      size: fs.statSync(full).size,
      customers: meta.customers ?? null,
      entries: meta.entries ?? null,
      lastEntryAt: meta.lastEntryAt ?? null,
      inCloud: inCloud.has(file),
    };
  }

  /** Newest first */
  list(): BackupInfo[] {
    if (!fs.existsSync(this.dir)) return [];
    const inCloud = this.cloud.uploadedFiles();
    return fs
      .readdirSync(this.dir)
      .map((f) => this.info(f, inCloud))
      .filter((b): b is BackupInfo => b !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Automatic: everything from the last 2 days, then the newest per day for
   * 14 days, then the newest per week for 8 weeks. Other kinds: newest 10 each.
   */
  private prune() {
    const all = this.list();
    const keep = new Set<string>(all.slice(0, 1).map((b) => b.file));
    const now = Date.now();
    const seen = new Set<string>();
    for (const b of all.filter((x) => x.kind === 'auto')) {
      const t = new Date(b.createdAt);
      const age = now - t.getTime();
      const bucket =
        age < 2 * DAY ? b.file : age < 14 * DAY ? `d${t.toDateString()}` : age < 56 * DAY ? `w${Math.floor(t.getTime() / (7 * DAY))}` : null;
      if (bucket && !seen.has(bucket)) {
        seen.add(bucket);
        keep.add(b.file);
      }
    }
    for (const kind of BACKUP_KINDS.filter((k) => k !== 'auto')) {
      all.filter((b) => b.kind === kind).slice(0, 10).forEach((b) => keep.add(b.file));
    }
    for (const b of all) {
      if (keep.has(b.file)) continue;
      const full = path.join(this.dir, b.file);
      fs.rmSync(full, { force: true });
      fs.rmSync(full.replace(/\.sqlite$/, '.json'), { force: true });
    }
  }

  async status() {
    const backups = this.list();
    const pending = this.pendingRestore();
    return {
      cloud: await this.cloud.status(),
      folder: this.dir,
      lastBackupAt: backups[0]?.createdAt ?? null,
      count: backups.length,
      totalSize: backups.reduce((s, b) => s + b.size, 0),
      pendingRestore: pending ? this.info(pending) : null,
      backups,
    };
  }

  private pendingRestore(): string | null {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.dir, PENDING_RESTORE), 'utf8')).file ?? null;
    } catch {
      return null;
    }
  }

  path(file: string): string {
    if (!parseBackupName(file)) throw new BadRequestException('Not a backup file');
    const full = path.join(this.dir, file);
    if (!fs.existsSync(full)) throw new NotFoundException('Backup not found');
    return full;
  }

  /** Queues the backup to replace the database when the app next starts. */
  async requestRestore(file: string) {
    this.path(file);
    fs.writeFileSync(path.join(this.dir, PENDING_RESTORE), JSON.stringify({ file, requestedAt: new Date().toISOString() }));
    this.log.warn(`Restore of ${file} queued for the next start`);
    return { restartRequired: true, file };
  }

  cancelRestore() {
    fs.rmSync(path.join(this.dir, PENDING_RESTORE), { force: true });
    return { cancelled: true };
  }
}

export class ConnectCloudDto {
  @ApiProperty({ example: 'https://sgh-cloud-backup.yourname.workers.dev' })
  @IsString()
  @MaxLength(300)
  url: string;

  @ApiProperty({ example: 'sgh1_shaukeens-hub_…', description: 'Café key from the developer' })
  @IsString()
  @MaxLength(120)
  key: string;
}

@ApiTags('Backups')
@ApiBearerAuth()
@Controller('backups')
export class BackupsController {
  constructor(
    private readonly backups: BackupsService,
    private readonly cloud: CloudBackupService,
  ) {}

  @Get('cloud')
  @ApiOperation({ summary: 'Cloud backup connection and last upload' })
  cloudStatus() {
    return this.cloud.status();
  }

  @Put('cloud')
  @ApiOperation({ summary: 'Connect cloud backup (checks the server and key first)' })
  connectCloud(@Body() dto: ConnectCloudDto) {
    return this.cloud.connect(dto.url, dto.key);
  }

  @Delete('cloud')
  @ApiOperation({ summary: 'Stop uploading backups to the cloud' })
  disconnectCloud() {
    return this.cloud.disconnect();
  }

  @Post('cloud/upload')
  @ApiOperation({ summary: 'Upload the newest backup to the cloud now' })
  async uploadNow() {
    try {
      await this.cloud.uploadLatest();
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    return this.cloud.status();
  }

  @Get('cloud/list')
  @ApiOperation({ summary: "This café's backups in the cloud" })
  cloudList() {
    return this.cloud.list();
  }

  @Post('cloud/:file/restore')
  @ApiOperation({ summary: 'Download a cloud backup and restore it when the app next starts' })
  async restoreFromCloud(@Param('file') file: string) {
    return this.backups.requestRestore(await this.cloud.download(file));
  }

  @Get()
  @ApiOperation({ summary: 'Backup folder, last backup time and the list of backups' })
  status() {
    return this.backups.status();
  }

  @Post()
  @ApiOperation({ summary: 'Take a backup now' })
  create() {
    return this.backups.create('manual');
  }

  @Get(':file/download')
  @ApiOperation({ summary: 'Download a backup file (e.g. to send for support)' })
  download(@Param('file') file: string, @Res() res: Response) {
    res.download(this.backups.path(file), file);
  }

  @Post(':file/restore')
  @ApiOperation({ summary: 'Restore this backup when the app next starts' })
  restore(@Param('file') file: string) {
    return this.backups.requestRestore(file);
  }

  @Post('restore/cancel')
  @ApiOperation({ summary: 'Cancel a queued restore' })
  cancelRestore() {
    return this.backups.cancelRestore();
  }
}

@Module({
  controllers: [BackupsController],
  providers: [BackupsService, CloudBackupService, PrismaService],
})
export class BackupsModule {}
