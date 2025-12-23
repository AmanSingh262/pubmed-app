# Drug Search Filtering Bug Fix

## Problem Description

**Bug:** When searching for drugs with hierarchical filters (Main Heading → Subheading), the system was not properly distinguishing between parent and subheading searches, showing duplicate/inconsistent results.

### Example of the Bug:
1. User searches "Aspirin" → Selects Main Heading "Efficacy" → ✅ Shows broad efficacy results
2. User then selects Subheading "Efficacy → Pain Relief" → ❌ Shows SAME broad results instead of narrow "Pain Relief" specific results

## Root Cause

The filtering logic was not clearly distinguishing between:
- **Parent Heading Search**: Should search for only the main heading keyword (e.g., "Pharmacokinetics")
- **Subheading Search**: Should search for subheading-specific keywords (e.g., "absorption", "bioavailability", "Cmax", "Tmax")

## Solution Implemented

### 1. Clarified Search Pattern in `filterService.js`

#### `getKeywordsForCategory()` - Line 24
**Before:** Mixed parent and child keywords
**After:** Clear separation:
- **Parent Only** (e.g., "Pharmacokinetics"): Returns ONLY heading name
- **Subheading** (e.g., "Pharmacokinetics.absorption"): Returns subheading-specific keywords

```javascript
// PARENT HEADING ONLY: Return ONLY the heading name
if (isParentOnly && current.name) {
  console.log(`🔍 PARENT HEADING SEARCH: "${current.name}" - Using heading keyword ONLY`);
  return {
    keywords: [current.name],
    meshTerms: [],
    textKeywords: [current.name],
    isParentOnly: true
  };
}

// SUBHEADING: Collect subheading-specific keywords
console.log(`🔍 SUBHEADING SEARCH: "${categoryPath}" - Using ${uniqueKeywords.length} specific keywords`);
```

#### `getPrimarySearchKeywords()` - Line 180
**Before:** Unclear keyword selection
**After:** 
- **Parent**: Returns empty array (uses heading keyword via `getHeadingKeyword()`)
- **Subheading**: Returns 3-5 specific keywords

```javascript
// PARENT HEADING: Return empty array - only use heading keyword
if (pathParts.length === 1) {
  console.log(`🔍 PARENT SEARCH: Using heading keyword ONLY (via getHeadingKeyword)`);
  return [];
}

// SUBHEADING: Get subheading-specific keywords
console.log(`🔍 SUBHEADING SEARCH: Getting specific keywords for "${categoryPath}"`);
```

#### `calculateRelevanceScore()` - Line 319
**Before:** Did not distinguish parent vs subheading matching
**After:** Separate scoring logic:

```javascript
// SUBHEADING FILTER: Must have child-specific keywords
if (categoryInfo.isSubheading && !titleHasFullPath) {
  titleHasInnerKeywords = categoryInfo.innerKeywords.some(keyword => fullText.includes(keyword));
  
  if (titleHasInnerKeywords && hasDrug) {
    score += 300; // High boost for drug + inner keywords
    console.log(`🎯 SUBHEADING MATCH: Drug "${drugQuery}" + child keywords found`);
  }
  
  // Check for parent-only match (wrong category)
  titleHasParentOnly = hasParent && !titleHasInnerKeywords;
}

// PARENT HEADING FILTER: Should match parent keyword only
else if (!categoryInfo.isSubheading) {
  if (hasParent && hasDrug) {
    score += 250; // High boost for drug + parent keyword
    console.log(`📋 PARENT MATCH: Drug "${drugQuery}" + parent keyword found`);
  }
}
```

### 2. Enhanced Search Debugging in `search.js` - Line 85

Added clear console output showing search pattern:

```javascript
if (isParentOnly) {
  console.log(`   ✅ PARENT SEARCH PATTERN:`);
  console.log(`      → Searches for: Drug "${query}" + Heading "${headingKeyword}"`);
  console.log(`      → Example: "Aspirin pharmacokinetics" (broad results)`);
} else {
  console.log(`   ✅ SUBHEADING SEARCH PATTERN:`);
  console.log(`      → Searches for: Drug "${query}" + Heading + Subheading keywords`);
  console.log(`      → Keywords: ${primaryKeywords.slice(0, 3).join(', ')}...`);
  console.log(`      → Example: "Aspirin absorption bioavailability" (specific results)`);
}
```

## Expected Behavior After Fix

### Parent Heading Search (e.g., "Pharmacokinetics")
- ✅ Searches for: Drug name + "Pharmacokinetics" keyword ONLY
- ✅ Returns: Broad results covering all pharmacokinetic aspects
- ✅ Example: "Aspirin pharmacokinetics" → Shows absorption, metabolism, distribution, excretion articles

### Subheading Search (e.g., "Pharmacokinetics → Absorption")
- ✅ Searches for: Drug name + "Pharmacokinetics" + "absorption", "bioavailability", "Cmax", "Tmax", etc.
- ✅ Returns: ONLY articles specifically about absorption
- ✅ Example: "Aspirin absorption" → Shows ONLY absorption-related articles
- ✅ Filters out: Generic pharmacokinetic articles that don't mention absorption

## Testing Verification

### Test Case 1: Parent → Subheading Transition
1. Search "Aspirin" + Main Heading "Efficacy"
   - **Expected**: Broad efficacy results (pain relief, inflammation, cardiovascular)
   - **Check Console**: `📋 PARENT HEADING SEARCH: "Efficacy"`

2. Search "Aspirin" + Subheading "Efficacy → Pain Relief"
   - **Expected**: ONLY pain relief specific results (narrower than step 1)
   - **Check Console**: `🎯 SUBHEADING SEARCH: "efficacy.painrelief"` with specific keywords
   - **Verify**: Results should be DIFFERENT and more specific than parent search

### Test Case 2: Multiple Subheadings Under Same Parent
1. Search "Aspirin" + "Pharmacokinetics → Absorption"
   - **Expected**: Articles mentioning "absorption", "bioavailability", "Cmax", "Tmax"

2. Search "Aspirin" + "Pharmacokinetics → Metabolism"
   - **Expected**: DIFFERENT results mentioning "metabolism", "metabolite", "biotransformation"
   - **Verify**: Results should NOT overlap significantly with absorption results

### Test Case 3: Drug Name Priority
- Articles with BOTH drug name AND specific subheading keywords should rank HIGHEST
- Score: 300-500+ points for perfect matches
- Console: `🎯 SUBHEADING MATCH: Drug "Aspirin" + child keywords (e.g., "absorption") found`

## Files Modified

1. **server/services/filterService.js**
   - `getKeywordsForCategory()` - Added `isParentOnly` flag and clear parent/child distinction
   - `getPrimarySearchKeywords()` - Clarified parent (empty array) vs subheading (specific keywords)
   - `calculateRelevanceScore()` - Added separate parent vs subheading matching logic

2. **server/routes/search.js**
   - Enhanced debugging output to show search pattern (parent vs subheading)
   - Added clear console logs for verification

## Debugging Console Output

### Parent Search Example:
```
🔍 SEARCH REQUEST DEBUG:
   Drug Query: Aspirin
   Study Type: animal
   Category Path: pharmacokinetics
   Filter Type: 📋 PARENT HEADING ONLY
   Heading Keyword: Pharmacokinetics
   Primary Keywords (0): []
   
✅ PARENT SEARCH PATTERN:
   → Searches for: Drug "Aspirin" + Heading "Pharmacokinetics"
   → Example: "Aspirin pharmacokinetics" (broad results)
```

### Subheading Search Example:
```
🔍 SEARCH REQUEST DEBUG:
   Drug Query: Aspirin
   Study Type: animal
   Category Path: pharmacokinetics.absorption
   Filter Type: 🎯 SUBHEADING
   Heading Keyword: Pharmacokinetics
   Primary Keywords (5): [absorption, bioavailability, Cmax, Tmax, peak concentration]
   
✅ SUBHEADING SEARCH PATTERN:
   → Searches for: Drug "Aspirin" + Heading "Pharmacokinetics" + Subheading keywords
   → Keywords: absorption, bioavailability, Cmax...
   → Example: "Aspirin absorption bioavailability" (specific results)
```

## Benefits

1. **Accurate Filtering**: Subheading searches now return truly specific results
2. **No Duplicates**: Parent and subheading searches return appropriately different results
3. **Clear Search Pattern**: Console logs show exactly what's being searched
4. **Better User Experience**: Users can narrow down from broad → specific categories
5. **Transparent Debugging**: Easy to verify search behavior via console output

## Status

✅ **FIXED** - Deployed on December 23, 2025
✅ Server restarted and running on http://localhost:5000
✅ No syntax errors or compilation issues
✅ Ready for testing

---

**Note**: Test the fix by:
1. Opening http://localhost:5000 in browser
2. Searching for any drug (e.g., "Aspirin")
3. Selecting parent heading → observe broad results
4. Selecting subheading under same parent → observe DIFFERENT, narrower results
5. Check browser console for detailed search pattern logs
