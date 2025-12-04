# Clear Browser Cache Instructions

The backend server has been restarted with PMID normalization fixes.

## CRITICAL: Clear Browser Storage

Open your browser's DevTools Console (F12 or Right-click → Inspect → Console tab) and paste this command:

```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

This will:
1. Clear all stored cart data (including corrupted PMID objects)
2. Clear session storage
3. Reload the page with fresh data

## After Clearing:

1. Perform a fresh PubMed search
2. Add articles to cart
3. Click the cart icon - the error should be resolved

## What Was Fixed:

- **pubmedService.js**: Normalized PMIDs at the source (PubMed API)
- **All template routes**: V2, V3, V4 now normalize PMIDs
- **export.js**: Normalized in citations and CSV export
- **detailDocument.js & shortSummaryDoc.js**: Normalized in references
- **referenceDoc.js**: Already normalized

All PMIDs are now converted to strings before being sent to the frontend, preventing the React rendering error.
