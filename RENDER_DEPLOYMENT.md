# Deploy PubMed Intelligent Filter to Render.com

## 🚀 Quick Deployment Steps

### Prerequisites
- GitHub account with repository: `AmanSingh262/pubmed-app`
- Render.com account (free): https://render.com
- OpenAI API key (from https://platform.openai.com)

---

## Step 1: Prepare Your Repository

✅ **Already Done!** Your repository has:
- `render.yaml` configuration file
- Health check endpoint at `/api/health`
- Production build scripts

**Commit and push** (if you haven't already):

```bash
cd "c:\Users\ASquare\Downloads\report image\pubmed"
git add .
git commit -m "Add Render.com deployment configuration"
git push origin main
```

---

## Step 2: Deploy to Render

### 2.1 Sign Up / Log In to Render
1. Go to https://render.com
2. Click **"Get Started"** or **"Sign In"**
3. Sign in with your **GitHub account**

### 2.2 Create New Web Service

1. Click **"New +"** button (top right)
2. Select **"Web Service"**
3. Connect your GitHub repository:
   - Click **"Connect account"** if not connected
   - Search for: **`pubmed-app`**
   - Click **"Connect"**

### 2.3 Configure Service

Render will auto-detect your `render.yaml` file, but verify these settings:

**Basic Settings:**
```
Name: pubmed-intelligent-filter
Region: Oregon (US West)
Branch: main
Root Directory: (leave blank)
```

**Build & Deploy:**
```
Build Command: npm install && cd server && npm install && cd ../client && npm install && npm run build

Start Command: node server/index.js
```

**Plan:**
```
Instance Type: Free
```

### 2.4 Add Environment Variables

Click **"Advanced"** → **"Environment Variables"**

Add these variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `PUBMED_API_BASE_URL` | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils` |
| `RATE_LIMIT_WINDOW_MS` | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | `100` |
| `CACHE_TTL_SECONDS` | `3600` |
| `OPENAI_API_KEY` | `your-openai-api-key-here` |

⚠️ **IMPORTANT**: Use your actual OpenAI API key from https://platform.openai.com/api-keys

### 2.5 Deploy

1. Click **"Create Web Service"**
2. Render will start building your app
3. Wait 5-10 minutes for first deployment
4. Watch the logs in real-time

---

## Step 3: Verify Deployment

### Check Health Endpoint

Once deployed, your app URL will be: `https://pubmed-intelligent-filter.onrender.com`

Test the health endpoint:
```bash
curl https://pubmed-intelligent-filter.onrender.com/api/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2025-12-16T10:30:00.000Z",
  "uptime": 123.456
}
```

### Access Your App

Open in browser:
```
https://pubmed-intelligent-filter.onrender.com
```

---

## Step 4: Configure Frontend (If Deploying Frontend Separately)

If you want to split deployment (Frontend on Vercel/Netlify):

### Update API URL in Client

Edit `client/src/services/api.js`:

```javascript
const API_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://pubmed-intelligent-filter.onrender.com' 
    : 'http://localhost:5000');

export default API_URL;
```

---

## 🔒 Security Setup (Do This Immediately)

### 1. Regenerate OpenAI API Key

The key in this guide is exposed. Regenerate it:

1. Go to: https://platform.openai.com/api-keys
2. Click **"Revoke"** on the old key
3. Click **"Create new secret key"**
4. Copy the new key
5. In Render dashboard:
   - Go to your service
   - Click **"Environment"**
   - Update `OPENAI_API_KEY` with new key
   - Click **"Save Changes"**
   - Service will auto-redeploy

### 2. Set OpenAI Spending Limits

1. Go to: https://platform.openai.com/account/billing/limits
2. Set **Hard limit**: $10/month
3. Set **Soft limit**: $5/month (email warning)

### 3. Monitor Usage

Check Render usage:
- Dashboard → Your Service → **"Metrics"**
- Watch: Hours used / 750 free hours

Check OpenAI usage:
- https://platform.openai.com/usage

---

## 🎯 Post-Deployment Tips

### For Single User (You):

**Don't use cron-job** - Let app sleep when not in use:
- First request takes 30-60 seconds (cold start)
- After wake-up, fast for 15+ minutes
- Saves 700+ hours/month

### Optional: Add Wake-Up Button

If cold starts bother you, add this to your frontend:

```javascript
const wakeUpServer = async () => {
  setStatus('Waking up...');
  await fetch('https://pubmed-intelligent-filter.onrender.com/api/health');
  setStatus('Ready!');
};
```

---

## 📊 Free Tier Limits

**Render Free Tier Includes:**
- ✅ 750 hours/month runtime
- ✅ 512 MB RAM
- ✅ Shared CPU
- ✅ Auto-deploy from GitHub
- ✅ Custom domains
- ⚠️ Sleeps after 15 minutes inactivity
- ⚠️ Cold start: 30-60 seconds

**Your Expected Usage (single user):**
- ~50-100 hours/month
- Well within free tier limits
- No cost!

---

## 🔄 Updating Your App

After making changes:

```bash
git add .
git commit -m "Update: description of changes"
git push origin main
```

Render **auto-deploys** when you push to `main` branch!

---

## 🐛 Troubleshooting

### Build Fails

**Check logs** in Render dashboard:
- Click your service
- Click **"Logs"** tab
- Look for errors

**Common issues:**
- Missing dependencies: Run `npm install` locally first
- Build timeout: Increase build time in Render settings

### App Crashes

**Check runtime logs:**
- Look for error messages
- Common issues:
  - Missing environment variables
  - OpenAI API key invalid
  - Port conflicts (should use PORT=10000)

### Slow Performance

**Normal for free tier:**
- Cold start: 30-60 seconds (first request)
- After wake-up: Fast performance
- Solution: Just accept it or upgrade to paid tier ($7/month)

### Out of Hours

If you exceed 750 hours:
- App shuts down for rest of month
- Restarts on 1st of next month
- Solution: Use app less, or upgrade

---

## 📞 Support

**Render Documentation:**
- https://render.com/docs

**Your GitHub Repo:**
- https://github.com/AmanSingh262/pubmed-app

**Issues?**
- Check Render dashboard logs
- Check OpenAI usage/limits
- Verify environment variables

---

## ✅ Deployment Checklist

- [ ] Push code to GitHub
- [ ] Create Render account
- [ ] Connect GitHub repository
- [ ] Configure environment variables
- [ ] Deploy service
- [ ] Test health endpoint
- [ ] Access app in browser
- [ ] Regenerate OpenAI API key
- [ ] Set OpenAI spending limits
- [ ] Bookmark your app URL

---

## 🎉 You're Done!

Your app is now live at:
```
https://pubmed-intelligent-filter.onrender.com
```

Bookmark it and start using your PubMed research tool!
