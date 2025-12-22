# Subheading Priority Feature

## Overview
When a **subheading** is selected (like "Distribution" under "Pharmacokinetics"), the system now prioritizes articles that specifically focus on that subheading and its related keywords.

## Example
**User Selection:**
- Drug: `augmentin`
- Study Type: `Human Studies`
- Category: `Pharmacokinetics > Distribution`

## How It Works

### 1. **Subheading Name Priority** (HIGHEST)
When "Distribution" is selected:
- **+50 points** if "distribution" appears in the article title (10x normal keyword score)
- **+15 points per mention** in the abstract (7.5x normal score)

### 2. **Subheading-Specific Keywords** (HIGH)
Keywords that contain the subheading name get boosted scores:
- `Volume of distribution` → **2x MeSH scores** (40 exact, 30 partial vs 20/15)
- `Tissue Distribution` → **3x title scores** (25 vs 8)
- `distribution[tiab]` → **3x abstract scores** (6 vs 2)

### 3. **Multi-Location Bonus**
When subheading matches appear in multiple places:
- **1.6x multiplier** for matches in 2+ locations (title + abstract + MeSH)
- Ensures comprehensive coverage of the subheading topic

### 4. **Normal Keywords** (BASELINE)
Generic category keywords get standard scores:
- Pharmacokinetics-related terms: Normal scoring (8 for title, 2 for abstract)

## Scoring Breakdown

| Match Type | Normal Score | Subheading Score | Multiplier |
|-----------|-------------|------------------|-----------|
| **Subheading name in title** | 8 | **50** | **6.25x** |
| **Subheading name in abstract** | 2 | **15/mention** | **7.5x** |
| **MeSH exact match** | 20 | **40** | **2x** |
| **MeSH partial match** | 15 | **30** | **2x** |
| **Title keyword** | 8 | **25** | **3x** |
| **Abstract keyword** | 2 | **6** | **3x** |

## Benefits

✅ **Focused Results**: Articles directly about "Distribution" rank highest  
✅ **Reduced Noise**: Generic "Pharmacokinetics" articles rank lower  
✅ **Better Relevance**: Matches user's specific interest in the subheading  
✅ **Smart Filtering**: Still considers drug + subheading combination

## Technical Implementation

The system detects subheadings by checking the `categoryPath`:
- Main heading only: `"pharmacokinetics"` → Normal scoring
- Subheading selected: `"pharmacokinetics.distribution"` → Enhanced scoring

Keywords are categorized as subheading-specific if they:
- Match the subheading name exactly (`distribution`)
- Contain the subheading name (`Volume of distribution`, `Tissue Distribution`)

## Code Changes
- Modified `calculateRelevanceScore()` to accept `categoryPath` parameter
- Added subheading detection logic
- Implemented 2-3x score multipliers for subheading-specific keywords
- Added multi-location bonus (1.6x) for comprehensive matches
- Updated `filterAndRankArticles()` to pass `categoryPath`

## Result
When you search "augmentin" + "Pharmacokinetics > Distribution", you now get articles that specifically discuss the **distribution** of augmentin, rather than generic pharmacokinetics articles.
