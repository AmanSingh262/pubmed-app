# 🚀 Quick Start Guide - PubMed Intelligent Filter

## Installation (2 minutes)

```powershell
# Navigate to project directory
cd "c:\Users\ASquare\Downloads\report image\pubmed"

# Install all dependencies
npm install
cd client
npm install
cd ..

# Start the application
npm run dev
```

Open browser: **http://localhost:3000**

## How to Use (Step-by-Step)

### 1️⃣ Enter Search Term
Type a drug name or medical topic in the search bar:
- Examples: `cefixime`, `aspirin`, `metformin`, `diabetes`, `hypertension`

### 2️⃣ Select Study Type
Click one of the two buttons:
- 🐾 **Animal Studies** - Pre-clinical research
- 👨‍⚕️ **Human Studies** - Clinical trials and patient studies

### 3️⃣ Choose Category
Expand the category tree and select a specific subcategory:

**Animal Studies Categories:**
- Pharmacodynamics (In Vivo, In Vitro)
- Safety Pharmacology (CNS, CVS effects)
- Pharmacokinetics (ADME - Absorption, Distribution, Metabolism, Excretion)
- Toxicology (Acute, Chronic, Genotoxicity, etc.)

**Human Studies Categories:**
- Pharmacokinetics (ADME, Special Populations, Drug Interactions)
- Pharmacodynamics (Mechanism of action, Drug interactions)
- Efficacy (Clinical trials, Pediatrics, Dosage)
- Safety (Adverse reactions, Pregnancy, Overdose, Post-marketing)

### 4️⃣ Search
Click **"Search Articles"** button and wait for results (typically 2-5 seconds)

### 5️⃣ Review Results
- View filtered articles ranked by relevance
- Check the relevance score (higher = more relevant)
- Read abstracts and matched keywords
- Click article titles to view on PubMed

### 6️⃣ Export (Optional)
Choose export format:
- **CSV** - Open in Excel/Google Sheets
- **JSON** - For data processing
- **BibTeX** - For LaTeX references
- **RIS** - For reference managers (Mendeley, Zotero)

## Example Workflow

### Example 1: Find Animal Pharmacokinetics Studies

1. **Search term:** `cefixime`
2. **Study type:** Animal Studies
3. **Category:** Pharmacokinetics → Absorption
4. **Result:** Articles about drug absorption in animal models
5. **Export:** Download as CSV for further analysis

### Example 2: Find Human Safety Data

1. **Search term:** `aspirin`
2. **Study type:** Human Studies
3. **Category:** Safety → Adverse Drug Reactions
4. **Result:** Clinical reports of aspirin side effects
5. **Export:** Download as BibTeX for research paper

### Example 3: Find Clinical Efficacy Trials

1. **Search term:** `metformin diabetes`
2. **Study type:** Human Studies
3. **Category:** Efficacy → Placebo-Controlled Studies
4. **Result:** Randomized controlled trials of metformin
5. **Export:** Download as RIS for reference manager

## Understanding Results

### Relevance Score Breakdown

| Score | Label | Meaning |
|-------|-------|---------|
| 30+ | Highly Relevant | Multiple strong keyword matches |
| 15-29 | Relevant | Good keyword matches |
| <15 | Moderately Relevant | Basic keyword matches |

### What Gets Matched?

✅ **MeSH Terms** (Medical Subject Headings) - Highest priority (+10 points)
✅ **Title Keywords** - High priority (+5 points)
✅ **Abstract Keywords** - Medium priority (+2 points)
✅ **Article Keywords** - Medium priority (+3 points)
✅ **Multiple Match Types** - Bonus multiplier (up to 50%)

## Performance Tips

### For Best Results:

1. **Be Specific:** Use precise drug names or medical terms
2. **Select Narrow Categories:** More specific = better filtering
3. **Use API Key:** Get free NCBI API key for faster searches
4. **Check Cache:** Repeated searches are instant (cached)

### If Results Are Too Broad:

- Select a more specific subcategory
- Add more specific terms to search query
- Try different category combinations

### If No Results Found:

- Try a broader category
- Check spelling of drug/topic name
- Try different search terms (synonyms)
- Switch between Animal/Human studies

## Keyboard Shortcuts

- **Enter** - Submit search from search bar
- **Escape** - Clear current focus
- Browser shortcuts work normally (Ctrl+F, etc.)

## Common Use Cases

### 📊 Research Review
Filter 200+ articles → 15-20 highly relevant ones
**Time Saved:** 80%+ reduction in manual review

### 📝 Literature Review
Export filtered results → Import to reference manager
**Workflow:** Search → Filter → Export RIS → Mendeley/Zotero

### 📈 Data Analysis
Export to CSV → Analyze in Excel/Python
**Use Case:** Meta-analysis, systematic review preparation

### 🔬 Drug Safety Assessment
Filter by safety categories → Review adverse events
**Application:** Pharmacovigilance, regulatory submissions

### 🧪 Pre-clinical Research Planning
Find animal studies → Identify research gaps
**Benefit:** Avoid duplicate studies, identify methodologies

## Troubleshooting Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| No results | Try broader category or different search term |
| Slow loading | Add NCBI API key to `.env` file |
| Port in use | Change PORT in `.env` or restart computer |
| Module errors | Run `npm install` in both root and client folders |
| Cache issues | Clear browser cache or use incognito mode |

## Need Help?

1. Check `SETUP_GUIDE.md` for detailed installation instructions
2. Review `README.md` for technical documentation
3. Check browser console for error messages
4. Verify `.env` file is configured correctly

## Pro Tips 💡

1. **Batch Processing:** Search once, export multiple formats
2. **Category Exploration:** Browse category tree to understand options
3. **Multiple Searches:** Try different categories for comprehensive review
4. **Score Threshold:** Focus on articles with score >20 for highest relevance
5. **MeSH Terms:** Pay attention to matched MeSH terms for accuracy
6. **API Key:** Essential for frequent users (3 requests/sec vs 10/sec)

---

## Quick Reference Commands

```powershell
# Start development servers
npm run dev

# Start backend only
npm run server

# Start frontend only  
npm run client

# Build for production
cd client; npm run build

# Clear cache
# Use the "Clear Filters" button in UI
# Or restart the server
```

## System Requirements

- ✅ Windows 10/11
- ✅ Node.js 14+
- ✅ 4GB RAM minimum
- ✅ Internet connection
- ✅ Modern browser (Chrome, Firefox, Edge)

---

**You're all set!** Happy researching! 🎉
