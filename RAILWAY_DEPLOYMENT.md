# Railway Deployment Fix - Detail Document Feature

## Problem
❌ **"Failed to fetch"** error when clicking Detail Document or Short Summary buttons on Railway deployment  
✅ Works perfectly on localhost

## Root Cause
The client code was using hardcoded `http://localhost:5000` which doesn't work in production.

## Solution Applied ✅

### 1. **Fixed API URL (Already Done)**
Updated `DetailDocumentModal.js` to use dynamic URLs:
```javascript
const apiBase = process.env.REACT_APP_API_URL || '/api';
```

### 2. **Railway Deployment Steps**

#### **For Single Service Deployment (Both Frontend + Backend)**

1. **Environment Variables in Railway Dashboard:**
   ```
   NODE_ENV=production
   OPENAI_API_KEY=your_openai_api_key_here
   ```
   ⚠️ **DO NOT set REACT_APP_API_URL** - it will use relative path `/api` automatically

2. **Build Settings:**
   - Build Command: `npm run build` (already in package.json)
   - Start Command: `npm start` or leave empty (uses package.json)

3. **Deploy:**
   - Push to GitHub
   - Railway will automatically build and deploy

#### **For Separate Frontend/Backend Services**

If deploying client and server separately:

**Backend Service:**
```
Environment Variables:
- NODE_ENV=production
- OPENAI_API_KEY=your_key
```

**Frontend Service:**
```
Environment Variables:
- REACT_APP_API_URL=https://your-backend.railway.app/api
```

### 3. **Verify Deployment**

After deployment, check:
1. ✅ Backend URL accessible: `https://your-app.railway.app/api/health`
2. ✅ Frontend loads correctly
3. ✅ Cart functionality works
4. ✅ Detail Document button appears
5. ✅ Both document types generate successfully

### 4. **Testing Detail Document Feature**

1. Search for articles (e.g., "paracetamol")
2. Add articles to cart
3. Click "Detail Document" button (purple button in cart footer)
4. Try all 4 options:
   - ✅ Animal Studies - Detail Document
   - ✅ Animal Studies - Short Summary  
   - ✅ Human Studies - Detail Document
   - ✅ Human Studies - Short Summary

## Common Issues & Solutions

**Error: "Failed to fetch"**
- Check Railway logs for backend errors
- Verify build completed successfully
- Check that `/api/generate-detail-document` endpoint is accessible

**Error: "Request entity too large"**
- Already fixed with 50MB limit
- If still occurs, increase in `server/index.js`:
  ```javascript
  app.use(express.json({ limit: '100mb' }));
  ```

**Error: "Cannot find module"**
- Ensure all dependencies in both `package.json` and `client/package.json`
- Run: `npm install && cd client && npm install`

**OpenAI errors**
- Set `OPENAI_API_KEY` in Railway environment variables
- System has fallback if OpenAI is unavailable

### Current Features
✅ Detail Document (Full abstracts)
✅ Short Summary Document (Tables + summaries)
✅ Both Animal and Human studies
✅ 50MB payload limit
✅ PubMed links on each paragraph
✅ Professional formatting
✅ AI-generated summaries with fallback
