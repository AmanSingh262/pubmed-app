# 📋 HOW TO CREATE ABBREVIATIONS TABLE IN YOUR WORD TEMPLATE

## ⚠️ IMPORTANT: The System Cannot Auto-Generate Tables

The XML injection approach is **unreliable and creates corrupted tables** (as you saw with wrong data in cells).

**THE ONLY RELIABLE WAY:** Create the table structure in your Word template file.

---

## ✅ STEP-BY-STEP GUIDE

### Step 1: Open Your Word Template

Open your template file (e.g., `Nonclinical_Template.docx`) in Microsoft Word.

### Step 2: Go to the Abbreviations Section

Scroll to where you want the abbreviations table (usually "LIST OF ABBREVIATIONS" section).

### Step 3: Insert a 2-Column Table

1. Click where you want the table
2. Go to **Insert** → **Table**
3. Select **2 columns** and **2 rows**
4. Click to insert

### Step 4: Format the Header Row

**In Row 1:**
- **Cell A1:** Type `Abbreviation` and make it **Bold** (Ctrl+B)
- **Cell B1:** Type `Definition` and make it **Bold** (Ctrl+B)
- **Optional:** Center align both cells
- **Optional:** Add gray background (Table Design → Shading)

### Step 5: Add the Loop Tags for Data

**CRITICAL:** The loop tags must be placed **OUTSIDE** the table row, not inside cells.

**Place your cursor BEFORE Row 2** (the data row) and type:
```
{#abbreviations}
```

**Then press Enter** to move it above the row.

**In Row 2:**
- **Cell A2:** Type `{abbr}`
- **Cell B2:** Type `{fullTerm}`

**Place your cursor AFTER Row 2** and type:
```
{/abbreviations}
```

### Step 6: Visual Example

Your template should look like this:

```
LIST OF ABBREVIATIONS

{#abbreviations}
┌───────────────────┬─────────────────────────────┐
│  Abbreviation     │         Definition          │  ← Header (manually typed)
├───────────────────┼─────────────────────────────┤
│  {abbr}           │      {fullTerm}             │  ← Data row (placeholders)
└───────────────────┴─────────────────────────────┘
{/abbreviations}
```

### Step 7: Add Borders (Important!)

1. Select the entire table
2. Go to **Table Design** tab
3. Click **Borders** dropdown
4. Select **All Borders**

### Step 8: Adjust Column Widths (Optional)

1. Select column A → Right-click → **Table Properties** → **Column** tab
   - Set width to **2 inches** or **5 cm**
2. Select column B → Set width to **4 inches** or **10 cm**

### Step 9: Save Your Template

Save the template file.

---

## 🎯 WHAT WILL HAPPEN

When you generate a document:

1. The system provides an array of abbreviations:
   ```javascript
   [
     { abbr: "CNS", fullTerm: "central nervous system" },
     { abbr: "g", fullTerm: "gram" },
     { abbr: "h", fullTerm: "hours" },
     // ... more abbreviations
   ]
   ```

2. The `{#abbreviations}` loop will **repeat Row 2** for each abbreviation

3. Each placeholder gets replaced:
   - `{abbr}` → "CNS", "g", "h", etc.
   - `{fullTerm}` → "central nervous system", "gram", "hours", etc.

4. Result: A perfect table with all abbreviations!

---

## ✅ EXPECTED OUTPUT

Your generated document will have:

```
┌───────────────────┬─────────────────────────────┐
│  Abbreviation     │         Definition          │
├───────────────────┼─────────────────────────────┤
│ a.c.              │ before food or meals        │
├───────────────────┼─────────────────────────────┤
│ a.m.              │ before noon                 │
├───────────────────┼─────────────────────────────┤
│ admin             │ administration              │
├───────────────────┼─────────────────────────────┤
│ approx.           │ approximately               │
├───────────────────┼─────────────────────────────┤
│ ATC               │ anatomical therapeutic chemical │
├───────────────────┼─────────────────────────────┤
│ AUC               │ area under the curve        │
├───────────────────┼─────────────────────────────┤
│ ... (all abbreviations listed)                  │
└───────────────────┴─────────────────────────────┘
```

---

## ❌ COMMON MISTAKES TO AVOID

### Mistake 1: Loop Tags Inside Table Cells
❌ **Wrong:**
```
┌─────────────┬──────────────────┐
│ {#abbreviations}{abbr}{/abbreviations} │ {fullTerm} │
└─────────────┴──────────────────┘
```

✅ **Correct:**
```
{#abbreviations}
┌─────────────┬──────────────────┐
│ {abbr}      │ {fullTerm}       │
└─────────────┴──────────────────┘
{/abbreviations}
```

### Mistake 2: Not Having a Header Row
You need a header row that's NOT part of the loop, otherwise it will repeat for each abbreviation.

### Mistake 3: Using {abbreviations_list}
If you use `{abbreviations_list}`, you'll get a simple text list:
```
CNS: central nervous system
g: gram
h: hours
```

This is NOT a table. You must use the loop approach for a table.

---

## 🔄 ALTERNATIVE: Simple Text List

If you don't want to create a table in your template, you can use:

```
{abbreviations_list}
```

This will output:
```
CNS: central nervous system
g: gram
h: hours
AUC: area under the curve
...
```

Then you can manually convert it to a table in Word:
1. Select the text
2. Insert → Table → Convert Text to Table
3. Choose "Other" as separator and type `:`
4. Click OK

---

## 📊 DATA PROVIDED BY THE SYSTEM

The system extracts and provides these abbreviations automatically:

**Common Pharmaceutical Terms:**
- a.c., a.m., admin, approx., ATC, AUC, bid, CAS, CL/F, CLcr, cm, Cmax, CNS, CV, g, h, im, IV, kg, L, mg, mL, PI, PK, μg

**Plus Article-Specific Abbreviations:**
- Extracted from the article title and abstract using pattern matching

---

## ✅ SUMMARY

1. **Open your Word template**
2. **Insert a 2-column table** where you want abbreviations
3. **Row 1:** Type headers (Abbreviation | Definition) - make bold
4. **Before Row 2:** Type `{#abbreviations}`
5. **Row 2 cells:** Type `{abbr}` | `{fullTerm}`
6. **After Row 2:** Type `{/abbreviations}`
7. **Add borders** to the table
8. **Save template**
9. **Generate document** - perfect table will appear!

---

**This is the ONLY way to get a reliable, properly formatted table with correct data in all cells!** 🎯
