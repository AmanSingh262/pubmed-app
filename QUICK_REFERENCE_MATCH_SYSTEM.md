# Quick Reference: Match Tracking & Drug Synonyms

## What's Fixed

### 1. Wrong Category Results ❌ → ✅
**Before**: Article about "Pharmacokinetics" shows under "Distribution" filter even without distribution data

**After**: Only shows articles containing SPECIFIC distribution keywords:
- Volume of Distribution
- Vd
- Protein binding
- Distribution
- Cytochrome

### 2. Drug Synonym Matching 🔍
**Before**: Search "augmentin" → misses "amoxicillin-clavulanic acid" articles

**After**: Search "augmentin" → finds ALL variations:
- augmentin
- amoxicillin-clavulanic acid
- co-amoxiclav
- amoxycillin and clavulanic acid

### 3. Visible Match Checks ✅
Every article now shows 4 checks:

```
✅ Drug: augmentin (also: amoxicillin-clavulanic acid) | TITLE, 2×
✅ Subheading: Distribution, Vd | TITLE
✅ Inner Keywords: protein binding | ABSTRACT
✅ Study Design: Randomized Controlled Trial (high confidence)
```

## API Response Format

```json
{
  "pmid": "12345678",
  "title": "Article title...",
  "matchSummary": {
    "drugName": "✅ Drug: augmentin (also: amoxicillin-clavulanic acid) | TITLE, 2×",
    "category": "✅ Subheading: Distribution, Vd | TITLE",
    "innerKeywords": "✅ Inner Keywords: protein binding | ABSTRACT",
    "studyDesign": "✅ Study Design: RCT (high confidence)"
  },
  "matchDetails": {
    "drugNameMatch": {
      "found": true,
      "location": "title",
      "count": 2,
      "matchedTerms": ["amoxicillin-clavulanic acid"],
      "queriedDrug": "augmentin"
    }
  }
}
```

## Supported Drug Synonyms (20+ Families)

| Brand Name | Generic Names & Variations |
|------------|---------------------------|
| augmentin | amoxicillin-clavulanic acid, co-amoxiclav |
| aspirin | acetylsalicylic acid, ASA |
| paracetamol | acetaminophen, APAP |
| zithromax | azithromycin, azithromycine |
| cipro | ciprofloxacin |
| glucophage | metformin, dimethylbiguanide |
| motrin | ibuprofen |
| tylenol | acetaminophen, paracetamol |
| lipitor | atorvastatin |
| zocor | simvastatin |
| norvasc | amlodipine |
| lasix | furosemide |
| coumadin | warfarin |
| plavix | clopidogrel |
| nexium | esomeprazole |
| prilosec | omeprazole |
| zyrtec | cetirizine |
| allegra | fexofenadine |
| singulair | montelukast |
| prozac | fluoxetine |

## Enhanced Keywords

### Pharmacokinetics
**Synonyms**: PK, kinetic, kinetics, ADME, Pharmaco-kinetic

**Subcategories**:

#### Method of Analysis
- HPLC, LC-MS, LCMS
- High-performance liquid chromatography
- Bioanalytical Method Validation

#### Absorption
- Bioavailability
- Cmax, Tmax, AUC
- Area Under Curve
- Maximum drug concentration
- Peak plasma concentration

#### Distribution (ULTRA STRICT)
- **Volume of Distribution**
- **Vd**
- **Protein binding**
- **Distribution**
- **Cytochrome**
- Tissue Penetration

#### Metabolism
- CYP, CYP450
- Metabolite
- Biotransformation
- Cytochrome P450 Enzymes

#### Excretion
- Elimination
- Clearance
- Half-life, t1/2
- Renal Clearance

### Efficacy

#### Placebo-Controlled
- RCT, Randomized Controlled Trial
- Double-Blind
- Placebo Group
- Intention-to-Treat

#### Active-Controlled
- Active Comparator
- Non-Inferiority Trial
- Head-to-Head Comparison

#### Meta Analysis
- Systematic Reviews
- Network Meta-Analysis
- Evidence synthesis

#### Paediatrics
- Pediatric Population
- Child, Infant, Adolescent
- Pediatric Clinical Trials

#### Dosage
- Dose-Response Relationship
- Maximum Tolerated Dose (MTD)
- Dose Optimization
- Dosing Regimen

### Safety

#### Adverse Drug Reactions (ADR)
- Adverse Event (AE)
- Serious Adverse Event (SAE)
- Side Effect
- Pharmacovigilance

#### Special Warnings
- Contraindications
- Black Box Warning
- Risk-Benefit Analysis

#### Pregnancy
- Teratogenicity
- Fetal Risk
- Pregnancy safety
- Drug use in pregnancy

#### Breast-feeding
- Drug Transfer into Breast Milk
- Milk-to-Plasma Ratio
- Infant Exposure

#### Fertility
- Reproductive Toxicity
- Infertility Risk
- Fertility safety

#### Overdose
- Toxic Dose
- Poisoning
- Acute Toxicity
- Antidote

#### Post-marketing
- Pharmacovigilance
- Safety Signal Detection
- Real-World Evidence

## How to Use

### Frontend Display
```javascript
function ArticleCard({ article }) {
  return (
    <div className="article">
      <h3>{article.title}</h3>
      
      {/* Show match checks */}
      <div className="checks">
        <div>{article.matchSummary.drugName}</div>
        <div>{article.matchSummary.category}</div>
        <div>{article.matchSummary.innerKeywords}</div>
        <div>{article.matchSummary.studyDesign}</div>
      </div>
      
      {/* Show synonyms found */}
      {article.matchDetails.drugNameMatch.matchedTerms.length > 0 && (
        <p>Also found: {article.matchDetails.drugNameMatch.matchedTerms.join(', ')}</p>
      )}
    </div>
  );
}
```

## Testing

### Test Distribution Filter
**Search**: Drug: "augmentin", Category: "Distribution"

**Should Match**:
- ✅ Articles with "Volume of Distribution", "Vd", "protein binding"

**Should NOT Match**:
- ❌ Articles with only "pharmacokinetics" (no specific distribution terms)

### Test Drug Synonyms
**Search**: Drug: "augmentin"

**Should Find**:
- Articles with "augmentin"
- Articles with "amoxicillin-clavulanic acid"
- Articles with "co-amoxiclav"

**Display Should Show**:
```
✅ Drug: augmentin (also: amoxicillin-clavulanic acid) | TITLE
```

## Files Modified

1. ✅ `server/services/drugSynonymService.js` - NEW drug synonym matching
2. ✅ `server/services/filterService.js` - Integrated synonym matching + visual summaries
3. ✅ `server/data/keywordMappings.json` - Enhanced with 100+ new keywords

## Summary

✅ **Accurate filtering** - No more false positive matches
✅ **Drug synonyms** - Find articles by any drug name variation
✅ **Visual checks** - See exactly what matched in each article
✅ **Comprehensive keywords** - 200+ keywords across all categories
✅ **Transparent matching** - Full visibility into why articles matched

---

**Status**: Ready to use! Server already running with all improvements.
