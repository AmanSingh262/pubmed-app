# Quick Start: Template Doc Feature

## ✅ Enhanced for Nonclinical Overview Documents

### What Changed?

The Template Doc feature now supports complex pharmaceutical documents with multi-level numbered sections like "4.2.1.1 Mechanism of action".

### Why Was It Showing Blank Pages?

**Problem:** PubMed articles only have abstracts, not full text.

**Solution:** The system now:
1. ✅ Extracts relevant sentences from abstracts using keywords
2. ✅ Matches pharmaceutical/toxicology terms intelligently
3. ✅ Provides better placeholders when content isn't available

### Quick Test

1. **Search for a pharmacology or toxicology article:**
   - Example: "ibuprofen pharmacokinetics"
   - Example: "aspirin toxicity"

2. **Add to cart and click "Template Doc"**

3. **Upload your Nonclinical Overview template**

4. **Click "Preview Mapping"** - You'll see:
   - ✓ = Content found
   - Section name = Where content comes from

5. **Generate Document**

### What Content Can Be Extracted?

✅ **Works Well:**
- Articles with detailed abstracts
- Pharmacology/pharmacokinetics studies
- Toxicology studies
- Articles with structured abstracts (labeled sections)

❌ **Limited Content:**
- Articles with short abstracts
- Case reports without methodology
- Review articles without specific data
- Articles behind paywalls (only abstract available)

### Expected Results

| Template Section | Content Source | Quality |
|-----------------|----------------|---------|
| 4.2 Pharmacology | Sentences with "mechanism", "receptor", "activity" | ⭐⭐⭐⭐ |
| 4.3 Pharmacokinetics | Sentences with "PK", "absorption", "half-life" | ⭐⭐⭐⭐ |
| 4.4 Toxicology | Sentences with "toxicity", "adverse", "NOAEL" | ⭐⭐⭐⭐ |
| Title, Authors, PMID | Metadata | ⭐⭐⭐⭐⭐ |
| Abstract | Full abstract | ⭐⭐⭐⭐⭐ |
| Detailed subsections | Specific keywords | ⭐⭐⭐ |

### Tips for Best Results

1. **Choose the Right Articles**
   ```
   Good: "Pharmacokinetics and safety of XYZ in rats..."
   Bad: "Case report of adverse event..."
   ```

2. **Use Standard Heading Names**
   ```
   ✅ 4.2 Pharmacology
   ✅ 4.3.1 Absorption
   ✅ 4.4.2 Repeat Dose Toxicity
   
   ❌ 4.2 Drug Effects
   ❌ 4.3.1 How drug gets in
   ❌ 4.4.2 Long term safety
   ```

3. **Preview Before Generating**
   - See what content will actually appear
   - Adjust template headings if needed
   - Try different articles if content is limited

### Understanding the Output

**What You'll Get:**
- ✅ Professional document with your template structure
- ✅ Numbered sections preserved
- ✅ Content extracted from article abstract
- ✅ Clear placeholders for unavailable content
- ✅ Article reference at top

**What You Won't Get:**
- ❌ Full article text (PubMed doesn't provide this)
- ❌ Figures or tables
- ❌ Detailed experimental protocols (unless in abstract)
- ❌ References list

**What You Should Do:**
1. Use generated document as a starting point
2. Review and verify all content
3. Add additional information from full article if available
4. Fill in sections marked as "[No relevant content found]"
5. Enhance with your own analysis

### Example Workflow

```
1. Search: "sildenafil pharmacokinetics toxicity"
2. Select article with detailed abstract
3. Add to cart
4. Click "Template Doc"
5. Upload "Nonclinical_Overview_Template.docx"
6. Preview mapping:
   ✓ 4.2 Pharmacology → "inhibits PDE5..."
   ✓ 4.3 Pharmacokinetics → "rapidly absorbed, half-life 4h..."
   ✓ 4.4 Toxicology → "well tolerated, NOAEL 200 mg/kg..."
7. Generate document
8. Review and enhance generated content
```

### Common Issues

**Issue:** All sections show "[No relevant content found]"

**Fix:**
- Article abstract is too short
- Try articles with "Abstract" badge in PubMed
- Select research articles, not reviews
- Choose articles with structured abstracts

**Issue:** Content doesn't match section

**Fix:**
- Use more specific heading names
- Include keywords: "Primary Pharmacodynamics" vs just "Pharmacology"
- Preview first to see what's being extracted

**Issue:** Same content in multiple sections

**Fix:**
- This happens when abstract doesn't differentiate
- Normal for short abstracts
- Edit document to distribute content appropriately

### Need More Content?

Remember: The system can only extract from **article abstracts**. For detailed nonclinical overviews:

1. Use generated document as template
2. Access full articles for complete data
3. Fill in missing sections manually
4. Combine multiple articles for comprehensive coverage
5. Add your own analysis and interpretation

### Support

The Template Doc feature provides intelligent extraction from available data (abstracts). It's designed to:
- ✅ Save time on initial document structuring
- ✅ Auto-populate basic information
- ✅ Provide relevant content where available
- ✅ Show clear placeholders where manual input needed

Think of it as a smart assistant, not a replacement for thorough scientific review!
