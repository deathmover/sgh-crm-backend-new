# SGH CRM - Self-Hosting Guide (Windows)

Complete guide to host SGH CRM on a Windows machine at your shop with zero hosting costs.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Part 1: Install Required Software](#part-1-install-required-software)
- [Part 2: Setup Database](#part-2-setup-database)
- [Part 3: Setup Backend](#part-3-setup-backend)
- [Part 4: Setup Frontend](#part-4-setup-frontend)
- [Part 5: Expose to Internet (Cloudflare Tunnel)](#part-5-expose-to-internet-cloudflare-tunnel)
- [Part 6: Operating Modes](#part-6-operating-modes)
- [Part 7: Monitoring & Maintenance](#part-7-monitoring--maintenance)
- [Part 8: Backup Strategy](#part-8-backup-strategy)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Windows 10/11 computer
- Stable internet connection
- Administrative access to the computer
- At least 4GB RAM and 20GB free disk space

---

## Part 1: Install Required Software

### Step 1: Install Node.js

1. Download Node.js LTS from: https://nodejs.org/
2. Run the installer (.msi file)
3. During installation, check **"Automatically install necessary tools"**
4. Complete the installation wizard
5. Open **Command Prompt** and verify:
   ```bash
   node --version
   npm --version
   ```

### Step 2: Install PostgreSQL

1. Download PostgreSQL 15 from: https://www.postgresql.org/download/windows/
2. Run the installer
3. During installation:
   - **Password**: Set a strong password for `postgres` user (save this!)
   - **Port**: 5432 (default)
   - **Components**: Check "pgAdmin 4"
4. Verify installation:
   ```bash
   psql --version
   ```

### Step 3: Install Git

1. Download from: https://git-scm.com/download/win
2. Run installer with default options
3. Verify:
   ```bash
   git --version
   ```

### Step 4: Install PM2 (Process Manager)

Open **Command Prompt as Administrator**:

```bash
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
```

---

## Part 2: Setup Database

### Option A: Using pgAdmin (GUI)

1. Open **pgAdmin 4**
2. Connect to PostgreSQL (enter your password)
3. Right-click **"Databases"** → **"Create"** → **"Database"**
4. Name: `sgh_crm`
5. Click **"Save"**

### Option B: Using Command Line

```bash
psql -U postgres
```
Enter password, then:
```sql
CREATE DATABASE sgh_crm;
\q
```

---

## Part 3: Setup Backend

### Step 1: Clone Repository

Open **Command Prompt**:

```bash
cd C:\
mkdir Projects
cd Projects
git clone <your-backend-repo-url> sgh-crm-backend
cd sgh-crm-backend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Create Environment File

Create file: `C:\Projects\sgh-crm-backend\.env`

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/sgh_crm"
PORT=3001
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string
```

**Replace:**
- `YOUR_PASSWORD` → Your PostgreSQL password
- `your-super-secret-jwt-key-change-this-to-random-string` → Generate random string

### Step 4: Run Database Migrations

```bash
npx prisma generate
npx prisma db push
```

### Step 5: Build Backend

```bash
npm run build
```

### Step 6: Start Backend with PM2

```bash
pm2 start npm --name "sgh-crm-backend" -- run start:prod
pm2 save
```

Verify:
```bash
pm2 status
pm2 logs sgh-crm-backend
```

---

## Part 4: Setup Frontend

### Step 1: Clone Repository

```bash
cd C:\Projects
git clone <your-frontend-repo-url> sgh-crm-frontend
cd sgh-crm-frontend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Create Environment File

Create file: `C:\Projects\sgh-crm-frontend\.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Step 4: Build Frontend

```bash
npm run build
```

### Step 5: Start Frontend with PM2

```bash
pm2 start npm --name "sgh-crm-frontend" -- start
pm2 save
```

Verify both apps are running:
```bash
pm2 status
```

### Step 6: Test Locally

Open browser on Windows machine:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

---

## Part 5: Expose to Internet (Cloudflare Tunnel)

Access your CRM from anywhere without port forwarding or exposing your IP.

### Step 1: Install Cloudflare Tunnel

1. Download: https://github.com/cloudflare/cloudflared/releases
2. Download `cloudflared-windows-amd64.exe`
3. Rename to `cloudflared.exe`
4. Move to `C:\Program Files\cloudflared\`
5. Add to PATH:
   - Search **"Environment Variables"** in Windows Start Menu
   - Edit **"Path"** system variable
   - Click **"New"** → Add `C:\Program Files\cloudflared\`
   - Click **OK**

### Step 2: Login to Cloudflare

```bash
cloudflared tunnel login
```

Browser opens → Login with Cloudflare account (create free account if needed)

### Step 3: Create Tunnel

```bash
cloudflared tunnel create sgh-crm
```

**Copy the Tunnel ID shown** (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### Step 4: Create Tunnel Configuration

Create file: `C:\Program Files\cloudflared\config.yml`

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: C:\Users\YOUR_USERNAME\.cloudflared\YOUR_TUNNEL_ID.json

ingress:
  - hostname: sgh-crm.yourdomain.com
    service: http://localhost:3000
  - hostname: api.sgh-crm.yourdomain.com
    service: http://localhost:3001
  - service: http_status:404
```

**Replace:**
- `YOUR_TUNNEL_ID` → Your tunnel ID from Step 3
- `YOUR_USERNAME` → Your Windows username (e.g., `Admin`, `YourName`)
- `yourdomain.com` → Your domain name

**Don't have a domain?** Use Cloudflare's free subdomain:
```yaml
  - hostname: sgh-crm-abc123.trycloudflare.com
    service: http://localhost:3000
  - hostname: api-sgh-crm-abc123.trycloudflare.com
    service: http://localhost:3001
```

### Step 5: Setup DNS

**If you have a domain:**
```bash
cloudflared tunnel route dns sgh-crm sgh-crm.yourdomain.com
cloudflared tunnel route dns sgh-crm api.sgh-crm.yourdomain.com
```

**Using Cloudflare's free domain:**
```bash
cloudflared tunnel route dns sgh-crm sgh-crm-abc123.trycloudflare.com
cloudflared tunnel route dns sgh-crm api-sgh-crm-abc123.trycloudflare.com
```

### Step 6: Run Tunnel as Windows Service

```bash
cloudflared service install
sc start cloudflared
sc config cloudflared start=auto
```

### Step 7: Update Frontend for Remote Access

Edit `C:\Projects\sgh-crm-frontend\.env.local`:

```env
NEXT_PUBLIC_API_URL=https://api.sgh-crm.yourdomain.com
```

Rebuild and restart:
```bash
cd C:\Projects\sgh-crm-frontend
npm run build
pm2 restart sgh-crm-frontend
```

**Test remote access:**
- Open browser on phone/another computer
- Visit: `https://sgh-crm.yourdomain.com`

---

## Part 6: Operating Modes

Choose the mode that fits your business needs.

### Mode 1: 24/7 Always Running

**Best for:**
- Auto-end sessions feature (cron jobs)
- Remote access anytime
- Multiple locations/staff

**Setup:** Already done! Apps auto-start on boot.

**Pros:**
- Always accessible
- Cron jobs work automatically
- No manual intervention

**Cons:**
- Higher electricity cost (~$5-10/month)
- More hardware wear

**Commands:**
```bash
# Check status
pm2 status

# View logs
pm2 logs
```

---

### Mode 2: Business Hours Only (Recommended)

**Best for:**
- Single location cafe
- Fixed operating hours
- Cost savings

**Setup:** Auto-start/stop using Task Scheduler

#### Create Batch Files:

**File: `C:\Projects\start-crm.bat`**
```batch
@echo off
pm2 start all
echo SGH CRM Started - %date% %time% >> C:\Projects\crm-log.txt
```

**File: `C:\Projects\stop-crm.bat`**
```batch
@echo off
pm2 stop all
echo SGH CRM Stopped - %date% %time% >> C:\Projects\crm-log.txt
```

#### Schedule with Task Scheduler:

1. Open **Task Scheduler** (search in Start Menu)

**Task 1 - Auto Start:**
2. Click **"Create Basic Task"**
3. Name: `SGH CRM Auto Start`
4. Trigger: **Daily**
5. Time: `9:30 AM` (30 min before opening)
6. Action: **Start a program**
7. Program: `C:\Projects\start-crm.bat`
8. Finish

**Task 2 - Auto Stop:**
9. Create another task: `SGH CRM Auto Stop`
10. Trigger: **Daily**
11. Time: `10:30 PM` (30 min after closing)
12. Program: `C:\Projects\stop-crm.bat`

**Pros:**
- ~65% electricity savings (~$2-4/month)
- Automatic operation
- Remote access during business hours

**Cons:**
- Not accessible outside business hours
- Cron jobs only run during operating hours

---

### Mode 3: On-Demand (Manual Start/Stop)

**Best for:**
- Occasional use
- Maximum cost savings
- Testing/demo setups

**Commands:**

**Start when needed:**
```bash
pm2 start all
```

**Stop when done:**
```bash
pm2 stop all
```

**Check status:**
```bash
pm2 status
```

**Pros:**
- Minimum electricity usage
- Full control
- ~80% cost savings

**Cons:**
- Manual intervention required
- No auto-end sessions
- Must remember to start/stop

---

### Mode Comparison:

| Feature | 24/7 | Business Hours | On-Demand |
|---------|------|----------------|-----------|
| **Cost/month** | $5-10 | $2-4 | $1-2 |
| **Auto-start** | ✅ | ✅ | ❌ |
| **Remote access** | Always | Business hours | When running |
| **Cron jobs** | ✅ | During hours | When running |
| **Setup effort** | Low | Medium | Low |
| **Best for** | Multi-location | Single cafe | Testing |

---

## Part 7: Monitoring & Maintenance

### Check App Status

```bash
pm2 status
```

### View Real-time Logs

```bash
pm2 logs

# Or specific app
pm2 logs sgh-crm-backend
pm2 logs sgh-crm-frontend

# Last 100 lines
pm2 logs sgh-crm-backend --lines 100
```

### Monitor Resources

```bash
pm2 monit
```

### Restart Apps

```bash
# Restart all
pm2 restart all

# Restart specific app
pm2 restart sgh-crm-backend
pm2 restart sgh-crm-frontend
```

### Update Application

**Backend Update:**
```bash
cd C:\Projects\sgh-crm-backend
git pull
npm install
npm run build
npx prisma db push
pm2 restart sgh-crm-backend
```

**Frontend Update:**
```bash
cd C:\Projects\sgh-crm-frontend
git pull
npm install
npm run build
pm2 restart sgh-crm-frontend
```

---

## Part 8: Backup Strategy

### Automated Database Backup

**Create file: `C:\Projects\backup-db.bat`**

```batch
@echo off
set PGPASSWORD=YOUR_POSTGRES_PASSWORD
set BACKUP_DIR=C:\Projects\backups
set DATE=%date:~-4,4%%date:~-10,2%%date:~-7,2%

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

"C:\Program Files\PostgreSQL\15\bin\pg_dump" -U postgres -d sgh_crm > "%BACKUP_DIR%\sgh_crm_%DATE%.sql"

echo Backup completed: %BACKUP_DIR%\sgh_crm_%DATE%.sql >> C:\Projects\backup-log.txt
```

**Replace:** `YOUR_POSTGRES_PASSWORD` with your actual password

### Schedule Daily Backups

1. Open **Task Scheduler**
2. **Create Basic Task**
3. Name: `SGH CRM DB Backup`
4. Trigger: **Daily** at `2:00 AM`
5. Action: **Start a program**
6. Program: `C:\Projects\backup-db.bat`
7. Finish

### Restore from Backup

```bash
psql -U postgres -d sgh_crm < C:\Projects\backups\sgh_crm_20250104.sql
```

### Backup Retention

Delete backups older than 30 days:

**Create file: `C:\Projects\cleanup-backups.bat`**

```batch
@echo off
forfiles /p "C:\Projects\backups" /s /m *.sql /d -30 /c "cmd /c del @path"
echo Old backups deleted - %date% >> C:\Projects\backup-log.txt
```

Schedule this weekly.

---

## Windows Configuration

### Disable Sleep Mode

1. **Settings** → **System** → **Power & Sleep**
2. Set **"When plugged in, PC goes to sleep after"** → **Never**
3. Click **"Additional power settings"**
4. **Change plan settings** → **"Put the computer to sleep"** → **Never**
5. Save changes

### Configure Firewall

Allow Node.js through Windows Firewall:

1. **Windows Defender Firewall** → **Advanced Settings**
2. **Inbound Rules** → **New Rule**
3. **Program** → Browse to Node.js: `C:\Program Files\nodejs\node.exe`
4. **Allow the connection**
5. Apply to: **Domain, Private, Public**
6. Name: `Node.js - SGH CRM`
7. Finish

### Auto-Login (Optional, for dedicated machine)

1. Press `Win + R` → Type `netplwiz` → Enter
2. Uncheck **"Users must enter a username and password to use this computer"**
3. Click **OK** → Enter your password
4. Restart to test

---

## Security Recommendations

1. ✅ **Use strong PostgreSQL password** (at least 16 characters)
2. ✅ **Keep Windows updated** (enable automatic updates)
3. ✅ **Enable Windows Defender** (built-in antivirus)
4. ✅ **Use Cloudflare Tunnel** (never expose ports directly)
5. ✅ **Regular backups** (automated daily)
6. ✅ **UPS (Uninterruptible Power Supply)** - Recommended for shop
7. ✅ **Lock the computer** when not in use (Win + L)
8. ✅ **Change default passwords** (PostgreSQL, Windows user)

---

## Troubleshooting

### Apps won't start after reboot

```bash
pm2 resurrect
pm2 save
```

If still not working:
```bash
pm2 startup
pm2 save
```

### Port already in use

Check what's using the port:
```bash
netstat -ano | findstr :3000
netstat -ano | findstr :3001
```

Kill the process:
```bash
taskkill /PID <PID_NUMBER> /F
```

### PostgreSQL connection refused

Check if PostgreSQL service is running:
```bash
sc query postgresql-x64-15
```

Start if stopped:
```bash
sc start postgresql-x64-15
```

Set to auto-start:
```bash
sc config postgresql-x64-15 start=auto
```

### Cloudflare Tunnel not working

Check tunnel status:
```bash
sc query cloudflared
```

Restart tunnel:
```bash
sc stop cloudflared
sc start cloudflared
```

View tunnel logs:
```bash
cloudflared tunnel info sgh-crm
```

### PM2 commands not found

Re-add to PATH or use full path:
```bash
C:\Users\YOUR_USERNAME\AppData\Roaming\npm\pm2 status
```

Or reinstall:
```bash
npm install -g pm2
```

### Database migration errors

Reset migrations (⚠️ WARNING: This deletes data):
```bash
cd C:\Projects\sgh-crm-backend
npx prisma migrate reset
```

Or push schema directly:
```bash
npx prisma db push --force-reset
```

### Frontend shows "API connection error"

1. Check if backend is running: `pm2 status`
2. Check backend logs: `pm2 logs sgh-crm-backend`
3. Verify `.env.local` has correct API URL
4. Restart frontend: `pm2 restart sgh-crm-frontend`

---

## Cost Breakdown

| Item | Cost |
|------|------|
| Windows Computer | Already owned |
| Electricity (24/7) | $5-10/month |
| Electricity (Business hours) | $2-4/month |
| Electricity (On-demand) | $1-2/month |
| Internet | Already have |
| Cloudflare Tunnel | **FREE** |
| Domain (optional) | $10-15/year |
| UPS (optional) | $50-100 one-time |

**Total recurring cost: $1-10/month** (depending on operating mode)

---

## Quick Reference Commands

### Daily Operations

```bash
# Start all apps
pm2 start all

# Stop all apps
pm2 stop all

# Restart all apps
pm2 restart all

# Check status
pm2 status

# View logs
pm2 logs

# Monitor resources
pm2 monit
```

### Maintenance

```bash
# Update backend
cd C:\Projects\sgh-crm-backend && git pull && npm install && npm run build && npx prisma db push && pm2 restart sgh-crm-backend

# Update frontend
cd C:\Projects\sgh-crm-frontend && git pull && npm install && npm run build && pm2 restart sgh-crm-frontend

# Backup database
C:\Projects\backup-db.bat

# View PM2 logs
pm2 logs --lines 200

# Clear PM2 logs
pm2 flush
```

---

## Support

**Check logs first:**
```bash
pm2 logs sgh-crm-backend --lines 100
pm2 logs sgh-crm-frontend --lines 100
```

**Common issues:**
- Backend not starting → Check PostgreSQL is running
- Frontend shows errors → Check API URL in `.env.local`
- Can't access remotely → Check Cloudflare tunnel service
- Database errors → Check DATABASE_URL in `.env`

---

## Summary

You've successfully set up SGH CRM on your Windows machine with:

✅ **Zero hosting costs** (only electricity: $1-10/month)
✅ **Remote access** via Cloudflare Tunnel (free HTTPS)
✅ **Automated backups** (daily PostgreSQL dumps)
✅ **Flexible operating modes** (24/7, business hours, on-demand)
✅ **Auto-start on boot** (PM2 process manager)
✅ **Production-ready** setup with monitoring and logs

**Recommended operating mode:** Business Hours (saves 65% electricity while maintaining full functionality during shop hours)

**Next steps:**
1. Choose your operating mode (Part 6)
2. Setup automated backups (Part 8)
3. Test remote access from phone/another device
4. Configure UPS for power backup (optional but recommended)

---

**Made with ❤️ for SGH Gaming Cafe**
