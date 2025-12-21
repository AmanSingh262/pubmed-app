# Priority Search Enhancement - Drug + Filter Matching

## Overview
Enhanced the search system to prioritize articles that contain **BOTH** the searched drug/query AND the selected filter keywords. This ensures the most relevant articles appear at the top of search results.

## Implementation Details

### 1. Modified `filterService.js`

#### Updated `calculateRelevanceScore()` method:
- **New Parameter**: Added `drugQuery` parameter to pass the drug/search term
- **Priority Boost Logic**: 
  - Checks if article contains both the drug query AND filter keywords
  - If **drug in title** + filters matched: **+100 points** 
  - If **drug in abstract** + filters matched: **+50 points**
  - If drug mentioned **multiple times** (>2): **+20 additional points**
- **New Return Value**: Added `hasDrugAndFilter` flag to identify high-priority articles

#### Updated `filterAndRankArticles()` method:
- **New Parameter**: Added `drugQuery` parameter 
- **Enhanced Sorting**: 
  1. Primary: Sort by relevance score (includes drug+filter boost)
  2. Secondary: Prioritize articles with `hasDrugAndFilter=true`
  3. Tertiary: Sort by number of match types
- **Console Logging**: Shows count of articles with both drug and filters

### 2. Modified `search.js` Route

#### Main Search Endpoint (`POST /api/search`):
- Now passes the `query` parameter to `filterAndRankArticles()` as the drug term
- Enhanced sorting logic to ensure dual-match articles rank highest
- Preserves `hasDrugAndFilter` flag when combining results from multiple categories
- Console logs show count of prioritized articles

#### Batch Search Endpoint (`POST /api/search/batch`):
- Also passes `query` parameter to enable priority boosting
- Consistent behavior across all search methods

## How It Works

### Example Scenario:
**Search Query**: "cefixime"  
**Selected Filter**: "Pharmacokinetics > Absorption"

### Before Enhancement:
- Articles ranked only by filter keyword matches
- Drug presence not factored into priority
- Articles with drug mentioned but weak filter matches could rank low

### After Enhancement:
- Articles containing **"cefixime" + absorption keywords** = **HIGHEST PRIORITY**
  - Score: 100+ points if drug in title
  - Score: 50+ points if drug in abstract
- Articles with **only filter keywords** = Medium priority
- Articles with **only drug name** = Low priority (if no filter match)

## Benefits

1. **Highly Relevant Results First**: Articles discussing the specific drug in the context of selected filters appear at the top
2. **Better User Experience**: Users immediately see the most pertinent articles
3. **Reduced Search Time**: No need to scroll through results to find drug-specific articles
4. **Intelligent Ranking**: Multi-level scoring ensures best matches rise to the top

## Technical Details

### Score Calculation Example:
```
Base filter match score: 25 points (from MeSH/title/abstract matches)
+ Drug in title: +100 points
+ Multiple drug mentions: +20 points
─────────────────────────────
Total Score: 145 points (HIGH PRIORITY)
```

### Console Output:
```
🔥 HIGH PRIORITY: Article contains both "cefixime" and filter keywords (Score: 145)
Articles with both drug and filters: 15
```

## Files Modified

1. **server/services/filterService.js**
   - `calculateRelevanceScore()` - Added drugQuery parameter and priority logic
   - `filterAndRankArticles()` - Added drugQuery parameter and enhanced sorting

2. **server/routes/search.js**
   - Main search endpoint - Passes query to filter service
   - Batch search endpoint - Passes query to filter service
   - Enhanced result sorting and logging

## Testing

To verify the enhancement:
1. Search for a drug (e.g., "cefixime")
2. Select a filter category (e.g., "Pharmacokinetics > Absorption")
3. Check console logs for "HIGH PRIORITY" messages
4. Verify top results contain both drug name and filter keywords
5. Compare article scores - dual-match articles should have scores 50-120+ points higher

## Future Enhancements

Potential improvements:
- Weight boost based on drug mention frequency
- Consider drug synonyms and brand names
- Adjust boost values based on user feedback
- Add visual indicator in UI for dual-match articles
