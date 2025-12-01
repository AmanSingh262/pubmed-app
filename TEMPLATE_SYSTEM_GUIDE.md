# Template Document Generator - Complete Guide

## ✅ System Status
The template system is **FULLY FUNCTIONAL** and uses the **Final API** which:
- ✅ Extracts **FULL abstract text** (not excerpts)
- ✅ Generates **complete abbreviations table**
- ✅ Fills **ALL sections** in your template
- ✅ Preserves **all formatting and structure**
- ✅ Supports **multi-level headings and tables**

## 🎯 How It Works

### Step 1: Prepare Your Word Template

Your `.docx` template must contain **placeholders** where you want content filled.

#### Available Placeholders:

```
{abstract}                    - Complete abstract text
{abstract_background}         - Background/Introduction section
{abstract_methods}            - Methods section
{abstract_results}            - Results section
{abstract_conclusions}        - Conclusions section

{pharmacology}                - Pharmacology content
{primary_pharmacodynamics}    - Primary pharmacodynamics
{mechanism_of_action}         - Mechanism of action
{receptor_binding}            - Receptor binding information

{pharmacokinetics}            - Pharmacokinetics content
{absorption}                  - Absorption data
{distribution}                - Distribution data
{metabolism}                  - Metabolism data
{excretion}                   - Excretion data
{adme}                        - ADME overview

{toxicology}                  - Toxicology content
{genotoxicity}                - Genotoxicity data
{carcinogenicity}             - Carcinogenicity data
{reproductive_toxicity}       - Reproductive toxicity
{developmental_toxicity}      - Developmental toxicity

{abbreviations_list}          - Formatted abbreviations table

{drug_name}                   - Drug name
{pmid}                        - PubMed ID
{title}                       - Article title
{authors}                     - Authors list
{journal}                     - Journal name
{publication_year}            - Year published
```

#### Example Template Structure:

```
MODULE 2.4: NONCLINICAL OVERVIEW
Drug Name: {drug_name}
Reference: {pmid}

1. ABSTRACT
{abstract}

2. PHARMACOLOGY
{pharmacology}

3. PHARMACOKINETICS
Absorption: {absorption}
Distribution: {distribution}
Metabolism: {metabolism}
Excretion: {excretion}

4. TOXICOLOGY
{toxicology}

5. LIST OF ABBREVIATIONS
{abbreviations_list}
```

### Step 2: Upload Template

1. Open the Template Generator modal in your app
2. Click "Choose Template File (.docx)"
3. Select your prepared template
4. Click "Upload Template"
5. System analyzes structure and shows: "✅ Template analyzed! Found X headings, Y tables"

### Step 3: Preview Content (Optional)

1. Select an article from your PubMed results
2. Click "👁️ Preview Extracted Content"
3. Review what will be inserted:
   - Drug name and PMID
   - Abstract availability
   - Pharmacology content
   - Toxicology content
   - Abbreviations found (e.g., PK, PD, ADME, AUC, Cmax)

### Step 4: Generate Document

1. Click "Generate Document"
2. System fills ALL placeholders with extracted content
3. Downloads complete `.docx` file
4. Success message: "✅ Complete document generated! Full abstract, abbreviations list, and all sections filled."

## 📋 What Gets Extracted

### Abstract Extraction
- **Full text** - Complete abstract, not excerpts
- Preserves paragraph structure
- Handles structured abstracts (Background, Methods, Results, Conclusions)
- Provides section-specific placeholders

### Abbreviations Table
The system automatically:
1. **Finds abbreviations** in title and abstract
   - Pattern: "Full Term (ABBR)"
   - Example: "Pharmacokinetics (PK)"

2. **Adds common pharmaceutical terms** if present:
   - PK, PD, ADME, AUC, Cmax, Tmax
   - CNS, IV, PO, LD50, NOAEL, LOAEL
   - IC50, EC50, ED50, CYP, FDA, GLP, OECD

3. **Formats as table**:
   ```
   Abbreviation    Full Term
   ──────────────────────────────────────────
   ADME           Absorption, Distribution, Metabolism, Excretion
   AUC            Area Under the Curve
   Cmax           Maximum Plasma Concentration
   PK             Pharmacokinetics
   PD             Pharmacodynamics
   ```

### Content Extraction
The system intelligently extracts content by looking for keywords:

**Pharmacology**: mechanism, receptor, binding, inhibit, agonist, antagonist, efficacy, selectivity

**Pharmacokinetics**: absorption, distribution, metabolism, excretion, bioavailability, clearance, half-life, AUC, Cmax

**Toxicology**: toxicity, toxic, adverse, safety, genotoxicity, carcinogenicity, mutagenic

## 🔧 Technical Details

### Backend Implementation
- **Route**: `/api/template-final`
- **File**: `server/routes/templateFinal.js`
- **Technology**: 
  - `docxtemplater` - Template filling
  - `xml2js` - DOCX structure analysis
  - `pizzip` - DOCX file handling

### Frontend Integration
- **Component**: `TemplateDocModal.js`
- **API Methods**:
  - `uploadTemplateFinal()` - Upload and analyze
  - `previewTemplateFinal()` - Preview extraction
  - `generateTemplateDocFinal()` - Generate document

### Workflow
1. Upload `.docx` → Unzip → Parse XML → Extract all headings/tables/paragraphs
2. Select article → Extract full abstract → Find abbreviations → Extract content
3. Generate → Replace placeholders → Preserve formatting → Download filled document

## 🚨 Troubleshooting

### "Template needs placeholders!" Error
**Problem**: Template doesn't contain any placeholders

**Solution**: 
1. Open your Word template
2. Add placeholders using curly braces: `{placeholder_name}`
3. Save and re-upload
4. Use placeholders from the list above

### Only MODULE 2.4 Header Showing
**Problem**: Template was created as new document instead of filling existing

**Solution**: ✅ **FIXED** - System now uses templateFinal API which properly fills templates

### Missing Abstract Content
**Problem**: Earlier versions extracted excerpts only

**Solution**: ✅ **FIXED** - templateFinal extracts FULL abstract text

### Empty Abbreviations List
**Problem**: No abbreviations extraction

**Solution**: ✅ **FIXED** - templateFinal generates complete abbreviations table

### Sections Not Filled
**Problem**: Content not mapped to placeholders

**Solution**: 
1. Verify placeholders match exact names (case-sensitive)
2. Check Preview to see what content is available
3. Use correct placeholder names: `{pharmacology}` not `{pharm}` or `{pharmacology_section}`

## 📊 Example Results

### Input Article
- **PMID**: 12345678
- **Title**: "Pharmacokinetics and Safety of Drug XYZ in Healthy Volunteers"
- **Abstract**: 300-word structured abstract with Background, Methods, Results, Conclusions

### Generated Document
```
MODULE 2.4: NONCLINICAL OVERVIEW
Drug Name: Drug XYZ
Reference: PMID 12345678

1. ABSTRACT
Background: Drug XYZ is a novel therapeutic agent...
Methods: A randomized, double-blind, placebo-controlled study...
Results: The mean AUC was 245.3 μg·h/mL, Cmax was 45.2 μg/mL...
Conclusions: Drug XYZ demonstrates favorable pharmacokinetic...

[... 300 words of complete abstract ...]

2. PHARMACOLOGY
Drug XYZ is a selective receptor antagonist that binds with high 
affinity to the target receptor (IC50 = 5.2 nM)...

3. PHARMACOKINETICS
Absorption: Following oral administration, Drug XYZ was rapidly 
absorbed with a bioavailability of 85%...

4. LIST OF ABBREVIATIONS
Abbreviation    Full Term
────────────────────────────────────────────
ADME           Absorption, Distribution, Metabolism, Excretion
AUC            Area Under the Curve
Cmax           Maximum Plasma Concentration
IC50           Half Maximal Inhibitory Concentration
PK             Pharmacokinetics
```

## ✨ Best Practices

1. **Use Descriptive Section Headers** in your template to organize content
2. **Include All Relevant Placeholders** - System only fills what you request
3. **Preview Before Generating** - Verify content availability
4. **Select High-Quality Articles** - Better abstracts = better extraction
5. **Add Custom Text** - Mix placeholders with your own content:
   ```
   2.4.1 Brief Summary
   
   This section provides an overview of {drug_name} based on PubMed 
   literature (PMID: {pmid}).
   
   {abstract}
   ```

## 🎓 Tips for Multiple Articles

If you need to combine data from multiple articles:
1. Generate separate documents for each article
2. Manually combine relevant sections
3. Update abbreviations list to merge all terms
4. Consider creating different templates for different article types

## 📞 Support

If you encounter issues:
1. Check that placeholders are spelled exactly as listed above
2. Verify template is `.docx` format (not `.doc`)
3. Use Preview to see what content is available
4. Check browser console (F12) for detailed error messages

---

**System Version**: Final (templateFinal.js)  
**Last Updated**: 2024  
**Status**: ✅ Production Ready
