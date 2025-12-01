# Template Placeholders - Quick Reference Card

## 📋 Complete List of Available Placeholders

Copy and paste these into your Word template where you want content inserted.

### 📄 Article Metadata
```
{drug_name}              - Drug/compound name
{pmid}                   - PubMed ID number
{title}                  - Article title
{authors}                - Authors list
{journal}                - Journal name
{publication_year}       - Publication year
{doi}                    - Digital Object Identifier
```

### 📖 Abstract Sections
```
{abstract}               - FULL abstract text (complete, not excerpt)
{abstract_background}    - Background/Introduction section
{abstract_methods}       - Methods/Materials section
{abstract_results}       - Results/Findings section
{abstract_conclusions}   - Conclusions/Discussion section
{study_objectives}       - Study objectives/purpose
```

### 💊 Pharmacology
```
{pharmacology}                - General pharmacology content
{primary_pharmacodynamics}    - Primary pharmacodynamic effects
{mechanism_of_action}         - Mechanism of action
{receptor_binding}            - Receptor binding information
```

### 🔬 Pharmacokinetics (PK/ADME)
```
{pharmacokinetics}       - General PK content
{adme}                   - ADME overview
{absorption}             - Absorption data
{distribution}           - Distribution data
{metabolism}             - Metabolism data
{excretion}              - Excretion data
```

### ⚠️ Toxicology
```
{toxicology}                - General toxicology content
{genotoxicity}              - Genotoxicity studies
{carcinogenicity}           - Carcinogenicity data
{reproductive_toxicity}     - Reproductive toxicity
{developmental_toxicity}    - Developmental toxicity
{acute_toxicity}            - Acute toxicity studies
{chronic_toxicity}          - Chronic toxicity studies
```

### 📚 Abbreviations
```
{abbreviations_list}     - Formatted table with borders showing abbreviations
                          - Automatically extracted abbreviations
                          - Common pharma terms (PK, PD, ADME, etc.)
                          - Displays in proper table format with borders

Example output:
┌─────────────────────┬──────────────────────────────────────────────────┐
│ Abbreviation        │ Definition                                       │
├─────────────────────┼──────────────────────────────────────────────────┤
│ AUC                 │ area under the curve                             │
│ CNS                 │ central nervous system                           │
│ Cmax                │ maximal plasma concentrations                    │
│ PK                  │ pharmacokinetics                                 │
└─────────────────────┴──────────────────────────────────────────────────┘
```

**For Word Table Format:**
```
Create a table in your Word template with 2 columns, then use:

| Abbreviation | Definition |
|--------------|------------|
| {#abbreviations}{abbr}{/abbreviations} | {#abbreviations}{fullTerm}{/abbreviations} |

Or use row loop:
First row (header): Abbreviation | Definition
Second row: {#abbreviations}{abbr} | {fullTerm}{/abbreviations}
```

---

## 🎯 Example Template Snippet

```
MODULE 2.4: NONCLINICAL OVERVIEW

Drug Substance: {drug_name}
Reference: PMID {pmid}

1. SUMMARY
Title: {title}
Authors: {authors}
Journal: {journal}, {publication_year}

2. ABSTRACT
{abstract}

3. PHARMACOLOGY
3.1 Mechanism of Action
{mechanism_of_action}

3.2 Primary Pharmacodynamics
{primary_pharmacodynamics}

3.3 Receptor Binding
{receptor_binding}

4. PHARMACOKINETICS
4.1 Absorption
{absorption}

4.2 Distribution
{distribution}

4.3 Metabolism
{metabolism}

4.4 Excretion
{excretion}

5. TOXICOLOGY
{toxicology}

5.1 Genotoxicity
{genotoxicity}

5.2 Carcinogenicity
{carcinogenicity}

6. LIST OF ABBREVIATIONS
{abbreviations_list}
```

---

## ⚡ Quick Tips

1. **Exact Names Required**: Placeholders are case-sensitive and must match exactly
   - ✅ `{pharmacology}` 
   - ❌ `{Pharmacology}` or `{PHARMACOLOGY}`

2. **Curly Braces Required**: Must use `{` and `}`
   - ✅ `{abstract}`
   - ❌ `[abstract]` or `<abstract>`

3. **No Spaces**: Don't add spaces inside braces
   - ✅ `{drug_name}`
   - ❌ `{ drug_name }`

4. **Underscores for Multi-word**: Use underscores, not hyphens or spaces
   - ✅ `{mechanism_of_action}`
   - ❌ `{mechanism-of-action}` or `{mechanism of action}`

5. **Preview First**: Use Preview to see which placeholders have content available

---

## 🔍 Content Availability

Not all placeholders will have content for every article. Common availability:

| Placeholder | Typical Availability |
|------------|---------------------|
| `{abstract}` | ✅ 95% of articles |
| `{abbreviations_list}` | ✅ 90% (auto-generated) |
| `{pharmacology}` | ⚠️ 60% (depends on article type) |
| `{pharmacokinetics}` | ⚠️ 50% (PK/ADME articles) |
| `{toxicology}` | ⚠️ 40% (tox studies) |
| `{genotoxicity}` | ⚠️ 20% (specific studies) |

**Tip**: Use Preview to check what content is available before generating the final document.

---

## 📝 Fallback Text

If a placeholder has no content, it will show:
- For sections: "No [section name] information available in this article."
- For abbreviations: "No abbreviations were found in the article abstract."

You can edit the generated document afterward to add manual content or remove empty sections.

---

**Quick Access**: Keep this reference open while editing your Word template!
