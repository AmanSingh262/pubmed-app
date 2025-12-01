# Template Document Generator V2 - User Guide

## 🎯 What's New in V2?

**V2 preserves your ENTIRE template document** - including Table of Contents, List of Abbreviations, all formatting, headers, footers, and page breaks. You just add placeholders where you want content!

### Key Differences:
- **V1**: Created new documents, lost ToC and formatting ❌
- **V2**: Preserves everything, fills placeholders ✅

---

## 🚀 Quick Start

### Step 1: Prepare Your Template

1. Open your existing Nonclinical Overview template in Microsoft Word
2. Find places where you want article data inserted
3. Add placeholders using curly braces: `{placeholder_name}`

**Example:**

Before:
```
4.2 Pharmacology
[Add pharmacology information here]
```

After:
```
4.2 Pharmacology
{pharmacology}
```

### Step 2: Use the System

1. Search for articles in PubMed
2. Select article(s) you want to extract data from
3. Click "Template Doc" button
4. Upload your prepared template
5. Click "Generate Document"
6. Download your filled template!

---

## 📋 Available Placeholders

### Basic Information
```
{drug_name}          - Drug/compound name from article
{strength}           - Dosage strength (if mentioned)
{dosage_form}        - Tablet, capsule, injection, etc.
{pmid}               - PubMed ID
{article_title}      - Full article title
{authors}            - Author names
{journal}            - Journal name
{publication_date}   - Publication date
{abstract}           - Complete abstract text
```

### Pharmacology Section
```
{pharmacology}                  - General pharmacology information
{mechanism_of_action}           - How the drug works
{primary_pharmacodynamics}      - Primary effects
{secondary_pharmacodynamics}    - Secondary effects
{pharmacological_effects}       - Overall effects
{receptor_binding}              - Receptor binding information
{drug_interactions}             - Known interactions
```

### Pharmacokinetics Section
```
{pharmacokinetics}       - General PK information
{absorption}             - Absorption data
{distribution}           - Distribution data
{metabolism}             - Metabolism information
{excretion}              - Excretion pathways
{adme}                   - Combined ADME data
{bioavailability}        - Bioavailability percentage
{half_life}              - Elimination half-life
{clearance}              - Drug clearance
{protein_binding}        - Protein binding data
```

### Toxicology Section
```
{toxicology}                - General toxicology
{acute_toxicity}            - Acute toxicity data
{repeat_dose_toxicity}      - Repeated dose studies
{genotoxicity}              - Genetic toxicity
{carcinogenicity}           - Cancer potential
{reproductive_toxicity}     - Reproduction effects
{developmental_toxicity}    - Development effects
{local_tolerance}           - Local tolerance
```

### Clinical/Study Information
```
{study_objectives}      - Study goals
{study_design}          - Study methodology
{study_population}      - Patient population
{study_methods}         - Methods used
{study_results}         - Key findings
{study_conclusions}     - Conclusions
{efficacy}              - Efficacy data
{safety}                - Safety information
{adverse_effects}       - Side effects
```

### Special Placeholders
```
{abbreviations_list}    - Auto-generated table of abbreviations
{study_number}          - Study identifier
{sponsor}               - Study sponsor
{indication}            - Therapeutic indication
{route_of_admin}        - Administration route
{keywords}              - Article keywords
```

---

## 💡 Usage Tips

### 1. Multiple Occurrences
You can use the same placeholder multiple times:
```
Module 2.4: Nonclinical Overview - {drug_name}

1. Introduction
This document presents nonclinical data for {drug_name}...

2. Pharmacology of {drug_name}
{pharmacology}
```

### 2. Combining Text and Placeholders
```
The mechanism of action of {drug_name} is as follows:
{mechanism_of_action}

Based on the study conducted in {publication_date}, the results show:
{study_results}
```

### 3. Abbreviations List
The `{abbreviations_list}` placeholder generates a formatted table:
```
List of Abbreviations

{abbreviations_list}

This will automatically find abbreviations in the article and create:
| Abbreviation | Full Term          |
|--------------|-------------------|
| PK           | Pharmacokinetics  |
| PD           | Pharmacodynamics  |
| ADME         | Absorption, Distribution, Metabolism, Excretion |
```

### 4. Preserve Your Template Structure
Everything NOT a placeholder stays exactly as is:
- ✅ Table of Contents
- ✅ Headers and Footers
- ✅ Page Numbers
- ✅ Section Numbering
- ✅ Formatting (bold, italic, colors)
- ✅ Tables and Figures
- ✅ Page Breaks

---

## 📝 Example Template Sections

### Module Header
```
MODULE 2.4
NONCLINICAL OVERVIEW

{drug_name} {strength} {dosage_form}

Sponsor: {sponsor}
Study Number: {study_number}
Reference: PMID {pmid}
```

### Pharmacology Section
```
4.2 Pharmacology

4.2.1 Primary Pharmacodynamics

{primary_pharmacodynamics}

4.2.2 Secondary Pharmacodynamics

{secondary_pharmacodynamics}

4.2.3 Mechanism of Action

{mechanism_of_action}
```

### Pharmacokinetics Section
```
4.3 Pharmacokinetics

4.3.1 Absorption

{absorption}

4.3.2 Distribution

{distribution}

4.3.3 Metabolism

{metabolism}

4.3.4 Excretion

{excretion}
```

### Toxicology Section
```
4.4 Toxicology

4.4.1 Single-Dose Toxicity

{acute_toxicity}

4.4.2 Repeat-Dose Toxicity

{repeat_dose_toxicity}

4.4.3 Genotoxicity

{genotoxicity}

4.4.4 Carcinogenicity

{carcinogenicity}
```

---

## ⚠️ Important Notes

### Data Extraction Limitations

**PubMed Only Provides Abstracts!**

The system extracts data from article abstracts, which are typically 200-400 words. This means:

- ✅ You'll get general information about pharmacology, toxicology, etc.
- ❌ You won't get detailed tables, figures, or full study protocols
- ✅ Content is automatically extracted using smart keyword matching
- ❌ Some placeholders may be empty if data isn't in the abstract

**What You Can Expect:**
```
Good: "The compound showed significant receptor binding activity..."
Limited: Full dose-response curves or detailed statistical tables
```

### Best Practices

1. **Use Multiple Articles**: Generate documents from several articles, then combine the best content
2. **Review Before Submission**: Always review generated content for accuracy
3. **Add Context**: The template preserves your instructional text, so add guidance around placeholders
4. **Test First**: Try with a simple template before using your full 30+ page document

### Template Requirements

Your template MUST:
- ✅ Be in `.docx` format (Microsoft Word)
- ✅ Contain at least one placeholder in `{curly_braces}` format
- ✅ Use valid placeholder names from the list above

The system will reject templates without placeholders and show you the available options.

---

## 🔧 Troubleshooting

### "Template does not contain placeholders"
**Solution**: Add placeholders like `{drug_name}` to your template before uploading

### Some placeholders are empty
**Solution**: The abstract may not contain that specific information. Try different articles or remove unused placeholders.

### Formatting looks different
**Solution**: Make sure you're using `.docx` format, not `.doc`. The system preserves `.docx` formatting perfectly.

### Abbreviations list is empty
**Solution**: The article abstract didn't contain recognizable abbreviations. The system auto-detects patterns like "pharmacokinetics (PK)".

---

## 📚 Additional Resources

- **TEMPLATE_PLACEHOLDER_GUIDE.md** - Complete reference of all 50+ placeholders
- **TEMPLATE_QUICKSTART.md** - Understanding abstract-only extraction
- **Sample Templates** - Download pre-made templates from `/server/uploads/templates/samples/`

---

## 🆘 Support

If you encounter issues:
1. Check that your template has valid placeholders
2. Verify the article contains the information you need (check abstract on PubMed)
3. Review the placeholder guide for correct syntax
4. Test with a minimal template first

---

**Version**: 2.0  
**Last Updated**: 2025  
**System**: PubMed Template Document Generator
