const express = require('express');
const router = express.Router();
const path = require('path');
const { 
  Document, 
  Paragraph, 
  Table, 
  TableRow, 
  TableCell, 
  TextRun, 
  HeadingLevel, 
  AlignmentType,
  WidthType,
  BorderStyle,
  VerticalAlign,
  Packer,
  convertInchesToTwip
} = require('docx');
const OpenAI = require('openai');

// Ensure environment variables are loaded from root .env file
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Initialize OpenAI with better error checking
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('✅ OpenAI initialized successfully');
} else {
  console.error('❌ OPENAI_API_KEY not found in environment variables');
  console.error('Checked path:', path.join(__dirname, '../../.env'));
}

// Import the matching function from detailDocument
const detailDocModule = require('./detailDocument');
const matchArticleToSection = detailDocModule.matchArticleToSection;

/**
 * Extract biological terms from text for italicization
 */
function extractBiologicalTerms(text) {
  const biologicalPatterns = [
    // Species names (e.g., Caenorhabditis elegans, Homo sapiens, Mus musculus)
    /\b([A-Z][a-z]+\s+[a-z]+)\b/g,
    // Abbreviated species (e.g., C. elegans, H. sapiens, E. coli)
    /\b([A-Z]\.\s+[a-z]+)\b/g,
    // DNA/RNA related
    /\b(DNA|RNA|mRNA|tRNA|rRNA|cDNA|siRNA|miRNA)\b/gi,
    // Latin terms
    /\b(in vitro|in vivo|ex vivo|in situ|de novo|per se|et al)\b/gi,
    // Gene names (e.g., TP53, BRCA1, alpha-synuclein)
    /\b([A-Z]{2,}[0-9]+[A-Z]*)\b/g,
    /\b(alpha|beta|gamma|delta)-[a-z]+\b/gi,
    // Protein/enzyme names with Greek letters or numbers
    /\b([a-z]+-[a-z]+|[A-Z][a-z]+[0-9]+)\b/g
  ];
  
  const terms = new Set();
  biologicalPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      // Exclude common words that match patterns but aren't biological terms
      const term = match[0];
      if (!['A study', 'The aim', 'et al'].includes(term)) {
        terms.add(term);
      }
    }
  });
  
  return Array.from(terms);
}

/**
 * Create formatted text runs with biological terms in italic
 */
function createFormattedTextRuns(text, fontSize = 24) {
  const biologicalTerms = extractBiologicalTerms(text);
  
  if (biologicalTerms.length === 0) {
    return [new TextRun({ text, size: fontSize, font: 'Times New Roman' })];
  }
  
  // Create regex to split text while preserving biological terms
  const pattern = new RegExp(`(${biologicalTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const parts = text.split(pattern);
  
  return parts.map(part => {
    const isItalic = biologicalTerms.includes(part);
    return new TextRun({
      text: part,
      size: fontSize,
      font: 'Times New Roman',
      italics: isItalic
    });
  });
}

/**
 * Generate short summary using ChatGPT
 */
async function generateShortSummary(fullAbstract, sectionType) {
  if (!openai) {
    // Fallback: extract first 2-3 sentences
    const sentences = fullAbstract.match(/[^.!?]+[.!?]+/g) || [];
    return sentences.slice(0, 3).join(' ').trim();
  }

  try {
    const prompt = `You are a medical research summarizer. Given the following detailed abstract from a ${sectionType} study, provide a concise SHORT SUMMARY (2-3 sentences) that captures:
1. The main objective
2. Key methodology
3. Primary results with specific data/numbers

Keep it professional, scientific, and under 150 words.

ABSTRACT:
${fullAbstract}

SHORT SUMMARY:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('ChatGPT summary error:', error.message);
    // Fallback
    const sentences = fullAbstract.match(/[^.!?]+[.!?]+/g) || [];
    return sentences.slice(0, 3).join(' ').trim();
  }
}

/**
 * Extract study type/identifier from article for table rows
 */
function extractStudyType(article, categoryPath) {
  if (!article) return '__';
  
  // First priority: Use the category path if available
  if (categoryPath) {
    return categoryPath;
  }
  
  // Second priority: Try to extract study phase or type from title/abstract
  const text = ((article.title || '') + ' ' + (article.abstract || '')).toLowerCase();
  
  // Check for clinical trial phases
  const phaseMatch = text.match(/\b(phase\s*[i1-4]{1,3}|phase\s*iv)\b/i);
  if (phaseMatch) {
    return phaseMatch[0].toUpperCase().replace(/\s+/g, ' ');
  }
  
  // Check for study types
  const studyTypes = [
    'randomized controlled trial',
    'double-blind',
    'single-blind',
    'placebo-controlled',
    'crossover',
    'open-label',
    'pilot study',
    'case-control',
    'cohort study',
    'observational',
    'retrospective',
    'prospective'
  ];
  
  for (const type of studyTypes) {
    if (text.includes(type)) {
      return type.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  
  // Use PMID as fallback identifier
  if (article.pmid) {
    return `PMID: ${article.pmid}`;
  }
  
  return '__';
}

/**
 * Extract PK Parameters data using ChatGPT
 */
async function extractPKParametersData(articles) {
  if (!openai) {
    console.error('OpenAI not initialized - check OPENAI_API_KEY in .env file');
    return [];
  }
  
  if (!articles || articles.length === 0) {
    console.warn('No articles provided for PK extraction');
    return [];
  }
  
  console.log(`Starting PK extraction for ${articles.length} articles...`);
  const extractedData = [];
  
  for (const item of articles) {
    const article = item.article || item;
    const categoryPath = item.categoryPath || '';
    const fullText = `Title: ${article.title || ''}\n\nAbstract: ${article.abstract || ''}`;
    const studyType = extractStudyType(article, categoryPath);
    
    console.log(`Processing PMID ${article.pmid} with category: ${categoryPath}...`);
    
    try {
      const prompt = `Extract pharmacokinetic parameters from this article. Return ONLY a JSON array of objects with this exact structure:
[
  {
    "parameter": "Maximum Plasma Concentration",
    "symbolUnit": "Cmax (ng/mL)",
    "meanSD": "value ± SD or just value",
    "median": "value or leave empty",
    "range": "min-max or leave empty",
    "studyPopulation": "description of subjects",
    "keyFinding": "brief finding"
  }
]

Extract ALL available PK parameters from this list:
- Maximum Plasma Concentration (Cmax)
- Time to Reach Cmax (Tmax)
- Area Under Curve 0-t (AUC0-t)
- Area Under Curve 0-∞ (AUC0-∞)
- Half-Life (t½)
- Clearance (CL/F)
- Volume of Distribution (Vd/F)
- Absorption Rate Constant (ka)
- Elimination Rate Constant (kel)
- Bioavailability (F%)
- Protein Binding (% Bound)
- Renal Excretion
- Metabolite Ratio

Use "__" for missing values. Include units in symbolUnit field.

Article:
${fullText}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1500
      });

      const responseText = completion.choices[0].message.content.trim();
      console.log(`ChatGPT response for PMID ${article.pmid}:`, responseText.substring(0, 200));
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const pkData = JSON.parse(jsonMatch[0]);
        console.log(`Extracted ${pkData.length} PK parameters from PMID ${article.pmid}`);
        // Add study type to each row
        pkData.forEach(row => {
          row.studyType = studyType;
          extractedData.push(row);
        });
      } else {
        console.warn(`No JSON found in ChatGPT response for PMID ${article.pmid}`);
      }
    } catch (error) {
      console.error('ChatGPT PK extraction error for PMID', article.pmid, ':', error.message);
      // Add placeholder row on error
      extractedData.push({
        studyType: studyType,
        parameter: 'Data extraction failed',
        symbolUnit: '__',
        meanSD: '__',
        median: '__',
        range: '__',
        studyPopulation: '__',
        keyFinding: 'Please check article manually'
      });
    }
  }
  
  console.log(`Total PK parameters extracted: ${extractedData.length} rows`);
  return extractedData;
}

/**
 * Extract Food Effect data using ChatGPT
 */
async function extractFoodEffectData(articles) {
  if (!openai) {
    console.error('OpenAI not initialized for Food Effect extraction');
    return [];
  }
  
  if (!articles || articles.length === 0) {
    console.warn('No articles provided for Food Effect extraction');
    return [];
  }
  
  console.log(`Starting Food Effect extraction for ${articles.length} articles...`);
  const extractedData = [];
  
  for (const item of articles) {
    const article = item.article || item;
    const fullText = `Title: ${article.title || ''}\n\nAbstract: ${article.abstract || ''}`;
    
    console.log(`Processing Food Effect for PMID ${article.pmid}...`);
    
    try {
      const prompt = `Extract food effect data from this pharmacokinetic study. Return ONLY a JSON array:
[
  {
    "parameter": "Cmax" or "AUC" or "Tmax",
    "fedState": "value with unit (e.g., 150 ng/mL)",
    "fastedState": "value with unit",
    "percentChange": "percentage (e.g., +25% or -15%)",
    "interpretation": "clinical significance (e.g., Food increases absorption, No significant effect)"
  }
]

Look for data comparing fed vs fasted states, with food intake, meals, etc.
Use "__" for missing values.

Article:
${fullText}

PMID: ${article.pmid || '__'}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 800
      });

      const responseText = completion.choices[0].message.content.trim();
      console.log(`Food Effect ChatGPT response for PMID ${article.pmid}:`, responseText.substring(0, 150));
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const foodData = JSON.parse(jsonMatch[0]);
        console.log(`Extracted ${foodData.length} food effect parameters from PMID ${article.pmid}`);
        extractedData.push(...foodData);
      } else {
        console.warn(`No JSON found in Food Effect response for PMID ${article.pmid}`);
      }
    } catch (error) {
      console.error('ChatGPT Food Effect extraction error for PMID', article.pmid, ':', error.message);
    }
  }
  
  console.log(`Total Food Effect parameters extracted: ${extractedData.length} rows`);
  return extractedData;
}

/**
 * Extract Dose Proportionality data using ChatGPT
 */
async function extractDoseProportionalityData(articles) {
  if (!openai) {
    console.error('OpenAI not initialized for Dose Proportionality extraction');
    return [];
  }
  
  if (!articles || articles.length === 0) {
    console.warn('No articles provided for Dose Proportionality extraction');
    return [];
  }
  
  console.log(`Starting Dose Proportionality extraction for ${articles.length} articles...`);
  const extractedData = [];
  
  for (const item of articles) {
    const article = item.article || item;
    const fullText = `Title: ${article.title || ''}\n\nAbstract: ${article.abstract || ''}`;
    
    console.log(`Processing Dose Proportionality for PMID ${article.pmid}...`);
    
    try {
      const prompt = `Extract dose proportionality data from this pharmacokinetic study. Return ONLY a JSON array:
[
  {
    "dose": "dose amount with unit (e.g., 100 mg, 200 mg)",
    "cmax": "Cmax value with unit",
    "auc": "AUC value with unit",
    "proportionality": "Yes or No or Dose-proportional or Non-linear",
    "comments": "brief note about dose-response relationship"
  }
]

Look for multiple doses, dose-response, dose escalation, proportionality assessment.
Use "__" for missing values.

Article:
${fullText}

PMID: ${article.pmid || '__'}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 800
      });

      const responseText = completion.choices[0].message.content.trim();
      console.log(`Dose Proportionality ChatGPT response for PMID ${article.pmid}:`, responseText.substring(0, 150));
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const doseData = JSON.parse(jsonMatch[0]);
        console.log(`Extracted ${doseData.length} dose proportionality entries from PMID ${article.pmid}`);
        extractedData.push(...doseData);
      } else {
        console.warn(`No JSON found in Dose Proportionality response for PMID ${article.pmid}`);
      }
    } catch (error) {
      console.error('ChatGPT Dose Proportionality extraction error for PMID', article.pmid, ':', error.message);
    }
  }
  
  console.log(`Total Dose Proportionality entries extracted: ${extractedData.length} rows`);
  return extractedData;
}

/**
 * Extract Intrinsic Factor Effects data using ChatGPT
 */
async function extractIntrinsicFactorData(articles) {
  if (!openai) {
    console.error('OpenAI not initialized for Intrinsic Factor extraction');
    return [];
  }
  
  if (!articles || articles.length === 0) {
    console.warn('No articles provided for Intrinsic Factor extraction');
    return [];
  }
  
  console.log(`Starting Intrinsic Factor extraction for ${articles.length} articles...`);
  const extractedData = [];
  
  for (const item of articles) {
    const article = item.article || item;
    const fullText = `Title: ${article.title || ''}\n\nAbstract: ${article.abstract || ''}`;
    
    console.log(`Processing Intrinsic Factor for PMID ${article.pmid}...`);
    
    try {
      const prompt = `Extract intrinsic factor effects and special population data from this pharmacokinetic study. Return ONLY a JSON array:
[
  {
    "population": "Renal Impairment" or "Hepatic Impairment" or "Elderly Patients" or "Pediatric Patients" or "Gender Differences",
    "cmax": "Cmax value or fold-change (e.g., 1.5-fold increase, 120 ng/mL)",
    "auc": "AUC value or fold-change",
    "halfLife": "t½ value (e.g., 8.5 h, 1.2-fold)",
    "adjustmentNeeded": "Yes or No",
    "comments": "brief clinical recommendation or finding"
  }
]

Look for data on:
- Renal/kidney impairment or dysfunction
- Hepatic/liver impairment or dysfunction  
- Elderly/geriatric populations
- Pediatric/children populations
- Gender/sex differences
- Age effects
- Organ dysfunction

Use "__" for missing values.

Article:
${fullText}

PMID: ${article.pmid || '__'}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1000
      });

      const responseText = completion.choices[0].message.content.trim();
      console.log(`Intrinsic Factor ChatGPT response for PMID ${article.pmid}:`, responseText.substring(0, 150));
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const intrinsicData = JSON.parse(jsonMatch[0]);
        console.log(`Extracted ${intrinsicData.length} intrinsic factor entries from PMID ${article.pmid}`);
        extractedData.push(...intrinsicData);
      } else {
        console.warn(`No JSON found in Intrinsic Factor response for PMID ${article.pmid}`);
      }
    } catch (error) {
      console.error('ChatGPT Intrinsic Factor extraction error for PMID', article.pmid, ':', error.message);
    }
  }
  
  console.log(`Total Intrinsic Factor entries extracted: ${extractedData.length} rows`);
  return extractedData;
}

/**
 * Extract Pharmacodynamics data using ChatGPT
 */
async function extractPharmacodynamicsData(articles) {
  if (!openai || !articles || articles.length === 0) return [];
  
  const extractedData = [];
  
  for (const item of articles) {
    const article = item.article || item;
    const fullText = `Title: ${article.title || ''}\n\nAbstract: ${article.abstract || ''}`;
    
    try {
      const prompt = `Extract pharmacodynamic data from this article. Return ONLY a JSON array with this structure:
[
  {
    "category": "Related to Proposed Indications" or "Pharmacodynamic Drug Interaction",
    "studyId": "PMID or study identifier",
    "studyDesign": "In vitro / In vivo / Clinical",
    "objective": "main objective",
    "pdParameters": "biomarkers, EC50, Emax, receptor binding, etc.",
    "keyResults": "main results with numbers",
    "interpretation": "clinical relevance"
  }
]

Article:
${fullText}

PMID: ${article.pmid || '__'}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1000
      });

      const responseText = completion.choices[0].message.content.trim();
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const pdData = JSON.parse(jsonMatch[0]);
        extractedData.push(...pdData);
      }
    } catch (error) {
      console.error('ChatGPT PD extraction error:', error.message);
    }
  }
  
  return extractedData;
}

/**
 * Extract Clinical Efficacy data using ChatGPT
 */
async function extractClinicalEfficacyData(articles) {
  if (!openai || !articles || articles.length === 0) return [];
  
  const extractedData = [];
  
  for (const item of articles) {
    const article = item.article || item;
    const fullText = `Title: ${article.title || ''}\n\nAbstract: ${article.abstract || ''}`;
    
    try {
      const prompt = `Extract clinical efficacy data from this article. Return ONLY a JSON array:
[
  {
    "studyType": "Placebo-Controlled / Active-Controlled / Uncontrolled / Meta-Analyses / Pediatrics",
    "studyId": "PMID or identifier",
    "indication": "disease/condition treated",
    "population": "patient characteristics, n=number",
    "primaryEndpoint": "main outcome measure",
    "results": "efficacy results with statistics",
    "pValue": "statistical significance",
    "conclusion": "study conclusion"
  }
]

Article:
${fullText}

PMID: ${article.pmid || '__'}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1000
      });

      const responseText = completion.choices[0].message.content.trim();
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const efficacyData = JSON.parse(jsonMatch[0]);
        extractedData.push(...efficacyData);
      }
    } catch (error) {
      console.error('ChatGPT Efficacy extraction error:', error.message);
    }
  }
  
  return extractedData;
}

/**
 * Extract Safety data using ChatGPT
 */
async function extractSafetyData(articles) {
  if (!openai || !articles || articles.length === 0) return [];
  
  const extractedData = [];
  
  for (const item of articles) {
    const article = item.article || item;
    const fullText = `Title: ${article.title || ''}\n\nAbstract: ${article.abstract || ''}`;
    
    try {
      const prompt = `Extract safety and adverse event data from this article. Return ONLY a JSON array:
[
  {
    "category": "ADRs / Pregnancy / Breastfeeding / Fertility / Overdose / PMS",
    "studyId": "PMID or identifier",
    "population": "subjects studied",
    "findings": "safety findings with percentages/numbers",
    "severity": "mild/moderate/severe or __",
    "interpretation": "clinical significance"
  }
]

Article:
${fullText}

PMID: ${article.pmid || '__'}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1000
      });

      const responseText = completion.choices[0].message.content.trim();
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const safetyData = JSON.parse(jsonMatch[0]);
        extractedData.push(...safetyData);
      }
    } catch (error) {
      console.error('ChatGPT Safety extraction error:', error.message);
    }
  }
  
  return extractedData;
}

/**
 * Extract table data from articles for a specific heading
 */
async function extractTableDataForHeading(articles, headingName, studyType) {
  const tableData = [];
  
  for (const item of articles) {
    const article = item.article;
    
    // Generate short summary from the full abstract
    const shortSummary = await generateShortSummary(article.abstract || '', headingName);
    
    // Extract study details based on study type
    let rowData = {};
    
    if (studyType === 'animal') {
      // Animal study table format
      rowData = {
        typeOfStudy: item.categoryPath || headingName,
        speciesStrain: extractSpeciesStrain(article),
        methodOfAdmin: extractMethodOfAdmin(article),
        durationDosing: extractDurationDosing(article),
        doses: extractDoses(article),
        glpCompliance: extractGLPCompliance(article),
        testingFacility: extractTestingFacility(article),
        studyNumber: article.pmid || '',
        location: extractLocation(article),
        shortSummary: shortSummary,
        reference: formatReference(article)
      };
    } else {
      // Human study table format
      rowData = {
        typeOfStudy: item.categoryPath || headingName,
        testSystem: extractTestSystem(article),
        methodOfAdmin: extractMethodOfAdmin(article),
        doses: extractDoses(article),
        genderNo: extractGenderNumber(article),
        noteworthyFindings: extractNoteworthyFindings(article),
        glpCompliance: extractGLPCompliance(article),
        studyNumber: article.pmid || '',
        shortSummary: shortSummary,
        reference: formatReference(article)
      };
    }
    
    tableData.push(rowData);
  }
  
  return tableData;
}

// Helper functions to extract information from articles
function extractSpeciesStrain(article) {
  const text = (article.abstract || '') + ' ' + (article.title || '');
  const speciesPatterns = /\b(mice|rats|rabbits|dogs|monkeys|guinea pigs?|hamsters|C57BL\/6|Sprague-Dawley|Wistar)\b/gi;
  const matches = text.match(speciesPatterns);
  return matches ? [...new Set(matches.map(m => m.toLowerCase()))].join(', ') : '(2)';
}

function extractMethodOfAdmin(article) {
  const text = (article.abstract || '').toLowerCase();
  const methods = ['oral', 'intravenous', 'subcutaneous', 'intramuscular', 'topical', 'inhalation', 'i.v.', 'p.o.', 's.c.', 'i.m.'];
  for (const method of methods) {
    if (text.includes(method)) {
      return method.toUpperCase();
    }
  }
  return '';
}

function extractDurationDosing(article) {
  const text = article.abstract || '';
  const durationPattern = /(\d+)\s*(day|week|month|hour)s?/gi;
  const match = text.match(durationPattern);
  return match ? match[0] : '';
}

function extractDoses(article) {
  const text = article.abstract || '';
  const dosePattern = /(\d+\.?\d*)\s*(mg\/kg|g\/kg|µg\/kg|mg|g)/gi;
  const matches = text.match(dosePattern);
  return matches ? matches.slice(0, 3).join(', ') : '';
}

function extractGLPCompliance(article) {
  const text = (article.abstract || '').toLowerCase();
  if (text.includes('glp') || text.includes('good laboratory practice')) {
    return 'Yes';
  }
  return '';
}

function extractTestingFacility(article) {
  const authors = article.authors || [];
  return authors.length > 0 ? authors[0] : '';
}

function extractLocation(article) {
  // Try to extract location from affiliation or journal
  return '(3)';
}

function extractTestSystem(article) {
  const text = article.abstract || '';
  if (text.toLowerCase().includes('human') || text.toLowerCase().includes('patient')) {
    return 'Human';
  }
  return '';
}

function extractGenderNumber(article) {
  const text = article.abstract || '';
  const genderPattern = /(\d+)\s*(male|female|men|women|subjects|participants|patients)/gi;
  const matches = text.match(genderPattern);
  return matches ? matches[0] : '';
}

function extractNoteworthyFindings(article) {
  // Extract key findings - first sentence of results
  const text = article.abstract || '';
  const resultsMatch = text.match(/results?:?\s*([^.]+\.)/i);
  return resultsMatch ? resultsMatch[1] : '';
}

function formatReference(article) {
  const authors = article.authors && article.authors.length > 0
    ? article.authors.slice(0, 3).join(', ') + (article.authors.length > 3 ? ', et al.' : '')
    : 'Unknown authors';
  const year = article.publicationDate ? article.publicationDate.split(' ')[0] : 'n.d.';
  return `${authors} (${year})`;
}

/**
 * Create table for Animal Studies (based on template images)
 */
function createAnimalStudyTable(tableData, headingName) {
  const rows = [];
  
  // Header row
  rows.push(
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ text: 'Type of Study', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Species and Strain', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Method of Administration', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Duration of Dosing', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Doses (mg/kg)', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER
        }),
        new TableCell({
          children: [new Paragraph({ text: 'GLP Compliance', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Testing Facility', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Study Number(3)', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Location Vol. Section', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER
        })
      ]
    })
  );
  
  // Data rows
  for (const data of tableData) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: data.typeOfStudy, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.speciesStrain, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.methodOfAdmin, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.durationDosing, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.doses, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.glpCompliance, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.testingFacility, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.studyNumber, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.location, size: 18 })] })
        ]
      })
    );
  }
  
  return new Table({
    rows: rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 3, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 3, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 3, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 3, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' }
    },
    columnWidths: [1500, 1500, 1500, 1500, 1200, 1000, 1500, 1000, 1300],
    margins: {
      top: 100,
      bottom: 100,
      left: 100,
      right: 100
    }
  });
}

/**
 * Create Pharmacokinetic Parameters Table for Human Studies
 */
function createPKParametersTable(tableData, articles = []) {
  // Default PK parameters template
  const pkParameters = [
    { parameter: 'Maximum Plasma Concentration', symbolUnit: 'Cmax (ng/mL)' },
    { parameter: 'Time to Reach Cmax', symbolUnit: 'Tmax (h)' },
    { parameter: 'Area Under Curve (0–t)', symbolUnit: 'AUC0–t (ng·h/mL)' },
    { parameter: 'Area Under Curve (0–∞)', symbolUnit: 'AUC0–∞ (ng·h/mL)' },
    { parameter: 'Half-Life', symbolUnit: 't½ (h)' },
    { parameter: 'Clearance', symbolUnit: 'CL/F (L/h)' },
    { parameter: 'Volume of Distribution', symbolUnit: 'Vd/F (L)' },
    { parameter: 'Absorption Rate Constant', symbolUnit: 'ka (h⁻¹)' },
    { parameter: 'Elimination Rate Constant', symbolUnit: 'kel (h⁻¹)' },
    { parameter: 'Bioavailability', symbolUnit: 'F (%)' },
    { parameter: '% Bound', symbolUnit: '__' },
    { parameter: 'Renal Excretion (Parent Drug)', symbolUnit: '__' },
    { parameter: 'Metabolite Ratio', symbolUnit: '__' }
  ];
  
  // Build rows with Study Type from articles
  const defaultRows = [];
  for (const pkParam of pkParameters) {
    // For each PK parameter, create a row for each article (or empty if no articles)
    if (articles && articles.length > 0) {
      for (const item of articles) {
        const article = item.article || item;
        const studyInfo = extractStudyType(article);
        defaultRows.push({
          studyType: studyInfo,
          parameter: pkParam.parameter,
          symbolUnit: pkParam.symbolUnit,
          meanSD: '__',
          median: '__',
          range: '__',
          studyPopulation: '__',
          keyFinding: '__'
        });
      }
    } else {
      // No articles - use empty study type
      defaultRows.push({
        studyType: '__',
        parameter: pkParam.parameter,
        symbolUnit: pkParam.symbolUnit,
        meanSD: '__',
        median: '__',
        range: '__',
        studyPopulation: '__',
        keyFinding: '__'
      });
    }
  }
  
  const rows = [];
  rows.push(new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ text: 'Type of Study', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Parameter', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Symbol / Unit', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Mean ± SD', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Median', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Range (Min–Max)', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Study Population', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Key Finding', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER })
    ]
  }));
  
  // Prefer ChatGPT extracted data over default template
  const dataToUse = tableData && tableData.length > 0 ? tableData : defaultRows;
  console.log(`PK Parameters Table: Using ${dataToUse.length} rows (${tableData && tableData.length > 0 ? 'ChatGPT extracted' : 'default template'})`);
  if (tableData && tableData.length > 0) {
    console.log('First row sample:', JSON.stringify(tableData[0], null, 2));
  }
  for (const data of dataToUse) {
    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: data.studyType || '__', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.parameter || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.symbolUnit || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.meanSD || '__', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.median || '__', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.range || '__', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.studyPopulation || '__', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.keyFinding || '__', size: 18 })] })
      ]
    }));
  }
  return new Table({
    rows, width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
    margins: { top: 100, bottom: 100, left: 100, right: 100 }
  });
}

function createFoodEffectTable(tableData) {
  const defaultRows = [
    { parameter: 'Cmax', fedState: '__', fastedState: '__', percentChange: '__%', interpretation: '__' },
    { parameter: 'AUC', fedState: '__', fastedState: '__', percentChange: '__%', interpretation: '__' },
    { parameter: 'Tmax', fedState: '__', fastedState: '__', percentChange: '__%', interpretation: '__' }
  ];
  
  const rows = [];
  rows.push(new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ text: 'Parameter', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Fed State', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Fasted State', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: '% Change', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Interpretation', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER })
    ]
  }));
  
  const dataToUse = tableData && tableData.length > 0 ? tableData : defaultRows;
  for (const data of dataToUse) {
    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: data.parameter || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.fedState || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.fastedState || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.percentChange || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.interpretation || '', size: 18 })] })
      ]
    }));
  }
  return new Table({
    rows, width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
    margins: { top: 100, bottom: 100, left: 100, right: 100 }
  });
}

function createDoseProportionalityTable(tableData) {
  const defaultRows = [
    { dose: '__', cmax: '__', auc: '__', proportionality: '__', comments: '__' },
    { dose: '__', cmax: '__', auc: '__', proportionality: '__', comments: '__' }
  ];
  
  const rows = [];
  rows.push(new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ text: 'Dose (mg)', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Cmax', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'AUC', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Proportionality (Yes/No)', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Comments', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER })
    ]
  }));
  
  const dataToUse = tableData && tableData.length > 0 ? tableData : defaultRows;
  for (const data of dataToUse) {
    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: data.dose || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.cmax || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.auc || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.proportionality || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.comments || '', size: 18 })] })
      ]
    }));
  }
  return new Table({
    rows, width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
    margins: { top: 100, bottom: 100, left: 100, right: 100 }
  });
}

function createIntrinsicFactorEffectsTable(tableData) {
  const defaultRows = [
    { population: 'Renal Impairment', cmax: '__', auc: '__', halfLife: '__', adjustmentNeeded: 'Yes/No', comments: '__' },
    { population: 'Hepatic Impairment', cmax: '__', auc: '__', halfLife: '__', adjustmentNeeded: 'Yes/No', comments: '__' },
    { population: 'Elderly Patients', cmax: '__', auc: '__', halfLife: '__', adjustmentNeeded: 'Yes/No', comments: '__' },
    { population: 'Pediatric Patients', cmax: '__', auc: '__', halfLife: '__', adjustmentNeeded: 'Yes/No', comments: '__' },
    { population: 'Gender Differences', cmax: '__', auc: '__', halfLife: '__', adjustmentNeeded: '—', comments: '__' }
  ];
  
  const rows = [];
  rows.push(new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ text: 'Population', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Cmax', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'AUC', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 't½', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Adjustment Needed?', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Comments', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER })
    ]
  }));
  
  const dataToUse = tableData && tableData.length > 0 ? tableData : defaultRows;
  for (const data of dataToUse) {
    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: data.population || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.cmax || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.auc || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.halfLife || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.adjustmentNeeded || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.comments || '', size: 18 })] })
      ]
    }));
  }
  return new Table({
    rows, width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
    margins: { top: 100, bottom: 100, left: 100, right: 100 }
  });
}

function createPharmacodynamicsTable(tableData) {
  const defaultRows = [
    { category: 'Related to Proposed Indications', studyId: '__', studyDesign: 'In vitro / In vivo / Clinical', objective: 'Evaluate PD effect relevant to indication', pdParameters: 'Biomarker response, EC50, Emax, receptor binding, onset/duration', keyResults: '__', interpretation: '__' },
    { category: 'Pharmacodynamic Drug Interaction', studyId: '__', studyDesign: 'Interaction study / PK-PD model', objective: 'Assess PD interactions with co-administered drugs', pdParameters: 'Biomarkers, receptor occupancy, response shift', keyResults: '__', interpretation: '__' }
  ];
  
  const rows = [];
  rows.push(new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ text: 'Category', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Study ID', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Study Design / Model', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Objective', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'PD Parameters Assessed', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Key Results / Findings', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Clinical Interpretation', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER })
    ]
  }));
  
  const dataToUse = tableData && tableData.length > 0 ? tableData : defaultRows;
  for (const data of dataToUse) {
    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: data.category || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.studyId || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.studyDesign || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.objective || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.pdParameters || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.keyResults || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.interpretation || '', size: 18 })] })
      ]
    }));
  }
  return new Table({
    rows, width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
    margins: { top: 100, bottom: 100, left: 100, right: 100 }
  });
}

function createClinicalEfficacyTable(tableData) {
  const defaultRows = [
    { section: '1. Placebo-Controlled Studies', studyType: 'Randomized, Double-Blind, Placebo-Controlled Trials', studyIdentifiers: 'Study IDs (e.g., PBO-01, PBO-02)', populationSize: 'N = __ ; Adults/Pediatrics; Brief inclusion criteria', designComparator: 'Parallel-group / Crossover', endpoints: 'Primary: __ ; Secondary: __', keyOutcomes: 'Effect size, p-values, responder rates, clinically meaningful improvements', conclusion: 'Demonstrates superiority/non-inferiority vs placebo' },
    { section: '2. Active-Controlled Studies', studyType: 'Randomized, Active Comparator Trials', studyIdentifiers: 'Study IDs (e.g., ACT-01, ACT-02)', populationSize: 'N = __ ; Population characteristics', designComparator: 'Comparator: __ (dose); Study duration', endpoints: 'Primary: __ ; Secondary: __', keyOutcomes: 'Comparative efficacy, non-inferiority margins, benefit-risk evaluation', conclusion: 'Shows non-inferiority/superiority vs active control' },
    { section: '3. Uncontrolled Studies', studyType: 'Open-Label / Single-Arm Studes', studyIdentifiers: 'Study IDs (e.g., UNC-01)', populationSize: 'N = __ ; Special subpopulations', designComparator: 'Single-arm, Observational', endpoints: 'Primary: __', keyOutcomes: 'Clinical response rates, symptom improvement, real-world evidence summary', conclusion: 'Supports long-term use/specific subgroup benefit' },
    { section: '4. Meta-Analyses', studyType: 'Pooled Analyses / Systematic Reviews', studyIdentifiers: 'Meta-analysis ID or citation', populationSize: 'Total pooled N = __', designComparator: 'Methods: Fixed/random effects; Inclusion criteria', endpoints: 'Primary pooled endpoint', keyOutcomes: 'Summary RR/OR/HR, heterogeneity (P), consistency of treatment benefit', conclusion: 'Confirms consistent efficacy across studies' },
    { section: '5. Efficacy in Paediatrics', studyType: 'Paediatric Clinical Studies / Extrapolation Strategy', studyIdentifiers: 'Study IDs (e.g., PED-01, PK-Ped)', populationSize: 'N = __ ; Age groups', designComparator: 'Design: __ ; Extrapolation from adult data if applicable', endpoints: 'Primary paediatric endpoints', keyOutcomes: 'Efficacy by age subgroup; PK/PD similarity supporting extrapolation', conclusion: 'Supports efficacy in paediatric population' }
  ];
  
  const rows = [];
  rows.push(new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ text: 'Section', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Study Type / Evidence', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Key Study Identifiers', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Population & Sample Size', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Design & Comparator', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Primary/Secondary Endpoints', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Key Efficacy Outcomes', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Conclusion', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER })
    ]
  }));
  
  const dataToUse = tableData && tableData.length > 0 ? tableData : defaultRows;
  for (const data of dataToUse) {
    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: data.section || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.studyType || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.studyIdentifiers || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.populationSize || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.designComparator || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.endpoints || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.keyOutcomes || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.conclusion || '', size: 18 })] })
      ]
    }));
  }
  return new Table({
    rows, width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
    margins: { top: 100, bottom: 100, left: 100, right: 100 }
  });
}

function createSafetyAssessmentTable(tableData) {
  const defaultRows = [
    { section: '1. Adverse Drug Reactions (ADRs)', safetyDomain: 'Treatment-Emergent AEs, Serious AEs, ADRs', dataSources: 'RCTs, Open-label studies, Pooled safety set', populationExposure: 'Total exposed: __ ; Duration: __', keyFindings: 'Most common ADRs: __ ; Serious ADRs: __ ; Discontinuation due to AEs: __', regulatoryConclusion: 'Overall safety profile consistent with class; no unexpected ADRs' },
    { section: '2. Pregnancy', safetyDomain: 'Embryo–foetal risk, congenital anomaly data', dataSources: 'Clinical data (if any), PMS reports, Literature', populationExposure: 'Pregnant exposure count: __', keyFindings: 'No adequate well-controlled studies; observed pregnancy outcomes: __', regulatoryConclusion: 'Use only if clearly needed; risk cannot be ruled out' },
    { section: '3. Breastfeeding', safetyDomain: 'Drug transfer to breastmilk; infant exposure', dataSources: 'PK studies, Case reports, Literature', populationExposure: 'Lactating exposure: __', keyFindings: 'Milk transfer level: __ ; Reported effects on infants: __', regulatoryConclusion: 'Caution advised; balance maternal benefit vs infant risk' },
    { section: '4. Fertility', safetyDomain: 'Effects on male/female reproductive function', dataSources: 'Nonclinical reproductive studies; Limited clinical data', populationExposure: '—', keyFindings: 'No clinically meaningful impact observed / Potential effects at high doses: __', regulatoryConclusion: 'No human fertility-related safety signals identified' },
    { section: '5. Overdose', safetyDomain: 'Clinical overdose cases, symptoms, management', dataSources: 'Clinical trials, PMS reports', populationExposure: 'Number of overdose cases: __', keyFindings: 'Symptoms: __ ; Management used: __ ; Outcomes: __', regulatoryConclusion: 'Supportive symptomatic care recommended; no specific antidote' },
    { section: '6. Post-Marketing Surveillance (PMS)', safetyDomain: 'Real-world safety profile', dataSources: 'PMS databases, Spontaneous ADR reports, Literature', populationExposure: 'Exposure post-approval: __', keyFindings: 'New safety signals: __ ; Rare AEs: __ ; Overall benefit-risk favourable', regulatoryConclusion: 'PMS supports good long-term safety; no new major risks identified' }
  ];
  
  const rows = [];
  rows.push(new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ text: 'Section', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Safety Domain', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Data Sources / Study IDs', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Population & Exposure', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Key Findings / Safety Signals', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ text: 'Regulatory Conclusion', bold: true, size: 20 })], verticalAlign: VerticalAlign.CENTER })
    ]
  }));
  
  const dataToUse = tableData && tableData.length > 0 ? tableData : defaultRows;
  for (const data of dataToUse) {
    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: data.section || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.safetyDomain || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.dataSources || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.populationExposure || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.keyFindings || '', size: 18 })] }),
        new TableCell({ children: [new Paragraph({ text: data.regulatoryConclusion || '', size: 18 })] })
      ]
    }));
  }
  return new Table({
    rows, width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 3, color: '000000' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
    margins: { top: 100, bottom: 100, left: 100, right: 100 }
  });
}

/**
 * Create table for Human Studies
 */
function createHumanStudyTable(tableData, headingName) {
  // For Pharmacokinetics heading, we don't create a table here
  // Tables will be created separately for each subheading
  if (headingName === 'Pharmacokinetics') {
    return null; // Will be handled separately
  }
  
  // Use the specialized table functions
  if (headingName === 'Pharmacodynamics') {
    return createPharmacodynamicsTable(tableData);
  } else if (headingName === 'Efficacy') {
    return createClinicalEfficacyTable(tableData);
  } else if (headingName === 'Safety') {
    return createSafetyAssessmentTable(tableData);
  }
  
  // Default fallback - shouldn't reach here for Human studies
  return null;
}

/**
 * Get template structure (same as detail document)
 */
function getAnimalStudiesTemplate() {
  return [
    { heading: 'Pharmacodynamics', subheadings: ['Primary Pharmacodynamics', 'Secondary Pharmacodynamics'] },
    { heading: 'Safety Pharmacology', subheadings: ['Effect on Central Nervous System (CNS)', 'Effect on Cardiovascular System (CVS)', 'Other Effects'] },
    { heading: 'Pharmacokinetics', subheadings: ['Method of Analysis', 'Absorption', 'Distribution', 'Metabolism', 'Excretion', 'Other Pharmacokinetic Studies'] },
    { heading: 'Toxicology', subheadings: ['Single Dose Toxicity', 'Repeat Dose Toxicity', 'Genotoxicity', 'Carcinogenicity', 'Reproductive and Developmental Toxicity', 'Local Tolerance', 'Other Toxicity Studies'] }
  ];
}

function getHumanStudiesTemplate() {
  return [
    { heading: 'Pharmacokinetics', subheadings: ['Method of Analysis', 'Absorption', 'Distribution', 'Metabolism', 'Excretion', 'Pharmacokinetics in Special Populations', 'Pharmacokinetic Drug Interaction'] },
    { heading: 'Pharmacodynamics', subheadings: ['Related to Proposed Indications', 'Pharmacodynamic Drug Interaction'] },
    { heading: 'Efficacy', subheadings: ['Placebo-Controlled Studies', 'Active-Controlled Studies', 'Uncontrolled Studies', 'Efficacy in Paediatrics', 'Dosage'] },
    { heading: 'Safety', subheadings: ['Adverse Drug Reactions (ADR)', 'Pregnancy and Lactation', 'Overdose', 'Post-marketing Surveillance'] }
  ];
}

/**
 * Generate Short Summary Document
 */
router.post('/generate-short-summary', async (req, res) => {
  try {
    const { cartItems, studyType } = req.body;

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: 'No articles provided' });
    }

    const filteredItems = cartItems.filter(item => item.studyType === studyType);
    if (filteredItems.length === 0) {
      return res.status(400).json({ error: `No ${studyType} studies found in cart` });
    }

    const template = studyType === 'animal' ? getAnimalStudiesTemplate() : getHumanStudiesTemplate();
    
    // Organize articles by heading and subheading
    const organizedArticles = {};
    template.forEach(section => {
      organizedArticles[section.heading] = {};
      section.subheadings.forEach(subheading => {
        organizedArticles[section.heading][subheading] = [];
      });
    });

    // Match each article to appropriate section
    for (const item of filteredItems) {
      const match = matchArticleToSection(item.article, item.categoryPath, studyType);
      
      if (match.heading && organizedArticles[match.heading]) {
        if (match.subheading && organizedArticles[match.heading][match.subheading]) {
          organizedArticles[match.heading][match.subheading].push(item);
        } else if (!match.subheading) {
          // Add to first subheading if no specific match
          const firstSubheading = Object.keys(organizedArticles[match.heading])[0];
          if (firstSubheading) {
            organizedArticles[match.heading][firstSubheading].push(item);
          }
        }
      }
    }

    const sections = [];

    // Title
    sections.push(
      new Paragraph({
        text: `Short Summary Document - ${studyType.charAt(0).toUpperCase() + studyType.slice(1)} Studies`,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );

    // Generate content for each main heading
    let mainCounter = 1;
    for (const templateSection of template) {
      const mainLabel = String.fromCharCode(96 + mainCounter); // 'a', 'b', 'c', etc.
      
      // 1. Main heading (e.g., "1. a. Pharmacodynamics")
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${mainCounter}. ${mainLabel}. ${templateSection.heading}`,
              bold: true,
              size: 28,
              font: 'Times New Roman'
            })
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 200 }
        })
      );

      // Collect all articles for this main heading
      const allHeadingArticles = [];
      Object.values(organizedArticles[templateSection.heading]).forEach(articles => {
        allHeadingArticles.push(...articles);
      });

      if (allHeadingArticles.length > 0) {
        // Special handling for Pharmacokinetics in Human studies - create 4 tables
        if (studyType === 'human' && templateSection.heading === 'Pharmacokinetics') {
          // Extract all PK data using ChatGPT
          console.log('Extracting PK parameters data using ChatGPT...');
          const pkParamsData = await extractPKParametersData(allHeadingArticles);
          
          console.log('Extracting Food Effect data using ChatGPT...');
          const foodEffectData = await extractFoodEffectData(allHeadingArticles);
          
          console.log('Extracting Dose Proportionality data using ChatGPT...');
          const doseProportionalityData = await extractDoseProportionalityData(allHeadingArticles);
          
          console.log('Extracting Intrinsic Factor data using ChatGPT...');
          const intrinsicFactorData = await extractIntrinsicFactorData(allHeadingArticles);
          
          // 1.1 PK Parameters Table
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${mainCounter}.1 Pharmacokinetic Parameters Table`,
                  bold: true,
                  size: 24,
                  font: 'Times New Roman'
                })
              ],
              spacing: { before: 150, after: 100 }
            })
          );
          const pkParamsTable = createPKParametersTable(pkParamsData, allHeadingArticles);
          sections.push(pkParamsTable);
          sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));

          // 1.2 Food Effect Table
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${mainCounter}.2 Food Effect Assessment Table`,
                  bold: true,
                  size: 24,
                  font: 'Times New Roman'
                })
              ],
              spacing: { before: 150, after: 100 }
            })
          );
          const foodEffectTable = createFoodEffectTable(foodEffectData);
          sections.push(foodEffectTable);
          sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));

          // 1.3 Dose Proportionality Table
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${mainCounter}.3 Dose Proportionality Table`,
                  bold: true,
                  size: 24,
                  font: 'Times New Roman'
                })
              ],
              spacing: { before: 150, after: 100 }
            })
          );
          const doseProportionalityTable = createDoseProportionalityTable(doseProportionalityData);
          sections.push(doseProportionalityTable);
          sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));

          // 1.4 Intrinsic Factor Effects Table
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${mainCounter}.4 Intrinsic Factor Effects Table`,
                  bold: true,
                  size: 24,
                  font: 'Times New Roman'
                })
              ],
              spacing: { before: 150, after: 100 }
            })
          );
          const intrinsicFactorTable = createIntrinsicFactorEffectsTable(intrinsicFactorData);
          sections.push(intrinsicFactorTable);
          sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));

          // 1.5 Short summaries heading
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${mainCounter}.5 Short summaries with references`,
                  bold: true,
                  size: 24,
                  font: 'Times New Roman'
                })
              ],
              spacing: { before: 200, after: 150 }
            })
          );
        } else {
          // Standard single table for other headings
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${mainCounter}.1 Table with all articles`,
                  bold: true,
                  size: 24,
                  font: 'Times New Roman'
                })
              ],
              spacing: { before: 150, after: 100 }
            })
          );

          // Generate table data for all articles in this heading using ChatGPT
          let tableData;
          if (templateSection.heading === 'Pharmacodynamics') {
            console.log('Extracting Pharmacodynamics data using ChatGPT...');
            tableData = await extractPharmacodynamicsData(allHeadingArticles);
          } else if (templateSection.heading === 'Efficacy') {
            console.log('Extracting Clinical Efficacy data using ChatGPT...');
            tableData = await extractClinicalEfficacyData(allHeadingArticles);
          } else if (templateSection.heading === 'Safety') {
            console.log('Extracting Safety data using ChatGPT...');
            tableData = await extractSafetyData(allHeadingArticles);
          } else {
            // Fallback for other headings
            tableData = await extractTableDataForHeading(allHeadingArticles, templateSection.heading, studyType);
          }
          
          // Create table
          const table = studyType === 'animal' 
            ? createAnimalStudyTable(tableData, templateSection.heading)
            : createHumanStudyTable(tableData, templateSection.heading);
          
          if (table) {
            sections.push(table);
            sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));
          }

          // 1.2 Short summaries heading
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${mainCounter}.2 Short summaries with references`,
                  bold: true,
                  size: 24,
                  font: 'Times New Roman'
                })
              ],
              spacing: { before: 200, after: 150 }
            })
          );
        }

        // 1.2.1, 1.2.2, etc. (or 1.5.1, 1.5.2 for PK) - Subsection summaries
        const summaryPrefix = (studyType === 'human' && templateSection.heading === 'Pharmacokinetics') ? 5 : 2;
        let subCounter = 1;
        for (const subheading of templateSection.subheadings) {
          const subheadingArticles = organizedArticles[templateSection.heading][subheading] || [];
          
          if (subheadingArticles.length > 0) {
            // Subsection heading (e.g., "1.2.1 Primary Pharmacodynamics" or "1.5.1 Absorption")
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${mainCounter}.${summaryPrefix}.${subCounter} ${subheading}`,
                    bold: true,
                    size: 22,
                    font: 'Times New Roman'
                  })
                ],
                spacing: { before: 150, after: 100 }
              })
            );

            // Generate short summaries for each article in this subsection
            for (const item of subheadingArticles) {
              const shortSummary = await generateShortSummary(item.article.abstract || '', subheading);
              const reference = formatReference(item.article);
              
              // Create formatted text runs with biological terms in italic
              const summaryRuns = createFormattedTextRuns(shortSummary, 22);
              
              sections.push(
                new Paragraph({
                  children: [
                    ...summaryRuns,
                    new TextRun({ text: ' ', size: 22, font: 'Times New Roman' }),
                    new TextRun({
                      text: reference,
                      size: 22,
                      font: 'Times New Roman',
                      italics: true
                    })
                  ],
                  spacing: { after: 100 },
                  alignment: AlignmentType.JUSTIFIED
                })
              );

              // Add PubMed link below each summary
              const pmidUrl = item.article.url || `https://pubmed.ncbi.nlm.nih.gov/${item.article.pmid}/`;
              sections.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Link: ',
                      size: 20,
                      font: 'Times New Roman',
                      color: '666666'
                    }),
                    new TextRun({
                      text: pmidUrl,
                      size: 20,
                      font: 'Times New Roman',
                      color: '0563C1',
                      underline: {}
                    })
                  ],
                  spacing: { after: 250 },
                  alignment: AlignmentType.LEFT
                })
              );
            }
          }
          
          subCounter++;
        }
      }

      mainCounter++;
    }

    // 5. References section
    sections.push(
      new Paragraph({
        text: '',
        spacing: { before: 400 }
      })
    );

    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${mainCounter}. REFERENCES`,
            bold: true,
            size: 28,
            font: 'Times New Roman'
          })
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 }
      })
    );

    let refCounter = 1;
    for (const item of filteredItems) {
      const article = item.article;
      
      // Normalize PMID
      const normalizePmid = (pmid) => {
        if (typeof pmid === 'object' && pmid !== null) {
          return String(pmid._ || pmid.i || pmid);
        }
        return String(pmid || '');
      };
      
      const authors = article.authors && article.authors.length > 0
        ? article.authors.slice(0, 6).join(', ') + (article.authors.length > 6 ? ', et al.' : '')
        : 'Unknown authors';
      const year = article.publicationDate ? article.publicationDate.split(' ')[0] : 'n.d.';
      const title = article.title || 'Untitled';
      const journal = article.journal || 'Unknown journal';
      const pmid = normalizePmid(article.pmid);
      const url = article.url || `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${refCounter}. `,
              size: 24,
              font: 'Times New Roman'
            }),
            new TextRun({
              text: `${authors} `,
              size: 24,
              font: 'Times New Roman'
            }),
            new TextRun({
              text: `(${year}). `,
              size: 24,
              font: 'Times New Roman'
            }),
            new TextRun({
              text: `${title}. `,
              size: 24,
              font: 'Times New Roman'
            }),
            new TextRun({
              text: `${journal}. `,
              size: 24,
              font: 'Times New Roman',
              italics: true
            }),
            new TextRun({
              text: `PMID: ${pmid}. `,
              size: 24,
              font: 'Times New Roman'
            }),
            new TextRun({
              text: url,
              size: 24,
              font: 'Times New Roman',
              color: '0563C1',
              underline: {}
            })
          ],
          spacing: { after: 200 },
          indent: {
            left: convertInchesToTwip(0),
            hanging: convertInchesToTwip(0.5)
          },
          alignment: AlignmentType.LEFT
        })
      );

      refCounter++;
    }

    // Create document
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1)
            }
          }
        },
        children: sections
      }]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=Short_Summary_${studyType}_Studies_${new Date().toISOString().split('T')[0]}.docx`);
    
    res.send(buffer);

  } catch (error) {
    console.error('Error generating short summary document:', error);
    res.status(500).json({ 
      error: 'Failed to generate short summary document',
      details: error.message 
    });
  }
});

module.exports = router;
