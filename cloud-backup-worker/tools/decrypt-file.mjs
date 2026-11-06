#!/usr/bin/env node
// Decrypts a backup file you already downloaded (e.g. from the R2 dashboard).
//   node tools/decrypt-file.mjs <file.sqlite.enc> [cafe-id]
// The café id is read from the file name when it starts with "<cafe-id>_" or
// "<cafe-id>-sgh-backup". SIGNING_SECRET is taken from the environment, or
// asked for without echoing it (so it stays out of your shell history).
import { createDecipheriv, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { gunzipSync } from 'node:zlib';
import { cafeKeyFor } from '../src/worker.js';

const [file, cafeArg] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node tools/decrypt-file.mjs <file.sqlite.enc> [cafe-id]');
  process.exit(1);
}
const name = basename(file);
const cafeId = cafeArg ?? /^([a-z0-9][a-z0-9-]{2,39})(?:_|-(?=sgh-backup))/.exec(name)?.[1];
if (!cafeId) {
  console.error('Could not tell the café id from the file name; pass it as the second argument.');
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => rl.output.write(s.startsWith(question) ? s : '');
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

// Either secret works: backups are locked with the café key, which SIGNING_SECRET re-creates
const secret = process.env.SIGNING_SECRET || (await askHidden('SIGNING_SECRET or café key (sgh1_…): '));
const data = readFileSync(file);
if (data.subarray(0, 5).toString() !== 'SGHB1') {
  console.error('This is not an SGH cloud backup file.');
  process.exit(1);
}
const cafeKey = secret.startsWith('sgh1_') ? secret : await cafeKeyFor(cafeId, secret);
const key = createHash('sha256').update(`sgh-backup-enc:${cafeKey}`).digest();
let sqlite;
try {
  const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(5, 17));
  decipher.setAuthTag(data.subarray(17, 33));
  sqlite = gunzipSync(Buffer.concat([decipher.update(data.subarray(33)), decipher.final()]));
} catch {
  console.error(`Could not decrypt: wrong SIGNING_SECRET, or the file is not from café "${cafeId}".`);
  process.exit(1);
}
const out = join(dirname(file), name.replace(/\.enc$/, ''));
writeFileSync(out, sqlite);
console.log(`Saved ${out} (${Math.round(sqlite.length / 1024)} KB)`);
