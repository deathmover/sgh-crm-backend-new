# Railway Deployment Guide

## Prerequisites
- Railway account (sign up at https://railway.app)
- GitHub repository access
- Database credentials ready

## Deployment Steps

### 1. Create a New Project on Railway

1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `sgh-crm-backend` repository

### 2. Add PostgreSQL Database

1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically provision a PostgreSQL database
4. Note: Railway will automatically set `DATABASE_URL` in your environment

### 3. Configure Environment Variables

Go to your service → Variables and add the following:

```bash
# Database (automatically set by Railway if using Railway PostgreSQL)
DATABASE_URL=<automatically_set_by_railway>

# JWT Configuration
JWT_SECRET=<generate_a_strong_random_secret>
JWT_EXPIRES_IN=7d

# Admin Credentials
SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_PASSWORD=<set_a_strong_password>
SUPER_ADMIN_FULLNAME=Administrator

# Port (Railway handles this automatically)
PORT=3000

# Node Environment
NODE_ENV=production
```

### 4. Generate Secure Secrets

For `JWT_SECRET`, generate a strong random string:
```bash
# On Linux/Mac
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 5. Deploy

1. Railway will automatically deploy when you push to your main branch
2. Or click "Deploy" in the Railway dashboard
3. Monitor the build logs in Railway dashboard

### 6. Run Database Migrations

After first deployment, you need to run migrations:

1. Go to your service in Railway
2. Click on the "..." menu → "Shell" or use Railway CLI
3. Run:
```bash
npx prisma migrate deploy
```

### 7. Seed Initial Data (Optional)

If you have a seed script:
```bash
npm run prisma:seed
```

### 8. Enable Membership System (Optional)

If you need to enable the membership system:
```bash
node scripts/enable-membership-render.js
```

### 9. Verify Deployment

Once deployed, Railway will provide you with a public URL like:
```
https://your-project.up.railway.app
```

Test the endpoints:
- Health check: `https://your-project.up.railway.app/api/v1`
- API Docs: `https://your-project.up.railway.app/api/docs`

## Important Security Notes

### 🚨 CRITICAL: Rotate Your Render Database Credentials

Your old database credentials were exposed in git history. **You MUST**:

1. Go to Render dashboard
2. Navigate to your PostgreSQL database
3. Rotate/change the password for user `sghcrm_user`
4. Update any services still using the old credentials

### Clean Git History (Optional but Recommended)

The exposed credentials are still in your git history. To remove them:

```bash
# Using BFG Repo-Cleaner (recommended)
# 1. Install BFG: brew install bfg (on Mac)
# 2. Clone a fresh copy of your repo
git clone --mirror https://github.com/deathmover/sgh-crm-backend-new.git
cd sgh-crm-backend-new.git

# 3. Run BFG to remove the exposed credentials
bfg --replace-text passwords.txt

# Create passwords.txt with:
# 1zCyM7wKtY77frjxpAffYGuMchCLXPwv

# 4. Clean up and push
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

**Warning**: Force pushing rewrites history. Coordinate with your team first!

## Railway CLI (Optional)

Install Railway CLI for easier management:

```bash
# Install
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# View logs
railway logs

# Open shell
railway shell
```

## Troubleshooting

### Build Fails
- Check build logs in Railway dashboard
- Ensure `package.json` has correct build scripts
- Verify Node.js version compatibility

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- Check if Prisma migrations have been run
- Ensure PostgreSQL service is running

### Application Won't Start
- Check if `PORT` environment variable is set
- Review application logs in Railway dashboard
- Verify all required environment variables are set

## Continuous Deployment

Railway automatically deploys when you push to your connected branch (usually `main`):

```bash
git add .
git commit -m "Your changes"
git push origin main
# Railway will automatically deploy
```

## Cost Considerations

Railway pricing:
- Free tier: $5 credit/month
- Pro plan: $20/month + usage
- PostgreSQL: ~$5-10/month depending on usage

Monitor your usage in the Railway dashboard.

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- GitHub Issues: Create an issue in your repository
