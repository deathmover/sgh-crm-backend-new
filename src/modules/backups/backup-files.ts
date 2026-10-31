import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Backup file layout, shared by the backups service and the startup restore.
 * sgh-crm-electron/electron/server-manager.ts applies a pending restore with the
 * same rules before the database opens; keep the two in sync.
 *
 *   <database folder>/backups/sgh-backup-2026-10-31_14-05-09-auto.sqlite
 *   <database folder>/backups/sgh-backup-2026-10-31_14-05-09-auto.json   (counts)
 *   <database folder>/backups/restore-pending.json                         ({ file })
 */

export const BACKUP_KINDS = ['auto', 'manual', 'pre-update', 'pre-restore'] as const;
export type BackupKind = (typeof BACKUP_KINDS)[number];

const NAME = /^sgh-backup-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:-\d+)?-(auto|manual|pre-update|pre-restore)\.sqlite$/;
export const PENDING_RESTORE = 'restore-pending.json';

/** Absolute path of the SQLite file behind DATABASE_URL (relative URLs are relative to prisma/). */
export function databasePath(url = process.env.DATABASE_URL ?? ''): string {
  const file = url.replace(/^file:/, '').split('?')[0];
  return path.isAbsolute(file) ? file : path.resolve(process.cwd(), 'prisma', file);
}

export function backupDir(dbPath = databasePath()): string {
  return process.env.BACKUP_DIR || path.join(path.dirname(dbPath), 'backups');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A new, unused backup file name stamped with local time. */
export function newBackupName(dir: string, kind: BackupKind, at = new Date()): string {
  const stamp = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}_${pad(at.getHours())}-${pad(at.getMinutes())}-${pad(at.getSeconds())}`;
  let name = `sgh-backup-${stamp}-${kind}.sqlite`;
  for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `sgh-backup-${stamp}-${i}-${kind}.sqlite`;
  return name;
}

export function parseBackupName(name: string): { createdAt: Date; kind: BackupKind } | null {
  const m = NAME.exec(name);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, kind] = m;
  return { createdAt: new Date(+y, +mo - 1, +d, +h, +mi, +s), kind: kind as BackupKind };
}

/** Removes the SQLite side files so a swapped-in database isn't mixed with the old journal. */
function removeSideFiles(dbPath: string) {
  for (const suffix of ['-journal', '-wal', '-shm']) fs.rmSync(dbPath + suffix, { force: true });
}

/**
 * Swaps in the backup chosen in Settings. Must run before anything opens the
 * database. The current data is kept as a "pre-restore" backup first.
 */
export function applyPendingRestore(dbPath: string, dir = backupDir(dbPath), log: (msg: string) => void = () => {}) {
  const pendingPath = path.join(dir, PENDING_RESTORE);
  if (!fs.existsSync(pendingPath)) return false;
  try {
    const { file } = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) as { file?: string };
    const source = file && parseBackupName(file) ? path.join(dir, file) : null;
    if (!source || !fs.existsSync(source)) {
      log(`Pending restore ignored: backup ${file} not found`);
      return false;
    }
    if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, path.join(dir, newBackupName(dir, 'pre-restore')));
    removeSideFiles(dbPath);
    fs.copyFileSync(source, dbPath);
    log(`Restored database from ${file}`);
    return true;
  } finally {
    // One attempt only: a broken request must not block every start
    fs.rmSync(pendingPath, { force: true });
  }
}
