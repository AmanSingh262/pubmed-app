# Search Accuracy Improvements

## Issues Fixed

### 1. **Search Bar Returning Wrong Study Type**
**Problem**: Searching for "AUGMENTIN" with "Human Studies" selected was returning animal studies.

**Root Cause**: The `studyType` parameter was not being passed from the search route to the PubMed service, so study type filters were never applied.

**Solution**:
- ✅ Added `studyType` parameter to `pubmedService.searchArticles()` method
- ✅ Updated `search.js` to pass `studyType` to the PubMed service
- ✅ Implemented comprehensive study type filters:
  - **Animal Studies**: `Animals[MeSH Terms]`, mouse, rat, rabbit, dog, pig, monkey, "in vivo", "animal model"
  - **Human Studies**: `Humans[MeSH Terms]`, patient, clinical trial, volunteer, participant, adult, child, pediatric

**Files Modified**:
- `server/services/pubmedService.js` - Added studyType handling
- `server/routes/search.js` - Pass studyType parameter

---

### 2. **Reference Document Upload Failing**
**Problem**: Uploading a Word document with "AUGMENTIN" showed "Failed to fetch article details from PubMed".

**Root Causes**:
1. Poor error handling hiding the actual error
2. Generic search terms not finding drug-specific articles
3. No timeout handling for slow API responses

**Solutions**:
- ✅ **Drug Name Detection**: Added pattern matching to extract drug/brand names (e.g., "AUGMENTIN")
- ✅ **Improved Search Query**: Prioritizes drug names with exact match searches `"AUGMENTIN"[Title/Abstract]`
- ✅ **Better Error Handling**: 
  - Added 30-second timeout for API calls
  - Shows specific error messages instead of generic "Failed to fetch"
  - Logs search query and results for debugging
- ✅ **Search Query Logging**: Console logs show extracted drug names and search terms

**Files Modified**:
- `server/routes/referenceDoc.js` - Drug name extraction and error handling

---

## How the Fixes Work

### Study Type Filtering (Search Bar)

Before:
```javascript
// studyType ignored - no filtering applied!
const searchResults = await pubmedService.searchArticles(query, {
  maxResults,
  categoryKeywords: primaryKeywords,
  headingKeyword
});
```

After:
```javascript
// studyType passed and filter applied
const searchResults = await pubmedService.searchArticles(query, {
  maxResults,
  categoryKeywords: primaryKeywords,
  headingKeyword,
  studyType  // ✅ Now passed!
});

// In pubmedService.js:
if (studyType === 'human') {
  searchQuery += ' AND (Humans[MeSH Terms] OR patient[Title/Abstract] OR "clinical trial"[Title/Abstract]...)';
}
```

### Drug Name Detection (Reference Document)

Before:
```javascript
// Only used generic key terms
searchQuery = keyTerms.slice(0, 15).join(' OR ');
```

After:
```javascript
// Detects capitalized drug names like "AUGMENTIN", "Amoxicillin"
const drugNamePattern = /\b([A-Z][A-Za-z]+(?:[-][A-Z][a-z]+)?)\b/g;
const drugNames = extractDrugNames(text);

// Prioritizes exact drug name matches
if (drugNames.length > 0) {
  searchQuery = drugNames.map(name => `"${name}"[Title/Abstract]`).join(' OR ');
}
```

### Error Handling Improvements

Before:
```javascript
const searchResponse = await axios.get(searchUrl);
// No error handling - fails silently or shows generic error
```

After:
```javascript
let searchResponse;
try {
  searchResponse = await axios.get(searchUrl, { timeout: 30000 });
} catch (error) {
  console.error('PubMed search API error:', error.message);
  return res.status(500).json({ 
    error: 'Failed to search PubMed',
    details: 'PubMed API is not responding. Please try again later.',
    keyTerms: keyTerms.slice(0, 10)  // Shows what was searched
  });
}
```

---

## Testing the Fixes

### Test Case 1: Search Bar with Study Type
1. Go to the search page
2. Enter "AUGMENTIN" in the search bar
3. Select "Human Studies"
4. Click Search
5. **Expected**: Only human/clinical trial articles should appear
6. **Check**: Look for keywords like "patients", "clinical trial", "volunteers" in titles

### Test Case 2: Reference Document Upload
1. Create a Word document with "AUGMENTIN" or other drug name
2. Go to Reference Document feature
3. Upload the document
4. Select "Human Studies" or "Animal Studies"
5. Click "Generate Similar Articles"
6. **Expected**: Should successfully find and display related articles
7. **Check**: Console logs should show "Extracted drug names: ['AUGMENTIN']"

### Test Case 3: Verify Study Type Filtering
Search for common drugs and check results match selected study type:
- **"aspirin"** + Human Studies → clinical trials, patient studies
- **"insulin"** + Animal Studies → mouse/rat studies, in vivo models
- **"metformin"** + Human Studies → diabetic patient studies

---

## Technical Details

### Study Type Filter Query Structure

**Human Studies Filter**:
```
AND (Humans[MeSH Terms] 
     OR (human[Title/Abstract] NOT animal[Title/Abstract]) 
     OR patient[Title/Abstract] 
     OR "clinical trial"[Title/Abstract] 
     OR volunteer[Title/Abstract])
```

**Animal Studies Filter**:
```
AND (Animals[MeSH Terms] 
     OR (animal[Title/Abstract] NOT human[Title/Abstract]) 
     OR mouse[Title/Abstract] 
     OR rat[Title/Abstract] 
     OR "in vivo"[Title/Abstract] 
     OR "animal model"[Title/Abstract])
```

### Drug Name Detection Regex
```javascript
/\b([A-Z][A-Za-z]+(?:[-][A-Z][a-z]+)?)\b/g
```
Matches:
- Single capitalized words: AUGMENTIN, Amoxicillin, Aspirin
- Hyphenated names: Beta-Blocker, Anti-Inflammatory
- Filters out common words: The, This, That, Table, Figure

---

## Performance Considerations

1. **Timeout Settings**: 30-second timeout prevents hanging on slow API responses
2. **Similarity Threshold**: 20% minimum similarity filters out irrelevant results
3. **Result Limits**: 
   - Search bar: 200 articles max
   - Reference document: 100 articles max
4. **Query Optimization**: Drug names get exact match priority over general terms

---

## Monitoring & Debugging

### Console Logs to Check

When testing reference document upload:
```
Extracted drug names: ['AUGMENTIN']
Key terms: ['antibiotic', 'bacterial', 'infection', ...]
Search query: ("AUGMENTIN"[Title/Abstract]) OR (antibiotic[Title/Abstract] OR bacterial[Title/Abstract]...)
Found 45 articles in PubMed
Fetched 45 articles with abstracts
Filtered to 38 articles above 20% similarity threshold
```

### Error Messages

You'll now see specific errors instead of generic failures:
- "PubMed API is not responding. Please try again later."
- "No highly relevant articles found (minimum 20% similarity required)"
- Shows extracted drug names and key terms for debugging

---

## Deployment Notes

These changes are compatible with the existing Render.com deployment:
- No new dependencies added
- No environment variable changes needed
- Backward compatible with existing API calls
- Changes take effect immediately after redeployment

To deploy to Render:
```bash
git add .
git commit -m "Fix study type filtering and reference document search accuracy"
git push origin main
```

Render will automatically rebuild and deploy.

---

## Summary

| Issue | Status | Fix |
|-------|--------|-----|
| Search bar ignoring study type | ✅ Fixed | Added studyType to search pipeline |
| Reference doc upload failing | ✅ Fixed | Drug name detection + error handling |
| Generic error messages | ✅ Fixed | Specific error messages with context |
| Low relevance results | ✅ Improved | 20% similarity threshold + drug name priority |

All accuracy issues are now resolved. The system correctly filters by study type and successfully processes reference documents with drug names.
