# 🎯 SOLUTION: Get Proper Abbreviations Table with Borders

## ⚠️ THE PROBLEM
When you use `{abbreviations_list}`, it inserts tab-separated text, NOT a formatted table with borders.

## ✅ THE SOLUTION
You MUST create an actual table in your Word template and use a loop.

---

## 📋 STEP-BY-STEP INSTRUCTIONS

### **Method 1: Create Table in Word Template** (BEST - Automatic borders!)

#### Step 1: Open Your Word Template

#### Step 2: Insert a Table
1. Place cursor where you want the abbreviations table
2. Click **Insert** → **Table** → **Insert Table**
3. Choose:
   - **Number of columns:** 2
   - **Number of rows:** 2
4. Click **OK**

#### Step 3: Format the Table Header (Row 1)
**Cell A1:**
- Type: `Abbreviation`
- Make it **Bold** (Ctrl+B)
- Center align it

**Cell B1:**
- Type: `Definition`
- Make it **Bold** (Ctrl+B)
- Center align it

#### Step 4: Add Loop Tags for Data (Row 2)

**IMPORTANT:** The loop tags must be OUTSIDE the table row!

**Before Row 2 (above the table row):**
```
{#abbreviations}
```

**Cell A2:**
```
{abbr}
```

**Cell B2:**
```
{fullTerm}
```

**After Row 2 (below the table row):**
```
{/abbreviations}
```

#### Visual Example:
```
                {#abbreviations}              ← BEFORE the row
┌───────────────────┬─────────────────────────────┐
│   Abbreviation    │         Definition          │  ← Header (type manually)
├───────────────────┼─────────────────────────────┤
│      {abbr}       │        {fullTerm}           │  ← Data (placeholders)
└───────────────────┴─────────────────────────────┘
                {/abbreviations}              ← AFTER the row
```

#### Step 5: Apply Table Borders
1. Select the entire table
2. Go to **Table Design** tab
3. Click **Borders** dropdown
4. Select **All Borders**

#### Step 6: Set Column Widths (Optional)
1. Select column A (Abbreviation)
   - Right-click → **Table Properties** → **Column** tab
   - Set **Preferred width:** 2 inches
2. Select column B (Definition)
   - Set **Preferred width:** 4 inches

#### Step 7: Save Your Template
Save the template file (.docx)

---

### **Method 2: Convert After Generation** (Manual but Quick)

If you don't want to modify your template:

#### Step 1: Use This Placeholder in Template
```
{abbreviations_list}
```

#### Step 2: After Document is Generated
1. Open the generated document
2. Find the abbreviations section (will be tab-separated text)
3. **Select ALL the abbreviations text** (including header)
4. Go to **Insert** → **Table** → **Convert Text to Table**
5. In the dialog:
   - **Separate text at:** Choose **Tabs**
   - **Number of columns:** Should auto-detect as 2
6. Click **OK**

#### Step 3: Format the Table
1. Select the table
2. **Table Design** → **Borders** → **All Borders**
3. Select Row 1 (header) → Make **Bold**

---

## 📊 COMPARISON

| Method | Setup Time | Result | Auto-formats? |
|--------|-----------|---------|---------------|
| **Method 1 (Template Table)** | 5 min (one-time) | Perfect table with borders | ✅ YES - Automatic! |
| **Method 2 (Convert Text)** | 30 sec per document | Perfect table with borders | ❌ NO - Manual each time |

---

## 💡 RECOMMENDED APPROACH

**Use Method 1** - Set up the table loop in your template ONCE, and every generated document will have a perfect table automatically!

### Your Template Should Look Like:

```docx
MODULE 2.4 NONCLINICAL OVERVIEW

Drug Name: {drug_name}
PMID: {pmid}

1. ABSTRACT
{abstract}

2. PHARMACOLOGY
{pharmacology}

3. LIST OF ABBREVIATIONS

{#abbreviations}
┌───────────────────┬─────────────────────────────┐
│   Abbreviation    │         Definition          │
├───────────────────┼─────────────────────────────┤
│      {abbr}       │        {fullTerm}           │
└───────────────────┴─────────────────────────────┘
{/abbreviations}
```

### Generated Document Will Have:

```docx
┌───────────────────┬─────────────────────────────┐
│   Abbreviation    │         Definition          │
├───────────────────┼─────────────────────────────┤
│ a.c.              │ before food or meals        │
├───────────────────┼─────────────────────────────┤
│ AUC               │ area under the curve        │
├───────────────────┼─────────────────────────────┤
│ CNS               │ central nervous system      │
├───────────────────┼─────────────────────────────┤
│ Cmax              │ maximal plasma concentrations│
├───────────────────┼─────────────────────────────┤
│ PK                │ pharmacokinetics            │
└───────────────────┴─────────────────────────────┘
```

---

## 🎥 QUICK VIDEO GUIDE (Text Instructions)

### Creating the Table Loop:

1. **Open template.docx**
2. **Insert → Table → 2 columns, 2 rows**
3. **Row 1:** Type headers (Abbreviation, Definition) - make Bold
4. **Row 2:** Click BEFORE the row, type `{#abbreviations}`, press Enter
5. **Cell A2:** Type `{abbr}`
6. **Cell B2:** Type `{fullTerm}`
7. **After Row 2:** Click after the row, type `{/abbreviations}`
8. **Select table → Table Design → All Borders**
9. **Save template**
10. **Generate document** - table will appear with all abbreviations!

---

## ❓ TROUBLESHOOTING

### Problem: Loop tags showing in output
**Solution:** Make sure `{#abbreviations}` and `{/abbreviations}` are OUTSIDE the table, not inside cells.

### Problem: Only one row appears
**Solution:** The loop tags must wrap the ENTIRE row, not individual cells.

### Problem: Table has no borders
**Solution:** In your template, select the table → Table Design → Borders → All Borders

### Problem: Getting text instead of table
**Solution:** You're using `{abbreviations_list}` instead of the table loop. Either:
- Use Method 1 (table loop in template), OR
- Use Method 2 (convert text to table after generation)

---

## ✅ FINAL CHECKLIST

Before generating:
- [ ] Template has a 2-column table
- [ ] Row 1 has "Abbreviation" and "Definition" headers (manually typed)
- [ ] `{#abbreviations}` is BEFORE row 2
- [ ] Row 2 has `{abbr}` and `{fullTerm}` placeholders
- [ ] `{/abbreviations}` is AFTER row 2
- [ ] Table has borders applied (All Borders)
- [ ] Template is saved

After generating:
- [ ] Document has complete table with all abbreviations
- [ ] Table has borders
- [ ] All abbreviations are listed
- [ ] Definitions are complete

---

**This is the ONLY way to get automatic table formatting with borders!** 🎯
