# Complete Match Tracking and Drug Synonym System

## Overview
This document describes the comprehensive improvements made to fix false positive article matching and add drug synonym support with visual match indicators.

## Problems Fixed

### 1. **False Positive Category Matching**
**Problem**: Articles with only parent keywords (e.g., "pharmacokinetics") were appearing in specific subheading searches (e.g., "Distribution") even when they didn't contain specific distribution-related data.

**Example**: Article titled "Pharmacokinetics of amoxycillin and clavulanic acid" appearing under "Distribution" filter when the study measured volume of distribution but did NOT report that distribution was 100%.

**Solution**: 
- Enhanced keyword matching to require SPECIFIC subheading keywords
- Added comprehensive keyword variations for each subcategory
- Distribution filter now requires: "Volume of Distribution", "Vd", "Protein binding", "Distribution", "Cytochrome"
- Articles with only generic "pharmacokinetics" keyword will NOT match "Distribution" unless specific distribution terms are found

### 2. **Drug Synonym Matching**
**Problem**: Searching for brand name "augmentin" would not find articles that only mention the generic name "amoxicillin-clavulanic acid" or variations like "amoxycillin and clavulanic acid".

**Solution**: 
- Created `DrugSynonymService` with comprehensive drug synonym mappings
- Supports 20+ drug families including:
  - augmentin → amoxicillin-clavulanic acid, co-amoxiclav, amoxycillin and clavulanic acid
  - aspirin → acetylsalicylic acid, ASA
  - paracetamol → acetaminophen, APAP
  - metformin → glucophage, dimethylbiguanide
- Drug matching now checks all synonym variations
- Returns matched terms in results

### 3. **Visual Match Indicators**
**Problem**: No visibility into which checks passed/failed for each article.

**Solution**: Added `matchSummary` object to each article result with formatted strings:
```
✅ Drug: augmentin (also: amoxicillin-clavulanic acid) | TITLE, 3×
✅ Subheading: Distribution, Vd | TITLE
✅ Inner Keywords: protein binding, cytochrome | ABSTRACT
✅ Study Design: Randomized Controlled Trial (high confidence)
```

## Implementation Details

### Drug Synonym Service (`server/services/drugSynonymService.js`)

```javascript
class DrugSynonymService {
  constructor() {
    this.synonymMap = {
      // Brand name → [generic names and variations]
      'augmentin': ['amoxicillin-clavulanic acid', 'co-amoxiclav', 'amoxycillin and clavulanic acid'],
      'aspirin': ['acetylsalicylic acid', 'ASA', 'acetyl salicylic acid'],
      // ... 20+ drug families
    };
  }

  // Get all synonym variations for a drug
  getSynonyms(drugName) { ... }

  // Check if text contains drug or any synonyms
  matchDrugSynonyms(text, drugName) {
    // Returns: { found, matchedTerms, count, allSynonyms }
  }
}
```

### Filter Service Updates

#### Drug Matching with Synonyms
```javascript
// OLD: Direct string matching
const drugRegex = new RegExp(`\\b${drugQueryLower}\\b`, 'gi');
drugInTitle = drugRegex.test(titleStr);

// NEW: Synonym-aware matching
const titleMatch = this.drugSynonymService.matchDrugSynonyms(titleStr, drugQuery);
const abstractMatch = this.drugSynonymService.matchDrugSynonyms(abstractStr, drugQuery);

drugInTitle = titleMatch.found;
matchDetails.drugNameMatch.matchedTerms = fullTextMatch.matchedTerms;
matchDetails.drugNameMatch.queriedDrug = drugQuery;
```

#### Visual Match Summary
```javascript
createMatchSummary(matchDetails, drugQuery) {
  return {
    drugName: '✅ Drug: augmentin (also: amoxicillin-clavulanic acid) | TITLE, 3×',
    category: '✅ Subheading: Distribution, Vd | TITLE',
    innerKeywords: '✅ Inner Keywords: protein binding | ABSTRACT',
    studyDesign: '✅ Study Design: RCT (high confidence)'
  };
}
```

### Enhanced Keyword Mappings

#### Pharmacokinetics Synonyms
Added to `keywordMappings.json`:
```json
"pharmacokinetics": {
  "name": "Pharmacokinetics",
  "synonyms": ["PK", "kinetic", "kinetics", "ADME", "Pharmaco-kinetic", "Pharma-cokinetic"]
}
```

#### Method of Analysis
- **Added**: HPLC, LC-MS, LCMS, High-performance liquid chromatography
- **Purpose**: Detect analytical methods used in pharmacokinetic studies

#### Absorption Keywords
- **Added**: AUC, Area Under Curve, Maximum drug concentration, bioavailability
- **MeSH Terms**: Drug Absorption[MeSH], Biological Availability[MeSH]
- **Text Keywords**: Cmax, Tmax, AUC, peak concentration, bioavailability

#### Distribution Keywords (ULTRA STRICT)
- **Required Keywords**: Volume of Distribution, Vd, Protein binding, Distribution, Cytochrome
- **Purpose**: Ensure only articles with ACTUAL distribution data match this filter
- **MeSH Terms**: Tissue Distribution[MeSH], Protein Binding[MeSH]
- **Text Keywords**: Vd[tiab], V d[tiab], Protein binding[tiab], Distribution[tiab]

#### Metabolism Keywords
- **Added**: CYP, Metabolite, Biotransformation, Cytochrome
- **Purpose**: Identify metabolic pathway studies
- **MeSH Terms**: Cytochrome P-450 Enzyme System[MeSH]

#### Excretion Keywords
- **Added**: t1/2, Elimination, Clearance, Half-life
- **Purpose**: Identify elimination and clearance studies
- **Text Keywords**: t1/2[tiab], t½[tiab], Elimination[tiab], Clearance[tiab]

## Match Tracking System

### Match Details Structure
```javascript
matchDetails = {
  drugNameMatch: {
    found: true,
    location: 'title',
    count: 3,
    matchedTerms: ['amoxicillin-clavulanic acid', 'co-amoxiclav'],
    queriedDrug: 'augmentin'
  },
  headingMatch: {
    found: true,
    matchedTerms: ['Pharmacokinetics'],
    location: 'title'
  },
  subheadingMatch: {
    found: true,
    matchedTerms: ['Distribution', 'Vd'],
    location: 'title'
  },
  innerKeywordsMatch: {
    found: true,
    matchedTerms: ['protein binding', 'cytochrome'],
    location: 'abstract'
  },
  studyDesignMatch: {
    found: true,
    design: 'Randomized Controlled Trial',
    confidence: 'high'
  }
}
```

## API Response Format

### Article with Match Summary
```json
{
  "pmid": "12345678",
  "title": "Pharmacokinetics and protein binding of augmentin in healthy volunteers",
  "abstract": "...",
  "relevanceScore": 235,
  "matches": {
    "drugMatches": ["augmentin", "amoxicillin-clavulanic acid"],
    "categoryMatches": ["Distribution", "Vd", "protein binding"]
  },
  "matchDetails": {
    "drugNameMatch": {
      "found": true,
      "location": "title",
      "count": 2,
      "matchedTerms": ["amoxicillin-clavulanic acid"],
      "queriedDrug": "augmentin"
    },
    "subheadingMatch": {
      "found": true,
      "matchedTerms": ["Distribution", "protein binding"],
      "location": "title"
    },
    "studyDesignMatch": {
      "found": true,
      "design": "Randomized Controlled Trial",
      "confidence": "high"
    }
  },
  "matchSummary": {
    "drugName": "✅ Drug: augmentin (also: amoxicillin-clavulanic acid) | TITLE, 2×",
    "category": "✅ Subheading: Distribution, protein binding | TITLE",
    "innerKeywords": "✅ Inner Keywords: Vd | ABSTRACT",
    "studyDesign": "✅ Study Design: Randomized Controlled Trial (high confidence)"
  }
}
```

## How to Display Match Checks in Frontend

### Example Implementation
```javascript
// In your React component
function ArticleCard({ article }) {
  return (
    <div className="article-card">
      <h3>{article.title}</h3>
      
      {/* Match Summary Display */}
      <div className="match-checks">
        <div className="check-item">{article.matchSummary.drugName}</div>
        <div className="check-item">{article.matchSummary.category}</div>
        <div className="check-item">{article.matchSummary.innerKeywords}</div>
        <div className="check-item">{article.matchSummary.studyDesign}</div>
      </div>
      
      {/* Detailed Match Info */}
      {article.matchDetails.drugNameMatch.found && (
        <div className="drug-info">
          <strong>Searched:</strong> {article.matchDetails.drugNameMatch.queriedDrug}
          <br />
          <strong>Also found:</strong> {article.matchDetails.drugNameMatch.matchedTerms.join(', ')}
        </div>
      )}
    </div>
  );
}
```

## Testing the Improvements

### Test Case 1: Distribution Filter
**Search**: Drug: "augmentin", Category: "Human Studies → Pharmacokinetics → Distribution"

**Expected Behavior**:
- ✅ Should match: Articles containing "distribution", "Vd", "volume of distribution", "protein binding"
- ❌ Should NOT match: Articles with only "pharmacokinetics" in title without specific distribution keywords

### Test Case 2: Drug Synonym Matching
**Search**: Drug: "augmentin"

**Expected Behavior**:
- Should find articles containing:
  - "augmentin" (exact match)
  - "amoxicillin-clavulanic acid" (generic name)
  - "co-amoxiclav" (alternative generic)
  - "amoxycillin and clavulanic acid" (spelling variation)
- Should display in results: "✅ Drug: augmentin (also: amoxicillin-clavulanic acid) | TITLE"

### Test Case 3: Visual Match Indicators
**Expected Behavior**:
- Every article should show 4 match indicators:
  1. Drug name match (with synonyms if found)
  2. Category/subheading match (heading or subheading keywords)
  3. Inner keywords match (specific subcategory terms)
  4. Study design match (if detected)

## Benefits

1. **Accuracy**: Articles only appear in relevant categories with specific keyword matches
2. **Transparency**: Users see exactly WHY each article matched their search
3. **Drug Discovery**: Find articles by brand name or generic name automatically
4. **Confidence**: Visual indicators show match quality and location (title vs abstract)
5. **Study Design Awareness**: See what type of study each article represents

## Future Enhancements

1. **Custom Drug Synonyms**: Allow users to add their own drug synonym mappings
2. **Confidence Scoring**: Show numerical confidence scores for each match type
3. **Filter by Match Type**: Allow filtering by "Title matches only" or "High confidence matches"
4. **Match Highlighting**: Highlight matched keywords in article text display
5. **Synonym Learning**: Automatically learn new drug synonyms from search patterns

## Maintenance

### Adding New Drug Synonyms
Edit `server/services/drugSynonymService.js`:
```javascript
this.synonymMap = {
  // Add new entry
  'zithromax': ['azithromycin', 'azithromycine'],
  // ... existing entries
};
```

### Adding New Keywords
Edit `server/data/keywordMappings.json`:
```json
{
  "humanStudies": {
    "categories": {
      "pharmacokinetics": {
        "subcategories": {
          "newSubcategory": {
            "name": "New Subcategory",
            "keywords": [...],
            "meshTerms": [...],
            "textKeywords": [...]
          }
        }
      }
    }
  }
}
```

## Summary

This update provides:
- ✅ **Drug synonym matching** with 20+ drug families
- ✅ **Visual match indicators** showing what matched and where
- ✅ **Ultra-strict keyword filtering** to eliminate false positives
- ✅ **Comprehensive keyword hierarchies** for all study categories
- ✅ **Transparent matching** with detailed match information
- ✅ **Study design detection** for 25+ study types

The system now provides accurate, transparent, and comprehensive article matching with full visibility into WHY each article was selected.
