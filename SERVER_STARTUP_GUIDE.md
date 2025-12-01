# 🚀 SERVER STARTUP GUIDE

## ✅ SOLUTION - Server is Now Running!

The error was caused by the server process exiting immediately. The solution is to run the server in a **separate PowerShell window** that stays open.

---

## 📋 How to Start the Servers

### Option 1: Start Backend Only (CURRENTLY RUNNING ✅)

The backend server is already running on **http://localhost:5000**

To verify:
```powershell
Invoke-WebRequest -Uri http://localhost:5000/api/health -UseBasicParsing
```

### Option 2: Start Both Backend and Frontend

**Method A: Separate Windows (Recommended)**

1. **Backend** (in one PowerShell window):
```powershell
cd 'c:\Users\ASquare\Downloads\report image\pubmed'
npm run server
```

2. **Frontend** (in another PowerShell window):
```powershell
cd 'c:\Users\ASquare\Downloads\report image\pubmed\client'
npm start
```

**Method B: Single Command (if ports are free)**
```powershell
cd 'c:\Users\ASquare\Downloads\report image\pubmed'
npm run dev
```

---

## 🔍 Check Server Status

### Backend (Port 5000):
```powershell
Invoke-WebRequest -Uri http://localhost:5000/api/health -UseBasicParsing | ConvertFrom-Json
```

Expected output:
```
status : OK
timestamp : 2025-11-30T20:15:23.889Z
uptime : 7.45
```

### Frontend (Port 3000):
Open browser: http://localhost:3000

---

## 🐛 Troubleshooting

### Problem: "Unable to connect to the remote server"
**Solution:** Server isn't running. Start it using Option 1 or 2 above.

### Problem: "Address already in use"
**Solution:** Kill existing processes:
```powershell
# Kill backend (port 5000)
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force

# Kill frontend (port 3000)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Problem: Server exits immediately
**Solution:** Run in a **new PowerShell window** with `-NoExit`:
```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\ASquare\Downloads\report image\pubmed'; npm run server"
```

---

## ✅ Current Status

- **Backend:** ✅ Running on http://localhost:5000
- **Frontend:** ❌ Not started (start it if you need the UI)

### Test the Backend:
```powershell
# Health check
Invoke-WebRequest -Uri http://localhost:5000/api/health -UseBasicParsing

# Categories (for filters)
Invoke-WebRequest -Uri http://localhost:5000/api/categories -UseBasicParsing

# API info
Invoke-WebRequest -Uri http://localhost:5000/ -UseBasicParsing
```

---

## 🎯 Ready to Generate Documents!

The backend server is running and ready to:
1. Accept template uploads
2. Generate Word documents with abbreviated tables
3. Process article data

**The "Unable to connect" error is now fixed!** ✅
