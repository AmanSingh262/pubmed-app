# Detail Document Feature

## Overview
The Detail Document feature generates professionally formatted Word documents from selected cart articles using AI-powered abstract summarization.

## Features

### 1. **Study Type Selection**
- **Animal Studies**: Generate document from animal research articles
- **Human Studies**: Generate document from human research articles

### 2. **Document Structure**
```
Detail Document - [Study Type] Studies
│
├── ABBREVIATIONS TABLE
│   ├── PK → Pharmacokinetics
│   ├── PD → Pharmacodynamics
│   ├── AUC → Area Under the Curve
│   └── ... (auto-extracted from articles)
│
├── MAIN CONTENT (Organized by Categories)
│   ├── Pharmacokinetics (Heading 1)
│   │   ├── 1.1 Primary Pharmacokinetics (Heading 2)
│   │   │   └── [AI-generated summary paragraphs]
│   │   └── 1.2 Secondary Pharmacokinetics (Heading 2)
│   │       └── [AI-generated summary paragraphs]
│   │
│   ├── Pharmacodynamics (Heading 1)
│   │   └── [AI-generated summary paragraphs]
│   │
│   └── ... (other categories)
│
└── REFERENCES
    ├── 1. Author et al. Title. Journal. Year. PMID: xxx. Link
    ├── 2. Author et al. Title. Journal. Year. PMID: xxx. Link
    └── ...
```

### 3. **AI-Powered Summarization**
Each article abstract is converted into a detailed summary using ChatGPT (GPT-3.5-turbo):

**Format**: 
```
A study was conducted to evaluate [specific focus]. [Study aim]. [Study type: species/model]. [Complete results with data]. (Author First Initial Last Name et al, Year)
```

**Example**:
```
A study was conducted to evaluate the pharmacokinetics of acetaminophen in mice. The research aimed to determine the plasma concentration-time profile and bioavailability. In male C57BL/6 mice, acetaminophen showed rapid absorption with Tmax of 0.5 hours, Cmax of 150 μg/mL, and an elimination half-life of 2.3 hours. The AUC was calculated as 450 μg·h/mL with 85% oral bioavailability. (Smith J et al, 2020)
```

### 4. **Professional Formatting**
- **Font**: Times New Roman throughout
- **Heading Size**: 14pt, Bold
- **Paragraph Size**: 12pt
- **Biological Terms**: Automatically italicized
  - Species names: *Homo sapiens*, *Mus musculus*
  - Technical terms: *in vitro*, *in vivo*, *ex vivo*
  - Gene names: *TP53*, *BRCA1*
- **Margins**: 1 inch all sides
- **Alignment**: Justified paragraphs

### 5. **Category Hierarchy**
Articles are automatically organized by their category path:
- Main categories become primary headings
- Subcategories (Primary/Secondary/Tertiary) become numbered subheadings
- Articles are grouped under appropriate sections

## Usage

### From the Cart:
1. Add articles to your cart from search results or reference document
2. Open the cart by clicking the 🛒 icon
3. Click the **"Detail Document"** button in the cart footer
4. Select either **"🐁 Animal Studies"** or **"👤 Human Studies"**
5. Wait for AI processing (may take 10-30 seconds depending on article count)
6. Document automatically downloads as `.docx`

### Requirements:
- **OpenAI API Key**: Required for abstract summarization
- **Cart Articles**: At least one article of the selected study type
- **Internet Connection**: For ChatGPT API calls

## Configuration

### Environment Variables
Add to your `.env` file:
```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### Get OpenAI API Key:
1. Visit https://platform.openai.com/api-keys
2. Create account or sign in
3. Generate new API key
4. Copy key to `.env` file

### Cost Estimation:
- Model: GPT-3.5-turbo
- Approximate cost: $0.001-0.002 per article summary
- 100 articles ≈ $0.10-0.20

## Technical Details

### Backend Route
```javascript
POST /api/generate-detail-document
Body: {
  cartItems: Array<CartItem>,
  studyType: 'animal' | 'human'
}
Response: Word document (.docx) as blob
```

### Components
- **Frontend**: `DetailDocumentModal.js` - UI for study type selection
- **Backend**: `detailDocument.js` - Document generation logic
- **AI Integration**: OpenAI GPT-3.5-turbo for summarization

### Processing Flow:
1. Filter cart items by study type
2. Group articles by category hierarchy
3. Extract abbreviations from content
4. For each article:
   - Send abstract to ChatGPT
   - Receive formatted summary
   - Extract biological terms for italicization
5. Build Word document structure:
   - Title page
   - Abbreviations table
   - Categorized content with summaries
   - References section
6. Apply Times New Roman formatting
7. Generate and download .docx file

### Error Handling:
- **No API Key**: Falls back to original abstract with formatted citation
- **API Failure**: Uses abstract text with author/year appended
- **Network Issues**: Displays error toast with retry option

## Example Output

### Document Header:
```
Detail Document - Animal Studies
```

### Abbreviations Table:
| Abbreviation | Full Form |
|--------------|-----------|
| PK | Pharmacokinetics |
| PD | Pharmacodynamics |
| AUC | Area Under the Curve |

### Content Section:
**Pharmacokinetics**

**1.1 Primary Pharmacokinetics**

A study was conducted to evaluate the pharmacokinetics of compound X in *Mus musculus*. The research aimed to characterize absorption, distribution, metabolism, and excretion profiles. In male C57BL/6 mice (n=24), intravenous administration showed linear kinetics with Cmax of 250 ng/mL at 0.25h, AUC0-∞ of 1200 ng·h/mL, and t1/2 of 3.2 hours. Oral bioavailability was 65% with dose-proportional exposure. (Johnson M et al, 2021)

### References:
1. Johnson M, Smith A, Williams R. Pharmacokinetic characterization of compound X in mice. *Journal of Pharmaceutical Sciences*. 2021. PMID: 12345678. https://pubmed.ncbi.nlm.nih.gov/12345678/

## Troubleshooting

### Issue: "Failed to generate document"
**Solutions**:
- Check OPENAI_API_KEY in .env file
- Verify API key is active on OpenAI platform
- Check internet connection
- Ensure cart has articles of selected study type

### Issue: Document formatting issues
**Solutions**:
- Ensure MS Word or compatible software is installed
- Try opening in Google Docs or LibreOffice
- Check .docx file is not corrupted

### Issue: Slow generation
**Normal**: Processing time depends on:
- Number of articles (5-10 articles: 10-20 seconds)
- ChatGPT API response time
- Network speed

## Future Enhancements
- [ ] Custom template selection
- [ ] Multiple AI model options (GPT-4, Claude)
- [ ] Batch processing optimization
- [ ] Export to PDF format
- [ ] Custom abbreviations dictionary
- [ ] Section ordering customization
- [ ] Figure/table inclusion from articles

## Support
For issues or questions, check:
- Server logs: `combined.log`
- Error logs: `error.log`
- Browser console for frontend errors
- Network tab for API call failures
