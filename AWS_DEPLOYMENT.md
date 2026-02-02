# AWS Deployment Guide

## Problem: CloudFront Cache Issues

When you deploy a new build to S3, CloudFront may serve **cached old files**, causing 404 errors.

**Your Symptoms:**
- Browser tries to load: `vendor-BWixxOLW.js` (old file) ❌
- S3 actually has: `vendor-O4rLo36Q.js` (new file) ✅
- Result: **404 Not Found**

## Solution 1: Automated Deployment (RECOMMENDED)

### Step 1: Install AWS SDK
```bash
cd admin
npm install aws-sdk --save-dev
```

### Step 2: Configure AWS Credentials

**Option A: AWS CLI (Easiest)**
```bash
npm install -g aws-cli
aws configure
```
Enter:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: `ap-south-1`
- Default output format: `json`

**Option B: Environment Variables**
```bash
# Windows PowerShell
$env:AWS_ACCESS_KEY_ID="your-access-key"
$env:AWS_SECRET_ACCESS_KEY="your-secret-key"
$env:AWS_REGION="ap-south-1"

# Linux/Mac
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="ap-south-1"
```

### Step 3: Update Configuration

Open `admin/deploy-to-aws.js` and update:

```javascript
const CONFIG = {
  S3_BUCKET: 'your-actual-bucket-name',  // Replace this
  CLOUDFRONT_DISTRIBUTION_ID: 'E1A2B3C4D5E6F7', // Replace with your distribution ID
  AWS_REGION: 'ap-south-1',
  BUILD_DIR: './dist',
};
```

### Step 4: Deploy

```bash
npm run build
node deploy-to-aws.js
```

This will:
1. ✅ Upload all files to S3
2. ✅ Set correct cache headers (`index.html` = no cache, assets = cache forever)
3. ✅ Automatically invalidate CloudFront cache
4. ✅ Wait for invalidation to complete

---

## Solution 2: Manual Deployment

If you prefer to do it manually:

### Step 1: Upload to S3
```bash
cd admin
aws s3 sync ./dist s3://your-bucket-name --delete
```

### Step 2: Invalidate CloudFront
```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

### Step 3: Wait & Test
1. Wait 1-2 minutes
2. Open site in **Incognito/Private window** (to bypass browser cache)
3. Verify new files load

---

## Solution 3: AWS Console (Manual)

### Upload Files to S3
1. Go to **S3 Console**
2. Open your bucket
3. Delete old files (or just upload new ones to overwrite)
4. Upload entire `dist` folder contents

### Invalidate CloudFront
1. Go to **CloudFront Console**
2. Click your distribution
3. Go to **Invalidations** tab
4. Click **Create Invalidation**
5. Enter: `/*`
6. Click **Create Invalidation**
7. Wait 1-2 minutes

### Test
Open your CloudFront URL in an **Incognito/Private window**.

---

## Prevention: Fix Cache Settings (Do Once)

To prevent this in future, configure CloudFront behaviors:

### For Root Path `/`
- **Path pattern:** `index.html`
- **Cache-Control:** Min TTL=0, Max TTL=0, Default TTL=0
- **Origin Cache Headers:** Use origin cache headers

### For Assets `/assets/*`
- **Path pattern:** `/assets/*`
- **Cache-Control:** Min TTL=31536000, Max TTL=31536000
- **Origin Cache Headers:** Use origin cache headers

This ensures `index.html` is **never cached** while assets (with unique hashes) can be **cached forever**.

---

## Troubleshooting

### "CredentialsError"
- Run `aws configure` to set up credentials
- Or set environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

### "Access Denied" when uploading to S3
- Check your IAM user has `s3:PutObject` permission
- Check bucket policy allows your account

### "AccessDenied" when creating invalidation
- Check your IAM user has `cloudfront:CreateInvalidation` permission

### Still seeing old files after invalidation
1. **Wait longer** (can take up to 5 minutes in rare cases)
2. **Clear browser cache** completely
3. **Use Incognito/Private window**
4. **Check S3 directly**: Visit `https://your-bucket.s3.amazonaws.com/index.html`
   - If S3 shows old file → re-upload
   - If S3 shows new file → CloudFront issue, wait longer

---

## Quick Reference

```bash
# Build
cd admin
npm run build

# Deploy (automated)
node deploy-to-aws.js

# Deploy (manual)
aws s3 sync ./dist s3://your-bucket --delete
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

## Solution 4: Fix "404 Not Found" on Page Refresh (SPA Routing)

If you can load the homepage but get a **404 error when refreshing** a page like `/revenue` or `/orders`:

**The Problem:**
CloudFront looks for a file named `revenue` in S3. Since this is a React app, that file doesn't exist (it's a route inside `index.html`).

**The Fix:**
You need to configure CloudFront to serve `index.html` when it encounters a 404 error.

### Option A: Use the Script (Recommended)
1. Open `admin/fix-cloud-front-404.js`
2. Update `DISTRIBUTION_ID` with your ID (not the URL)
3. Run:
```bash
node admin/fix-cloud-front-404.js
```

### Option B: AWS Console (Manual)
1. Go to **CloudFront Console**
2. Click your distribution
3. Go to **Error Pages** tab
4. Click **Create Custom Error Response**
   - **HTTP Error Code:** `404`
   - **Customize Error Response:** `Yes`
   - **Response Page Path:** `/index.html`
   - **HTTP Response Code:** `200: OK`
   - Click **Create**
5. Repeat for **HTTP Error Code: `403`** (S3 often returns 403 for missing files)

Once done, wait 5 minutes and try refreshing the `/revenue` page again.

