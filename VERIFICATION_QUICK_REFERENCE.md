# Study Type Verification - Quick Reference

## 🎯 Purpose
Solve the problem of mixed animal/human study results with strict verification filters.

## 🔍 New Filters (in Search Filters panel)

### 🐾 Strict Animal Study Only
- ✅ Requires: Animal species in title OR "Animals" MeSH
- ❌ Excludes: "patient", "clinical trial", "Humans" MeSH

### 👨‍⚕️ Strict Human Study Only
- ✅ Requires: Human indicators in text OR "Humans" MeSH  
- ❌ Excludes: Animal species in title, animal-only MeSH

## 📊 Visual Indicators

**Verified articles show badges:**
- 🟢 **Verified Animal Study** (green badge)
- 🟣 **Verified Human Study** (purple badge)

## ⚡ Quick Start

1. Search for drug/compound
2. Select study type (Animal/Human)
3. Choose category
4. ✅ **Check verification box** (Animal or Human)
5. Search

## 💡 When to Use

**Use Verification:**
- Need high accuracy
- Systematic reviews
- Minimize manual checking

**Skip Verification:**
- Exploratory research
- Want more results
- Some ambiguity OK

## 🔧 Files Modified

**Frontend:**
- `SearchFilters.js` - Added checkboxes
- `App.js` - State management
- `ArticleCard.js` - Verification badges
- CSS files - Styling

**Backend:**
- `search.js` - Enhanced validation logic

## 📝 Example

```
Query: "cefixime"
Type: Animal
Category: Pharmacokinetics > Absorption
✅ Strict Animal Study Only

Results: Only "...in rats", "...mouse model" etc.
Badge: 🐾 Verified Animal Study
```

---
**Tip:** Combine with other filters (year, abstract, full text) for best results!
