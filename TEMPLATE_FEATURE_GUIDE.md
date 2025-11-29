# Template Document Auto-Fill Feature

## Overview
The Template Document Auto-Fill feature allows users to upload a document template with predefined headings and subheadings, which are then automatically filled with content from selected PubMed articles.

## How It Works

### 1. **Search and Select Articles**
- Search for articles using the search bar
- Add desired articles to the cart using the "Add to Cart" button

### 2. **Open Template Doc Generator**
- Open the cart (click cart icon in header)
- Click the **"Template Doc"** button in the cart footer

### 3. **Upload Template**
- Click "Choose Template File (.docx)"
- Select a `.docx` file containing your template with headings/subheadings
- Click "Upload & Parse"
- The system will parse and display the number of headings found

### 4. **Preview Mapping (Optional)**
- Click "Preview Mapping" to see how article content will be mapped
- The preview shows:
  - ✓ = Content available for this section
  - → = Which article section is mapped to this heading

### 5. **Generate Document**
- Click "Generate Document"
- The system will:
  - Map article content to template sections
  - Preserve template formatting
  - Auto-fill all sections
  - Download the completed document

## Template Structure Requirements

Your template document should use Word's built-in heading styles:
- **Heading 1**: Main sections
- **Heading 2**: Subsections
- **Heading 3**: Sub-subsections

### Example Template Structure:
```
Heading 1: Article Information
  Heading 2: Title
  Heading 2: Authors
  Heading 2: Publication Details
    Heading 3: Journal
    Heading 3: Publication Date
    Heading 3: PMID

Heading 1: Abstract
  Heading 2: Objective
  Heading 2: Methods
  Heading 2: Results
  Heading 2: Conclusions

Heading 1: Reference
```

## Intelligent Content Mapping

The system uses AI-powered semantic matching to map article content to template headings:

### Supported Mappings:
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
