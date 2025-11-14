# Recent Updates - November 12, 2025

## Major Features Added

### 1. ✅ Study Type Filtering (Human vs Animal)
**Problem:** When searching for human studies, rat and other animal articles were appearing in results.

**Solution:** Implemented intelligent study type filtering in `filterService.js`:
- Added `shouldExcludeArticle()` method that checks article content for species-specific keywords
- Animal keywords: rat, mouse, rabbit, dog, cat, pig, monkey, rodent, etc.
- Human keywords: human, patient, subject, volunteer, clinical trial, etc.
- For **human studies**: Excludes articles with animal keywords unless they also mention humans
- For **animal studies**: Excludes articles with only human keywords

### 2. ✅ Multi-Category Selection
**Problem:** Users could only select one category at a time. Wanted to combine filters (e.g., Pharmacodynamics + Related to Proposed Indication).

**Solution:** Implemented multi-selection support:
- Changed `selectedCategory` (single) → `selectedCategories` (array) in `App.js`
- Added checkbox UI to all category levels in `CategoryTree.js`
- Categories can now be toggled on/off (checkboxes appear next to each category)
- Backend combines keywords from all selected categories
- Articles matching any selected category are included
- Relevance scores are boosted (+2 points) for articles appearing in multiple categories
- Duplicate articles (same PMID) are deduplicated, keeping highest score

### 3. ✅ Main Category Heading Selection
**Problem:** Could only select leaf nodes (specific types). Couldn't select broad categories like "Pharmacokinetics" or "Pharmacodynamics".

**Solution:** 
- Added checkboxes to main category headings and subcategory headings
- When a main heading is selected (e.g., "Pharmacokinetics"), it collects ALL keywords from all its subcategories and types
- Updated `getKeywordsForCategory()` to recursively collect keywords from child categories
- Users can now mix broad and specific selections (e.g., "Pharmacokinetics" + "Secondary Pharmacodynamics")

## Technical Changes

### Frontend Changes

#### `client/src/App.js`
- Changed state from `selectedCategory` to `selectedCategories` (array)
- Added `handleToggleCategory()` to add/remove categories from selection
- Updated search to send comma-separated category paths
- Added UI to display all selected categories with remove buttons
- Shows count of selected categories

#### `client/src/components/CategoryTree.js`
- Added checkbox UI to category headers and subcategory headers
- Changed from single-select to multi-select behavior
- Added `category-checkbox` elements with hover and selected states
- Categories can be toggled independently

#### `client/src/components/CategoryTree.css`
- Added styles for `category-header-wrapper` and `subcategory-header-wrapper`
- Styled `category-checkbox` with gradient background when selected
- Added hover effects for checkboxes

#### `client/src/App.css`
- Added `selected-categories-list` styles
- Styled `selected-category-item` with gradient background
- Added `btn-remove-category` for removing individual selections

### Backend Changes

#### `server/services/filterService.js`
- **New method:** `shouldExcludeArticle(article, studyType)` - Filters articles by study type
- **Updated:** `getKeywordsForCategory()` - Now recursively collects keywords from subcategories
- **Updated:** `filterAndRankArticles()` - Calls `shouldExcludeArticle()` before scoring
- Logs number of excluded articles

#### `server/routes/search.js`
- **Updated:** POST `/api/search` route to handle comma-separated category paths
- Splits `categoryPath` by commas if multiple categories selected
- Uses Map to deduplicate articles by PMID
- Combines matches from different categories
- Boosts relevance score (+2) for articles matching multiple categories
- Returns combined and sorted results

## How to Use New Features

### Multi-Category Selection
1. Click the checkboxes next to any categories you want to include
2. You can select:
   - Main headings (e.g., "Pharmacokinetics") for broad search
   - Subcategories (e.g., "Absorption") for medium specificity
   - Specific types (e.g., "Bioavailability") for precise filtering
3. Mix and match any combination
4. Selected categories appear in the "Selected Categories" panel
5. Click × to remove individual categories or "Clear Filters" to remove all

### Example Use Cases
- **Broad Search:** Select "Pharmacokinetics" to get all PK-related articles
- **Combined Search:** Select "Pharmacodynamics" + "Related to Proposed Indication" to find articles matching either category
- **Precise Search:** Select "Absorption" + "Distribution" + "Metabolism" to focus on ADME

### Study Type Filtering
- Human studies now automatically exclude animal-only articles
- Animal studies exclude human-only articles
- Mixed articles (mentioning both) are included appropriately

## Performance Notes
- Multi-category searches may take slightly longer (1-2 seconds) as keywords are combined
- Deduplication ensures no article appears twice
- Cache still works - subsequent searches are faster

## Files Modified
1. `client/src/App.js`
2. `client/src/App.css`
3. `client/src/components/CategoryTree.js`
4. `client/src/components/CategoryTree.css`
5. `server/routes/search.js`
6. `server/services/filterService.js`

## Testing Recommendations
1. Test selecting multiple leaf categories
2. Test selecting a main heading + specific subcategory
3. Search "cefixime" in Human Studies and verify no rat articles appear
4. Select 3-4 different categories and verify results include articles matching any of them
5. Check that articles appearing in multiple categories show higher relevance scores
