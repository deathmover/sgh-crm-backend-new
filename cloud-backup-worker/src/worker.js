/**
 * SGH CRM cloud backups: a Cloudflare Worker in front of an R2 bucket.
 *
 * Each café has its own key, `sgh1_<cafeId>_<signature>`. The signature is an
 * HMAC of the café id with SIGNING_SECRET, so keys need no database and the
 * developer can always re-create one. A café key can only upload, list and
 * download that café's own backups. ADMIN_TOKEN (the developer) can see all.
 *
 * Backups arrive already encrypted by the app (AES-256-GCM, key derived from
 * the café key), so R2 only ever stores ciphertext.
 *
 * Café routes (Authorization: Bearer <café key>)
 *   GET  /v1/backups              list this café's backups
 *   PUT  /v1/backups/:file        upload one (then old ones are thinned out)
 *   GET  /v1/backups/:file        download one
 * Admin routes (Authorization: Bearer <ADMIN_TOKEN>)
 *   GET  /v1/admin/cafes                         cafés with backups
 *   GET  /v1/admin/cafes/:cafe/backups           list
 *   GET  /v1/admin/cafes/:cafe/backups/:file     download
 *   POST /v1/admin/keys  { "cafeId": "..." }     create a café key
 */

const CAFE_ID = /^[a-z0-9][a-z0-9-]{2,39}$/;
const FILE = /^sgh-backup-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:-\d+)?-[a-z-]+\.sqlite\.enc$/;
const MAX_BYTES = 50 * 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const fail = (status, message) => json({ error: message }, status);

const encoder = new TextEncoder();
const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function signature(cafeId, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`sgh-cafe:${cafeId}`));
  return b64url(mac).slice(0, 32);
}

export async function cafeKeyFor(cafeId, secret) {
  return `sgh1_${cafeId}_${await signature(cafeId, secret)}`;
}

/** Constant-time string comparison */
function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function cafeFromKey(token, env) {
  const m = /^sgh1_([a-z0-9-]+)_([A-Za-z0-9_-]{32})$/.exec(token || '');
  if (!m || !CAFE_ID.test(m[1])) return null;
  if (!same(m[2], await signature(m[1], env.SIGNING_SECRET))) return null;
  const revoked = (env.REVOKED_CAFES || '').split(',').map((s) => s.trim());
  return revoked.includes(m[1]) ? null : m[1];
}

async function list(env, prefix) {
  const objects = [];
  let cursor;
  do {
    const page = await env.BACKUPS.list({ prefix, cursor });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects
    .map((o) => ({ file: o.key.slice(prefix.length), size: o.size, uploadedAt: o.uploaded.toISOString() }))
    .filter((o) => FILE.test(o.file))
    .sort((a, b) => b.file.localeCompare(a.file));
}

function takenAt(file) {
  const [, y, mo, d, h, mi, s] = FILE.exec(file);
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s); // local café time; only used for spacing
}

/** Keep everything from the last 2 days, then the newest per day for 60 days. */
async function prune(env, cafeId) {
  const prefix = `${cafeId}/`;
  const all = await list(env, prefix);
  const newest = all.length ? takenAt(all[0].file) : 0;
  const days = new Set();
  const doomed = [];
  for (const b of all) {
    const t = takenAt(b.file);
    const age = newest - t;
    if (age < 2 * DAY) continue;
    const day = Math.floor(t / DAY);
    if (age < 60 * DAY && !days.has(day)) days.add(day);
    else doomed.push(prefix + b.file);
  }
  if (doomed.length) await env.BACKUPS.delete(doomed);
  return doomed.length;
}

async function download(env, key) {
  const obj = await env.BACKUPS.get(key);
  if (!obj) return fail(404, 'Backup not found');
  return new Response(obj.body, {
    headers: { 'content-type': 'application/octet-stream', 'content-length': String(obj.size) },
  });
}

export default {
  async fetch(request, env) {
    if (!env.SIGNING_SECRET || !env.ADMIN_TOKEN || !env.BACKUPS) return fail(500, 'Worker is not configured');
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

    if (parts.length === 0) return json({ service: 'sgh-cloud-backup', ok: true });
    if (parts[0] !== 'v1') return fail(404, 'Not found');

    // ── Developer ──
    if (parts[1] === 'admin') {
      if (!same(token, env.ADMIN_TOKEN)) return fail(401, 'Admin token required');
      if (request.method === 'POST' && parts[2] === 'keys' && parts.length === 3) {
        const { cafeId } = await request.json().catch(() => ({}));
        if (!CAFE_ID.test(cafeId || '')) return fail(400, 'cafeId: 3–40 lowercase letters, digits or dashes');
        return json({ cafeId, cafeKey: await cafeKeyFor(cafeId, env.SIGNING_SECRET) });
      }
      if (request.method === 'GET' && parts[2] === 'cafes') {
        if (parts.length === 3) {
          const page = await env.BACKUPS.list({ delimiter: '/' });
          const cafes = [];
          for (const p of page.delimitedPrefixes) {
            const backups = await list(env, p);
            cafes.push({ cafeId: p.slice(0, -1), backups: backups.length, latest: backups[0] ?? null });
          }
          return json({ cafes });
        }
        const cafeId = parts[3];
        if (!CAFE_ID.test(cafeId) || parts[4] !== 'backups') return fail(404, 'Not found');
        if (parts.length === 5) return json({ cafeId, backups: await list(env, `${cafeId}/`) });
        if (parts.length === 6 && FILE.test(parts[5])) return download(env, `${cafeId}/${parts[5]}`);
      }
      return fail(404, 'Not found');
    }

    // ── Café ──
    if (parts[1] !== 'backups') return fail(404, 'Not found');
    const cafeId = await cafeFromKey(token, env);
    if (!cafeId) return fail(401, 'Invalid café key');
    const prefix = `${cafeId}/`;

    if (parts.length === 2 && request.method === 'GET') return json({ cafeId, backups: await list(env, prefix) });
    if (parts.length !== 3 || !FILE.test(parts[2])) return fail(400, 'Not a backup file name');
    const key = prefix + parts[2];

    if (request.method === 'GET') return download(env, key);
    if (request.method === 'PUT') {
      const size = Number(request.headers.get('content-length') || 0);
      if (!size) return fail(411, 'Content-Length required');
      if (size > MAX_BYTES) return fail(413, 'Backup too large');
      await env.BACKUPS.put(key, request.body, { customMetadata: { cafeId } });
      const removed = await prune(env, cafeId);
      return json({ ok: true, cafeId, file: parts[2], size, removed });
    }
    return fail(405, 'Method not allowed');
  },
};
