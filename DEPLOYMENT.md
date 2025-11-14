# Deployment Guide

## Deploying PubMed Intelligent Filter

This application requires two separate deployments:
- **Backend (Node.js/Express)** → Deploy to Render/Railway/Heroku
- **Frontend (React)** → Deploy to Netlify

---

## Option 1: Backend on Render + Frontend on Netlify (FREE)

### Step 1: Deploy Backend to Render

1. **Create account** at [render.com](https://render.com)

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Or use "Public Git repository" and paste your repo URL

3. **Configure Service**
   - **Name**: `pubmed-api` (or any name)
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave empty
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `node server/index.js`

4. **Environment Variables** (Optional)
   - `NODE_ENV` = `production`
   - `PORT` = `10000` (Render assigns this automatically)

5. **Create Web Service** (Free tier)
   - Wait 5-10 minutes for deployment
   - Copy your backend URL: `https://pubmed-api-xxxx.onrender.com`

### Step 2: Deploy Frontend to Netlify

1. **Create account** at [netlify.com](https://netlify.com)

2. **Deploy via Git**
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub/GitLab repository
   - Or drag & drop your `client/build` folder

3. **Configure Build Settings**
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/build`

4. **Environment Variables**
   - Go to "Site settings" → "Environment variables"
   - Add: `REACT_APP_API_URL` = `https://pubmed-api-xxxx.onrender.com/api`
   - (Replace with your actual Render backend URL)

5. **Deploy Site**
   - Click "Deploy site"
   - Wait 2-3 minutes
   - Your app will be live at: `https://your-app.netlify.app`

6. **Custom Domain (Optional)**
   - Go to "Domain settings"
   - Add custom domain or use Netlify subdomain

---

## Option 2: Both on Railway (Easier, FREE)

Railway supports both frontend and backend in one deployment.

1. **Create account** at [railway.app](https://railway.app)

2. **New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository

3. **Railway will auto-detect** your Node.js app

4. **Add environment variables** (if needed)
   - `NODE_ENV` = `production`

5. **Railway generates a URL** for your app
   - Both frontend and backend will be served together

---

## Option 3: Full Stack on Vercel

1. **Create account** at [vercel.com](https://vercel.com)

2. **Import Project**
   - Click "New Project"
   - Import from GitHub

3. **Configure**
   - Framework Preset: Other
   - Build Command: `cd client && npm install && npm run build && cd ../server && npm install`
   - Output Directory: `client/build`
   - Install Command: `npm install`

4. **Add vercel.json** to project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server/index.js",
      "use": "@vercel/node"
    },
    {
      "src": "client/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "server/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "client/build/$1"
    }
  ]
}
```

---

## Quick Deploy Commands

### Prepare for deployment:

```bash
# 1. Test production build locally
cd client
npm run build
cd ..

# 2. Create .gitignore (if not exists)
echo "node_modules/" >> .gitignore
echo ".env" >> .gitignore
echo "*.log" >> .gitignore

# 3. Initialize git (if not done)
git init
git add .
git commit -m "Initial commit"

# 4. Push to GitHub
git remote add origin https://github.com/yourusername/pubmed-app.git
git branch -M main
git push -u origin main
```

---

## Testing Deployment

After deployment:

1. **Test backend API**:
   ```bash
   curl https://your-backend-url.onrender.com/api/health
   ```

2. **Test frontend**:
   - Visit: `https://your-app.netlify.app`
   - Try searching for "cefixime"
   - Check browser console for API errors

3. **Check CORS**:
   - If you see CORS errors, update backend CORS settings in `server/index.js`

---

## Troubleshooting

### Backend not responding
- Check Render/Railway logs
- Verify `PORT` environment variable
- Ensure `node server/index.js` works locally

### Frontend can't reach backend
- Check `REACT_APP_API_URL` environment variable in Netlify
- Must include `/api` at the end
- Check browser console for exact error

### Build fails
- Check Node.js version (should be 16+)
- Run `npm install` locally first
- Check build logs for specific error

---

## Recommended Setup

**Best FREE Option:**
- ✅ Backend: Render.com (Free tier)
- ✅ Frontend: Netlify (Free tier)
- ✅ Total cost: $0/month
- ✅ Auto-deploy on git push
- ✅ HTTPS included

**Alternatives:**
- Railway: $5/month (easiest, all-in-one)
- Heroku: $7/month (backend only)
- Vercel: Free (good for full-stack)

