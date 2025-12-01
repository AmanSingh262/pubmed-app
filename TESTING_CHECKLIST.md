# Template System - Testing Checklist ✅

## System Status
✅ Backend Route: `/api/template-final` - REGISTERED  
✅ Upload Endpoint: `POST /api/template-final/upload` - ACTIVE  
✅ Generate Endpoint: `POST /api/template-final/generate` - ACTIVE  
✅ Preview Endpoint: `POST /api/template-final/preview` - ACTIVE  
✅ Frontend Component: `TemplateDocModal.js` - UPDATED TO USE FINAL API  
✅ API Service: `api.js` - HAS ALL TEMPLATEFINAL METHODS  
✅ Server: Running on port 5000  

---

## Pre-Testing Setup

### 1. Create Test Template
Create a new Word document (`test_template.docx`) with this content:

```
MODULE 2.4: NONCLINICAL OVERVIEW

Drug Name: {drug_name}
PubMed ID: {pmid}

════════════════════════════════════════════════════════

1. ABSTRACT
{abstract}

════════════════════════════════════════════════════════

2. PHARMACOLOGY

2.1 Mechanism of Action
{mechanism_of_action}

2.2 Pharmacodynamics
{primary_pharmacodynamics}

════════════════════════════════════════════════════════

3. PHARMACOKINETICS

3.1 Absorption
{absorption}

3.2 Distribution
{distribution}

3.3 Metabolism
{metabolism}

3.4 Excretion
{excretion}

════════════════════════════════════════════════════════

4. TOXICOLOGY
{toxicology}

════════════════════════════════════════════════════════

5. LIST OF ABBREVIATIONS
{abbreviations_list}

════════════════════════════════════════════════════════

End of Report
```

**Save this as**: `test_template.docx` on your Desktop

---

## Testing Steps

### Test 1: Upload Template ✅

**Actions:**
1. Open your PubMed app in browser (http://localhost:3000)
2. Search for any drug (e.g., "aspirin pharmacokinetics")
3. Click "Template Generator" button
4. Click "Choose Template File"
5. Select `test_template.docx`
6. Click "Upload Template"

**Expected Results:**
- ✅ Button shows "Uploading..." briefly
- ✅ Success message: "Template analyzed! Found X headings, Y tables"
- ✅ Green checkmark appears: "✓ Template uploaded!"
- ✅ Step 2 (Preview) becomes available

**If Failed:**
- Check browser console (F12 → Console tab)
- Check server terminal for errors
- Verify template is `.docx` format (not `.doc`)

---

### Test 2: Preview Content ✅

**Actions:**
1. Select one article from search results (checkbox)
2. Click "👁️ Preview Extracted Content"

**Expected Results:**
- ✅ Preview panel appears
- ✅ Shows article info: PMID, drug name, title
- ✅ Lists content availability:
  - "abstract: Available ✓"
  - "pharmacology: Available ✓"
  - "abbreviations_list: Available ✓"
- ✅ Shows abbreviations found (PK, PD, ADME, etc.)
- ✅ Success message: "Preview generated with complete content!"

**Verify:**
- Abstract shows "Available" (most important!)
- At least 3-5 abbreviations listed
- Preview doesn't show error messages

**If Failed:**
- Try selecting a different article
- Articles with longer abstracts work better
- Check console for API errors

---

### Test 3: Generate Document ✅

**Actions:**
1. Click "Generate Document" button

**Expected Results:**
- ✅ Button shows "Generating..." with spinner
- ✅ File downloads automatically: `Nonclinical_Overview_PMID_12345678.docx`
- ✅ Success message: "Complete document generated! Full abstract, abbreviations list, and all sections filled."
- ✅ Modal closes after 1.5 seconds

**Open Downloaded File and Verify:**

**✅ Must Have:**
1. **Drug name and PMID filled** (not showing {drug_name} or {pmid})
2. **FULL abstract text** - Should be 100-500 words, NOT just first sentence
3. **Abbreviations table** - Should show 5-15 abbreviations formatted as:
   ```
   PK - Pharmacokinetics
   PD - Pharmacodynamics
   ADME - Absorption, Distribution, Metabolism, Excretion
   ```
4. **At least some content** in Pharmacology section
5. **Original template formatting preserved** (headings, lines, structure)

**❌ Should NOT Have:**
- Placeholders still showing: `{abstract}`, `{pharmacology}`
- Only MODULE 2.4 header with no content
- Abbreviated abstract (only first sentence)
- Empty abbreviations section
- New document that lost template structure

**If Failed - Placeholders Still Showing:**
- Template may not have been filled properly
- Check that placeholders match exact names from Quick Reference
- Verify template was uploaded (green checkmark in Step 1)

**If Failed - Only 1 Page Generated:**
- THIS WAS THE OLD BUG - Should be fixed now!
- If this happens, check:
  1. Browser console - look for API errors
  2. Server terminal - check which route was called
  3. Verify modal is calling `api.generateTemplateDocFinal()` not old V3/V4

---

### Test 4: Multiple Sections ✅

**Test with a PK/ADME article:**
1. Search: "drug pharmacokinetics absorption distribution"
2. Select article with detailed abstract
3. Upload template
4. Preview - verify shows "pharmacokinetics: Available"
5. Generate document

**Verify Downloaded File Has:**
- ✅ Content in Absorption section
- ✅ Content in Distribution section
- ✅ Content in Metabolism section
- ✅ Content in Excretion section
- ✅ PK-related abbreviations (AUC, Cmax, Tmax, bioavailability)

---

### Test 5: Toxicology Article ✅

**Test with a toxicology article:**
1. Search: "drug toxicity genotoxicity carcinogenicity"
2. Select relevant article
3. Upload template, preview, generate

**Verify:**
- ✅ Toxicology section has content
- ✅ May have genotoxicity content if article mentions it
- ✅ Abbreviations include NOAEL, LOAEL, LD50, MTD (if applicable)

---

## Known Limitations

### ⚠️ Content Depends on Article Quality

**What This Means:**
- If article abstract doesn't mention "pharmacokinetics" → PK section may be empty
- If article is about clinical trials → Toxicology section may be empty
- Short abstracts → Less content to extract

**Solutions:**
- Use Preview to check content availability BEFORE generating
- Select articles with comprehensive abstracts
- Combine data from multiple articles manually

### ⚠️ Abbreviations Auto-Detection

**What Gets Found:**
- Pattern matching: "Full Term (ABBR)" ✅
- Common pharma terms that appear in text ✅
- Custom/rare abbreviations may be missed ⚠️

**Solutions:**
- System adds 20+ common abbreviations automatically
- You can manually add more after generation
- Edit the abbreviations table in generated document

---

## Troubleshooting Guide

### Issue: "Failed to upload template"
**Causes:**
- File is not `.docx` format
- File is corrupted
- Server not running

**Fix:**
1. Re-save template as `.docx` (Word 2007+)
2. Check server terminal - should show "Server running on port 5000"
3. Try uploading a simple template with just `{abstract}`

---

### Issue: "No articles selected"
**Causes:**
- Forgot to check article checkbox

**Fix:**
- Select at least one article (checkbox) before clicking Preview/Generate

---

### Issue: Preview shows "No ... information available"
**Causes:**
- Article abstract doesn't contain those keywords
- Article type doesn't match section (e.g., clinical trial vs toxicology)

**Fix:**
- ✅ This is NORMAL! Not every article has all content types
- Select different article for that specific section
- Or manually add content after generation

---

### Issue: Downloaded file has "{abstract}" instead of actual text
**Causes:**
- Template wasn't uploaded before generating
- Placeholder names don't match exactly
- Old browser cache

**Fix:**
1. Refresh page (Ctrl+F5)
2. Upload template AGAIN (make sure green checkmark appears)
3. Verify placeholder names: `{abstract}` not `{Abstract}` or `{ABSTRACT}`
4. Check Quick Reference guide for exact spelling

---

### Issue: Only MODULE 2.4 header, missing all content
**Causes:**
- ⚠️ THIS WAS THE OLD BUG - Should be fixed now!
- If still happening: Frontend calling wrong API version

**Fix:**
1. Check browser console (F12)
2. Look for API call - should be `/api/template-final/generate`
3. If shows `/api/template-v3/` or `/api/template-v4/` → Modal not updated
4. Report this - modal needs to be updated to use Final API

**Verification:**
Open `TemplateDocModal.js` and search for:
- ✅ Should find: `api.uploadTemplateFinal`
- ✅ Should find: `api.generateTemplateDocFinal`
- ✅ Should find: `api.previewTemplateFinal`
- ❌ Should NOT find: `api.uploadTemplateV3` or `V4`

---

## Success Criteria Checklist

After completing all tests, you should have:

- ✅ Downloaded document with drug name and PMID filled
- ✅ FULL abstract text (100+ words, complete paragraph)
- ✅ Abbreviations table with 5-15 entries
- ✅ At least some content in 3+ sections
- ✅ Template formatting preserved (headings, lines, structure)
- ✅ No placeholder text showing (`{...}`)
- ✅ File named: `Nonclinical_Overview_PMID_########.docx`

---

## Next Steps After Testing

### If All Tests Pass ✅
You're ready to use the system! 

**Recommended Workflow:**
1. Create your official Nonclinical Overview template with all sections
2. Add placeholders from Quick Reference guide
3. Search PubMed for high-quality articles with detailed abstracts
4. Preview first to check content availability
5. Generate documents and combine data from multiple articles as needed

### If Tests Fail ❌

**Collect This Information:**
1. Which test failed? (Upload, Preview, or Generate)
2. Error message shown (screenshot helpful)
3. Browser console output (F12 → Console tab)
4. Server terminal output (check for error messages)
5. What you expected vs. what happened

**Then:**
- Check the specific "Fix" section for that issue above
- Try with a different article
- Clear browser cache and reload (Ctrl+Shift+R)
- Restart server (close terminal, run `npm run dev`)

---

## Files for Reference

**Documentation:**
- `TEMPLATE_SYSTEM_GUIDE.md` - Complete user guide
- `PLACEHOLDERS_QUICK_REFERENCE.md` - Quick placeholder list
- `TESTING_CHECKLIST.md` - This file

**Code:**
- `server/routes/templateFinal.js` - Backend logic (639 lines)
- `client/src/components/TemplateDocModal.js` - Frontend UI
- `client/src/services/api.js` - API methods

**Endpoints:**
- Upload: `POST http://localhost:5000/api/template-final/upload`
- Preview: `POST http://localhost:5000/api/template-final/preview`
- Generate: `POST http://localhost:5000/api/template-final/generate`

---

**Happy Testing! 🎉**

If everything works, you now have a fully functional template system that:
- Extracts FULL abstracts (not excerpts) ✅
- Generates complete abbreviations tables ✅
- Fills ALL sections in your template ✅
- Preserves your template structure and formatting ✅
