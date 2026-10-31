import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.config';
import { backupDir, databasePath, parseBackupName } from './backup-files';

/**
 * Off-site copies: each local backup is gzipped, encrypted with a key derived
 * from the café key, and uploaded to the developer's Cloudflare Worker
 * (sgh-crm-backend/cloud-backup-worker). Keep the format in sync with
 * cloud-backup-worker/tools/fetch-backup.mjs, which decrypts these files.
 *
 *   "SGHB1" | 12-byte IV | 16-byte GCM tag | ciphertext of gzip(sqlite file)
 */

const MAGIC = Buffer.from('SGHB1');
const CAFE_KEY = /^sgh1_([a-z0-9][a-z0-9-]{2,39})_[A-Za-z0-9_-]{32}$/;
const SETTING = { url: 'cloud_backup_url', key: 'cloud_backup_key' } as const;
const STATE_FILE = '.cloud.json';

const encryptionKey = (cafeKey: string) => crypto.createHash('sha256').update(`sgh-backup-enc:${cafeKey}`).digest();

export function encryptBackup(plain: Buffer, cafeKey: string): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(cafeKey), iv);
  const body = Buffer.concat([cipher.update(zlib.gzipSync(plain)), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

export function decryptBackup(data: Buffer, cafeKey: string): Buffer {
  if (!data.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Not an SGH backup file');
  const iv = data.subarray(5, 17);
  const tag = data.subarray(17, 33);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(cafeKey), iv);
  decipher.setAuthTag(tag);
  return zlib.gunzipSync(Buffer.concat([decipher.update(data.subarray(33)), decipher.final()]));
}

type CloudState = {
  uploaded: string[];
  lastUpload: { file: string; at: string } | null;
  lastError: { at: string; message: string } | null;
};

export type CloudBackup = { file: string; size: number; uploadedAt: string };

@Injectable()
export class CloudBackupService {
  private readonly log = new Logger('CloudBackup');
  private readonly dir = backupDir(databasePath());
  private uploading: Promise<unknown> | null = null;

  constructor(private prisma: PrismaService) {}

  private async config(): Promise<{ url: string; key: string; cafeId: string } | null> {
    const rows = await this.prisma.systemSetting.findMany({ where: { key: { in: Object.values(SETTING) } } });
    const url = rows.find((r) => r.key === SETTING.url)?.value;
    const key = rows.find((r) => r.key === SETTING.key)?.value;
    const m = key ? CAFE_KEY.exec(key) : null;
    return url && key && m ? { url: url.replace(/\/+$/, ''), key, cafeId: m[1] } : null;
  }

  private state(): CloudState {
    try {
      return { uploaded: [], lastUpload: null, lastError: null, ...JSON.parse(fs.readFileSync(path.join(this.dir, STATE_FILE), 'utf8')) };
    } catch {
      return { uploaded: [], lastUpload: null, lastError: null };
    }
  }

  private saveState(state: CloudState) {
    fs.mkdirSync(this.dir, { recursive: true });
    // Only remember files that still exist locally, so the list can't grow forever
    const local = new Set(fs.readdirSync(this.dir));
    state.uploaded = state.uploaded.filter((f) => local.has(f));
    fs.writeFileSync(path.join(this.dir, STATE_FILE), JSON.stringify(state));
  }

  /** Files already in the cloud (for the local list's cloud tick) */
  uploadedFiles(): Set<string> {
    return new Set(this.state().uploaded);
  }

  private async request(cfg: { url: string; key: string }, pathname: string, init: RequestInit = {}) {
    let res: Response;
    try {
      res = await fetch(`${cfg.url}${pathname}`, {
        ...init,
        headers: { authorization: `Bearer ${cfg.key}`, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      throw new Error(`Could not reach the backup server (${(e as Error).message}). Check the internet connection.`);
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ? `Backup server: ${body.error}` : `Backup server answered ${res.status}`);
    }
    return res;
  }

  async status() {
    const cfg = await this.config();
    const state = this.state();
    return {
      connected: !!cfg,
      url: cfg?.url ?? null,
      cafeId: cfg?.cafeId ?? null,
      lastUpload: state.lastUpload,
      lastError: state.lastError,
    };
  }

  /** Saves the server URL and café key after checking they work. */
  async connect(url: string, key: string) {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/\S+$/.test(cleanUrl)) throw new BadRequestException('Enter the backup server address, starting with https://');
    if (!CAFE_KEY.test(key.trim())) throw new BadRequestException('That café key does not look right. It starts with sgh1_');
    try {
      await this.request({ url: cleanUrl, key: key.trim() }, '/v1/backups');
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    for (const [k, value] of [
      [SETTING.url, cleanUrl],
      [SETTING.key, key.trim()],
    ]) {
      await this.prisma.systemSetting.upsert({ where: { key: k }, create: { key: k, value, category: 'backup' }, update: { value } });
    }
    this.saveState({ ...this.state(), lastError: null });
    this.uploadLatest().catch(() => {});
    return this.status();
  }

  async disconnect() {
    await this.prisma.systemSetting.deleteMany({ where: { key: { in: Object.values(SETTING) } } });
    return this.status();
  }

  /**
   * Uploads the newest local backup if it isn't in the cloud yet. Called after
   * each backup and every 30 minutes, so a failed upload is retried.
   */
  uploadLatest(): Promise<unknown> {
    this.uploading ??= this.doUpload().finally(() => {
      this.uploading = null;
    });
    return this.uploading;
  }

  private async doUpload() {
    const cfg = await this.config();
    if (!cfg || !fs.existsSync(this.dir)) return null;
    const newest = fs
      .readdirSync(this.dir)
      .filter((f) => parseBackupName(f))
      .sort((a, b) => parseBackupName(b)!.createdAt.getTime() - parseBackupName(a)!.createdAt.getTime())[0];
    const state = this.state();
    if (!newest || state.uploaded.includes(newest)) return null;

    try {
      const body = encryptBackup(fs.readFileSync(path.join(this.dir, newest)), cfg.key);
      await this.request(cfg, `/v1/backups/${encodeURIComponent(`${newest}.enc`)}`, {
        method: 'PUT',
        body: new Uint8Array(body),
        headers: { 'content-type': 'application/octet-stream', 'content-length': String(body.length) },
      });
      state.uploaded.push(newest);
      state.lastUpload = { file: newest, at: new Date().toISOString() };
      state.lastError = null;
      this.saveState(state);
      this.log.log(`Uploaded ${newest} (${body.length} bytes)`);
      return state.lastUpload;
    } catch (e) {
      state.lastError = { at: new Date().toISOString(), message: (e as Error).message };
      this.saveState(state);
      this.log.warn(`Upload failed: ${(e as Error).message}`);
      throw e;
    }
  }

  async list(): Promise<CloudBackup[]> {
    const cfg = await this.config();
    if (!cfg) throw new BadRequestException('Cloud backup is not connected');
    const res = await this.request(cfg, '/v1/backups').catch((e) => {
      throw new BadRequestException((e as Error).message);
    });
    const { backups } = (await res.json()) as { backups: CloudBackup[] };
    return backups.map((b) => ({ ...b, file: b.file.replace(/\.enc$/, '') }));
  }

  /**
   * Downloads and decrypts a cloud backup into the local backups folder (under
   * its original name) so it can be restored like any local copy.
   */
  async download(file: string): Promise<string> {
    if (!parseBackupName(file)) throw new BadRequestException('Not a backup file');
    const cfg = await this.config();
    if (!cfg) throw new BadRequestException('Cloud backup is not connected');
    const target = path.join(this.dir, file);
    if (fs.existsSync(target)) return file;
    const res = await this.request(cfg, `/v1/backups/${encodeURIComponent(`${file}.enc`)}`).catch((e) => {
      throw new BadRequestException((e as Error).message);
    });
    let plain: Buffer;
    try {
      plain = decryptBackup(Buffer.from(await res.arrayBuffer()), cfg.key);
    } catch {
      throw new BadRequestException('This backup could not be unlocked with this café key');
    }
    if (!plain.subarray(0, 15).equals(Buffer.from('SQLite format 3'))) throw new BadRequestException('Downloaded file is not a database');
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(target, plain);
    const state = this.state();
    state.uploaded.push(file);
    this.saveState(state);
    return file;
  }
}
