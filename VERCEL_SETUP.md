# Vercel Deployment Setup Guide

## Critical: Environment Variables Required

Your application is crashing because environment variables are not set in Vercel. Follow these steps:

### 1. Go to Vercel Dashboard
Visit: https://vercel.com/your-username/your-project/settings/environment-variables

### 2. Add Required Environment Variables

Add these **REQUIRED** variables:

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `MONGO_URI` | `mongodb+srv://username:password@cluster.mongodb.net/mkcode` | **CRITICAL** - Your MongoDB connection string |
| `JWT_SECRET` | `your-super-secret-random-string-here` | **CRITICAL** - Generate a random 32+ character string |

Add these **OPTIONAL** variables (for full functionality):

| Variable Name | Example Value | Purpose |
|--------------|--------------|---------|
| `FRONTEND_URL` | `https://your-site.vercel.app` | For email links and CORS |
| `SMTP_HOST` | `smtp.gmail.com` | Email service host |
| `SMTP_PORT` | `587` | Email service port |
| `SMTP_USER` | `your-email@gmail.com` | Email account |
| `SMTP_PASS` | `your-app-password` | Email app password |
| `EMAIL_FROM` | `noreply@mkcode.com` | From address for emails |
| `NODE_ENV` | `production` | Environment mode |

### 3. How to Add Variables in Vercel

1. Click **"Add New"** button
2. Enter **Variable Name** (e.g., `MONGO_URI`)
3. Enter **Value** (your actual MongoDB connection string)
4. Select **All Environments** (Production, Preview, Development)
5. Click **"Save"**
6. Repeat for each variable

### 4. Redeploy After Adding Variables

After adding all environment variables:

```bash
git add .
git commit -m "Update API configuration"
git push
```

Or manually trigger a redeploy in Vercel dashboard.

### 5. Get Your MongoDB URI

If you don't have a MongoDB connection string:

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a free cluster (if you don't have one)
3. Click **"Connect"** → **"Connect your application"**
4. Copy the connection string
5. Replace `<password>` with your actual database password
6. Replace `<dbname>` with `mkcode` or your database name

Example:
```
mongodb+srv://myuser:mypassword123@cluster0.abcde.mongodb.net/mkcode?retryWrites=true&w=majority
```

### 6. Generate JWT Secret

Run this command to generate a secure random string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or use any random string generator (32+ characters recommended).

### 7. Verify Deployment

After redeploying with environment variables:

1. Visit your site: `https://your-project.vercel.app`
2. Check if the API responds: `https://your-project.vercel.app/api/health`
3. If still failing, check Vercel logs: Dashboard → Your Project → Logs

## Common Issues

### Issue: "MONGO_URI is not set"
**Solution**: Add `MONGO_URI` in Vercel environment variables

### Issue: "Database connection failed"
**Solutions**:
- Check if MongoDB URI is correct
- Verify MongoDB cluster is running
- Check if IP is whitelisted in MongoDB (add `0.0.0.0/0` to allow all)
- Ensure MongoDB user has correct permissions

### Issue: "JWT authentication not working"
**Solution**: Add `JWT_SECRET` in Vercel environment variables

## Need Help?

Check Vercel deployment logs:
- Vercel Dashboard → Your Project → Deployments → Click on latest → Logs
- Look for specific error messages
