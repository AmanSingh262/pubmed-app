# Abbreviations Table - Complete Guide

## 📋 Two Ways to Add Abbreviations

The system provides **two formats** for abbreviations:

1. **Text-based table** - Simple, uses `{abbreviations_list}` placeholder
2. **Word table format** - Uses loops in an actual Word table

---

## 🎯 Option 1: Text-Based Table (Recommended for Simple Use)

### How to Use:
Just add `{abbreviations_list}` anywhere in your Word template.

### Template Example:
```
5. LIST OF ABBREVIATIONS

{abbreviations_list}
```

### Output Result:
```
Abbreviation    Full Term
───────────────────────────────────────────────────────
ADME           Absorption, Distribution, Metabolism, Excretion
AUC            Area Under the Curve
Cmax           Maximum Plasma Concentration
CYP            Cytochrome P450
IC50           Half Maximal Inhibitory Concentration
PD             Pharmacodynamics
PK             Pharmacokinetics
Tmax           Time to Maximum Concentration
```

**Advantages:**
- ✅ Very simple - just one placeholder
- ✅ Works immediately
- ✅ Properly formatted and aligned
- ✅ No Word table setup required

**Best for:** Quick documents, simple templates

---

## 🎯 Option 2: Word Table Format (For Professional Documents)

### How to Use:
Create an actual table in Word, then use loop placeholders.

### Step 1: Create Table in Word

1. Open your Word template
2. Go to: Insert → Table → 2 columns
3. Create header row manually
4. Add loop placeholder in second row

### Template Example in Word:

**Create this table:**

| Abbreviation | Full Term |
|--------------|-----------|
| {#abbreviations}{abbr}{/abbreviations} | {#abbreviations}{fullTerm}{/abbreviations} |

**Or better - use row loop:**

Row 1 (Header - type manually):
```
| Abbreviation | Full Term |
```

Row 2 (Data - use loop):
```
| {#abbreviations}{abbr} | {fullTerm}{/abbreviations} |
```

### Output Result:
A proper Word table:

| Abbreviation | Full Term |
|--------------|-----------|
| ADME | Absorption, Distribution, Metabolism, Excretion |
| AUC | Area Under the Curve |
| Cmax | Maximum Plasma Concentration |
| CYP | Cytochrome P450 |
| IC50 | Half Maximal Inhibitory Concentration |
| PD | Pharmacodynamics |
| PK | Pharmacokinetics |
| Tmax | Time to Maximum Concentration |

**Advantages:**
- ✅ Professional Word table
- ✅ Easy to style (borders, colors, fonts)
- ✅ Can be sorted or filtered in Word
- ✅ Better for regulatory submissions

**Best for:** Professional documents, regulatory submissions, formal reports

---

## 🔧 Detailed Instructions for Word Table

### Method A: Inline Loop (Simpler)

1. **Create table with 2 columns, 2 rows**

2. **Row 1 (Header):** Type manually
   ```
   Cell A1: Abbreviation
   Cell B1: Full Term
   ```

3. **Row 2 (Data):** Add loop
   ```
   Cell A2: {#abbreviations}{abbr}{/abbreviations}
   Cell B2: {#abbreviations}{fullTerm}{/abbreviations}
   ```

4. **Save template**

### Method B: Row Loop (Recommended)

1. **Create table with 2 columns, 2 rows**

2. **Row 1 (Header):** Type manually
   ```
   Cell A1: Abbreviation
   Cell B1: Full Term
   ```

3. **Row 2 (Data):** Add loop at start and end
   ```
   Before row 2: {#abbreviations}
   Cell A2: {abbr}
   Cell B2: {fullTerm}
   After row 2: {/abbreviations}
   ```

4. **Save template**

### Visual Example:

```
┌────────────────────────────────────────────────┐
│                                                │
│  {#abbreviations}                              │ ← Start loop BEFORE row
│  ┌─────────────────┬────────────────────────┐  │
│  │ {abbr}          │ {fullTerm}             │  │ ← Placeholders in cells
│  └─────────────────┴────────────────────────┘  │
│  {/abbreviations}                              │ ← End loop AFTER row
│                                                │
└────────────────────────────────────────────────┘
```

---

## 📊 Complete Template Example

### Template with Both Sections:

```
MODULE 2.4: NONCLINICAL OVERVIEW

Drug: {drug_name}
PMID: {pmid}

1. ABSTRACT
{abstract}

2. PHARMACOLOGY
{pharmacology}

3. PHARMACOKINETICS
{pharmacokinetics}

4. LIST OF ABBREVIATIONS (Text Format)
{abbreviations_list}

5. ABBREVIATIONS TABLE (Word Table Format)

[Insert Word Table here with loop:
| Abbreviation | Full Term |
| {#abbreviations}{abbr} | {fullTerm}{/abbreviations} |
]
```

---

## 🎨 Styling the Word Table

After creating the table with loops, you can style it:

### Borders:
- Select table → Table Design → Borders → Grid

### Colors:
- Header row: Select row 1 → Shading → Choose color (e.g., blue)
- Alternating rows: Table Design → Table Styles → Banded Rows

### Fonts:
- Select table → Home tab → Font: Arial, Size: 10pt

### Width:
- Select table → Layout tab → AutoFit → AutoFit Contents

---

## ⚡ Quick Comparison

| Feature | Text Format `{abbreviations_list}` | Word Table `{#abbreviations}` |
|---------|-----------------------------------|-------------------------------|
| Setup Time | 5 seconds | 2 minutes |
| Styling Options | Limited | Full Word formatting |
| Looks | Good | Professional |
| Editability | Hard to edit | Easy to edit in Word |
| Recommended for | Quick docs | Professional docs |

---

## 🔍 Troubleshooting

### Issue: Table shows "{#abbreviations}" instead of data

**Cause:** Loop syntax error

**Fix:**
- Ensure `{#abbreviations}` comes BEFORE the row
- Ensure `{/abbreviations}` comes AFTER the row
- Make sure opening and closing tags match exactly

### Issue: Only shows one abbreviation

**Cause:** Loop is not around the table row

**Fix:**
- The loop must wrap the ENTIRE row, not just cells
- Put `{#abbreviations}` before row, `{/abbreviations}` after row

### Issue: Text format shows "No abbreviations"

**Cause:** Article doesn't contain abbreviations or system couldn't extract them

**Fix:**
- Try a different article with more technical terms
- System auto-adds 20+ common pharma abbreviations
- Check Preview to see what was found

---

## 📝 Example Output Comparison

### Text Format Output:
```
Abbreviation    Full Term
───────────────────────────────────────────────────────
ADME           Absorption, Distribution, Metabolism, Excretion
AUC            Area Under the Curve
Cmax           Maximum Plasma Concentration
```

### Word Table Output:
```
╔═══════════════╦══════════════════════════════════════════════╗
║ Abbreviation  ║ Full Term                                    ║
╠═══════════════╬══════════════════════════════════════════════╣
║ ADME          ║ Absorption, Distribution, Metabolism,        ║
║               ║ Excretion                                    ║
╠═══════════════╬══════════════════════════════════════════════╣
║ AUC           ║ Area Under the Curve                         ║
╠═══════════════╬══════════════════════════════════════════════╣
║ Cmax          ║ Maximum Plasma Concentration                 ║
╚═══════════════╩══════════════════════════════════════════════╝
```

---

## ✅ Recommendations

**Use Text Format if:**
- You need quick results
- Template is simple
- Don't need heavy styling

**Use Word Table if:**
- Creating professional/regulatory documents
- Need to style with colors/borders
- Want to sort/filter abbreviations later
- Need to match specific formatting requirements

**Use Both if:**
- You want a backup format
- Different sections need different styles

---

## 🎯 Summary

1. **Easiest:** Just use `{abbreviations_list}` - works immediately
2. **Professional:** Create Word table with `{#abbreviations}` loop
3. **Both work:** Choose based on your needs
4. **Auto-generated:** System finds 10-20+ abbreviations automatically

The abbreviations table is now ready in both formats! 📊✨
