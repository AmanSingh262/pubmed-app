# How to Add Abbreviations Table to Your Word Template

## ✅ SIMPLE 3-STEP PROCESS

### Step 1: Create a Table in Word

1. Open your Word template (.docx file)
2. Find where you want the abbreviations (e.g., after "2.4 Nonclinical Overview" section)
3. Insert a table with **2 columns** and **2 rows**:
   - Click **Insert** → **Table** → Select **2 columns x 2 rows**

### Step 2: Format the Table

**First Row (Header):**
- Column 1: Type `Abbreviation` (bold, centered)
- Column 2: Type `Definition` (bold, centered)
- Add gray background to header row (right-click row → Shading → Gray 25%)

**Second Row (Data Template):**
- Column 1: Type `{#abbreviations}{abbr}`
- Column 2: Type `{fullTerm}{/abbreviations}`

### Step 3: Apply Table Borders

1. Select the entire table
2. Click **Table Design** → **Borders** → **All Borders**
3. Make sure borders are **black** and **visible**

---

## 📋 EXACT TABLE STRUCTURE

```
┌─────────────────┬────────────────────────────────────────┐
│  Abbreviation   │            Definition                  │  ← Header (Gray, Bold, Centered)
├─────────────────┼────────────────────────────────────────┤
│ {#abbreviations}{abbr}  │  {fullTerm}{/abbreviations}  │  ← Data row with loop
└─────────────────┴────────────────────────────────────────┘
```

**Important:** The second row contains the docxtemplater loop:
- `{#abbreviations}` = Start loop
- `{abbr}` = Abbreviation (e.g., "CNS")
- `{fullTerm}` = Full term (e.g., "central nervous system")
- `{/abbreviations}` = End loop

---

## 🎯 VISUAL GUIDE

### What You Type in Word:

**Row 1 (Header):**
| Abbreviation | Definition |
|--------------|------------|

**Row 2 (Data Loop):**
| {#abbreviations}{abbr} | {fullTerm}{/abbreviations} |

### What You Get in Output:

| Abbreviation | Definition |
|--------------|------------|
| AUC | area under the curve |
| CNS | central nervous system |
| Cmax | maximal plasma concentrations |
| g | gram |
| h | hours |
| PK | pharmacokinetics |
| ... | ... |

*(Automatically adds as many rows as there are abbreviations)*

---

## ⚙️ DETAILED INSTRUCTIONS

### Creating the Table:

1. **Position your cursor** where you want the table
2. Go to **Insert** tab
3. Click **Table**
4. Select **2 columns × 2 rows**

### Formatting Header Row:

1. Select the **first row**
2. Make text **bold** (Ctrl+B)
3. **Center align** text
4. Add **gray background**:
   - Right-click → **Shading** → **Gray-25%** or **#CCCCCC**

### Adding Borders:

1. Select the **entire table**
2. Go to **Table Design** tab
3. Click **Borders** dropdown
4. Select **All Borders**
5. Ensure border style is **single line, black**

### Adding Loop Syntax:

In the **second row**:
- **Left cell**: Type exactly `{#abbreviations}{abbr}`
- **Right cell**: Type exactly `{fullTerm}{/abbreviations}`

**Critical:** 
- No spaces between `{#abbreviations}` and `{abbr}`
- `{/abbreviations}` must be at the END of the second cell
- Use curly braces `{}`, not parentheses or square brackets

---

## 🔍 TROUBLESHOOTING

### Problem: Table shows "{#abbreviations}{abbr}" in output

**Solution:** The loop syntax is correct! This will be replaced when you generate the document.

### Problem: Only 1 row appears (no abbreviations)

**Causes:**
1. Loop syntax is incorrect
2. Curly braces are wrong type (use `{}` not fancy quotes)
3. Missing `{/abbreviations}` closing tag

**Fix:**
- Re-type the loop syntax manually
- Make sure it's exactly: `{#abbreviations}{abbr}` and `{fullTerm}{/abbreviations}`

### Problem: Table has no borders

**Solution:**
1. Select table
2. Table Design → Borders → All Borders
3. Make sure you save the template after adding borders

---

## 📝 COMPLETE EXAMPLE

Here's how your Word template should look:

```
2.4 Nonclinical Overview

[Your content here...]

Abbreviations:

┌───────────────────────┬──────────────────────────────────────┐
│    Abbreviation       │           Definition                 │  ← Gray background, bold
├───────────────────────┼──────────────────────────────────────┤
│ {#abbreviations}{abbr}│  {fullTerm}{/abbreviations}          │  ← Loop row
└───────────────────────┴──────────────────────────────────────┘
```

When you generate a document, this becomes:

```
Abbreviations:

┌───────────────────────┬──────────────────────────────────────┐
│    Abbreviation       │           Definition                 │
├───────────────────────┼──────────────────────────────────────┤
│ ADME                  │ absorption, distribution, metabolism,│
│                       │ excretion                            │
├───────────────────────┼──────────────────────────────────────┤
│ AUC                   │ area under the curve                 │
├───────────────────────┼──────────────────────────────────────┤
│ CNS                   │ central nervous system               │
├───────────────────────┼──────────────────────────────────────┤
│ ... (automatically continues for all abbreviations)          │
└───────────────────────┴──────────────────────────────────────┘
```

---

## ✨ FEATURES

✅ **Automatic row generation** - Creates exactly the number of rows needed  
✅ **Bordered table** - Black borders on all cells  
✅ **Gray header** - Professional pharmaceutical report style  
✅ **Alphabetically sorted** - Abbreviations appear in A-Z order  
✅ **40+ pharmaceutical terms** - Automatically includes standard abbreviations  
✅ **Article-specific terms** - Extracts abbreviations from your article content  

---

## 🚀 READY TO USE

1. **Add the table to your template** (2 columns, 2 rows)
2. **Format it** (header bold/gray, borders black)
3. **Add loop syntax** in row 2
4. **Save your template**
5. **Upload and generate** - abbreviations table will appear automatically!

No coding required - just format the table in Word and the system does the rest! 🎉
