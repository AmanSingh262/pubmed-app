const express = require('express');
const router = express.Router();
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  convertInchesToTwip,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle
} = require('docx');

/**
 * Helper function to replace first occurrence of full terms with "Full Term (ABBR)"
 * and subsequent occurrences with just "ABBR"
 */
function replaceWithAbbreviations(text, abbreviationsMap) {
  if (!text || !abbreviationsMap || abbreviationsMap.size === 0) return text;
  
  let processedText = text;
  const usedAbbreviations = new Set();
  
  // Sort abbreviations by full term length (longest first) to avoid partial matches
  const sortedAbbrs = Array.from(abbreviationsMap.entries())
    .sort((a, b) => b[1].length - a[1].length);
  
  sortedAbbrs.forEach(([abbr, fullTerm]) => {
    // Create regex to find the full term (case-insensitive, whole word)
    // Match the capitalized version of the term
    const capitalizedTerm = fullTerm.charAt(0).toUpperCase() + fullTerm.slice(1);
    const pattern = new RegExp(`\\b${capitalizedTerm}\\b`, 'g');
    
    let firstMatch = true;
    processedText = processedText.replace(pattern, (match) => {
      if (firstMatch) {
        firstMatch = false;
        usedAbbreviations.add(abbr);
        return `${match} (${abbr})`;
      } else {
        return abbr;
      }
    });
  });
  
  return processedText;
}

// Standard pharmaceutical abbreviations - comprehensive list
const STANDARD_ABBREVIATIONS = new Map([
  ['a.c.', 'before food or meals'],
  ['a.m.', 'before noon'],
  ['admin', 'administration'],
  ['ADME', 'absorption, distribution, metabolism, excretion'],
  ['approx.', 'approximately'],
  ['ATC', 'anatomical therapeutic chemical'],
  ['AUC', 'area under the curve'],
  ['bid', 'twice daily'],
  ['CAS', 'chemical abstract services'],
  ['CL/F', 'oral clearance'],
  ['CLcr', 'creatinine clearance'],
  ['cm', 'centimeter'],
  ['Cmax', 'maximal plasma concentrations'],
  ['CNS', 'central nervous system'],
  ['CV', 'cardiovascular'],
  ['CYP', 'cytochrome P450'],
  ['EC50', 'half maximal effective concentration'],
  ['ED50', 'median effective dose'],
  ['FDA', 'Food and Drug Administration'],
  ['g', 'gram'],
  ['GLP', 'good laboratory practice'],
  ['h', 'hours'],
  ['IC50', 'half maximal inhibitory concentration'],
  ['im', 'intramuscular'],
  ['IV', 'intravenous'],
  ['kg', 'kilogram'],
  ['L', 'liters'],
  ['LD50', 'lethal dose 50%'],
  ['LOAEL', 'lowest observed adverse effect level'],
  ['mg', 'milligram'],
  ['mL', 'milliliter'],
  ['MTD', 'maximum tolerated dose'],
  ['NOAEL', 'no observed adverse effect level'],
  ['OECD', 'Organisation for Economic Co-operation and Development'],
  ['PD', 'pharmacodynamics'],
  ['PI', 'product information'],
  ['PK', 'pharmacokinetics'],
  ['PO', 'per os (oral)'],
  ['Tmax', 'time to maximum concentration'],
  ['µg', 'microgram']
]);

/**
 * Helper function to extract abbreviations from text
 * Finds patterns like "Full Term (ABB)" and creates alphabetical list
 * Definitions start with lowercase unless proper noun
 */
function extractAbbreviations(text) {
  if (!text || typeof text !== 'string') return [];
  
  const abbreviations = new Map(); // Use Map to avoid duplicates
  
  // Pattern to match: "Full Term (ABBR)" where ABBR is 2-6 uppercase letters or mixed case
  // Examples: "Pharmacokinetics (PK)", "Central Nervous System (CNS)", "Area Under Curve (AUC)"
  const pattern = /([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)\s*\(([A-Z]{2,6}|[A-Z][a-z]{1,5})\)/g;
  
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const fullTerm = match[1].trim();
    const abbr = match[2].trim();
    
    // Convert full term to lowercase unless it's a proper noun
    // Keep first letter lowercase for definitions
    const definition = fullTerm.charAt(0).toLowerCase() + fullTerm.slice(1);
    
    // Store with abbreviation as key to avoid duplicates
    if (!abbreviations.has(abbr)) {
      abbreviations.set(abbr, definition);
    }
  }
  
  // Convert to array and sort alphabetically by abbreviation
  const abbrArray = Array.from(abbreviations.entries())
    .map(([abbr, fullTerm]) => ({ abbr, fullTerm }))
    .sort((a, b) => a.abbr.localeCompare(b.abbr));
  
  return abbrArray;
}

/**
 * Helper function to collect all abbreviations from all articles
 * Includes standard abbreviations and extracted abbreviations
 */
function collectAllAbbreviations(articles) {
  // Start with standard abbreviations
  const allAbbreviations = new Map(STANDARD_ABBREVIATIONS);
  
  articles.forEach(article => {
    // Extract from title
    if (article.title) {
      const titleAbbr = extractAbbreviations(article.title);
      titleAbbr.forEach(({ abbr, fullTerm }) => {
        if (!allAbbreviations.has(abbr)) {
          allAbbreviations.set(abbr, fullTerm);
        }
      });
    }
    
    // Extract from abstract
    if (article.abstract) {
      const abstractAbbr = extractAbbreviations(article.abstract);
      abstractAbbr.forEach(({ abbr, fullTerm }) => {
        if (!allAbbreviations.has(abbr)) {
          allAbbreviations.set(abbr, fullTerm);
        }
      });
    }
  });
  
  // Convert to sorted array (alphabetically by abbreviation)
  return Array.from(allAbbreviations.entries())
    .map(([abbr, fullTerm]) => ({ abbr, fullTerm }))
    .sort((a, b) => a.abbr.localeCompare(b.abbr));
}

/**
 * Helper function to clean and format text according to UK scientific standards
 */
function cleanText(text) {
  if (!text || typeof text !== 'string') return text;
  
  let cleaned = text;
  
  // Convert US to UK spelling (comprehensive medical terms)
  cleaned = cleaned.replace(/\bfavor\b/gi, 'favour');
  cleaned = cleaned.replace(/\bfavored\b/gi, 'favoured');
  cleaned = cleaned.replace(/\bfavoring\b/gi, 'favouring');
  cleaned = cleaned.replace(/\bcolor\b/gi, 'colour');
  cleaned = cleaned.replace(/\banalyze\b/gi, 'analyse');
  cleaned = cleaned.replace(/\banalyzed\b/gi, 'analysed');
  cleaned = cleaned.replace(/\banalyzing\b/gi, 'analysing');
  cleaned = cleaned.replace(/\brealize\b/gi, 'realise');
  cleaned = cleaned.replace(/\brealized\b/gi, 'realised');
  cleaned = cleaned.replace(/\borganize\b/gi, 'organise');
  cleaned = cleaned.replace(/\borganized\b/gi, 'organised');
  cleaned = cleaned.replace(/\bmetabolize\b/gi, 'metabolise');
  cleaned = cleaned.replace(/\bmetabolized\b/gi, 'metabolised');
  cleaned = cleaned.replace(/\bmetabolizing\b/gi, 'metabolising');
  cleaned = cleaned.replace(/\bcenter\b/gi, 'centre');
  cleaned = cleaned.replace(/\bcentered\b/gi, 'centred');
  cleaned = cleaned.replace(/\btumor\b/gi, 'tumour');
  cleaned = cleaned.replace(/\btumors\b/gi, 'tumours');
  cleaned = cleaned.replace(/\bbehavior\b/gi, 'behaviour');
  cleaned = cleaned.replace(/\blicense\b/gi, 'licence');
  cleaned = cleaned.replace(/\bdefense\b/gi, 'defence');
  
  // Standardize medical abbreviations (volumes)
  cleaned = cleaned.replace(/\bml\b/g, 'mL');
  cleaned = cleaned.replace(/\bMl\b/g, 'mL');
  cleaned = cleaned.replace(/\bmcg\b/gi, 'µg');
  cleaned = cleaned.replace(/\bmicrogram\b/gi, 'µg');
  cleaned = cleaned.replace(/\bmicrograms\b/gi, 'µg');
  cleaned = cleaned.replace(/\bmmol\b/g, 'mM');
  cleaned = cleaned.replace(/\bMmol\b/g, 'mM');
  cleaned = cleaned.replace(/\b(\d+)\s*l\b/gi, '$1 L');
  cleaned = cleaned.replace(/\bliter\b/gi, 'L');
  cleaned = cleaned.replace(/\bliters\b/gi, 'L');
  cleaned = cleaned.replace(/\blitre\b/gi, 'L');
  cleaned = cleaned.replace(/\blitres\b/gi, 'L');
  
  // Standardize time abbreviations
  cleaned = cleaned.replace(/\b(\d+)\s*h\b/g, '$1 hours');
  cleaned = cleaned.replace(/\b(\d+)\s*hrs\b/gi, '$1 hours');
  cleaned = cleaned.replace(/\bwks\b/gi, 'weeks');
  cleaned = cleaned.replace(/\byrs\b/gi, 'years');
  
  // Standardize pharmacokinetic terms
  cleaned = cleaned.replace(/\bcmax\b/gi, 'Cmax');
  cleaned = cleaned.replace(/\btmax\b/gi, 'Tmax');
  cleaned = cleaned.replace(/\bauc\b/gi, 'AUC');
  cleaned = cleaned.replace(/\bCL\/F\b/g, 'CL/F');
  cleaned = cleaned.replace(/\bt1\/2\b/gi, 'T1/2');
  cleaned = cleaned.replace(/\bhalf-life\b/gi, 'half-life');
  
  // Standardize dosing abbreviations
  cleaned = cleaned.replace(/\bbid\b/gi, 'twice daily');
  cleaned = cleaned.replace(/\bqd\b/gi, 'once daily');
  cleaned = cleaned.replace(/\bqid\b/gi, 'four times daily');
  cleaned = cleaned.replace(/\bq\.d\.\b/gi, 'once daily');
  cleaned = cleaned.replace(/\bq2h\b/gi, 'every 2 hours');
  cleaned = cleaned.replace(/\bqh\b/gi, 'every hour');
  cleaned = cleaned.replace(/\bqn\b/gi, 'every night');
  cleaned = cleaned.replace(/\bqod\b/gi, 'every other day');
  cleaned = cleaned.replace(/\ba\.c\.\b/gi, 'before meals');
  cleaned = cleaned.replace(/\ba\.m\.\b/gi, 'before noon');
  
  // Standardize administration routes
  cleaned = cleaned.replace(/\bpo\b/gi, 'oral');
  cleaned = cleaned.replace(/\biv\b/gi, 'intravenous');
  cleaned = cleaned.replace(/\bim\b/gi, 'intramuscular');
  
  // Standardize weight and measurement
  cleaned = cleaned.replace(/\bkg\b/g, 'kg');
  cleaned = cleaned.replace(/\bmg\b/g, 'mg');
  cleaned = cleaned.replace(/\bcm\b/g, 'cm');
  cleaned = cleaned.replace(/\bwt\.\b/gi, 'weight');
  
  // Standardize versus
  cleaned = cleaned.replace(/\bv\.s\b/gi, 'versus');
  cleaned = cleaned.replace(/\bvs\.\b/gi, 'versus');
  
  // Standardize P-value notation
  cleaned = cleaned.replace(/\bp\s*</gi, 'P<');
  cleaned = cleaned.replace(/\bp\s*>/gi, 'P>');
  cleaned = cleaned.replace(/\bp\s*=/gi, 'P=');
  
  return cleaned;
}

/**
 * Helper function to restructure abstract text from Methods/Results/Conclusions to narrative format
 */
function restructureAbstract(text) {
  if (!text || typeof text !== 'string') return text;
  
  let restructured = text;
  
  // Convert "Methods:" section to narrative
  restructured = restructured.replace(/\bMethods?:\s*/gi, 'A study was conducted to ');
  restructured = restructured.replace(/\bObjective:\s*/gi, 'The objective was to ');
  restructured = restructured.replace(/\bObjectives:\s*/gi, 'The objectives were to ');
  restructured = restructured.replace(/\bAim:\s*/gi, 'The aim was to ');
  restructured = restructured.replace(/\bAims:\s*/gi, 'The aims were to ');
  
  // Convert "Results:" section to narrative
  restructured = restructured.replace(/\bResults?:\s*/gi, 'The study showed that ');
  restructured = restructured.replace(/\bFindings?:\s*/gi, 'The findings indicated that ');
  
  // Convert "Conclusions:" section to narrative
  restructured = restructured.replace(/\bConclusions?:\s*/gi, 'The study concluded that ');
  restructured = restructured.replace(/\bSummary:\s*/gi, 'In summary, ');
  
  // Convert "Background:" section
  restructured = restructured.replace(/\bBackground:\s*/gi, 'The background for this study was ');
  
  return restructured;
}

/**
 * Helper function to add italic formatting to biological and scientific terms
 */
function addItalicFormatting(text) {
  if (!text || typeof text !== 'string') return [];
  
  const parts = [];
  let remaining = text;
  
  // Scientific terms that should be italicized
  const italicTerms = [
    /\bin vitro\b/gi,
    /\bin vivo\b/gi,
    /\bex vivo\b/gi,
    /\bEscherichia coli\b/gi,
    /\bStaphylococcus aureus\b/gi,
    /\bPseudomonas aeruginosa\b/gi,
    /\bCandida albicans\b/gi,
    // Add common biological genus/species patterns
    /\b[A-Z][a-z]+ [a-z]+\b/g // Matches "Genus species" pattern
  ];
  
  let lastIndex = 0;
  const matches = [];
  
  // Find all matches
  italicTerms.forEach(pattern => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0]
      });
    }
  });
  
  // Sort matches by position
  matches.sort((a, b) => a.start - b.start);
  
  // Build parts array with proper formatting
  matches.forEach(match => {
    if (match.start > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.start), italics: false });
    }
    parts.push({ text: match.text, italics: true });
    lastIndex = match.end;
  });
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), italics: false });
  }
  
  return parts.length > 0 ? parts : [{ text, italics: false }];
}

/**
 * Helper function to combine italic formatting and blue color for references
 * This handles both biological terms (italic) and citations/Table/Figure (blue)
 */
function addCombinedFormatting(text) {
  if (!text || typeof text !== 'string') return [];
  
  const parts = [];
  
  // First, identify all italic terms (biological/scientific)
  const italicPatterns = [
    /\bin vitro\b/gi,
    /\bin vivo\b/gi,
    /\bex vivo\b/gi,
    /\bEscherichia coli\b/gi,
    /\bStaphylococcus aureus\b/gi,
    /\bPseudomonas aeruginosa\b/gi,
    /\bCandida albicans\b/gi,
    /\b[A-Z][a-z]+ [a-z]+\b/g // Genus species pattern
  ];
  
  // Then identify all blue color terms (citations, Table, Figure)
  const bluePatterns = [
    /\([A-Z][a-z]+(?:\s+et\s+al)?(?:\s+and\s+[A-Z][a-z]+)?\s*,\s*\d{4}[a-z]?\)/g,
    /\bTable\s+\d+/gi,
    /\bFigure\s+\d+/gi
  ];
  
  // Collect all matches with their type
  const allMatches = [];
  
  italicPatterns.forEach(pattern => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        type: 'italic'
      });
    }
  });
  
  bluePatterns.forEach(pattern => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        type: 'blue'
      });
    }
  });
  
  // Sort by position and handle overlaps
  allMatches.sort((a, b) => a.start - b.start);
  
  // Remove overlaps (blue takes precedence over italic)
  const uniqueMatches = [];
  allMatches.forEach(match => {
    if (uniqueMatches.length === 0 || match.start >= uniqueMatches[uniqueMatches.length - 1].end) {
      uniqueMatches.push(match);
    } else if (match.type === 'blue' && uniqueMatches[uniqueMatches.length - 1].type === 'italic') {
      // Replace italic with blue if they overlap
      uniqueMatches[uniqueMatches.length - 1] = match;
    }
  });
  
  // Build parts array
  let lastIndex = 0;
  uniqueMatches.forEach(match => {
    if (match.start > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.start), italics: false, color: null });
    }
    parts.push({ 
      text: match.text, 
      italics: match.type === 'italic', 
      color: match.type === 'blue' ? '0000FF' : null 
    });
    lastIndex = match.end;
  });
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), italics: false, color: null });
  }
  
  return parts.length > 0 ? parts : [{ text, italics: false, color: null }];
}

/**
 * Helper function to add blue color to references, Table, and Figure mentions
 * Pattern matches: (Author, Year), (Author et al, Year), Table X, Figure X
 */
function addBlueColorToReferences(text) {
  if (!text || typeof text !== 'string') return [];
  
  const parts = [];
  let remaining = text;
  
  // Patterns to match and color blue
  const bluePatterns = [
    // Author citations: (Smith, 2019), (Smith et al, 2019), (Smith and Jones, 2019)
    /\([A-Z][a-z]+(?:\s+et\s+al)?(?:\s+and\s+[A-Z][a-z]+)?\s*,\s*\d{4}[a-z]?\)/g,
    // Table references: Table 1, Table X, etc.
    /\bTable\s+\d+/gi,
    // Figure references: Figure 1, Figure X, etc.
    /\bFigure\s+\d+/gi
  ];
  
  let lastIndex = 0;
  const matches = [];
  
  // Find all matches
  bluePatterns.forEach(pattern => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0]
      });
    }
  });
  
  // Sort matches by position and remove overlaps
  matches.sort((a, b) => a.start - b.start);
  const uniqueMatches = [];
  matches.forEach(match => {
    if (uniqueMatches.length === 0 || match.start >= uniqueMatches[uniqueMatches.length - 1].end) {
      uniqueMatches.push(match);
    }
  });
  
  // Build parts array with blue color for matches
  uniqueMatches.forEach(match => {
    if (match.start > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.start), color: null });
    }
    parts.push({ text: match.text, color: '0000FF' }); // Blue color
    lastIndex = match.end;
  });
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), color: null });
  }
  
  return parts.length > 0 ? parts : [{ text, color: null }];
}

/**
 * Helper function to generate in-text citation (Author et al, Year)
 */
function generateInTextCitation(article) {
  const authors = article.authors || [];
  const year = article.publicationDate ? article.publicationDate.split(' ')[0] : 'n.d.';
  
  if (authors.length === 0) {
    return `(Unknown, ${year})`;
  } else if (authors.length === 1) {
    // Single author: (Smith, 2019)
    const lastName = authors[0].split(' ').pop();
    return `(${lastName}, ${year})`;
  } else if (authors.length === 2) {
    // Two authors: (Smith and Jones, 2019)
    const lastName1 = authors[0].split(' ').pop();
    const lastName2 = authors[1].split(' ').pop();
    return `(${lastName1} and ${lastName2}, ${year})`;
  } else {
    // Three or more: (Smith et al, 2019)
    const lastName = authors[0].split(' ').pop();
    return `(${lastName} et al, ${year})`;
  }
}

/**
 * Helper function to format citations
 */
function formatCitation(article, style) {
  const authors = article.authors || [];
  const title = article.title || 'Untitled';
  const journal = article.journal || '';
  const year = article.publicationDate ? article.publicationDate.split(' ')[0] : 'n.d.';
  const pmid = article.pmid || '';
  const url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

  // Format authors based on style
  let authorString = '';
  
  if (style === 'APA') {
    // APA: Last, F. M., Last, F. M., & Last, F. M.
    if (authors.length === 0) {
      authorString = 'Unknown Author';
    } else if (authors.length === 1) {
      authorString = authors[0];
    } else if (authors.length === 2) {
      authorString = `${authors[0]} & ${authors[1]}`;
    } else {
      authorString = authors.slice(0, -1).join(', ') + ', & ' + authors[authors.length - 1];
    }
    return `${authorString}. (${year}). ${title}. ${journal}. ${url}`;
    
  } else if (style === 'MLA') {
    // MLA: Last, First M. "Title." Journal (Year): n. pag. Web.
    authorString = authors.length > 0 ? authors[0] : 'Unknown Author';
    if (authors.length > 1) {
      authorString += ', et al';
    }
    return `${authorString}. "${title}." ${journal} (${year}): n. pag. Web. ${url}`;
    
  } else if (style === 'Chicago') {
    // Chicago: Last, First M. "Title." Journal (Year): pages.
    authorString = authors.length > 0 ? authors[0] : 'Unknown Author';
    if (authors.length > 1) {
      authorString += ', et al';
    }
    return `${authorString}. "${title}." ${journal} (${year}). ${url}`;
    
  } else if (style === 'Vancouver') {
    // Vancouver: Authors. Title. Journal. Year;PMID.
    if (authors.length === 0) {
      authorString = 'Unknown Author';
    } else if (authors.length <= 6) {
      authorString = authors.join(', ');
    } else {
      authorString = authors.slice(0, 6).join(', ') + ', et al';
    }
    return `${authorString}. ${title}. ${journal}. ${year}; PMID: ${pmid}. Available from: ${url}`;
  }
  
  // Default fallback
  return `${authors.join(', ')}. ${title}. ${journal}. ${year}. ${url}`;
}

/**
 * POST /api/export/unified-word
 * Export articles from cart (grouped by category) to Microsoft Word format
 */
router.post('/unified-word', async (req, res) => {
  try {
    const { groupedArticles, formatting } = req.body;

    if (!groupedArticles || typeof groupedArticles !== 'object' || Object.keys(groupedArticles).length === 0) {
      return res.status(400).json({ error: 'No grouped articles provided' });
    }

    // Convert alignment string to docx enum
    const alignmentMap = {
      'left': AlignmentType.LEFT,
      'center': AlignmentType.CENTER,
      'right': AlignmentType.RIGHT,
      'justify': AlignmentType.JUSTIFIED
    };

    const alignment = alignmentMap[formatting.alignment] || AlignmentType.JUSTIFIED;
    const citationStyle = formatting.citationStyle || 'APA';

    // Create document sections
    const sections = [];
    
    // Collect all articles for references section
    const allArticles = [];

    // Add main heading
    sections.push(
      new Paragraph({
        text: 'PubMed Research Export',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: {
          after: convertInchesToTwip(0.3)
        }
      }),
      new Paragraph({ text: '' })
    );

    // Process each category group
    const categoryGroups = Object.values(groupedArticles);
    
    categoryGroups.forEach((group, groupIndex) => {
      const { studyType, categoryPath, articles } = group;
      
      // Auto-detect category for reference documents or use provided categoryPath
      let categoryHeading = categoryPath;
      
      // If this is from reference document, use the category from the first article
      if (articles.length > 0 && articles[0].category) {
        categoryHeading = articles[0].category;
      }
      
      // Add category heading with auto-detected or provided category
      let studyTypeText = '';
      if (studyType === 'animal') {
        studyTypeText = 'Animal Studies';
      } else if (studyType === 'human') {
        studyTypeText = 'Human Studies';
      } else if (studyType === 'reference') {
        // Reference document - use just the category name
        studyTypeText = '';
      } else {
        studyTypeText = studyType.charAt(0).toUpperCase() + studyType.slice(1);
      }
      
      const headingText = studyTypeText ? `${studyTypeText} - ${categoryHeading}` : categoryHeading;
      
      sections.push(
        new Paragraph({
          text: headingText,
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.LEFT,
          spacing: {
            before: convertInchesToTwip(0.2),
            after: convertInchesToTwip(0.15)
          }
        })
      );
      
      // Add category description (removed italic formatting as per user request)
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `A Study was conducted to evaluate the ${categoryHeading}`,
              font: formatting.font,
              size: formatting.fontSize * 2,
              color: '666666'
            })
          ],
          alignment,
          spacing: {
            after: convertInchesToTwip(0.15)
          }
        }),
        new Paragraph({ text: '' })
      );

      // Add articles in this category
      articles.forEach((article, articleIndex) => {
        allArticles.push(article);
        const globalIndex = allArticles.length;

        // Article number and title removed as per user request

        // PMID, Authors, and Journal sections removed as per user request

        // Similarity Score removed as per user request

        // Abstract (with text cleaning, restructuring, italics for biology, and blue for citations)
        if (article.abstract) {
          // Check if abstract is structured (object with sections) or plain text (string)
          const isStructured = typeof article.abstract === 'object' && article.abstract.structured;
          
          if (isStructured && article.abstract.sections) {
            // Handle structured abstract with labeled sections (without "Abstract" heading)
            article.abstract.sections.forEach(section => {
              if (section.label) {
                // Add section heading (e.g., "Importance:", "Objective:", etc.)
                sections.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${section.label}: `,
                        bold: true,
                        font: formatting.font,
                        size: formatting.fontSize * 2
                      })
                    ],
                    alignment,
                    spacing: {
                      before: convertInchesToTwip(0.05),
                      after: convertInchesToTwip(0.05)
                    }
                  })
                );
              }
              
              // Process section content
              let processedContent = cleanText(section.content);
              processedContent = restructureAbstract(processedContent);
              processedContent = replaceWithAbbreviations(processedContent, STANDARD_ABBREVIATIONS);
              const contentParts = addCombinedFormatting(processedContent);
              
              sections.push(
                new Paragraph({
                  children: contentParts.map(part => new TextRun({
                    text: part.text,
                    italics: part.italics,
                    color: part.color || undefined,
                    font: formatting.font,
                    size: formatting.fontSize * 2
                  })),
                  alignment,
                  spacing: {
                    after: convertInchesToTwip(0.08),
                    line: Math.round(formatting.lineSpacing * 240)
                  }
                })
              );
            });
            
            // Add in-text citation after structured abstract
            const inTextCitation = generateInTextCitation(article);
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: inTextCitation,
                    color: '0000FF',
                    font: formatting.font,
                    size: formatting.fontSize * 2
                  })
                ],
                alignment,
                spacing: {
                  after: convertInchesToTwip(formatting.spacingAfter / 72),
                  line: Math.round(formatting.lineSpacing * 240)
                }
              })
            );
          } else {
            // Handle plain text abstract (original behavior)
            const abstractText = typeof article.abstract === 'string' ? article.abstract : article.abstract.text;
            let processedAbstract = cleanText(abstractText);
            processedAbstract = restructureAbstract(processedAbstract);
            
            // Apply abbreviation replacements (first use: "Full Term (ABBR)", subsequent: "ABBR")
            processedAbstract = replaceWithAbbreviations(processedAbstract, STANDARD_ABBREVIATIONS);
            
            const abstractParts = addCombinedFormatting(processedAbstract);
            
            // Generate in-text citation
            const inTextCitation = generateInTextCitation(article);
            
            sections.push(
              new Paragraph({
                children: [
                  ...abstractParts.map(part => new TextRun({
                    text: part.text,
                    italics: part.italics,
                    color: part.color || undefined,
                    font: formatting.font,
                    size: formatting.fontSize * 2
                  })),
                  new TextRun({
                    text: ` ${inTextCitation}`,
                    color: '0000FF',
                    font: formatting.font,
                    size: formatting.fontSize * 2
                  })
                ],
                alignment,
                spacing: {
                  after: convertInchesToTwip(formatting.spacingAfter / 72),
                  line: Math.round(formatting.lineSpacing * 240)
                }
              })
            );
          }
        }

        // MeSH Terms, Keywords, Relevance Score, and Matched Keywords removed as per user request

        // URL
        if (article.url) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Link: ',
                  bold: true,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                }),
                new TextRun({
                  text: article.url,
                  font: formatting.font,
                  size: formatting.fontSize * 2,
                  color: '0000FF',
                  underline: {}
                })
              ],
              alignment,
              spacing: {
                after: convertInchesToTwip(formatting.spacingAfter / 72),
                line: Math.round(formatting.lineSpacing * 240)
              }
            })
          );
        }

        // Add spacing between articles
        if (articleIndex < articles.length - 1) {
          sections.push(new Paragraph({ text: '' }));
        }
      });

      // Add horizontal divider between categories (except after last one)
      if (groupIndex < categoryGroups.length - 1) {
        sections.push(
          new Paragraph({ text: '' }),
          new Paragraph({
            text: '',
            spacing: {
              before: convertInchesToTwip(0.2),
              after: convertInchesToTwip(0.2)
            },
            border: {
              bottom: {
                color: '999999',
                space: 1,
                value: 'single',
                size: 12
              }
            }
          }),
          new Paragraph({ text: '' })
        );
      }
    });

    // Add Abbreviations section (before References)
    const allAbbreviations = collectAllAbbreviations(allArticles);
    
    if (allAbbreviations.length > 0) {
      sections.push(
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'Abbreviations',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.LEFT,
          spacing: {
            before: convertInchesToTwip(0.3),
            after: convertInchesToTwip(0.2)
          }
        }),
        new Paragraph({ text: '' })
      );
      
      // Create abbreviations table
      const tableRows = [];
      
      // Add header row
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Abbreviation',
                      bold: true,
                      font: 'Times New Roman',
                      size: 20
                    })
                  ],
                  alignment: AlignmentType.CENTER
                })
              ],
              shading: { fill: 'E5E7EB' },
              width: { size: 30, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Definition',
                      bold: true,
                      font: 'Times New Roman',
                      size: 20
                    })
                  ],
                  alignment: AlignmentType.CENTER
                })
              ],
              shading: { fill: 'E5E7EB' },
              width: { size: 70, type: WidthType.PERCENTAGE }
            })
          ]
        })
      );
      
      // Add abbreviation rows
      allAbbreviations.forEach(({ abbr, fullTerm }) => {
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: abbr,
                        bold: true,
                        font: 'Times New Roman',
                        size: 20
                      })
                    ],
                    alignment: AlignmentType.LEFT
                  })
                ],
                width: { size: 30, type: WidthType.PERCENTAGE }
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: fullTerm,
                        font: 'Times New Roman',
                        size: 20
                      })
                    ],
                    alignment: AlignmentType.LEFT
                  })
                ],
                width: { size: 70, type: WidthType.PERCENTAGE }
              })
            ]
          })
        );
      });
      
      // Add the table to sections
      sections.push(
        new Table({
          rows: tableRows,
          width: {
            size: 100,
            type: WidthType.PERCENTAGE
          }
        })
      );
      
      sections.push(new Paragraph({ text: '' }));
    }

    // Add References section
    sections.push(
      new Paragraph({ text: '' }),
      new Paragraph({ text: '' }),
      new Paragraph({
        text: 'References',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.LEFT,
        spacing: {
          before: convertInchesToTwip(0.3),
          after: convertInchesToTwip(0.2)
        }
      }),
      new Paragraph({ text: '' })
    );

    // Sort articles alphabetically by first author's last name for Vancouver style
    const sortedArticles = [...allArticles].sort((a, b) => {
      const authorsA = a.authors || [];
      const authorsB = b.authors || [];
      
      const lastNameA = authorsA.length > 0 ? authorsA[0].split(' ').pop() : 'Unknown';
      const lastNameB = authorsB.length > 0 ? authorsB[0].split(' ').pop() : 'Unknown';
      
      return lastNameA.localeCompare(lastNameB);
    });
    
    // Remove duplicate references based on PMID
    const uniqueArticles = [];
    const seenPMIDs = new Set();
    
    sortedArticles.forEach(article => {
      const pmid = article.pmid || article.title; // Use title as fallback if no PMID
      if (!seenPMIDs.has(pmid)) {
        seenPMIDs.add(pmid);
        uniqueArticles.push(article);
      }
    });
    
    // Handle same author/year disambiguation (add 'a', 'b', etc.)
    const citationMap = new Map();
    const disambiguatedArticles = uniqueArticles.map(article => {
      const authors = article.authors || [];
      const year = article.publicationDate ? article.publicationDate.split(' ')[0] : 'n.d.';
      const firstAuthor = authors.length > 0 ? authors[0].split(' ').pop() : 'Unknown';
      const key = `${firstAuthor}_${year}`;
      
      if (citationMap.has(key)) {
        const count = citationMap.get(key);
        citationMap.set(key, count + 1);
        return { ...article, yearSuffix: String.fromCharCode(96 + count + 1) }; // 'b', 'c', etc.
      } else {
        citationMap.set(key, 1);
        return { ...article, yearSuffix: 'a' };
      }
    });
    
    // Add formatted citations with proper APA format and justified alignment
    disambiguatedArticles.forEach((article, index) => {
      const citation = formatCitation(article, citationStyle);
      const cleanedCitation = cleanText(citation);
      
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${index + 1}. `,
              font: formatting.font,
              size: formatting.fontSize * 2
            }),
            new TextRun({
              text: cleanedCitation,
              font: formatting.font,
              size: formatting.fontSize * 2
            })
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: {
            after: convertInchesToTwip(0.1),
            line: Math.round(formatting.lineSpacing * 240)
          }
        })
      );
    });

    // Create the document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: sections
        }
      ]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=pubmed_unified_export_${Date.now()}.docx`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    console.error('Unified Word export error:', error);
    res.status(500).json({ error: 'Failed to generate unified Word document', details: error.message });
  }
});

/**
 * POST /api/export/word
 * Export selected articles to Microsoft Word format
 */
router.post('/word', async (req, res) => {
  try {
    const { articles, formatting } = req.body;

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: 'No articles provided' });
    }

    // Convert alignment string to docx enum
    const alignmentMap = {
      'left': AlignmentType.LEFT,
      'center': AlignmentType.CENTER,
      'right': AlignmentType.RIGHT,
      'justify': AlignmentType.JUSTIFIED
    };

    const alignment = alignmentMap[formatting.alignment] || AlignmentType.JUSTIFIED;

    // Create document sections
    const sections = [];

    // Add heading
    sections.push(
      new Paragraph({
        text: formatting.heading || 'Research Articles',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: {
          after: convertInchesToTwip(0.2)
        }
      }),
      new Paragraph({ text: '' }) // Empty paragraph for spacing
    );

    // Add each article
    articles.forEach((article, index) => {
      // Article number and title removed as per user request

      // PMID, Authors, and Journal sections removed as per user request

      // Abstract (with text cleaning, restructuring, italics for biology, and blue for citations)
      // Abstract heading removed as per user request - showing only the paragraph
      if (article.abstract) {
        let processedAbstract = cleanText(article.abstract);
        processedAbstract = restructureAbstract(processedAbstract);
        const abstractParts = addCombinedFormatting(processedAbstract);
        
        // Generate in-text citation
        const inTextCitation = generateInTextCitation(article);
        
        sections.push(
          new Paragraph({
            children: [
              ...abstractParts.map(part => new TextRun({
                text: part.text,
                italics: part.italics,
                color: part.color || undefined,
                font: formatting.font,
                size: formatting.fontSize * 2
              })),
              new TextRun({
                text: ` ${inTextCitation}`,
                color: '0000FF',
                font: formatting.font,
                size: formatting.fontSize * 2
              })
            ],
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            }
          })
        );
      }

      // MeSH Terms
      if (article.meshTerms && Array.isArray(article.meshTerms) && article.meshTerms.length > 0) {
        const meshText = article.meshTerms.join('; ');
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'MeSH Terms: ',
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              }),
              new TextRun({
                text: meshText,
                font: formatting.font,
                size: formatting.fontSize * 2
              })
            ],
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            }
          })
        );
      }

      // Keywords
      if (article.keywords && Array.isArray(article.keywords) && article.keywords.length > 0) {
        const keywordsText = article.keywords.join('; ');
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Keywords: ',
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              }),
              new TextRun({
                text: keywordsText,
                font: formatting.font,
                size: formatting.fontSize * 2
              })
            ],
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            }
          })
        );
      }

      // Relevance Score
      if (article.relevanceScore !== undefined) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Relevance Score: ',
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              }),
              new TextRun({
                text: article.relevanceScore.toString(),
                font: formatting.font,
                size: formatting.fontSize * 2,
                color: article.relevanceScore >= 30 ? '10b981' : article.relevanceScore >= 15 ? 'f59e0b' : '6b7280'
              })
            ],
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            }
          })
        );
      }

      // MeSH Terms, Keywords, and Relevance Score removed as per user request

      // URL
      if (article.url) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Link: ',
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              }),
              new TextRun({
                text: article.url,
                font: formatting.font,
                size: formatting.fontSize * 2,
                color: '0000FF',
                underline: {}
              })
            ],
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            }
          })
        );
      }

      // DOI, Matched Keywords removed as per user request

      // Add separator between articles (except after last one)
      if (index < articles.length - 1) {
        sections.push(
          new Paragraph({
            text: '',
            spacing: {
              after: convertInchesToTwip(0.3)
            },
            border: {
              bottom: {
                color: 'CCCCCC',
                space: 1,
                value: 'single',
                size: 6
              }
            }
          }),
          new Paragraph({ text: '' })
        );
      }
    });

    // Create the document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: sections
        }
      ]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=pubmed_export_${Date.now()}.docx`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    console.error('Word export error:', error);
    res.status(500).json({ error: 'Failed to generate Word document', details: error.message });
  }
});

/**
 * POST /api/export/csv
 * Export search results to CSV format
 */
router.post('/csv', (req, res) => {
  try {
    const { articles, query, categoryPath } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({
        error: 'No articles to export'
      });
    }

    // Create CSV header
    const csvHeader = 'PMID,Title,Authors,Journal,Publication Date,Relevance Score,MeSH Terms,URL\n';

    // Create CSV rows
    const csvRows = articles.map(article => {
      const pmid = article.pmid || '';
      const title = `"${(article.title || '').replace(/"/g, '""')}"`;
      const authors = `"${(article.authors || []).join('; ').replace(/"/g, '""')}"`;
      const journal = `"${(article.journal || '').replace(/"/g, '""')}"`;
      const pubDate = article.publicationDate || '';
      const score = article.relevanceScore || 0;
      const meshTerms = `"${(article.meshTerms || []).join('; ').replace(/"/g, '""')}"`;
      const url = article.url || '';

      return `${pmid},${title},${authors},${journal},${pubDate},${score},${meshTerms},${url}`;
    }).join('\n');

    const csv = csvHeader + csvRows;

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="pubmed_results_${query}_${Date.now()}.csv"`);
    
    res.send(csv);

  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({
      error: 'Failed to export CSV',
      message: error.message
    });
  }
});

/**
 * POST /api/export/bibtex
 * Export search results to BibTeX format
 */
router.post('/bibtex', (req, res) => {
  try {
    const { articles } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({
        error: 'No articles to export'
      });
    }

    // Generate BibTeX entries
    const bibtexEntries = articles.map((article, index) => {
      const pmid = article.pmid || `unknown${index}`;
      const title = article.title || 'Unknown Title';
      const authors = (article.authors || []).join(' and ');
      const journal = article.journal || 'Unknown Journal';
      const year = article.publicationDate ? article.publicationDate.split(' ')[0] : 'Unknown';

      return `@article{PMID${pmid},
  author = {${authors}},
  title = {${title}},
  journal = {${journal}},
  year = {${year}},
  pmid = {${pmid}},
  url = {https://pubmed.ncbi.nlm.nih.gov/${pmid}/}
}`;
    }).join('\n\n');

    res.setHeader('Content-Type', 'application/x-bibtex');
    res.setHeader('Content-Disposition', `attachment; filename="pubmed_results_${Date.now()}.bib"`);
    
    res.send(bibtexEntries);

  } catch (error) {
    console.error('BibTeX export error:', error);
    res.status(500).json({
      error: 'Failed to export BibTeX',
      message: error.message
    });
  }
});

/**
 * POST /api/export/ris
 * Export search results to RIS format
 */
router.post('/ris', (req, res) => {
  try {
    const { articles } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({
        error: 'No articles to export'
      });
    }

    // Generate RIS entries
    const risEntries = articles.map(article => {
      const pmid = article.pmid || '';
      const title = article.title || 'Unknown Title';
      const authors = (article.authors || []).map(author => `AU  - ${author}`).join('\n');
      const journal = article.journal || 'Unknown Journal';
      const year = article.publicationDate ? article.publicationDate.split(' ')[0] : '';

      return `TY  - JOUR
${authors}
TI  - ${title}
JO  - ${journal}
PY  - ${year}
UR  - https://pubmed.ncbi.nlm.nih.gov/${pmid}/
ID  - ${pmid}
ER  -`;
    }).join('\n\n');

    res.setHeader('Content-Type', 'application/x-research-info-systems');
    res.setHeader('Content-Disposition', `attachment; filename="pubmed_results_${Date.now()}.ris"`);
    
    res.send(risEntries);

  } catch (error) {
    console.error('RIS export error:', error);
    res.status(500).json({
      error: 'Failed to export RIS',
      message: error.message
    });
  }
});

/**
 * POST /api/export/json
 * Export search results to JSON format
 */
router.post('/json', (req, res) => {
  try {
    const { articles, query, studyType, categoryPath } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({
        error: 'No articles to export'
      });
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      query,
      studyType,
      categoryPath,
      totalArticles: articles.length,
      articles
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="pubmed_results_${query}_${Date.now()}.json"`);
    
    res.send(JSON.stringify(exportData, null, 2));

  } catch (error) {
    console.error('JSON export error:', error);
    res.status(500).json({
      error: 'Failed to export JSON',
      message: error.message
    });
  }
});

module.exports = router;
