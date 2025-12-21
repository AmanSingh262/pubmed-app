# Quick Troubleshooting Guide - Search Errors

## ✅ System Status: WORKING

All tests passed successfully! If you're still seeing errors, follow this guide:

## 1. Verify Server is Running

Check that the server is running on port 5000:
```bash
curl http://localhost:5000/api/health
```

Or open in browser: http://localhost:5000/api/health

**Expected Response:**
```json
{
  "status": "OK",
  "services": {
    "server": "running",
    "pubmed": "connected"
  }
}
```

## 2. Check for Common Issues

### Error: "Unable to connect to PubMed API"
**Cause:** Internet connection issue or PubMed is down
**Solution:**
- Check your internet connection
- Visit https://pubmed.ncbi.nlm.nih.gov/ to verify PubMed is accessible
- Run health check: `curl http://localhost:5000/api/health`

### Error: "Request timed out"
**Cause:** Slow network or too many results requested
**Solution:**
- Try again in a few seconds
- Reduce the number of results (maxResults)
- Check internet speed

### Error: "Query cannot be empty"
**Cause:** No search term entered
**Solution:** Enter a drug name or search term (at least 2 characters)

### Error: "Category path is required"
**Cause:** No category selected
**Solution:** Select at least one category before searching

### Error: "Failed to search articles"
**Cause:** Generic server error
**Solution:**
1. Check server console for detailed error message
2. Run test script: `node server/test-search-endpoint.js`
3. Check server logs in terminal

## 3. Run Diagnostic Test

```bash
cd server
node test-search-endpoint.js
```

This will test:
- ✅ Health check
- ✅ Categories endpoint
- ✅ Search endpoint

## 4. Check Server Logs

Look at the terminal where the server is running for error messages. Common patterns:

```
❌ Error searching PubMed: ECONNREFUSED
   → Server cannot connect to PubMed (internet issue)

❌ Error searching PubMed: ETIMEDOUT
   → Request timed out (slow connection)

❌ CRITICAL ERROR loading keyword mappings
   → Missing keywordMappings.json file

❌ Error fetching article details
   → Issue retrieving article information from PubMed
```

## 5. Browser Console Errors

Open browser DevTools (F12) and check Console tab:

```javascript
// Network error
Failed to fetch → Server is not running or wrong URL

// API error  
POST /api/search 500 → Server error (check server logs)

// Validation error
POST /api/search 400 → Invalid parameters (check query)
```

## 6. Clear Cache

If seeing stale or incorrect results:

```bash
# Using curl
curl -X DELETE http://localhost:5000/api/search/cache

# Or restart the server
```

## 7. Restart Everything

If all else fails:

1. **Stop the server** (Ctrl+C in terminal)
2. **Clear cache** (optional)
3. **Restart server:**
   ```bash
   cd server
   npm run dev
   ```
4. **Clear browser cache** (Ctrl+Shift+R)
5. **Try search again**

## 8. Verify Environment

Check these files exist:
- ✅ `server/data/keywordMappings.json`
- ✅ `server/index.js`
- ✅ `server/routes/search.js`
- ✅ `server/services/pubmedService.js`

## 9. Test with cURL

Test the API directly:

```bash
curl -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "cefixime",
    "studyType": "animal",
    "categoryPath": "safety.adverseEffects",
    "maxResults": 10,
    "topN": 5
  }'
```

## 10. Get Help

If still having issues, provide:

1. **Error message** from UI
2. **Server console output** (full error)
3. **Health check result**: `curl http://localhost:5000/api/health`
4. **Test script result**: `node server/test-search-endpoint.js`
5. **Browser console errors** (F12 → Console tab)

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `node server/test-search-endpoint.js` | Run diagnostic tests |
| `curl http://localhost:5000/api/health` | Check server health |
| `npm run dev` (in server/) | Start server |
| `Ctrl+Shift+R` | Hard refresh browser |
| `Ctrl+C` | Stop server |

## Success Indicators

✅ Server running on port 5000
✅ Health check shows "pubmed: connected"
✅ Test script shows "ALL TESTS PASSED"
✅ No errors in server console
✅ Search returns results in UI

---

**Last Updated:** December 22, 2025
**Status:** All systems operational
