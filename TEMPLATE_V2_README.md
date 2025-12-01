# 🎉 Template Document Generator - V2 Now Available!

## What's New?

**Template Document Generator V2** is here with a completely new approach that preserves your entire document structure!

### V1 vs V2 Comparison

| Feature | V1 (Old) | V2 (New) ✨ |
|---------|----------|------------|
| **Approach** | Creates new document | Fills placeholders |
| **Table of Contents** | ❌ Lost | ✅ Preserved |
| **List of Abbreviations** | ❌ Lost | ✅ Auto-generated |
| **Formatting** | ❌ Basic only | ✅ Everything preserved |
| **Headers/Footers** | ❌ Lost | ✅ Preserved |
| **Page Breaks** | ❌ Lost | ✅ Preserved |
| **Section Numbering** | ❌ Recreated | ✅ Original maintained |
| **Setup Required** | None | Add placeholders to template |

---

## 🚀 Quick Start Guide

### 1. Prepare Your Template (One-Time Setup)

Open your Nonclinical Overview template in Word and add placeholders where you want content:

**Before:**
```
4.2 Pharmacology
[Add pharmacology information here]
```

**After:**
```
4.2 Pharmacology
{pharmacology}
```

### 2. Use the System

1. Search for articles in PubMed
2. Select article(s)
3. Click **"Template Doc"** button
4. Upload your prepared template
5. Click **"Generate Document"**
6. Done! ✅

---

## 📋 Available Placeholders (50+)

### Most Common Placeholders

```
{drug_name}           - Drug/compound name
{pharmacology}        - Pharmacology information
{mechanism_of_action} - How the drug works
{pharmacokinetics}    - PK data (ADME)
{absorption}          - Absorption data
{distribution}        - Distribution data
{metabolism}          - Metabolism data
{excretion}           - Excretion data
{toxicology}          - Toxicology information
{genotoxicity}        - Genetic toxicity
{carcinogenicity}     - Cancer potential
{study_results}       - Study findings
{abbreviations_list}  - Auto-generated abbreviations table
```

**See complete list:** [TEMPLATE_PLACEHOLDER_GUIDE.md](./TEMPLATE_PLACEHOLDER_GUIDE.md)

---

## 📖 Documentation

- **[V2 User Guide](./TEMPLATE_V2_USER_GUIDE.md)** - Complete usage guide with examples
- **[Placeholder Reference](./TEMPLATE_PLACEHOLDER_GUIDE.md)** - All 50+ placeholders explained
- **[Quick Start](./TEMPLATE_QUICKSTART.md)** - Understanding data extraction

---

## 💡 Key Features

### ✅ Preserves Everything

Your template structure remains **100% intact**:
- Table of Contents (with page numbers)
- List of Tables/Figures
- List of Abbreviations (auto-filled!)
- All section numbering (4.2.1.1, etc.)
- Headers, footers, page numbers
- All formatting, styles, colors
- Page breaks and layout

### ✅ Smart Content Extraction

The system intelligently extracts data from PubMed abstracts:
- Finds pharmacology-related sentences
- Identifies toxicology information
- Extracts study methodology and results
- Auto-generates abbreviations from text
- Maps content to appropriate placeholders

### ✅ Multiple Placeholders Supported

Use the same placeholder multiple times:
```
Module 2.4: Nonclinical Overview - {drug_name}

1. Introduction to {drug_name}
...

2. Pharmacology of {drug_name}
{pharmacology}
```

---

## ⚠️ Important: Data Limitations

**PubMed provides only abstracts** (200-400 words typically), not full articles.

This means:
- ✅ General pharmacology, toxicology, study info available
- ❌ Detailed tables, figures, full protocols NOT available
- ✅ Good for initial document drafts
- ❌ Will need manual review and enhancement

**Recommendation:** Generate documents from multiple articles, then combine the best content.

---

## 🎯 Perfect For

- Creating initial Nonclinical Overview drafts
- Extracting key information from multiple studies
- Maintaining consistent document structure
- Auto-generating abbreviations lists
- Batch processing multiple articles

---

## 🔧 System Requirements

- Microsoft Word template (`.docx` format)
- Template must contain at least one placeholder
- Valid placeholder names from the reference list

---

## 🆘 Troubleshooting

### Error: "Template does not contain placeholders"
**Fix:** Add placeholders like `{pharmacology}` to your Word template

### Some sections are empty
**Fix:** The article abstract may not contain that information. Try different articles or check the abstract content on PubMed.

### Formatting looks wrong
**Fix:** Ensure you're using `.docx` format (not `.doc`). V2 preserves all `.docx` formatting.

---

## 📊 Example Workflow

### Step 1: Search
```
Search PubMed for: "novel antidiabetic compound pharmacology"
```

### Step 2: Select
```
Select 3-5 relevant articles with good abstracts
```

### Step 3: Prepare Template
```
Open: Nonclinical_Overview_Template.docx
Add placeholders: {drug_name}, {pharmacology}, {toxicology}
Save
```

### Step 4: Generate
```
Upload template → Select articles → Generate
```

### Step 5: Review
```
Download generated document
Review content
Add missing details manually
```

---

## 🎓 Tips for Best Results

1. **Use descriptive article titles** - Helps extract drug names
2. **Choose comprehensive abstracts** - More content = better extraction
3. **Test with simple template first** - Verify placeholders work
4. **Generate from multiple articles** - Compare and combine content
5. **Keep your template structure** - Don't delete ToC, abbreviations lists, etc.

---

## 📦 What's Included

```
/server/routes/templateV2.js    - Backend V2 implementation
/client/src/components/TemplateDocModal.js - Updated UI
/TEMPLATE_V2_USER_GUIDE.md      - Complete user guide
/TEMPLATE_PLACEHOLDER_GUIDE.md  - Placeholder reference
```

---

## 🚀 Getting Started Now

1. **Read**: [TEMPLATE_V2_USER_GUIDE.md](./TEMPLATE_V2_USER_GUIDE.md)
2. **Prepare**: Add placeholders to your template
3. **Test**: Try with one article first
4. **Generate**: Create your first V2 document!

---

## 🔄 Migration from V1

If you were using V1:

**Old Way (V1):**
- Template with headings → System creates new doc → Lost ToC/formatting

**New Way (V2):**
- Template with placeholders → System fills placeholders → Everything preserved ✅

**Action Required:**
1. Open your existing template
2. Add placeholders where you want content
3. Use the same "Template Doc" button
4. System automatically uses V2

---

## 📞 Support

Questions? Issues? Check:
1. [V2 User Guide](./TEMPLATE_V2_USER_GUIDE.md) - Complete instructions
2. [Placeholder Guide](./TEMPLATE_PLACEHOLDER_GUIDE.md) - All placeholders
3. [Quick Start](./TEMPLATE_QUICKSTART.md) - Understanding extraction

---

**Version 2.0** | Built with docxtemplater | Powered by PubMed API

---

## 🎊 Ready to Start?

👉 **Next Step:** Read the [V2 User Guide](./TEMPLATE_V2_USER_GUIDE.md) and prepare your first template!
