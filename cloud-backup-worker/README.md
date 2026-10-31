# SGH CRM cloud backups

A small Cloudflare Worker that keeps an encrypted copy of each café's database in
Cloudflare R2. The desktop app uploads after every local backup (every 4 hours
while it runs). You, the developer, can download any café's backup for support.
The café can restore from it on a new PC.

- **Storage:** about 150 KB per backup after compression. The R2 free tier
  (10 GB, free downloads) covers hundreds of cafés.
- **What's kept in the cloud, per café:** every upload from the last 2 days, then
  one per day for 60 days.
- **Privacy:** files are encrypted in the café's app before upload (AES-256-GCM).
  Cloudflare only stores ciphertext.

## One-time setup (about 10 minutes)

You need Node.js and a free Cloudflare account (https://dash.cloudflare.com/sign-up).
To turn on R2, Cloudflare asks for a card. Nothing is charged under the free limits.

```bash
cd sgh-crm-backend/cloud-backup-worker

# 1. Log in (opens the browser)
npx wrangler@3 login

# 2. In the dashboard: R2 Object Storage → Purchase / enable R2 (free plan). Then:
npx wrangler@3 r2 bucket create sgh-backups

# 3. Two secrets. Paste a long random value for each, e.g. from:
#    node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
npx wrangler@3 secret put SIGNING_SECRET   # signs café keys AND unlocks their backups
npx wrangler@3 secret put ADMIN_TOKEN      # your token for the admin routes

# 4. Deploy. It prints the address, e.g. https://sgh-cloud-backup.<you>.workers.dev
npx wrangler@3 deploy
```

Save `SIGNING_SECRET` and `ADMIN_TOKEN` in your password manager.

> If you lose `SIGNING_SECRET`, every café key stops working and existing cloud
> backups can no longer be decrypted. If it leaks, someone could read every café's
> backups. In that case, set a new one, deploy, and give every café a new key.

## Connect a café

1. Pick an id for the café: lowercase letters, digits and dashes (e.g. `shaukeens-hub`).
2. Make its key:

   ```bash
   SIGNING_SECRET=... node tools/cafe-key.mjs shaukeens-hub
   ```

   The command prints `sgh1_shaukeens-hub_…`.
3. On the café PC, open **Settings → Backups → Cloud copy is off → Set up**.
   Paste the Worker address and the café key, then press **Connect**.
   The app checks both and uploads the newest backup straight away.

To block a café's key, add its id to `REVOKED_CAFES` under `[vars]` in
`wrangler.toml` and run `npx wrangler@3 deploy`.

## Look at a café's data (support)

```bash
export SGH_BACKUP_URL=https://sgh-cloud-backup.<you>.workers.dev
export ADMIN_TOKEN=...  SIGNING_SECRET=...

node tools/fetch-backup.mjs                       # cafés and their latest upload
node tools/fetch-backup.mjs shaukeens-hub         # that café's backups
node tools/fetch-backup.mjs shaukeens-hub latest  # download + decrypt the newest
```

The last command saves `shaukeens-hub-sgh-backup-….sqlite`. You can open it in any
SQLite viewer, or run the CRM against it:

```bash
cd ../ && DATABASE_URL="file:$PWD/cloud-backup-worker/shaukeens-hub-sgh-backup-….sqlite" npm run start:dev
```

## Restore a café on a new PC

1. Install the app.
2. In **Settings → Backups**, connect with the same café key.
3. Press **Restore from cloud** and pick a backup. The app downloads and decrypts
   it, keeps the current data as a backup, and restarts with the restored data.
