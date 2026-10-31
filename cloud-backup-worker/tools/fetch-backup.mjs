#!/usr/bin/env node
// Developer tool: list cafés, list a café's backups, or download one and decrypt
// it to a .sqlite file you can open (or run the CRM against) for support.
//
//   export SGH_BACKUP_URL=https://sgh-cloud-backup.<you>.workers.dev
//   export ADMIN_TOKEN=...  SIGNING_SECRET=...
//   node tools/fetch-backup.mjs                       # cafés and their latest backup
//   node tools/fetch-backup.mjs shaukeens-hub         # that café's backups
//   node tools/fetch-backup.mjs shaukeens-hub latest  # download + decrypt the newest
//   node tools/fetch-backup.mjs shaukeens-hub <file>  # a specific one
//
// The file format matches sgh-crm-backend/src/modules/backups/cloud-backup.ts.
import { createDecipheriv, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { cafeKeyFor } from '../src/worker.js';

const { SGH_BACKUP_URL, ADMIN_TOKEN, SIGNING_SECRET } = process.env;
if (!SGH_BACKUP_URL || !ADMIN_TOKEN) {
  console.error('Set SGH_BACKUP_URL and ADMIN_TOKEN (and SIGNING_SECRET to decrypt).');
  process.exit(1);
}
const base = SGH_BACKUP_URL.replace(/\/+$/, '');
const get = async (path) => {
  const res = await fetch(base + path, { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res;
};
const kb = (n) => `${Math.round(n / 1024)} KB`;

const [cafeId, which] = process.argv.slice(2);
if (!cafeId) {
  const { cafes } = await (await get('/v1/admin/cafes')).json();
  if (!cafes.length) console.log('No backups uploaded yet.');
  for (const c of cafes) console.log(`${c.cafeId.padEnd(28)} ${String(c.backups).padStart(4)} backups   latest: ${c.latest?.file ?? '-'} (${c.latest?.uploadedAt ?? ''})`);
  process.exit(0);
}

const { backups } = await (await get(`/v1/admin/cafes/${cafeId}/backups`)).json();
if (!which) {
  for (const b of backups) console.log(`${b.file.padEnd(52)} ${kb(b.size).padStart(8)}   uploaded ${b.uploadedAt}`);
  process.exit(0);
}

const file = which === 'latest' ? backups[0]?.file : which.endsWith('.enc') ? which : `${which}.enc`;
if (!file || !backups.some((b) => b.file === file)) {
  console.error(`No such backup for ${cafeId}.`);
  process.exit(1);
}
if (!SIGNING_SECRET) {
  console.error('Set SIGNING_SECRET to decrypt.');
  process.exit(1);
}
const data = Buffer.from(await (await get(`/v1/admin/cafes/${cafeId}/backups/${encodeURIComponent(file)}`)).arrayBuffer());
if (data.subarray(0, 5).toString() !== 'SGHB1') throw new Error('Not an SGH backup file');
const key = createHash('sha256').update(`sgh-backup-enc:${await cafeKeyFor(cafeId, SIGNING_SECRET)}`).digest();
const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(5, 17));
decipher.setAuthTag(data.subarray(17, 33));
const sqlite = gunzipSync(Buffer.concat([decipher.update(data.subarray(33)), decipher.final()]));
const out = `${cafeId}-${file.replace(/\.enc$/, '')}`;
writeFileSync(out, sqlite);
console.log(`Saved ${out} (${kb(sqlite.length)}). Open it with any SQLite viewer, or run the backend with DATABASE_URL="file:$PWD/${out}".`);
