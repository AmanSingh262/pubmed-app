# 🎯 QUICK FIX - Your Word Template Setup

## ❌ Problem You Had

The system generated a corrupted table with:
- Wrong data in cells ("hours", "pharmacokinetics" in wrong places)
- Only 2-3 abbreviations instead of all of them
- Bad alignment and spacing

## ✅ The Solution

**You MUST create the table structure in your Word template** and use loop syntax.

---

## 📝 EXACT STEPS (Copy This!)

### 1. Open Your Template in Word

### 2. Find the "LIST OF ABBREVIATIONS" Section

### 3. Delete Any Existing `{abbreviations_list}` Placeholder

### 4. Insert a Table

- **Insert** → **Table** → **2 columns, 2 rows**

### 5. Fill the Table Like This:

**Type EXACTLY this in your template:**

```
{#abbreviations}
```
↑ Type this ABOVE the table (press Enter to move it above)

**Then the table:**

| Abbreviation | Definition |
|-------------|-----------|
| {abbr} | {fullTerm} |

↓ Type this BELOW the table

```
{/abbreviations}
```

---

## 🎨 Visual Layout in Your Template

Your Word template should look **exactly** like this:

```word
3. LIST OF ABBREVIATIONS

{#abbreviations}
┌─────────────────┬──────────────────────────────┐
│ Abbreviation    │ Definition                   │  ← Row 1 (Header - type manually)
├─────────────────┼──────────────────────────────┤
│ {abbr}          │ {fullTerm}                   │  ← Row 2 (Data - placeholders)
└─────────────────┴──────────────────────────────┘
{/abbreviations}
```

---

## ⚙️ Detailed Template Formatting

### Header Row (Row 1):
- Cell A1: **Abbreviation** (Bold, Centered)
- Cell B1: **Definition** (Bold, Centered)
- Background: Light gray (optional)

### Data Row (Row 2):
- Cell A2: **{abbr}**
- Cell B2: **{fullTerm}**

### Table Borders:
- Select table → **Table Design** → **Borders** → **All Borders**

---

## 🔄 What Happens When You Generate

### The System Provides:
```javascript
abbreviations: [
  { abbr: "a.c.", fullTerm: "before food or meals" },
  { abbr: "a.m.", fullTerm: "before noon" },
  { abbr: "CNS", fullTerm: "central nervous system" },
  { abbr: "g", fullTerm: "gram" },
  { abbr: "h", fullTerm: "hours" },
  { abbr: "AUC", fullTerm: "area under the curve" },
  { abbr: "Cmax", fullTerm: "maximal plasma concentrations" },
  // ... 25+ more abbreviations
]
```

### The Loop Processes:
1. `{#abbreviations}` starts the loop
2. For **each abbreviation**, Row 2 is **duplicated**
3. `{abbr}` is replaced with: "a.c.", "a.m.", "CNS", etc.
4. `{fullTerm}` is replaced with: "before food or meals", "before noon", etc.
5. `{/abbreviations}` ends the loop

### Result in Generated Document:
```
┌─────────────────┬──────────────────────────────────┐
│ Abbreviation    │ Definition                       │
├─────────────────┼──────────────────────────────────┤
│ a.c.            │ before food or meals             │
├─────────────────┼──────────────────────────────────┤
│ a.m.            │ before noon                      │
├─────────────────┼──────────────────────────────────┤
│ admin           │ administration                   │
├─────────────────┼──────────────────────────────────┤
│ approx.         │ approximately                    │
├─────────────────┼──────────────────────────────────┤
│ ATC             │ anatomical therapeutic chemical  │
├─────────────────┼──────────────────────────────────┤
│ AUC             │ area under the curve             │
├─────────────────┼──────────────────────────────────┤
│ bid             │ twice daily                      │
├─────────────────┼──────────────────────────────────┤
│ CAS             │ chemical abstract services       │
├─────────────────┼──────────────────────────────────┤
│ CL/F            │ oral clearance                   │
├─────────────────┼──────────────────────────────────┤
│ CLcr            │ creatinine clearance             │
├─────────────────┼──────────────────────────────────┤
│ cm              │ centimeter                       │
├─────────────────┼──────────────────────────────────┤
│ Cmax            │ maximal plasma concentrations    │
├─────────────────┼──────────────────────────────────┤
│ CNS             │ central nervous system           │
├─────────────────┼──────────────────────────────────┤
│ ... (all 25+ abbreviations)                        │
└─────────────────┴──────────────────────────────────┘
```

**Perfect table with:**
- ✅ All borders
- ✅ Correct data in each cell
- ✅ All 25+ abbreviations listed
- ✅ Proper spacing and alignment

---

## 🚨 Critical Notes

1. **The loop tags `{#abbreviations}` and `{/abbreviations}` MUST be OUTSIDE the table**
   - NOT inside table cells
   - They wrap around the entire data row

2. **Keep Row 1 as the header** (not part of the loop)
   - It should NOT have any `{placeholders}`
   - Just plain text: "Abbreviation" and "Definition"

3. **Row 2 is the template row** that gets repeated
   - It has the placeholders: `{abbr}` and `{fullTerm}`
   - This row will be duplicated for each abbreviation

---

## ✅ After You Update Your Template

1. Save the template file
2. Upload it to the system
3. Generate a document
4. Open the generated document
5. See the **perfect table with all abbreviations!**

---

## 🎯 Summary

**DO THIS in your Word template:**

1. Insert 2-column table (2 rows)
2. Type `{#abbreviations}` BEFORE the table
3. Row 1: "Abbreviation" | "Definition" (bold, centered)
4. Row 2: `{abbr}` | `{fullTerm}`
5. Type `{/abbreviations}` AFTER the table
6. Add borders to table
7. Save template

**That's it!** The system will generate perfect tables automatically.

---

## 📊 Server Status

- ✅ **Backend running** on http://localhost:5000
- ✅ **Updated code** deployed (removed buggy XML injection)
- ✅ **Ready to generate** with template loops

**Now update your template and try again!** 🚀
