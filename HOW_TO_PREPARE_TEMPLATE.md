# 📄 How to Prepare Your Template - Quick Guide

## ✅ The System Now Works!

Your template will be filled with content from PubMed articles. Here's how to prepare it:

---

## 🎯 Step-by-Step Template Preparation

### 1. Open Your Existing Template in Microsoft Word

For example, your Nonclinical Overview template.

### 2. Add Placeholders Where You Want Content

Replace placeholder text or empty sections with `{placeholder_name}` in curly braces.

---

## 📋 Example: Before and After

### BEFORE (Your Current Template):
```
MODULE 2.4
NONCLINICAL OVERVIEW

Drug Name: _______________

4.2 Pharmacology

[Add pharmacology information here]

4.3 Pharmacokinetics

4.3.1 Absorption

[Add absorption data]

4.3.2 Distribution

[Add distribution data]

4.3.3 Metabolism

[Add metabolism data]

4.3.4 Excretion

[Add excretion data]

4.4 Toxicology

[Add toxicology information]

List of Abbreviations

[Table to be inserted]
```

### AFTER (With Placeholders Added):
```
MODULE 2.4
NONCLINICAL OVERVIEW

Drug Name: {drug_name}
Reference: PMID {pmid}

Abstract:
{abstract}

4.2 Pharmacology

{pharmacology}

4.2.1 Mechanism of Action

{mechanism_of_action}

4.2.2 Primary Pharmacodynamics

{primary_pharmacodynamics}

4.3 Pharmacokinetics

{pharmacokinetics}

4.3.1 Absorption

{absorption}

4.3.2 Distribution

{distribution}

4.3.3 Metabolism

{metabolism}

4.3.4 Excretion

{excretion}

4.4 Toxicology

{toxicology}

4.4.1 Genotoxicity

{genotoxicity}

4.4.2 Carcinogenicity

{carcinogenicity}

4.4.3 Reproductive Toxicity

{reproductive_toxicity}

List of Abbreviations

{abbreviations_list}
```

---

## 🔑 Available Placeholders

### Basic Information
- `{drug_name}` - Drug/compound name
- `{pmid}` - PubMed ID
- `{article_title}` - Full article title
- `{authors}` - Author list
- `{journal}` - Journal name
- `{publication_date}` - Publication date

### Abstract
- `{abstract}` - Full abstract text

### Pharmacology
- `{pharmacology}` - General pharmacology section
- `{mechanism_of_action}` - Mechanism of action
- `{primary_pharmacodynamics}` - Primary PD
- `{secondary_pharmacodynamics}` - Secondary PD

### Pharmacokinetics
- `{pharmacokinetics}` - General PK section
- `{absorption}` - Absorption data
- `{distribution}` - Distribution data
- `{metabolism}` - Metabolism data
- `{excretion}` - Excretion data
- `{adme}` - Combined ADME

### Toxicology
- `{toxicology}` - General toxicology
- `{single_dose_toxicity}` - Acute toxicity
- `{repeat_dose_toxicity}` - Chronic toxicity
- `{genotoxicity}` - Genotoxicity
- `{carcinogenicity}` - Carcinogenicity
- `{reproductive_toxicity}` - Reproductive effects
- `{embryo_fetal}` - Embryo-fetal effects
- `{local_tolerance}` - Local tolerance

### Study Information
- `{methods}` - Study methods
- `{results}` - Study results
- `{conclusions}` - Study conclusions

### Special
- `{abbreviations_list}` - Auto-generated abbreviations table

---

## ⚡ Quick Tips

### 1. Use Curly Braces `{ }`
```
✅ CORRECT: {pharmacology}
❌ WRONG: pharmacology
❌ WRONG: [pharmacology]
❌ WRONG: {{pharmacology}}
```

### 2. Exact Spelling
Use the exact placeholder names from the list above.

### 3. One Placeholder Per Location
Don't combine: `{pharmacology} and {toxicology}`  
Instead use them separately in different sections.

### 4. Keep Your Template Structure
- Keep all your headings
- Keep Table of Contents
- Keep page numbers
- Keep all formatting
- Just add `{placeholders}` where you want content

### 5. Abbreviations List
For the abbreviations section, just use:
```
List of Abbreviations

{abbreviations_list}
```

The system will create a formatted table automatically!

---

## 🎨 Advanced: Multiple Uses

You can use the same placeholder multiple times:

```
MODULE 2.4: NONCLINICAL OVERVIEW
Study of {drug_name}

1. Introduction
This document presents data for {drug_name}...

2. Pharmacology of {drug_name}
{pharmacology}

Reference: PMID {pmid}
Drug: {drug_name}
```

---

## ✅ Complete Example Template

```
MODULE 2.4
NONCLINICAL OVERVIEW

{drug_name}

Reference: PMID {pmid}
Title: {article_title}
Authors: {authors}
Journal: {journal}
Date: {publication_date}

═══════════════════════════════════════

ABSTRACT

{abstract}

═══════════════════════════════════════

4.2 PHARMACOLOGY

4.2.1 Overview

{pharmacology}

4.2.2 Mechanism of Action

{mechanism_of_action}

4.2.3 Primary Pharmacodynamics

{primary_pharmacodynamics}

═══════════════════════════════════════

4.3 PHARMACOKINETICS

4.3.1 Overview

{pharmacokinetics}

4.3.2 Absorption

{absorption}

4.3.3 Distribution

{distribution}

4.3.4 Metabolism

{metabolism}

4.3.5 Excretion

{excretion}

═══════════════════════════════════════

4.4 TOXICOLOGY

4.4.1 Overview

{toxicology}

4.4.2 Genotoxicity

{genotoxicity}

4.4.3 Carcinogenicity

{carcinogenicity}

4.4.4 Reproductive Toxicity

{reproductive_toxicity}

═══════════════════════════════════════

4.5 STUDY INFORMATION

Methods:
{methods}

Results:
{results}

Conclusions:
{conclusions}

═══════════════════════════════════════

LIST OF ABBREVIATIONS

{abbreviations_list}

═══════════════════════════════════════
```

---

## 🚀 How to Use

1. **Prepare**: Add placeholders to your template (5 minutes)
2. **Save**: Save as `.docx` file
3. **Upload**: Upload via "Template Doc" button in PubMed interface
4. **Generate**: Select article and click "Generate Document"
5. **Download**: Get your filled template!

---

## ⚠️ Important Notes

### What You'll Get:
- ✅ Content extracted from article **abstract** (200-400 words)
- ✅ Auto-generated abbreviations table
- ✅ All your template formatting preserved
- ✅ Ready-to-review document

### What You Won't Get:
- ❌ Full article text (PubMed only provides abstracts)
- ❌ Detailed tables/figures (not in abstracts)
- ❌ Complete study protocols

### Best Practice:
1. Generate documents from 3-5 articles about the same compound
2. Compare the generated documents
3. Combine the best content from each
4. Add additional details manually from full-text articles
5. Final review and editing

---

## 🎯 Ready to Start?

1. Open your template in Word
2. Add placeholders from the list above
3. Save as `.docx`
4. Upload and generate!

**Your template will be filled with all available content automatically!** 🎉

---

**Last Updated:** November 30, 2025  
**Version:** 4.0
