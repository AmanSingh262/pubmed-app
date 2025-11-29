# Template Document Auto-Fill Feature - Enhanced Version

## Overview
The **Template Document Auto-Fill** feature allows users to upload complex document templates (like Nonclinical Overview documents) with predefined headings, subheadings, and numbering. The system automatically maps PubMed article content to the appropriate template sections and generates a filled document.

## ✨ What's New - Enhanced Features

### 1. **Complex Document Structure Support**
- ✅ Multi-level numbered sections (e.g., 4.2.1.1)
- ✅ Preserves original numbering and formatting
- ✅ Handles 6 levels of headings
- ✅ Maintains section hierarchy

### 2. **Pharmaceutical/Nonclinical Document Support**
Now supports specialized sections including:
- **Pharmacology** (4.2)
  - Primary Pharmacodynamics
  - Secondary Pharmacodynamics
  - Safety Pharmacology
  - Pharmacodynamic Interactions

- **Pharmacokinetics** (4.3)
  - Absorption
  - Distribution
  - Metabolism
  - Excretion
  - PK Interactions

- **Toxicology** (4.4)
  - Single Dose Toxicity
  - Repeat Dose Toxicity
  - Genotoxicity
  - Carcinogenicity
  - Reproductive Toxicity
  - Developmental Toxicity
  - Juvenile Toxicity
  - Local Tolerance
  - Immunotoxicity
  - Phototoxicity

### 3. **Intelligent Content Extraction**
- 🤖 Keyword-based content extraction from abstracts
- 🤖 Sentence-level matching for relevant information
- 🤖 Handles both structured and unstructured abstracts
- 🤖 Smart fallback when exact matches aren't found

### 4. **Better Formatting**
- ✨ Preserves labeled sections (e.g., "OBJECTIVE: text")
- ✨ Professional document title with article reference
- ✨ Improved placeholder text for missing content
- ✨ Times New Roman font, 11pt
- ✨ Justified alignment for body text

## How to Use

### Step 1: Prepare Your Template

Create a Word document (.docx) with your desired structure. For example:

```
NONCLINICAL OVERVIEW

4. NONCLINICAL OVERVIEW
4.1 Introduction
4.2 Pharmacology
  4.2.1 Primary Pharmacodynamics
    4.2.1.1 Mechanism of action
  4.2.2 Secondary Pharmacodynamics
  4.2.3 Safety Pharmacology
4.3 Pharmacokinetics
  4.3.1 Absorption
  4.3.2 Distribution
  4.3.3 Metabolism
  4.3.4 Excretion
4.4 Toxicology
  4.4.1 Single Dose Toxicity
  4.4.2 Repeat Dose Toxicity
  4.4.3 Genotoxicity
  4.4.4 Carcinogenicity
  4.4.5 Reproductive and Developmental Toxicity
```

**Important:**
- Use Word's built-in Heading styles (Heading 1, Heading 2, Heading 3, etc.)
- Include numbering in your heading text if desired
- Leave content areas blank - they will be auto-filled

### Step 2: Search and Select Articles

1. Search for articles using the search bar
2. Select relevant articles
3. Add them to your cart using "Add to Cart"

### Step 3: Generate Template Document

1. Open the cart (click cart icon)
2. Click **"Template Doc"** button
3. Upload your template file
4. Click "Upload & Parse" - system shows how many headings found
5. (Optional) Click "Preview Mapping" to see content mapping
6. Click "Generate Document" to download filled document

## Advanced Mapping Details

### How Content is Matched

The system uses a sophisticated 3-step matching process:

1. **Exact Match**: Removes section numbering and looks for exact matches
2. **Partial Match**: Searches for keywords within heading text
3. **Smart Extraction**: Pulls relevant sentences from abstract

### Supported Section Mappings

**Pharmaceutical/Nonclinical Sections:**
- Pharmacology, Primary/Secondary Pharmacodynamics, Safety Pharmacology
- Pharmacokinetics, Absorption, Distribution, Metabolism, Excretion
- Toxicology, Single/Repeat Dose, Genotoxicity, Carcinogenicity
- Reproductive/Developmental Toxicity, Immunotoxicity, etc.

## Troubleshooting Blank Pages

If your generated document shows placeholders instead of content:

1. **Verify Article Has Abstract** - Check PubMed article has detailed abstract
2. **Match Template to Article Type** - Use pharmacology template with pharmacology studies
3. **Use Standard Terminology** - "Pharmacology" works better than "Drug Effects"
4. **Preview First** - Click "Preview Mapping" to see what content will be extracted
5. **Select Better Articles** - Choose articles with structured, detailed abstracts

The system extracts content from article **abstracts only**. Articles with richer abstracts produce better results.

## Best Practices

✅ Use Word heading styles (not just bold text)
✅ Include numbering in heading text if desired
✅ Match template type to article content
✅ Preview before generating
✅ Choose articles with detailed abstracts
✅ Review and edit generated document

## Need Help?

The Template Doc feature works best when:
- Articles have structured abstracts with labeled sections
- Template headings use standard scientific terminology
- Article content type matches template sections

Remember: This provides a starting point. Review and enhance the generated content as needed!
| Template Heading | Article Content |
|-----------------|-----------------|
| Title, Article Title, Study Title | Article title |
| Authors, Author, Researchers | Author list |
| Journal, Publication, Source | Journal name |
| Publication Date, Date, Year | Publication date |
| PMID, PubMed ID, ID | PubMed identifier |
| Abstract, Summary | Full abstract text |
| Objective, Aims, Purpose, Goal | Abstract objective section |
| Methods, Design, Methodology | Abstract methods section |
| Results, Findings, Outcomes | Abstract results section |
| Conclusions, Implications | Abstract conclusions section |
| Background, Introduction | Abstract background section |

### Smart Features:
- **Case-insensitive matching**: "TITLE", "Title", or "title" all work
- **Partial matching**: "Publication Date" matches headings containing "date"
- **Structured abstracts**: Automatically detects labeled sections (Objective, Methods, etc.)
- **Fallback content**: Shows "[Content not available]" for unmapped sections

## API Endpoints

### POST `/api/template/upload`
Upload and parse template document

**Request:**
- `Content-Type: multipart/form-data`
- File field: `template` (.docx file)

**Response:**
```json
{
  "success": true,
  "templateId": "template-1234567890",
  "templatePath": "/path/to/template.docx",
  "structure": [...],
  "headingsCount": 8
}
```

### POST `/api/template/preview`
Preview how article will be mapped to template

**Request:**
```json
{
  "templatePath": "/path/to/template.docx",
  "article": { /* article object */ }
}
```

**Response:**
```json
{
  "success": true,
  "structure": [
    {
      "level": 1,
      "text": "Title",
      "content": "Article title here...",
      "matchedSection": "title",
      "children": []
    }
  ]
}
```

### POST `/api/template/generate`
Generate filled document

**Request:**
```json
{
  "templatePath": "/path/to/template.docx",
  "article": { /* article object */ }
}
```

**Response:**
- Content-Type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- File download

### DELETE `/api/template/:filename`
Delete template file

## Technical Details

### Backend Implementation
- **Route**: `server/routes/template.js`
- **Parsing**: Uses `mammoth` to extract headings from .docx
- **Generation**: Uses `docx` library to create filled documents
- **Storage**: Templates stored in `server/uploads/templates/`

### Frontend Components
- **Modal**: `client/src/components/TemplateDocModal.js`
- **Styles**: `client/src/components/TemplateDocModal.css`
- **API**: `client/src/services/api.js` (template methods)
- **Integration**: `client/src/components/SelectCart.js`

### Mapping Algorithm
```javascript
function mapArticleToTemplate(article, templateStructure) {
  // 1. Extract heading text
  // 2. Normalize to lowercase
  // 3. Match against predefined mappings
  // 4. Retrieve corresponding article content
  // 5. Handle structured vs plain abstracts
  // 6. Recursively process nested headings
}
```

## Usage Examples

### Example 1: Simple Research Summary
Template:
```
Title
Authors
Abstract
Journal Information
```

Result: All sections auto-filled with article data

### Example 2: Detailed Research Report
Template:
```
Study Information
  Title
  Authors
  Publication Details
Abstract
  Background
  Objective
  Methods
  Results
  Conclusions
Reference Details
  Journal
  PMID
  DOI
```

Result: Comprehensive document with all available information

### Example 3: Citation Format
Template:
```
Citation
  Authors
  Title
  Journal
  Publication Date
  PMID
```

Result: Properly formatted citation

## Limitations & Future Enhancements

### Current Limitations:
- Batch generation processes only first article (multi-article coming soon)
- Template must use Word heading styles (not just bold text)
- Max template size: 10MB
- Only .docx format supported

### Planned Enhancements:
- ✨ Batch processing for multiple articles
- ✨ Save and reuse templates
- ✨ Custom mapping rules
- ✨ Template library with presets
- ✨ PDF template support
- ✨ Excel template support

## Troubleshooting

### "Failed to parse template"
- **Cause**: Template not using Word heading styles
- **Solution**: Use Format > Styles > Heading 1/2/3 in Word

### "Content not available"
- **Cause**: No matching section found in article
- **Solution**: Article may not have structured abstract or that specific field

### "Only .docx files allowed"
- **Cause**: Uploaded file is not .docx format
- **Solution**: Save your template as .docx (not .doc or .pdf)

## Best Practices

1. **Use Clear Heading Names**: "Title" instead of "Article Title Information"
2. **Use Standard Terms**: Stick to common academic terms (Abstract, Methods, etc.)
3. **Hierarchical Structure**: Use heading levels appropriately (H1 > H2 > H3)
4. **Test with Preview**: Always preview before generating
5. **Keep Templates Simple**: Start simple, add complexity gradually

## Support

For issues or questions:
- Check preview mapping to see what's being matched
- Verify template uses Word heading styles
- Ensure article has the required content (structured abstract, etc.)
- Check browser console for detailed error messages
