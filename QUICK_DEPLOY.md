# Quick Start: Deploy to Render.com in 5 Minutes

## 🚀 Fast Deployment Steps

### 1. Go to Render.com
👉 **https://render.com** → Sign in with GitHub

### 2. Create New Web Service
- Click **"New +"** → **"Web Service"**
- Connect repository: **`AmanSingh262/pubmed-app`**
- Click **"Connect"**

### 3. Render Auto-Detects Configuration
Render reads your `render.yaml` file automatically!

**Verify these settings:**
```
Name: pubmed-intelligent-filter
Branch: main
Build Command: (auto-filled from render.yaml)
Start Command: node server/index.js
```

### 4. Add Your OpenAI API Key
Click **"Advanced"** → Add environment variable:

```
Key: OPENAI_API_KEY
Value: [YOUR KEY FROM https://platform.openai.com/api-keys]
```

All other environment variables are already in `render.yaml`!

### 5. Deploy!
- Click **"Create Web Service"**
- Wait 5-10 minutes for build
- Your app will be live at: `https://pubmed-intelligent-filter.onrender.com`

### 6. Test It
Open in browser:
```
https://pubmed-intelligent-filter.onrender.com
```

Health check:
```
https://pubmed-intelligent-filter.onrender.com/api/health
```

## ✅ Done!

Your PubMed research tool is now live and free!

---

## 📖 Need More Details?

See **[RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)** for:
- Detailed configuration
- Security setup
- Troubleshooting
- Usage monitoring
- Cost management

---

## 🔒 Security Reminder

After deployment:

1. **Set OpenAI spending limit**: https://platform.openai.com/account/billing/limits
   - Hard limit: $10/month
   - Soft limit: $5/month

2. **Monitor usage**:
   - Render: Dashboard → Metrics
   - OpenAI: https://platform.openai.com/usage

---

## 💡 For Single User

**You don't need a cron-job!**

Just accept the 30-60 second cold start on first use:
- Open app URL
- Wait for wake-up
- Use normally for 15+ minutes
- App auto-sleeps when idle
- Saves 700+ hours/month

Your 750 free hours will last all month easily!
