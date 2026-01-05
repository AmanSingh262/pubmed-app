# Study Type Verification Guide

## Overview
The system now includes **Study Type Verification** filters to help you distinguish between animal and human studies with greater accuracy. This feature addresses the issue of incorrectly identified studies by applying stricter validation criteria.

## New Features

### 1. Verification Checkboxes
Located in the **Search Filters** panel, you'll find two new options under "Study Type Verification":

#### 🐾 Strict Animal Study Only
- **Purpose**: Ensures only genuine animal studies are returned
- **Validation Criteria**:
  - Must have clear animal species indicators in title (e.g., "in rats", "in mice", "rat model")
  - OR must have "Animals" MeSH term
  - AND must NOT have human study indicators (e.g., "patient", "clinical trial", "human volunteer")
  - AND must NOT have "Humans" MeSH term

#### 👨‍⚕️ Strict Human Study Only
- **Purpose**: Ensures only genuine human studies are returned
- **Validation Criteria**:
  - Must have clear human indicators in title/abstract (e.g., "patient", "clinical trial", "human volunteer")
  - OR must have "Humans" MeSH term
  - AND must NOT have obvious animal species indicators in title
  - AND must NOT have animal-only MeSH terms

### 2. Visual Verification Badges
When verification mode is enabled, articles that pass the strict validation will display a badge:

- **🐾 Verified Animal Study** - Green badge for confirmed animal studies
- **👨‍⚕️ Verified Human Study** - Purple badge for confirmed human studies

## How to Use

### Basic Usage
1. Enter your search query (e.g., drug name)
2. Select the study type (Animal or Human)
3. Choose your category filters
4. **Enable the appropriate verification checkbox**:
   - For animal studies: Check "Strict Animal Study Only"
   - For human studies: Check "Strict Human Study Only"
5. Click Search

### When to Use Verification Mode

✅ **Use Verification When:**
- You need high confidence that results are the correct study type
- You're conducting systematic reviews requiring strict inclusion criteria
- You've noticed incorrect study types in standard searches
- You need to minimize manual review of study type classification

⚠️ **Standard Mode (No Verification):**
- You want broader results
- You're doing exploratory research
- Some ambiguity in study type is acceptable

## Technical Implementation

### Frontend Changes
**Files Modified:**
- `client/src/components/SearchFilters.js` - Added verification checkboxes
- `client/src/App.js` - Added filter state management
- `client/src/components/ArticleCard.js` - Added verification badges
- `client/src/components/SearchFilters.css` - Styled verification section
- `client/src/components/ArticleCard.css` - Styled badges

### Backend Changes
**Files Modified:**
- `server/routes/search.js` - Enhanced filtering logic with verification mode

### Validation Algorithm

The system now uses a **multi-layer validation approach**:

1. **Standard Mode** (default):
   - Basic filtering to exclude obvious mismatches
   - Allows some ambiguous cases
   
2. **Verification Mode** (when enabled):
   - Requires positive evidence of correct study type
   - Excludes any articles with conflicting evidence
   - Checks title, abstract, and MeSH terms
   - Applies strict keyword matching

## Example Use Cases

### Example 1: Finding Animal Pharmacokinetics Studies
```
Search: "cefixime"
Study Type: Animal
Category: Pharmacokinetics > Absorption
✅ Enable: Strict Animal Study Only

Result: Only articles with clear animal species indicators
- "...bioavailability in rats..."
- "...mouse model of absorption..."
- Articles with "Animals" MeSH term
```

### Example 2: Finding Human Clinical Trials
```
Search: "aspirin"
Study Type: Human
Category: Safety Pharmacology
✅ Enable: Strict Human Study Only

Result: Only articles about human subjects
- "...randomized controlled trial in patients..."
- "...healthy human volunteers..."
- Articles with "Humans" MeSH term
```

## Benefits

1. **Improved Accuracy**: Reduces false positives in study type classification
2. **Time Savings**: Less manual review needed to verify study types
3. **Confidence**: Visual badges confirm verification status
4. **Flexibility**: Can toggle verification on/off based on needs
5. **Transparency**: Clear criteria for what constitutes verification

## Troubleshooting

### Too Few Results?
- Try disabling verification mode for broader results
- Some articles may lack clear study type indicators
- Consider using standard mode first to gauge total available literature

### Still Seeing Wrong Study Types?
- Verification mode is very strict but not perfect
- Some articles may have ambiguous or missing metadata
- Report persistent issues for further refinement

## Filter Combinations

Verification filters work alongside other filters:
- ✅ Publication Year Range
- ✅ Has Abstract
- ✅ Free Full Text
- ✅ Full Text Available
- ✅ Category Selection

All filters are applied together for comprehensive results.

## API Integration

If using the API directly, pass these parameters:
```javascript
{
  query: "drug name",
  studyType: "animal" | "human",
  categoryPath: "category.path",
  verifyAnimalStudy: true,  // Enable strict animal validation
  verifyHumanStudy: true    // Enable strict human validation
  // ... other filters
}
```

## Future Enhancements

Planned improvements:
- Machine learning-based study type classification
- Confidence scores for each article
- Customizable verification criteria
- Study type prediction for articles lacking MeSH terms

---

**Version**: 1.0  
**Last Updated**: January 2026  
**Status**: Production Ready
