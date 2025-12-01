# HOW TO CREATE ABBREVIATIONS TABLE IN WORD TEMPLATE

## ✅ RECOMMENDED METHOD: Use Word Table with Loop

To get a proper table like the second image, you need to **create an actual table in your Word template**.

### Step-by-Step Instructions:

#### 1. Open Your Word Template

#### 2. Create a Table
- Go to: **Insert** → **Table** → **Insert Table**
- Choose: **2 columns, 2 rows**

#### 3. Fill the Table Structure

**Row 1 (Header):**
- Cell A1: Type `Abbreviation`
- Cell B1: Type `Definition`

**Row 2 (Loop - this will repeat for each abbreviation):**
- Before the row, add: `{#abbreviations}`
- Cell A2: Type `{abbr}`
- Cell B2: Type `{fullTerm}`
- After the row, add: `{/abbreviations}`

#### Visual Layout:

```
{#abbreviations}
┌─────────────────┬──────────────────────────────┐
│ Abbreviation    │ Definition                   │  ← Header row (type manually)
├─────────────────┼──────────────────────────────┤
│ {abbr}          │ {fullTerm}                   │  ← Data row (placeholders)
└─────────────────┴──────────────────────────────┘
{/abbreviations}
```

#### 4. Style the Table (Optional)

**Add Borders:**
- Select the table
- Go to: **Table Design** → **Borders** → **All Borders**

**Format Header:**
- Select Row 1
- Make it **Bold**
- Center align the text
- Optionally add background color

**Set Column Widths:**
- Abbreviation column: 2-3 inches
- Definition column: 4-5 inches

#### 5. Example Template

Your Word template should look like this:

```
MODULE 2.4: NONCLINICAL OVERVIEW

Drug Name: {drug_name}
PMID: {pmid}

1. ABSTRACT
{abstract}

2. LIST OF ABBREVIATIONS

{#abbreviations}
┌─────────────────┬──────────────────────────────┐
│ Abbreviation    │ Definition                   │
├─────────────────┼──────────────────────────────┤
│ {abbr}          │ {fullTerm}                   │
└─────────────────┴──────────────────────────────┘
{/abbreviations}
```

## ⚠️ Important Notes:

1. **Loop tags must be OUTSIDE the table**
   - `{#abbreviations}` goes BEFORE the table row
   - `{/abbreviations}` goes AFTER the table row

2. **Placeholders in cells**
   - Use `{abbr}` for abbreviation
   - Use `{fullTerm}` for definition

3. **Header row is manual**
   - Type "Abbreviation" and "Definition" yourself
   - Don't use placeholders in header

## 🎯 Result:

When you generate the document, you'll get a table like this:

| Abbreviation | Definition                              |
|-------------|------------------------------------------|
| a.c.        | before food or meals                     |
| a.m.        | before noon                              |
| admin       | administration                           |
| ATC         | anatomical therapeutic chemical          |
| AUC         | area under the curve                     |
| CNS         | central nervous system                   |
| Cmax        | maximal plasma concentrations            |
| PK          | pharmacokinetics                         |

## 🔧 Alternative: Simple Text Format

If you don't want to create a table, use:
```
{abbreviations_list}
```

This will insert a tab-separated list that you can convert to a table in Word:
1. Select the text
2. Go to: **Insert** → **Table** → **Convert Text to Table**
3. Choose "Tabs" as separator
4. Click OK

---

**Recommendation:** Use the table method for professional documents! It looks much better and maintains formatting.
