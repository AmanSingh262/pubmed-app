const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');

// Import MeSH service for enhanced search
const meshService = require('../services/meshService');

// Configure multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only PDF, DOCX, TXT files
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
    }
  }
});

/**
 * Helper function to extract text from different file types
 */
async function extractTextFromFile(buffer, mimetype) {
  try {
    if (mimetype === 'text/plain') {
      // Plain text file
      return buffer.toString('utf-8');
    } else if (mimetype === 'application/pdf') {
      // PDF file - use pdf-parse library
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text;
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // DOCX file - use mammoth library
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    return '';
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw error;
  }
}

/**
 * Helper function to extract key medical terms and concepts from text
 * Enhanced version with better term extraction, bigrams, and medical term recognition
 */
function extractKeyTerms(text) {
  if (!text) return [];
  
  const words = text.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  // Enhanced stop words list
  const stopWords = new Set([
    'that', 'this', 'with', 'from', 'have', 'were', 'been', 'their', 'there', 
    'which', 'these', 'would', 'about', 'into', 'than', 'more', 'other', 'such', 
    'only', 'also', 'some', 'when', 'where', 'them', 'then', 'will', 'could', 
    'should', 'after', 'before', 'between', 'during', 'through', 'under', 'over',
    'very', 'using', 'used', 'found', 'showed', 'shown', 'data', 'results',
    'methods', 'conclusions', 'background', 'objectives', 'aims', 'however',
    'therefore', 'thus', 'although', 'since', 'while', 'whereas', 'study', 'studies'
  ]);
  
  // Medical keywords to prioritize (weight x5)
  const medicalKeywords = new Set([
    'pharmacokinetic', 'pharmacodynamic', 'efficacy', 'safety', 'toxicity',
    'adverse', 'clinical', 'trial', 'randomized', 'placebo', 'dose', 'treatment',
    'therapy', 'patient', 'disease', 'condition', 'diagnosis', 'prognosis',
    'metabolism', 'absorption', 'distribution', 'excretion', 'clearance',
    'bioavailability', 'protein', 'receptor', 'inhibitor', 'antagonist', 'agonist',
    'carcinogenicity', 'genotoxicity', 'mutagenicity', 'teratogenicity'
  ]);
  
  // Count single word frequency with medical term boosting
  const wordCount = {};
  words.forEach(word => {
    if (stopWords.has(word)) return;
    const boost = medicalKeywords.has(word) ? 5 : 1;
    wordCount[word] = (wordCount[word] || 0) + boost;
  });
  
  // Extract bigrams (2-word phrases) for better context
  const bigramCount = {};
  for (let i = 0; i < words.length - 1; i++) {
    if (stopWords.has(words[i]) || stopWords.has(words[i + 1])) continue;
    const bigram = `${words[i]} ${words[i + 1]}`;
    bigramCount[bigram] = (bigramCount[bigram] || 0) + 2; // Bigrams get 2x weight
  }
  
  // Extract trigrams (3-word phrases) for even better context
  const trigramCount = {};
  for (let i = 0; i < words.length - 2; i++) {
    if (stopWords.has(words[i]) || stopWords.has(words[i + 1]) || stopWords.has(words[i + 2])) continue;
    const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    trigramCount[trigram] = (trigramCount[trigram] || 0) + 3; // Trigrams get 3x weight
  }
  
  // Combine and get top terms
  const allTerms = { ...wordCount, ...bigramCount, ...trigramCount };
  const keyTerms = Object.entries(allTerms)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50) // Top 50 terms including phrases
    .map(([term]) => term);
  
  return keyTerms;
}

/**
 * Helper function to calculate similarity score between reference document and article
 * Enhanced with TF-IDF-like scoring, phrase matching, and context matching
 */
function calculateSimilarityScore(referenceKeyTerms, articleTitle, articleAbstract = '', drugName = null) {
  if (!referenceKeyTerms || referenceKeyTerms.length === 0) return 0;
  
  // Ensure title and abstract are strings
  const titleStr = typeof articleTitle === 'string' ? articleTitle : String(articleTitle || '');
  const abstractStr = typeof articleAbstract === 'string' ? articleAbstract : String(articleAbstract || '');
  
  const articleText = `${titleStr} ${abstractStr}`.toLowerCase();
  const titleLower = titleStr.toLowerCase();
  const abstractLower = abstractStr.toLowerCase();
  
  // PRIORITY: Check for drug name presence
  let hasDrugInTitle = false;
  let hasDrugInAbstract = false;
  let drugMatchCount = 0;
  
  if (drugName && drugName.trim().length > 0) {
    const drugLower = drugName.toLowerCase().trim();
    // Try exact match first
    const drugRegex = new RegExp(`\\b${drugLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    hasDrugInTitle = drugRegex.test(titleLower);
    hasDrugInAbstract = drugRegex.test(abstractLower);
    drugMatchCount = (articleText.match(drugRegex) || []).length;
    
    // Also try partial match if no exact match
    if (!hasDrugInTitle && !hasDrugInAbstract && drugLower.length >= 4) {
      hasDrugInTitle = titleLower.includes(drugLower);
      hasDrugInAbstract = abstractLower.includes(drugLower);
    }
  }
  
  let matchCount = 0;
  let weightedScore = 0;
  let titleBonus = 0;
  let abstractBonus = 0;
  let phraseMatchBonus = 0;
  
  referenceKeyTerms.forEach((term, index) => {
    const weight = referenceKeyTerms.length - index;
    const termLower = term.toLowerCase();
    
    // Check for exact term match
    if (articleText.includes(termLower)) {
      matchCount++;
      
      // Count occurrences with diminishing returns
      const titleOccurrences = (titleLower.match(new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length;
      const abstractOccurrences = (abstractLower.match(new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length;
      const totalOccurrences = titleOccurrences + abstractOccurrences;
      
      // Weighted scoring with logarithmic scaling to prevent over-weighting
      const occurrenceScore = Math.log(totalOccurrences + 1) * weight;
      weightedScore += occurrenceScore;
      
      // Title matches get massive bonus (5x weight)
      if (titleOccurrences > 0) {
        titleBonus += weight * 5 * titleOccurrences;
      }
      
      // Abstract matches get moderate bonus (2x weight)
      if (abstractOccurrences > 0) {
        abstractBonus += weight * 2;
      }
      
      // Phrase matches (bigrams/trigrams) get extra bonus
      if (term.includes(' ')) {
        phraseMatchBonus += weight * 3;
      }
    }
  });
  
  // Require minimum match coverage
  if (matchCount === 0) return 0;
  
  // Calculate base score with normalized weights
  const maxPossibleScore = referenceKeyTerms.reduce((sum, _, idx) => 
    sum + (referenceKeyTerms.length - idx), 0);
  
  const baseScore = (weightedScore / maxPossibleScore) * 40; // 40% weight for general matches
  const titleScore = (titleBonus / maxPossibleScore) * 35; // 35% weight for title matches (very important)
  const abstractScore = (abstractBonus / maxPossibleScore) * 15; // 15% weight for abstract matches
  const coverageScore = (matchCount / referenceKeyTerms.length) * 10; // 10% weight for term coverage
  
  let finalScore = baseScore + titleScore + abstractScore + coverageScore;
  
  // MASSIVE BOOST if drug name is present (PRIORITY FEATURE)
  if (hasDrugInTitle || hasDrugInAbstract) {
    const drugBoost = hasDrugInTitle ? 50 : 30; // 50 points for title, 30 for abstract
    const frequencyBoost = Math.min(drugMatchCount * 5, 20); // Up to 20 extra points for frequency
    finalScore = finalScore + drugBoost + frequencyBoost;
    
    // If has BOTH drug AND good keywords (score > 20), give additional multiplier
    if (finalScore > 20) {
      finalScore = finalScore * 1.3; // 30% boost for having BOTH drug and keywords
    }
  }
  
  return Math.min(100, Math.round(finalScore * 10) / 10);
}

/**
 * Helper function to categorize articles based on content
 * Enhanced with better pattern matching, multiple category support, and subheadings
 */
function categorizeArticles(articles, includeSubheadings = true) {
  const categorized = {
    'Pharmacokinetics': [],
    'Pharmacodynamics': [],
    'Efficacy & Clinical Trials': [],
    'Safety & Toxicity': []
  };
  
  // Subheading patterns for detailed categorization
  const subheadingPatterns = {
    'Absorption': /\b(?:absorption|bioavailability|cmax|tmax|peak concentration|time to peak|first[- ]pass|gastric|intestinal|oral)\b/i,
    'Distribution': /\b(?:distribution|volume of distribution|vd|tissue penetration|blood[- ]brain barrier|protein binding|plasma binding)\b/i,
    'Metabolism': /\b(?:metabolism|metabolite|biotransformation|cytochrome|cyp|p450|enzyme|oxidation|reduction|conjugation|glucuronidation)\b/i,
    'Excretion': /\b(?:excretion|elimination|clearance|renal|hepatic|biliary|urinary|half[- ]life|t1\/2)\b/i,
    'Method of Analysis': /\b(?:method|analysis|analytical|hplc|lc[- ]ms|mass spectrometry|chromatography|assay|quantification|detection|validation)\b/i,
    'Single Dose': /\b(?:single dose|single[- ]dose|one[- ]time dose|acute administration|single administration)\b/i,
    'Multiple Dose': /\b(?:multiple dose|multiple[- ]dose|repeated dose|chronic administration|steady[- ]state)\b/i,
    'Drug Interaction': /\b(?:drug interaction|interaction|concomitant|coadministration|combination therapy)\b/i,
    'Special Populations': /\b(?:pediatric|geriatric|elderly|renal impairment|hepatic impairment|pregnancy|lactation|children)\b/i
  };
  
  // Limit to top 50 per category
  const maxPerCategory = 50;
  
  articles.forEach(article => {
    const titleLower = (article.title || '').toLowerCase();
    const abstractLower = (article.abstract || '').toLowerCase();
    const combined = titleLower + ' ' + abstractLower;
    
    // Track which categories this article belongs to
    const matchedCategories = [];
    
    // Detect subheadings if enabled
    let subheadings = [];
    if (includeSubheadings) {
      Object.keys(subheadingPatterns).forEach(subheading => {
        if (subheadingPatterns[subheading].test(combined)) {
          subheadings.push(subheading);
        }
      });
    }
    
    // Pharmacokinetics - enhanced patterns
    if (combined.match(/\b(?:pharmacokinetic|pk|adme|absorption|distribution|metabolism|metabolite|excretion|clearance|half[- ]life|bioavailability|cmax|tmax|auc|volume of distribution|elimination|renal|hepatic)\b/i)) {
      matchedCategories.push('Pharmacokinetics');
    }
    
    // Pharmacodynamics - enhanced patterns
    if (combined.match(/\b(?:pharmacodynamic|pd|mechanism of action|receptor|binding|affinity|agonist|antagonist|inhibitor|enzyme|protein|pathway|signal|efficacy|potency|dose[- ]response|ic50|ec50)\b/i)) {
      matchedCategories.push('Pharmacodynamics');
    }
    
    // Efficacy & Clinical Trials - enhanced patterns
    if (combined.match(/\b(?:efficacy|effectiveness|treatment outcome|therapeutic|clinical trial|randomized|controlled|placebo|double[- ]blind|multicenter|phase [i1234]|primary endpoint|secondary endpoint|response rate|remission|improvement|benefit)\b/i)) {
      matchedCategories.push('Efficacy & Clinical Trials');
    }
    
    // Safety & Toxicity - enhanced patterns
    if (combined.match(/\b(?:safety|adverse event|side effect|toxicity|tolerability|contraindication|drug interaction|warning|precaution|mortality|morbidity|complication|risk|hazard|cardiotoxic|hepatotoxic|nephrotoxic|teratogenic)\b/i)) {
      matchedCategories.push('Safety & Toxicity');
    }
    
    // Add article to matched categories (limit to top 50 per category)
    if (matchedCategories.length > 0) {
      matchedCategories.forEach(category => {
        if (categorized[category].length < maxPerCategory) {
          categorized[category].push({
            ...article, 
            primaryCategory: matchedCategories[0],
            subheadings: subheadings.length > 0 ? subheadings : undefined
          });
        }
      });
    } else {
      // If no specific category, add to the first category that has space
      const firstAvailable = Object.keys(categorized).find(cat => categorized[cat].length < maxPerCategory);
      if (firstAvailable) {
        categorized[firstAvailable].push({
          ...article, 
          primaryCategory: 'General',
          subheadings: subheadings.length > 0 ? subheadings : undefined
        });
      }
    }
  });
  
  // Sort by ranking score when provided; otherwise fallback to similarity score.
  Object.keys(categorized).forEach(category => {
    categorized[category].sort((a, b) => {
      const rankingDelta = (b.rankingScore ?? b.similarityScore) - (a.rankingScore ?? a.similarityScore);
      if (rankingDelta !== 0) {
        return rankingDelta;
      }

      return b.similarityScore - a.similarityScore;
    });
  });
  
  return categorized;
}

const MINIMUM_SIMILARITY_THRESHOLD = 10;
const MINIMUM_ANOTHER_SIMILARITY_THRESHOLD = 3;
const MINIMUM_PREVALENCE_SIMILARITY_THRESHOLD = 8; // Balanced for prevalence studies (was 15, too strict)

// Recency boost based on publication year (EMA prioritizes 2021-2026)
function calculateRecencyBoost(publicationYear) {
  const year = parseInt(publicationYear, 10);
  if (!year || isNaN(year)) return 0;

  const currentYear = new Date().getFullYear();
  if (year >= currentYear - 2) return 5;  // 2024-2026
  if (year >= currentYear - 5) return 3;  // 2021-2023
  if (year >= currentYear - 8) return 1;  // 2017-2020
  return 0; // Older than 8 years
}

// Extract prevalence values from text (abstract/title)
function extractPrevalenceValue(title, abstract) {
  const text = `${title || ''} ${abstract || ''}`;

  // Patterns for prevalence values
  const patterns = [
    // "prevalence of X%" or "X% prevalence"
    /(?:prevalence\s+(?:was|is|of|were|:)?\s*)?(\d+\.?\d*)\s*%/i,
    /(\d+\.?\d*)\s*%\s*(?:overall\s+)?prevalence/i,
    // "X per 100,000" or "X per 100000"
    /(\d+\.?\d*)\s*(?:per\s+100[,\s]*?000|per\s+100000)\b/i,
    // "X cases per 100,000 population"
    /(\d+[,.]?\d*)\s*cases?\s*per\s*\d+/i,
    // "affecting X%" or "X% of population"
    /(?:affecting|in)\s+(\d+\.?\d*)\s*%/i,
    // "estimated prevalence: X%"
    /estimated\s+(?:prevalence|disease\s+burden)[:\s]+(\d+\.?\d*)\s*%/i,
    // "point prevalence: X%"
    /(?:point\s+)?prevalence[:\s]+(\d+\.?\d*)\s*%/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = parseFloat(match[1].replace(',', ''));
      if (value > 0 && value <= 100) {
        return {
          value: `${value}%`,
          rawValue: value,
          context: match[0].substring(0, 80)
        };
      } else if (value > 100) {
        // Likely per 100,000
        return {
          value: `${Math.round(value)} per 100,000`,
          rawValue: value,
          context: match[0].substring(0, 80)
        };
      }
    }
  }

  return null;
}

// Determine source authority tier for EMA compliance
function determineAuthorityTier(title, abstract, journal) {
  const text = `${title || ''} ${abstract || ''} ${journal || ''}`.toLowerCase();

  const tier1Signals = ['who', 'world health organization', 'global burden of disease', 'gbd', 'ihme', 'ema', 'comp', 'orphan drug', 'european medicines agency'];
  const tier2Signals = ['systematic review', 'meta-analysis', 'cochrane', ' NICE ', 'public health england', 'ukhsa', 'ecdc', 'eurostat'];
  const tier3Signals = ['cprd', 'qresearch', 'thins', 'clinical practice research datalink', 'uk biobank', 'ons', 'nhs digital'];

  const hasTier1 = tier1Signals.some(signal => text.includes(signal));
  if (hasTier1) return 1;

  const hasTier2 = tier2Signals.some(signal => text.includes(signal));
  if (hasTier2) return 2;

  const hasTier3 = tier3Signals.some(signal => text.includes(signal));
  if (hasTier3) return 3;

  return 4; // Default tier
}

// Generate EMA compliance note based on authority tier
function generateEMAComplianceNote(tier, title, journal, year) {
  const tierNotes = {
    1: `WHO/GBD/EMA source provides reliable and independent prevalence estimate for ERA Fpen refinement`,
    2: `Systematic review/meta-analysis provides peer-reviewed epidemiological data meeting EMA reliability standards`,
    3: `National registry data (NHS/CPRD/ONS) provides reliable and independent prevalence estimate for ERA`,
    4: `Peer-reviewed journal article provides epidemiological prevalence data for consideration in ERA`
  };

  return tierNotes[tier] || tierNotes[4];
}

function sanitizeQueryValue(value) {
  return String(value || '').replace(/"/g, '').trim();
}

function parseSelectedYears(rawYears) {
  if (!rawYears) {
    return [];
  }

  let candidateYears = [];

  if (Array.isArray(rawYears)) {
    candidateYears = rawYears;
  } else if (typeof rawYears === 'string') {
    const trimmed = rawYears.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith('[')) {
      try {
        const parsedYears = JSON.parse(trimmed);
        if (Array.isArray(parsedYears)) {
          candidateYears = parsedYears;
        }
      } catch (error) {
        candidateYears = [trimmed];
      }
    } else {
      candidateYears = trimmed.split(',');
    }
  } else {
    candidateYears = [rawYears];
  }

  return [...new Set(
    candidateYears
      .map(year => sanitizeQueryValue(year))
      .filter(year => /^(19|20)\d{2}$/.test(year))
  )];
}

function extractColumnKeyTermsFromTemplates(templates, maxTerms = 45) {
  if (!Array.isArray(templates) || templates.length === 0) {
    return [];
  }

  const stopWords = new Set([
    'and', 'or', 'not', 'with', 'from', 'that', 'this', 'those', 'these',
    'study', 'studies', 'review', 'data', 'results', 'using', 'used', 'between'
  ]);

  const phraseTerms = [];
  const singleTerms = [];

  templates.forEach(template => {
    const raw = String(template || '').trim();
    if (!raw) {
      return;
    }

    const quotedPhrases = raw.match(/"([^"]+)"/g) || [];
    quotedPhrases.forEach(phrase => {
      const cleanPhrase = phrase.replace(/"/g, '').trim().toLowerCase();
      if (cleanPhrase.length >= 4 && !stopWords.has(cleanPhrase)) {
        phraseTerms.push(cleanPhrase);
      }
    });

    const cleaned = raw
      .replace(/\[[^\]]+\]/g, ' ')
      .replace(/[()",]/g, ' ')
      .replace(/\bAND\b|\bOR\b|\bNOT\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    cleaned.split(' ').forEach(term => {
      if (term.length < 4 || /^\d+$/.test(term) || stopWords.has(term)) {
        return;
      }
      singleTerms.push(term);
    });
  });

  return [...new Set([...phraseTerms, ...singleTerms])].slice(0, maxTerms);
}

function extractSingleKeywordsFromTemplates(templates, maxKeywords = 180) {
  if (!Array.isArray(templates) || templates.length === 0) {
    return [];
  }

  const stopWords = new Set([
    'and', 'or', 'not', 'with', 'from', 'that', 'this', 'those', 'these',
    'study', 'studies', 'review', 'data', 'results', 'using', 'used', 'between'
  ]);

  const keywords = [];

  templates.forEach(template => {
    const cleaned = String(template || '')
      .replace(/\[[^\]]+\]/g, ' ')
      .replace(/[()",]/g, ' ')
      .replace(/\bAND\b|\bOR\b|\bNOT\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (!cleaned) {
      return;
    }

    cleaned.split(' ').forEach(term => {
      const normalized = term.replace(/\*/g, '').trim();
      if (!normalized || normalized.length < 4 || /^\d+$/.test(normalized) || stopWords.has(normalized)) {
        return;
      }
      keywords.push(normalized);
    });
  });

  return [...new Set(keywords)].slice(0, maxKeywords);
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordExistsInText(text, keyword) {
  const safeText = String(text || '').toLowerCase();
  const safeKeyword = String(keyword || '').toLowerCase().trim();

  if (!safeText || !safeKeyword) {
    return false;
  }

  if (safeKeyword.includes(' ')) {
    const pattern = new RegExp(`\\b${escapeRegex(safeKeyword).replace(/\\s+/g, '\\s+')}\\b`, 'i');
    return pattern.test(safeText);
  }

  const pattern = new RegExp(`\\b${escapeRegex(safeKeyword)}\\b`, 'i');
  return pattern.test(safeText);
}

function splitIntoSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/[.!?]\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function countKeywordOccurrences(text, keyword) {
  const safeText = String(text || '').toLowerCase();
  const safeKeyword = String(keyword || '').toLowerCase().trim();

  if (!safeText || !safeKeyword) {
    return 0;
  }

  const escapedKeyword = escapeRegex(safeKeyword).replace(/\s+/g, '\\s+');
  const pattern = new RegExp(`\\b${escapedKeyword}\\b`, 'gi');
  return safeText.match(pattern)?.length || 0;
}

function getDiseaseFocusDetails(title, abstract, meshTerms, diseaseName, diseaseMeshTerms = []) {
  const safeDisease = sanitizeQueryValue(diseaseName || '').toLowerCase();

  if (!safeDisease) {
    return {
      hasDisease: true,
      matchedDiseaseTerms: [],
      diseaseEvidence: []
    };
  }

  const titleText = String(title || '');
  const abstractText = String(abstract || '');
  const meshList = Array.isArray(meshTerms) ? meshTerms : [];
  const diseaseEvidence = [];
  const matchedDiseaseTerms = [];

  // Build list of all disease terms to check (original + MeSH synonyms)
  const allDiseaseTerms = [safeDisease];
  if (Array.isArray(diseaseMeshTerms) && diseaseMeshTerms.length > 0) {
    diseaseMeshTerms.forEach(term => {
      const normalized = sanitizeQueryValue(term || '').toLowerCase();
      if (normalized && normalized !== safeDisease && !allDiseaseTerms.includes(normalized)) {
        allDiseaseTerms.push(normalized);
      }
    });
  }

  const addEvidence = (evidenceType, matchedTerm) => {
    if (!diseaseEvidence.includes(evidenceType)) {
      diseaseEvidence.push(evidenceType);
    }
    const termToAdd = matchedTerm || safeDisease;
    if (!matchedDiseaseTerms.includes(termToAdd)) {
      matchedDiseaseTerms.push(termToAdd);
    }
  };

  // Check all disease terms (original + MeSH synonyms) against title
  for (const diseaseTerm of allDiseaseTerms) {
    if (keywordExistsInText(titleText, diseaseTerm)) {
      addEvidence('title', diseaseTerm);
    }
  }

  // Check against article MeSH terms
  for (const diseaseTerm of allDiseaseTerms) {
    if (meshList.some(term => keywordExistsInText(term, diseaseTerm))) {
      addEvidence('mesh', diseaseTerm);
    }
  }

  // Check first 2 sentences of abstract
  const abstractSentences = splitIntoSentences(abstractText);
  const firstAbstractSentences = abstractSentences.slice(0, 2).join(' ');
  for (const diseaseTerm of allDiseaseTerms) {
    if (keywordExistsInText(firstAbstractSentences, diseaseTerm)) {
      addEvidence('earlyAbstract', diseaseTerm);
    }
  }

  const prevalenceFocusTerms = [
    'prevalence',
    'epidemiology',
    'epidemiologic',
    'incidence',
    'disease burden',
    'population-based',
    'registry',
    'survey',
    'per 100',
    'per 100,000'
  ];
  // Check disease + prevalence co-occurrence in sentences
  for (const diseaseTerm of allDiseaseTerms) {
    const diseaseSentences = abstractSentences.filter(sentence => keywordExistsInText(sentence, diseaseTerm));
    if (diseaseSentences.some(sentence => prevalenceFocusTerms.some(term => keywordExistsInText(sentence, term)))) {
      addEvidence('prevalenceSentence', diseaseTerm);
    }
  }

  // Check repeated mentions in abstract
  for (const diseaseTerm of allDiseaseTerms) {
    if (countKeywordOccurrences(abstractText, diseaseTerm) >= 2) {
      addEvidence('repeatedAbstract', diseaseTerm);
    }
  }

  // STRONG evidence: disease must appear in title, MeSH, or early abstract (not just buried in text)
  const hasStrongEvidence = diseaseEvidence.some(e =>
    ['title', 'mesh', 'earlyAbstract'].includes(e)
  );

  return {
    hasDisease: hasStrongEvidence,
    matchedDiseaseTerms,
    diseaseEvidence
  };
}

function countPhraseHits(text, phrases) {
  return phrases.reduce((count, phrase) => (text.includes(phrase) ? count + 1 : count), 0);
}

function calculatePrevalencePriorityBoost(title, abstract) {
  const titleLower = String(title || '').toLowerCase();
  const abstractLower = String(abstract || '').toLowerCase();

  const systematicReviewSignals = ['systematic review', 'meta-analysis', 'meta analysis', 'pooled analysis'];
  const registrySignals = ['registry', 'national registry', 'disease registry', 'patient registry', 'population registry'];
  const populationStudySignals = ['population-based', 'cross-sectional', 'cohort study', 'cohort', 'survey'];
  const epidemiologySignals = ['epidemiology', 'epidemiologic', 'incidence', 'prevalence', 'prevalence rate', 'disease burden'];
  const sourceAuthoritySignals = ['who europe', 'ecdc', 'eurostat', 'global burden of disease', 'gbd', 'ihme'];

  const systematicTitleHits = countPhraseHits(titleLower, systematicReviewSignals);
  const systematicAbstractHits = countPhraseHits(abstractLower, systematicReviewSignals);
  const registryTitleHits = countPhraseHits(titleLower, registrySignals);
  const registryAbstractHits = countPhraseHits(abstractLower, registrySignals);
  const populationTitleHits = countPhraseHits(titleLower, populationStudySignals);
  const populationAbstractHits = countPhraseHits(abstractLower, populationStudySignals);
  const epidemiologyTitleHits = countPhraseHits(titleLower, epidemiologySignals);
  const epidemiologyAbstractHits = countPhraseHits(abstractLower, epidemiologySignals);
  const authorityTitleHits = countPhraseHits(titleLower, sourceAuthoritySignals);
  const authorityAbstractHits = countPhraseHits(abstractLower, sourceAuthoritySignals);

  let boost = 0;

  if (systematicTitleHits > 0) {
    boost += 32 + (systematicTitleHits - 1) * 4;
  } else if (systematicAbstractHits > 0) {
    boost += 20 + (systematicAbstractHits - 1) * 2;
  }

  if (registryTitleHits > 0) {
    boost += 30 + (registryTitleHits - 1) * 3;
  } else if (registryAbstractHits > 0) {
    boost += 18 + (registryAbstractHits - 1) * 2;
  }

  boost += Math.min(populationTitleHits * 8 + populationAbstractHits * 4, 16);
  boost += Math.min(epidemiologyTitleHits * 5 + epidemiologyAbstractHits * 2, 14);
  boost += Math.min(authorityTitleHits * 6 + authorityAbstractHits * 3, 12);

  const hasSystematicSignal = (systematicTitleHits + systematicAbstractHits) > 0;
  const hasRegistrySignal = (registryTitleHits + registryAbstractHits) > 0;
  if (hasSystematicSignal && hasRegistrySignal) {
    boost += 16;
  }

  if ((hasSystematicSignal || hasRegistrySignal) && titleLower.includes('prevalence')) {
    boost += 8;
  }

  return Math.min(90, Math.round(boost * 10) / 10);
}

function detectPotentialDrugNames(extractedText) {
  const text = String(extractedText || '');
  if (!text.trim()) {
    return [];
  }

  const medicationContextPattern = /\b(drug|medication|therapy|treatment|dose|dosage|administered|tablet|capsule|injection|solution|suspension|regimen|posology|pharmaceutical|compound|active ingredient)\b/i;
  const nonDrugTerms = new Set([
    'the', 'this', 'that', 'with', 'from', 'table', 'figure', 'introduction', 'methods', 'results',
    'conclusion', 'conclusions', 'discussion', 'background', 'study', 'studies', 'review', 'europe',
    'england', 'uk', 'disease', 'diseases', 'syndrome', 'infection', 'infections', 'virus', 'viral',
    'bacterial', 'fever', 'prevalence', 'epidemiology', 'incidence', 'population', 'registry', 'survey'
  ]);

  const candidates = [];

  text.split(/[.!?\n]+/).forEach(fragment => {
    const sentence = fragment.trim();
    if (!sentence || !medicationContextPattern.test(sentence)) {
      return;
    }

    const matches = sentence.match(/\b([A-Z][A-Za-z0-9-]{2,})\b/g) || [];
    matches.forEach(match => {
      const normalized = String(match || '').trim();
      const lower = normalized.toLowerCase();

      if (!normalized || nonDrugTerms.has(lower)) {
        return;
      }

      // Avoid random alphanumeric tokens unless they look like common dosage notations.
      if (/\d/.test(normalized) && !/\d+(mg|mcg|g|ml)$/i.test(normalized)) {
        return;
      }

      candidates.push(normalized);
    });
  });

  return [...new Set(candidates)].slice(0, 3);
}

function buildDefaultReferenceSearchQuery({ keyTerms, userDrugName, drugNames, doseForm, indication }) {
  let searchQuery = '';
  const boostTerms = [];

  if (userDrugName && userDrugName.trim().length > 0) {
    searchQuery = `"${sanitizeQueryValue(userDrugName)}"[Title/Abstract]`;

    if (doseForm && doseForm !== 'not-applicable') {
      boostTerms.push(`"${sanitizeQueryValue(doseForm)}"[Title/Abstract]`);
    }

    if (indication && indication.trim().length > 0 && indication.toLowerCase() !== 'not applicable') {
      boostTerms.push(`"${sanitizeQueryValue(indication)}"[Title/Abstract]`);
    }

    const topTerms = keyTerms.slice(0, 8).map(term => `${sanitizeQueryValue(term)}[Title/Abstract]`).join(' OR ');
    if (boostTerms.length > 0) {
      searchQuery = `(${searchQuery}) AND ((${topTerms}) OR (${boostTerms.join(' OR ')}))`;
    } else {
      searchQuery = `(${searchQuery}) AND (${topTerms})`;
    }

    return searchQuery;
  }

  if (drugNames.length > 0) {
    searchQuery = drugNames.map(name => `"${sanitizeQueryValue(name)}"[Title/Abstract]`).join(' OR ');

    if (doseForm && doseForm !== 'not-applicable') {
      boostTerms.push(`"${sanitizeQueryValue(doseForm)}"[Title/Abstract]`);
    }

    if (indication && indication.trim().length > 0 && indication.toLowerCase() !== 'not applicable') {
      boostTerms.push(`"${sanitizeQueryValue(indication)}"[Title/Abstract]`);
    }

    const topTerms = keyTerms.slice(0, 8).map(term => `${sanitizeQueryValue(term)}[Title/Abstract]`).join(' OR ');
    if (boostTerms.length > 0) {
      searchQuery = `(${searchQuery}) OR (${topTerms}) OR (${boostTerms.join(' OR ')})`;
    } else {
      searchQuery = `(${searchQuery}) OR (${topTerms})`;
    }

    return searchQuery;
  }

  searchQuery = keyTerms.slice(0, 15).map(term => `${sanitizeQueryValue(term)}[Title/Abstract]`).join(' OR ');

  if (doseForm && doseForm !== 'not-applicable') {
    boostTerms.push(`"${sanitizeQueryValue(doseForm)}"[Title/Abstract]`);
  }

  if (indication && indication.trim().length > 0 && indication.toLowerCase() !== 'not applicable') {
    boostTerms.push(`"${sanitizeQueryValue(indication)}"[Title/Abstract]`);
  }

  if (boostTerms.length > 0) {
    searchQuery = `(${searchQuery}) OR (${boostTerms.join(' OR ')})`;
  }

  return searchQuery;
}

/**
 * Build MeSH-enhanced search templates for better context understanding
 * Uses MeSH terms from NCBI API for accurate disease/drug matching
 */
function buildMeshEnhancedTemplates(diseaseName, drugName, diseaseMesh, drugMesh, country = '') {
  const templates = [];
  const safeDisease = sanitizeQueryValue(diseaseName);
  const safeDrug = sanitizeQueryValue(drugName);
  const safeCountry = sanitizeQueryValue(country);

  // Get search terms from MeSH (fallback to original term if no MeSH found)
  const diseaseTerms = (diseaseMesh?.searchTerms?.length > 0)
    ? diseaseMesh.searchTerms
    : [safeDisease];

  const drugTerms = (drugMesh?.searchTerms?.length > 0)
    ? drugMesh.searchTerms
    : (safeDrug ? [safeDrug] : []);

  // 1. MeSH-based exact match (highest priority)
  if (drugTerms.length > 0 && diseaseTerms.length > 0) {
    drugTerms.forEach(drug => {
      diseaseTerms.forEach(disease => {
        // Exact MeSH match with prevalence
        templates.push(
          `("${drug}"[MeSH Terms] OR "${drug}"[tiab]) AND ("${disease}"[MeSH Terms] OR "${disease}"[tiab]) AND "prevalence"[MeSH Terms]`
        );
        templates.push(
          `("${drug}"[MeSH Terms] OR "${drug}"[tiab]) AND ("${disease}"[MeSH Terms] OR "${disease}"[tiab]) AND "epidemiology"[MeSH Terms]`
        );
      });
    });
  }

  // 2. MeSH major topic search (focused)
  if (diseaseTerms.length > 0) {
    diseaseTerms.forEach(disease => {
      templates.push(
        `"${disease}"[MeSH Terms:exp] AND "prevalence"[MeSH Terms]`
      );
      templates.push(
        `"${disease}"[MeSH Terms:exp] AND ("prevalence"[tiab] OR "epidemiology"[tiab]) AND "Europe"[tiab]`
      );
      templates.push(
        `"${disease}"[MeSH Terms:exp] AND ("systematic review"[pt] OR "meta-analysis"[pt]) AND "Europe"[tiab]`
      );
    });
  }

  // 3. Combined title/abstract with MeSH
  if (diseaseTerms.length > 0) {
    diseaseTerms.forEach(disease => {
      templates.push(
        `("${disease}"[Title/Abstract] OR "${disease}"[MeSH Terms]) AND "prevalence"[Title/Abstract]`
      );
      templates.push(
        `("${disease}"[Title/Abstract] OR "${disease}"[MeSH Terms]) AND ("prevalence" OR "epidemiology" OR "incidence")[Title/Abstract]`
      );
      templates.push(
        `("${disease}"[Title/Abstract] OR "${disease}"[MeSH Terms]) AND "population-based"[Title/Abstract]`
      );
    });
  }

  // 4. Add country filter to MeSH queries (with Europe fallback)
  if (safeCountry) {
    const countryTemplates = [];
    const countryFilter = safeCountry.toLowerCase() !== 'europe'
      ? `"${safeCountry}"[tiab] OR "Europe"[tiab] OR "European"[tiab]`
      : `"${safeCountry}"[tiab]`;
    templates.forEach(t => {
      countryTemplates.push(`(${t}) AND (${countryFilter})`);
    });
    return countryTemplates;
  }

  // Limit templates to avoid overly complex queries
  return templates.slice(0, 20);
}

function buildPrevalenceKeywordTemplates(diseaseName, country, drugName = '') {
  const prioritizedTemplates = [];

  const safeDisease = sanitizeQueryValue(diseaseName);
  const safeCountry = sanitizeQueryValue(country);
  const safeDrug = sanitizeQueryValue(drugName);

  // CRITICAL: Disease name MUST be present in every template
  // Generic templates without disease name caused irrelevant results (e.g., rhinosinusitis for diabetes search)
  const D = safeDisease; // shorthand

  // --- Templates that ALWAYS require disease name ---

  // Tier 1: Disease + prevalence + European data sources (highest priority)
  const templates = D ? [
    `"${D}"[tiab] AND ("prevalence"[tiab] OR "epidemiology"[tiab]) AND "Europe"[tiab] AND "systematic review"[pt]`,
    `"${D}"[tiab] AND ("disease prevalence"[tiab] OR "population-based study"[tiab]) AND "Europe"[tiab]`,
    `"${D}"[tiab] AND "prevalence"[tiab] AND ("European Union"[tiab] OR "EU27"[tiab]) AND "meta-analysis"[pt]`,
    `"${D}"[tiab] AND "prevalence"[tiab] AND "Europe"[tiab] AND ("per 100 inhabitants"[tiab] OR "per 100,000"[tiab])`,
    `"${D}"[tiab] AND "disease burden"[tiab] AND "Europe"[tiab] AND "epidemiological data"[tiab]`,
    `"${D}"[tiab] AND "patient population"[tiab] AND "Europe"[tiab] AND "prevalence estimate"[tiab]`,
    `"${D}"[tiab] AND "prevalence rate"[tiab] AND "European"[tiab] AND "cross-sectional"[tiab]`,
    `"${D}"[tiab] AND ("incidence"[tiab] AND "prevalence"[tiab]) AND "Europe"[tiab] AND "cohort study"[tiab]`,
    `"${D}"[tiab] AND "national registry"[tiab] AND "Europe"[tiab] AND "disease statistics"[tiab]`,
    `"${D}"[tiab] AND ("WHO Europe"[tiab] OR "World Health Organization Europe"[tiab]) AND "prevalence"[tiab] AND "epidemiology"[tiab]`,
    `"${D}"[tiab] AND ("ECDC"[tiab] OR "European Centre for Disease Prevention"[tiab]) AND "prevalence"[tiab] AND "surveillance"[tiab]`,
    `"${D}"[tiab] AND "Eurostat"[tiab] AND "health statistics"[tiab] AND "prevalence"[tiab]`,
    `"${D}"[tiab] AND ("GBD"[tiab] OR "Global Burden of Disease"[tiab]) AND "prevalence"[tiab] AND "Europe"[tiab]`,
    `"${D}"[tiab] AND ("IHME"[tiab] OR "Institute for Health Metrics"[tiab]) AND "prevalence"[tiab] AND "European"[tiab]`,
    `"${D}"[tiab] AND ("systematic review"[pt] OR "meta-analysis"[pt]) AND "prevalence"[tiab] AND "Europe"[tiab]`,
    `"${D}"[tiab] AND "population-based"[tiab] AND "prevalence"[tiab] AND ("EU Member State"[tiab] OR "European"[tiab])`,
    `"${D}"[tiab] AND "observational study"[tiab] AND "prevalence"[tiab] AND "European"[tiab] AND "adults"[tiab]`,
    `"${D}"[tiab] AND ("survey"[tiab] OR "health survey"[tiab]) AND "prevalence"[tiab] AND "European population"[tiab]`,
    `"${D}"[tiab] AND "registry data"[tiab] AND "prevalence"[tiab] AND "European"[tiab] AND "patients"[tiab]`,
    // UK-specific data sources
    `"${D}"[tiab] AND "prevalence"[tiab] AND "United Kingdom"[tiab] AND "population-based"[tiab]`,
    `"${D}"[tiab] AND "disease prevalence"[tiab] AND ("England"[tiab] OR "UK"[tiab]) AND "NHS"[tiab]`,
    `"${D}"[tiab] AND ("CPRD"[tiab] OR "Clinical Practice Research Datalink"[tiab]) AND "prevalence"[tiab]`,
    `"${D}"[tiab] AND ("QResearch"[tiab] OR "primary care"[tiab]) AND "prevalence"[tiab] AND "England"[tiab]`,
    `"${D}"[tiab] AND ("ONS"[tiab] OR "Office for National Statistics"[tiab]) AND "prevalence"[tiab]`,
    `"${D}"[tiab] AND ("Public Health England"[tiab] OR "UKHSA"[tiab]) AND "prevalence"[tiab] AND "surveillance"[tiab]`,
    `"${D}"[tiab] AND "NHS Digital"[tiab] AND "prevalence"[tiab] AND ("England"[tiab] OR "UK"[tiab])`,
    `"${D}"[tiab] AND "NICE"[tiab] AND "epidemiology"[tiab] AND "prevalence"[tiab] AND "UK"[tiab]`,
    `"${D}"[tiab] AND "Health Survey for England"[tiab] AND "prevalence"[tiab]`
  ] : [];

  // --- Drug + Disease combination templates ---
  if (safeDrug && safeDisease) {
    prioritizedTemplates.push(
      `"${safeDrug}"[tiab] AND "${safeDisease}"[tiab] AND ("prevalence"[tiab] OR "epidemiology"[tiab])`,
      `"${safeDrug}"[tiab] AND "${safeDisease}"[tiab] AND ("population-based"[tiab] OR "cross-sectional"[tiab] OR "registry"[tiab])`,
      `"${safeDrug}"[tiab] AND "${safeDisease}"[tiab] AND ("Europe"[tiab] OR "United Kingdom"[tiab]) AND ("prevalence"[tiab] OR "epidemiology"[tiab])`
    );

    if (safeCountry) {
      prioritizedTemplates.push(
        `"${safeDrug}"[tiab] AND "${safeDisease}"[tiab] AND "${safeCountry}"[tiab] AND ("prevalence"[tiab] OR "epidemiology"[tiab])`
      );
    }
  } else if (safeDrug) {
    prioritizedTemplates.push(
      `"${safeDrug}"[tiab] AND ("prevalence"[tiab] OR "epidemiology"[tiab]) AND "Europe"[tiab]`,
      `"${safeDrug}"[tiab] AND "disease burden"[tiab] AND "Europe"[tiab]`
    );
  }

  // --- Disease-specific templates (highest relevance) ---
  if (safeDisease) {
    prioritizedTemplates.push(
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND "Europe"[tiab] AND "systematic review"[pt]`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND ("EU"[tiab] OR "European Union"[tiab]) AND "meta-analysis"[pt]`,
      `"${safeDisease}"[tiab] AND "epidemiology"[tiab] AND "Europe"[tiab] AND "population-based"[tiab]`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND "European population"[tiab] AND "adults"[tiab]`,
      `"${safeDisease}"[tiab] AND "disease burden"[tiab] AND "Europe"[tiab] AND ("DALY"[tiab] OR "disability-adjusted life year"[tiab])`,
      `"${safeDisease}"[tiab] AND ("per 100 inhabitants"[tiab] OR "per 100,000"[tiab]) AND "Europe"[tiab]`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND ("ECDC"[tiab] OR "European Centre for Disease Prevention"[tiab])`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND ("WHO Europe"[tiab] OR "World Health Organization"[tiab])`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND ("Global Burden of Disease"[tiab] OR "GBD"[tiab]) AND "Europe"[tiab]`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND "United Kingdom"[tiab]`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND "England"[tiab] AND "NHS"[tiab]`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND "UK"[tiab] AND "population-based study"[tiab]`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND "UK"[tiab] AND ("primary care"[tiab] OR "general practice"[tiab])`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND ("CPRD"[tiab] OR "Clinical Practice Research Datalink"[tiab])`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND "QResearch"[tiab] AND "England"[tiab]`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND "UK Biobank"[tiab]`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND ("ONS"[tiab] OR "Office for National Statistics"[tiab])`,
      `"${safeDisease}"[tiab] AND "NICE"[tiab] AND "epidemiology"[tiab] AND "prevalence"[tiab]`,
      `"${safeDisease}"[tiab] AND "epidemiology"[tiab] AND ("EU"[tiab] OR "European Union"[tiab]) AND ("adults"[tiab] OR "population"[tiab])`,
      `"${safeDisease}"[tiab] AND "one-year prevalence"[tiab] AND "Europe"[tiab]`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND ("WHO"[tiab] OR "Global Burden of Disease"[tiab] OR "GBD"[tiab]) AND ("Europe"[tiab] OR "UK"[tiab])`,
      `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND ("CPRD"[tiab] OR "QResearch"[tiab] OR "THIN"[tiab]) AND "England"[tiab]`
    );

    if (safeCountry) {
      prioritizedTemplates.push(
        `"${safeDisease}"[tiab] AND "annual prevalence"[tiab] AND "${safeCountry}"[tiab]`,
        `"${safeDisease}"[tiab] AND "prevalence"[tiab] AND "${safeCountry}"[tiab]`
      );
    }
  }

  return [...new Set([...prioritizedTemplates, ...templates])];
}

function buildAnotherKeywordTemplates(drugName, diseaseName, indication) {
  const prioritizedTemplates = [
    '"environmental risk assessment"[tiab] AND "pharmaceutical"[tiab]',
    '("pharmaceuticals"[tiab] AND "environmental contamination"[tiab])',
    '("pharmaceutical"[tiab] AND "surface water"[tiab])',
    '("pharmaceutical"[tiab] AND "ecotoxicity"[tiab])',
    '("ERA"[tiab] AND "medicinal products"[tiab])'
  ];

  const templates = [
    '"environmental risk assessment"[tiab] AND "medicinal products"[tiab] AND ("human use"[tiab] OR "pharmaceuticals"[tiab])',
    '"pharmaceutical"[tiab] AND "environmental risk assessment"[tiab] AND ("EMA guideline"[tiab] OR "EMEA"[tiab] OR "CHMP"[tiab])',
    '"Module 1.6"[tiab] AND "marketing authorisation"[tiab] AND "environmental risk assessment"[tiab]',
    '"pharmaceutical"[tiab] AND "environmental contamination"[tiab] AND "review"[pt]',
    '"FPEN"[tiab] AND "disease prevalence"[tiab] AND ("pharmaceutical"[tiab] OR "ERA"[tiab])',
    '"European prevalence"[tiab] AND "peer-reviewed"[tiab] AND "population"[tiab]',
    '"PREGION"[tiab] AND "prevalence"[tiab] AND ("pharmaceutical"[tiab] OR "ERA"[tiab])',
    '"treatment regimen"[tiab] AND ("FPEN"[tiab] OR "environmental exposure"[tiab]) AND "pharmaceutical"[tiab]',
    '"predicted environmental concentration"[tiab] AND "surface water"[tiab] AND "pharmaceutical"[tiab]',
    '"market penetration factor"[tiab] AND ("FPEN"[tiab] OR "pharmaceutical"[tiab]) AND "ERA"[tiab]',
    '"PECsw"[tiab] AND ("FPEN"[tiab] OR "default"[tiab]) AND "pharmaceutical"[tiab]',
    '"action limit"[tiab] AND "0.01"[tiab] AND "pharmaceutical"[tiab] AND "ERA"[tiab]',
    '"wastewater"[tiab] AND "pharmaceutical"[tiab] AND ("200 L"[tiab] OR "per inhabitant"[tiab]) AND "ERA"[tiab]',
    '"water solubility"[tiab] AND "OECD 105"[tiab] AND "pharmaceutical"[tiab]',
    '("log Kow"[tiab] OR "octanol water partition"[tiab]) AND "OECD 107"[tiab] AND "pharmaceutical"[tiab]',
    '"pKa"[tiab] AND "dissociation constant"[tiab] AND ("OECD 112"[tiab] OR "pharmaceutical"[tiab])',
    '("KFOC"[tiab] OR "Freundlich adsorption"[tiab]) AND "OECD 106"[tiab] AND "pharmaceutical"[tiab]',
    '"ready biodegradability"[tiab] AND "OECD 301"[tiab] AND "pharmaceutical"[tiab]',
    '"STP removal"[tiab] AND "pharmaceutical"[tiab] AND "activated sludge"[tiab]',
    '("SimpleTreat"[tiab] OR "STPWIN"[tiab]) AND "pharmaceutical"[tiab] AND "wastewater"[tiab]',
    '"algae growth inhibition"[tiab] AND "OECD 201"[tiab] AND "pharmaceutical"[tiab]',
    '"Daphnia magna"[MeSH Terms] AND "acute immobilisation"[tiab] AND "OECD 202"[tiab]',
    '"fish"[tiab] AND "acute toxicity"[tiab] AND "OECD 203"[tiab] AND ("LC50"[tiab] OR "pharmaceutical"[tiab])',
    '"Daphnia magna"[MeSH Terms] AND "reproduction"[tiab] AND "OECD 211"[tiab] AND "NOEC"[tiab]',
    '"fish early life stage"[tiab] AND "OECD 210"[tiab] AND "NOEC"[tiab] AND "pharmaceutical"[tiab]',
    '"activated sludge respiration inhibition"[tiab] AND "OECD 209"[tiab] AND "pharmaceutical"[tiab]',
    '("PNEC"[tiab] OR "predicted no effect concentration"[tiab]) AND "assessment factor"[tiab] AND ("AF 1000"[tiab] OR "QSAR"[tiab])',
    '("ECOSAR"[tiab] OR "QSAR"[tiab]) AND "ecotoxicity"[tiab] AND "pharmaceutical"[tiab]',
    '"PBT"[tiab] AND ("REACH Annex XIII"[tiab] OR "persistent bioaccumulative toxic"[tiab]) AND "pharmaceutical"[tiab]',
    '"persistence"[tiab] AND ("DT50"[tiab] OR "half-life"[tiab]) AND "pharmaceutical"[tiab] AND ("P criterion"[tiab] OR "sediment"[tiab])',
    '"bioaccumulation"[tiab] AND ("BCF"[tiab] OR "bioconcentration factor"[tiab]) AND "pharmaceutical"[tiab]',
    '("vPvB"[tiab] OR "very persistent very bioaccumulative"[tiab]) AND "pharmaceutical"[tiab]',
    '"OECD 308"[tiab] AND ("water sediment"[tiab] OR "sediment"[tiab]) AND ("DT50"[tiab] OR "persistence"[tiab]) AND "pharmaceutical"[tiab]',
    '("BCFBAF"[tiab] OR "EPI Suite"[tiab]) AND "bioaccumulation"[tiab] AND "pharmaceutical"[tiab]',
    '"PNECsw"[tiab] AND "chronic NOEC"[tiab] AND "pharmaceutical"[tiab]',
    '("RQsw"[tiab] OR "risk quotient"[tiab]) AND "surface water"[tiab] AND "pharmaceutical"[tiab] AND "ERA"[tiab]',
    '"PECsed"[tiab] AND "equilibrium partitioning"[tiab] AND ("pharmaceutical"[tiab] OR "sediment"[tiab])',
    '"Chironomus riparius"[MeSH Terms] AND "OECD 218"[tiab] AND "pharmaceutical"[tiab]',
    '"PECgw"[tiab] AND ("bank filtration"[tiab] OR "groundwater"[tiab]) AND "pharmaceutical"[tiab]',
    '"drinking water"[tiab] AND "0.1 µg/L"[tiab] AND "pharmaceutical"[tiab] AND "groundwater"[tiab]',
    '"secondary poisoning"[tiab] AND ("BCF"[tiab] OR "biomagnification"[tiab]) AND "pharmaceutical"[tiab] AND "ERA"[tiab]',
    '"CRED method"[tiab] AND "ecotoxicity data"[tiab] AND ("reliability"[tiab] OR "Moermond"[tiab])',
    '"Klimisch score"[tiab] AND "pharmaceutical"[tiab] AND ("ecotoxicity"[tiab] OR "environmental study"[tiab])',
    '("GLP"[tiab] OR "good laboratory practice"[tiab]) AND "OECD guideline"[tiab] AND "pharmaceutical"[tiab] AND "environmental"[tiab]'
  ];

  const safeDrug = drugName ? sanitizeQueryValue(drugName) : '';
  const safeDisease = diseaseName ? sanitizeQueryValue(diseaseName) : '';

  if (safeDisease) {
    prioritizedTemplates.push(
      `"${safeDisease}"[tiab] AND ("environmental risk assessment"[tiab] OR "pharmaceutical"[tiab])`,
      `"${safeDisease}"[tiab] AND ("surface water"[tiab] OR "ecotoxicity"[tiab]) AND "pharmaceutical"[tiab]`
    );
  }

  if (safeDrug) {
    prioritizedTemplates.push(
      `"${safeDrug}"[tiab] AND ("environmental risk assessment"[tiab] OR "surface water"[tiab] OR "ecotoxicity"[tiab])`,
      `"${safeDrug}"[tiab] AND "treatment duration"[tiab] AND ("treatment episodes"[tiab] OR "posology"[tiab])`,
      `"${safeDrug}"[tiab] AND "PBT assessment"[tiab] AND ("persistence"[tiab] OR "bioaccumulation"[tiab] OR "toxicity"[tiab])`
    );
  }

  const safeIndication = indication ? sanitizeQueryValue(indication) : '';
  if (safeIndication) {
    prioritizedTemplates.push(
      `"${safeIndication}"[tiab] AND "environmental risk assessment"[tiab] AND "pharmaceutical"[tiab]`
    );
  }

  return [...new Set([...prioritizedTemplates, ...templates])];
}

function getMandatoryMatchDetails(title, abstract, mandatoryTerms, meshTerms = [], diseaseMeshTerms = []) {
  if (!mandatoryTerms || !mandatoryTerms.enforce) {
    return {
      isMatch: true,
      matchedPrevalenceKeywords: [],
      matchedDiseaseTerms: [],
      diseaseEvidence: [],
      hasDrug: true,
      hasDisease: true,
      hasPrevalence: true
    };
  }

  const text = `${String(title || '')} ${String(abstract || '')}`.toLowerCase();
  const requiredDrug = sanitizeQueryValue(mandatoryTerms.drugName || '').toLowerCase();
  const requiredDisease = sanitizeQueryValue(mandatoryTerms.diseaseName || '').toLowerCase();
  const prevalenceKeywords = (mandatoryTerms.prevalenceKeywords || [])
    .map(k => String(k || '').toLowerCase())
    .filter(Boolean);

  const hasDrug = requiredDrug ? keywordExistsInText(text, requiredDrug) : true;
  const diseaseFocusDetails = getDiseaseFocusDetails(title, abstract, meshTerms, requiredDisease, diseaseMeshTerms);
  const hasDisease = requiredDisease ? diseaseFocusDetails.hasDisease : true;
  const matchedPrevalenceKeywords = prevalenceKeywords.filter(keyword => keywordExistsInText(text, keyword));
  const hasPrevalence = prevalenceKeywords.length === 0
    ? true
    : matchedPrevalenceKeywords.length > 0;

  return {
    isMatch: hasDrug && hasDisease && hasPrevalence,
    matchedPrevalenceKeywords,
    matchedDiseaseTerms: diseaseFocusDetails.matchedDiseaseTerms,
    diseaseEvidence: diseaseFocusDetails.diseaseEvidence,
    hasDrug,
    hasDisease,
    hasPrevalence
  };
}

function buildColumnSearchQuery({
  templates,
  country,
  year,
  years = [],
  diseaseName,
  maxTemplates = 20,
  maxQueryLength = 2200,
  applyCountryFilter = true,
  applyYearFilter = true,
  applyDiseaseFilter = true
}) {
  const normalizedTemplates = templates
    .map(template => template && template.trim())
    .filter(Boolean);

  const filters = [];
  const safeCountry = sanitizeQueryValue(country);
  const safeYears = [...new Set([
    ...(Array.isArray(years) ? years : []),
    ...(year ? [year] : [])
  ]
    .map(yearValue => sanitizeQueryValue(yearValue))
    .filter(yearValue => /^(19|20)\d{2}$/.test(yearValue)))];
  const safeDisease = sanitizeQueryValue(diseaseName);

  if (applyCountryFilter && safeCountry) {
    // Include "Europe" as fallback when a specific country is selected
    if (safeCountry.toLowerCase() !== 'europe') {
      filters.push(`("${safeCountry}"[tiab] OR "Europe"[tiab] OR "European"[tiab])`);
    } else {
      filters.push(`("${safeCountry}"[tiab])`);
    }
  }

  if (applyYearFilter && safeYears.length === 1) {
    filters.push(`(${safeYears[0]}[dp])`);
  } else if (applyYearFilter && safeYears.length > 1) {
    filters.push(`(${safeYears.map(yearValue => `${yearValue}[dp]`).join(' OR ')})`);
  }

  if (applyDiseaseFilter && safeDisease) {
    // Strict disease filter: require disease in title, abstract, OR MeSH Terms
    // MeSH Terms catches articles properly indexed even if disease name not in text
    filters.push(`("${safeDisease}"[tiab] OR "${safeDisease}"[MeSH Terms])`);
  }

  const selectedClauses = [];
  for (const template of normalizedTemplates) {
    if (selectedClauses.length >= maxTemplates) {
      break;
    }

    const candidateClauses = [...selectedClauses, `(${template})`];
    const candidateTemplateQuery = candidateClauses.join(' OR ');
    const candidateQuery = filters.length === 0
      ? candidateTemplateQuery
      : `(${candidateTemplateQuery}) AND (${filters.join(' AND ')})`;

    if (candidateQuery.length > maxQueryLength && selectedClauses.length > 0) {
      break;
    }

    if (candidateQuery.length > maxQueryLength && selectedClauses.length === 0) {
      selectedClauses.push(`(${template})`);
      break;
    }

    selectedClauses.push(`(${template})`);
  }

  const templateQuery = selectedClauses.join(' OR ');

  if (filters.length === 0) {
    return templateQuery;
  }

  return `(${templateQuery}) AND (${filters.join(' AND ')})`;
}

function applyStudyTypeFilter(searchQuery, studyType) {
  if (studyType === 'animal') {
    return `(${searchQuery}) AND (Animals[MeSH Terms])`;
  }

  if (studyType === 'human') {
    return `(${searchQuery}) AND (Humans[MeSH Terms])`;
  }

  return searchQuery;
}

function buildReferenceStatistics(articles, filteredArticles, categorizedArticles, minimumSimilarityThreshold = MINIMUM_SIMILARITY_THRESHOLD) {
  return {
    totalSearched: articles.length,
    totalFound: filteredArticles.length,
    filteredOut: articles.length - filteredArticles.length,
    threshold: `${minimumSimilarityThreshold}%`,
    categoryCounts: Object.fromEntries(
      Object.entries(categorizedArticles).map(([cat, arts]) => [cat, arts.length])
    ),
    averageSimilarity: filteredArticles.length > 0
      ? (filteredArticles.reduce((sum, a) => sum + a.similarityScore, 0) / filteredArticles.length).toFixed(1) + '%'
      : '0%',
    topMatchScore: filteredArticles.length > 0 ? filteredArticles[0].similarityScore.toFixed(1) + '%' : '0%',
    lowestMatchScore: filteredArticles.length > 0
      ? filteredArticles[filteredArticles.length - 1].similarityScore.toFixed(1) + '%'
      : '0%',
    qualityDistribution: {
      excellent: filteredArticles.filter(a => a.similarityScore >= 70).length,
      good: filteredArticles.filter(a => a.similarityScore >= 50 && a.similarityScore < 70).length,
      fair: filteredArticles.filter(a => a.similarityScore >= 30 && a.similarityScore < 50).length,
      acceptable: filteredArticles.filter(a => a.similarityScore >= 20 && a.similarityScore < 30).length
    }
  };
}

async function requestPubMedWithRetry(requestFn, maxRetries = 2) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await requestFn();
    } catch (error) {
      const status = error.response?.status;
      const code = error.code;
      const retryable = status === 429 || code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNABORTED';

      if (!retryable || attempt === maxRetries) {
        throw error;
      }

      const waitMs = 700 * (attempt + 1);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      attempt += 1;
    }
  }

  throw new Error('PubMed request failed after retries');
}

async function executeReferenceSearch({
  searchQuery,
  keyTerms,
  studyType,
  userDrugName,
  drugNames,
  includeSubheadings,
  mandatoryTerms = null,
  rankingProfile = 'default',
  minimumSimilarityThreshold = MINIMUM_SIMILARITY_THRESHOLD,
  searchRetmax = 80,
  diseaseMeshTerms = []
}) {
  const PUBMED_API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const searchUrl = `${PUBMED_API_BASE}/esearch.fcgi`;
  const searchPayload = new URLSearchParams({
    db: 'pubmed',
    term: searchQuery,
    retmax: String(searchRetmax),
    retmode: 'json',
    sort: 'relevance'
  });

  let searchResponse;
  try {
    searchResponse = await requestPubMedWithRetry(() =>
      axios.post(searchUrl, searchPayload.toString(), {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
    );
  } catch (error) {
    try {
      searchResponse = await requestPubMedWithRetry(() =>
        axios.get(searchUrl, {
          timeout: 30000,
          params: {
            db: 'pubmed',
            term: searchQuery,
            retmax: searchRetmax,
            retmode: 'json',
            sort: 'relevance'
          }
        })
      );
    } catch (fallbackError) {
      const fallbackStatus = fallbackError.response?.status;
      const fallbackStatusText = fallbackError.response?.statusText || 'Unknown status';
      const fallbackData = typeof fallbackError.response?.data === 'string'
        ? fallbackError.response.data
        : JSON.stringify(fallbackError.response?.data || {});

      const wrappedError = new Error('Failed to search PubMed');
      wrappedError.details = fallbackStatus
        ? `PubMed search failed (${fallbackStatus} ${fallbackStatusText}): ${fallbackData.slice(0, 300)}`
        : (fallbackError.message || error.message || 'PubMed API is not responding. Please try again later.');
      wrappedError.original = fallbackError;
      throw wrappedError;
    }

    if (!searchResponse) {
      const wrappedError = new Error('Failed to search PubMed');
      wrappedError.details = 'PubMed search did not return a response.';
      wrappedError.original = error;
      throw wrappedError;
    }

    // Successful GET fallback path reaches here.
  }

  if (!searchResponse) {
    const wrappedError = new Error('Failed to search PubMed');
    wrappedError.details = 'PubMed search returned no response.';
    throw wrappedError;
  }

  const pmids = (searchResponse.data.esearchresult?.idlist || []).slice(0, searchRetmax);

  if (pmids.length === 0) {
    return {
      searchQuery,
      categorizedArticles: {},
      totalArticles: 0,
      statistics: {
        totalSearched: 0,
        totalFound: 0,
        filteredOut: 0,
        threshold: `${minimumSimilarityThreshold}%`,
        categoryCounts: {},
        averageSimilarity: '0%',
        topMatchScore: '0%',
        lowestMatchScore: '0%',
        qualityDistribution: {
          excellent: 0,
          good: 0,
          fair: 0,
          acceptable: 0
        }
      },
      message: 'No similar articles found'
    };
  }

  const normalizePmid = (pmid) => {
    if (typeof pmid === 'object' && pmid !== null) {
      return String(pmid._ || pmid.i || pmid);
    }
    return String(pmid);
  };

  const articles = [];
  const fetchUrl = `${PUBMED_API_BASE}/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml&rettype=abstract`;

  try {
    const fetchResponse = await requestPubMedWithRetry(() =>
      axios.get(fetchUrl, { timeout: 30000 })
    );
    const xml2js = require('xml2js');
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(fetchResponse.data);

    const pubmedArticles = result.PubmedArticleSet?.PubmedArticle;
    if (!pubmedArticles) {
      return {
        searchQuery,
        categorizedArticles: {},
        totalArticles: 0,
        statistics: {
          totalSearched: 0,
          totalFound: 0,
          filteredOut: 0,
          threshold: `${minimumSimilarityThreshold}%`,
          categoryCounts: {},
          averageSimilarity: '0%',
          topMatchScore: '0%',
          lowestMatchScore: '0%',
          qualityDistribution: {
            excellent: 0,
            good: 0,
            fair: 0,
            acceptable: 0
          }
        },
        message: 'No similar articles found'
      };
    }

    const articleArray = Array.isArray(pubmedArticles) ? pubmedArticles : [pubmedArticles];

    articleArray.forEach(pubmedArticle => {
      if (!pubmedArticle) return;

      const article = pubmedArticle.MedlineCitation?.Article;
      if (!article) return;

      const rawPmid = pubmedArticle.MedlineCitation?.PMID;
      const pmid = normalizePmid(rawPmid);

      let title = article.ArticleTitle || '';
      if (typeof title === 'object' && title !== null) {
        title = title._ || String(title);
      }
      title = String(title || '');

      let abstract = '';
      if (article.Abstract?.AbstractText) {
        const abstractText = article.Abstract.AbstractText;
        if (typeof abstractText === 'string') {
          abstract = abstractText;
        } else if (Array.isArray(abstractText)) {
          abstract = abstractText.map(part => {
            if (typeof part === 'string') return part;
            if (typeof part === 'object' && part !== null) return part._ || '';
            return String(part || '');
          }).join(' ');
        } else if (typeof abstractText === 'object' && abstractText !== null) {
          abstract = abstractText._ || String(abstractText);
        }
      }
      abstract = String(abstract || '');

      let meshTerms = [];
      if (pubmedArticle.MedlineCitation?.MeshHeadingList?.MeshHeading) {
        const meshList = Array.isArray(pubmedArticle.MedlineCitation.MeshHeadingList.MeshHeading)
          ? pubmedArticle.MedlineCitation.MeshHeadingList.MeshHeading
          : [pubmedArticle.MedlineCitation.MeshHeadingList.MeshHeading];
        meshTerms = meshList.map(mesh => {
          if (typeof mesh === 'string') return mesh;
          if (mesh.DescriptorName) {
            return typeof mesh.DescriptorName === 'string'
              ? mesh.DescriptorName
              : (mesh.DescriptorName._ || String(mesh.DescriptorName));
          }
          return '';
        }).filter(Boolean);
      }

      if (studyType === 'animal' || studyType === 'human') {
        const titleLower = title.toLowerCase();
        const meshLower = meshTerms.map(m => m.toLowerCase());

        const animalIndicators = ['in rats', 'in mice', 'in pigs', 'in rabbits', 'in dogs', ' rat ', ' rats ', ' mouse ', ' mice ', ' pig ', ' pigs '];
        const hasAnimalInTitle = animalIndicators.some(ind => titleLower.includes(ind));
        const hasAnimalsMeSH = meshLower.some(m => m === 'animals' || m.includes('animal'));

        const hasHumansMeSH = meshLower.some(m => m === 'humans' || m === 'human');
        const hasClinicalInTitle = titleLower.includes('clinical trial') || titleLower.includes('patient');

        if (studyType === 'animal') {
          if (!hasAnimalsMeSH && !hasAnimalInTitle) return;
          if (hasHumansMeSH && !hasAnimalsMeSH) return;
          if (hasClinicalInTitle) return;
        } else {
          if (hasAnimalInTitle) return;
          if (hasAnimalsMeSH && !hasHumansMeSH) return;
        }
      }

      const mandatoryMatchDetails = getMandatoryMatchDetails(title, abstract, mandatoryTerms, meshTerms, diseaseMeshTerms);
      if (mandatoryTerms?.enforce && !mandatoryMatchDetails.isMatch) {
        // Relaxed: instead of rejecting entirely, check if article has at least disease OR prevalence
        // Only fully reject if article has NONE of the mandatory signals
        const hasAnySignal = mandatoryMatchDetails.hasDisease || mandatoryMatchDetails.hasPrevalence;
        if (!hasAnySignal) {
          return; // Reject only if completely irrelevant
        }
        // Otherwise demote below (handled via similarity penalty)
      }

      const drugNameForScoring = userDrugName ? sanitizeQueryValue(userDrugName) : null;
      let similarityScore = calculateSimilarityScore(keyTerms, title, abstract, drugNameForScoring);
      const prevalenceBoost = rankingProfile === 'prevalence'
        ? calculatePrevalencePriorityBoost(title, abstract)
        : 0;
      // Get publication year for recency boost
      const pubYear = article.Journal?.JournalIssue?.PubDate?.Year || '';
      // Add recency boost for publication year (2021-2026 prioritized for EMA)
      const recencyBoost = rankingProfile === 'prevalence'
        ? calculateRecencyBoost(pubYear)
        : 0;

      // Apply penalty for partial mandatory matches (instead of rejection)
      let mandatoryPenalty = 0;
      if (mandatoryTerms?.enforce && !mandatoryMatchDetails.isMatch) {
        // Partial match: has some signals but not all
        if (!mandatoryMatchDetails.hasDrug && mandatoryTerms.drugName) mandatoryPenalty += 8;
        if (!mandatoryMatchDetails.hasPrevalence) mandatoryPenalty += 5;
        if (!mandatoryMatchDetails.hasDisease && mandatoryTerms.diseaseName) {
          mandatoryPenalty += 35;
        }
        
        // Boost for what DID match
        if (mandatoryMatchDetails.hasDisease) mandatoryPenalty -= 3;
        similarityScore = Math.max(0, similarityScore - mandatoryPenalty);
      }

      const rankingScore = Math.round((similarityScore + prevalenceBoost + recencyBoost) * 10) / 10;

      // Extract prevalence data for EMA compliance
      const prevalenceData = rankingProfile === 'prevalence'
        ? extractPrevalenceValue(title, abstract)
        : null;
      const authorityTier = rankingProfile === 'prevalence'
        ? determineAuthorityTier(title, abstract, pubmedArticle.MedlineCitation?.Article?.Journal?.Title || '')
        : null;
      const emaComplianceNote = rankingProfile === 'prevalence' && authorityTier
        ? generateEMAComplianceNote(authorityTier, title, pubmedArticle.MedlineCitation?.Article?.Journal?.Title || '', pubYear)
        : null;

      articles.push({
        pmid,
        title,
        authors: article.AuthorList?.Author
          ? (Array.isArray(article.AuthorList.Author)
            ? article.AuthorList.Author
            : [article.AuthorList.Author]
          ).map(a => `${a.LastName || ''} ${a.ForeName || ''}`.trim()).filter(Boolean)
          : [],
        journal: pubmedArticle.MedlineCitation?.Article?.Journal?.Title || '',
        publicationDate: pubYear,
        abstract,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        similarityScore,
        rankingScore,
        meshTerms,
        mandatoryMatch: mandatoryTerms?.enforce ? {
          drugName: mandatoryTerms.drugName || null,
          diseaseName: mandatoryTerms.diseaseName || null,
          matchedDiseaseTerms: mandatoryMatchDetails.matchedDiseaseTerms,
          diseaseEvidence: mandatoryMatchDetails.diseaseEvidence,
          prevalenceKeywords: mandatoryMatchDetails.matchedPrevalenceKeywords
        } : undefined,
        selected: false,
        // Enhanced prevalence data for EMA compliance
        ...(prevalenceData && {
          prevalenceData: {
            value: prevalenceData.value,
            context: prevalenceData.context,
            authorityTier,
            emaComplianceNote
          }
        })
      });
    });
  } catch (error) {
    const wrappedError = new Error('Failed to fetch article details from PubMed');
    wrappedError.details = error.message;
    wrappedError.original = error;
    throw wrappedError;
  }

  const filteredArticles = articles.filter(a => a.similarityScore >= minimumSimilarityThreshold);
  filteredArticles.sort((a, b) => {
    const rankingDelta = (b.rankingScore ?? b.similarityScore) - (a.rankingScore ?? a.similarityScore);
    if (rankingDelta !== 0) {
      return rankingDelta;
    }

    return b.similarityScore - a.similarityScore;
  });

  const categorizedArticles = categorizeArticles(filteredArticles, includeSubheadings);
  const statistics = buildReferenceStatistics(articles, filteredArticles, categorizedArticles, minimumSimilarityThreshold);

  if (filteredArticles.length === 0) {
    return {
      searchQuery,
      categorizedArticles,
      totalArticles: 0,
      statistics,
      message: `No highly relevant articles found (minimum ${minimumSimilarityThreshold}% similarity required).`
    };
  }

  return {
    searchQuery,
    categorizedArticles,
    totalArticles: filteredArticles.length,
    statistics,
    message: 'Reference document processed successfully'
  };
}

/**
 * POST /api/reference-doc/upload
 * Upload a reference document and find similar articles
 */
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const studyType = req.body.studyType || 'all';
    const userDrugName = req.body.drugName || null;
    const doseForm = req.body.doseForm || null;
    const indication = req.body.indication || null;
    const includeSubheadings = req.body.includeSubheadings !== 'false';

    const prevalenceCountry = sanitizeQueryValue(req.body.prevalenceCountry || '');
    const prevalenceYears = parseSelectedYears(req.body.prevalenceYears || req.body.prevalenceYear || '');
    const prevalenceDiseaseName = sanitizeQueryValue(req.body.prevalenceDiseaseName || '');
    const hasPrevalenceInputs = Boolean(prevalenceCountry || prevalenceYears.length > 0 || prevalenceDiseaseName);

    if (hasPrevalenceInputs && !prevalenceDiseaseName) {
      return res.status(400).json({
        error: 'Disease name is required when using Prevalence options.'
      });
    }

    console.log('User-specified parameters:', {
      userDrugName,
      doseForm,
      indication,
      includeSubheadings,
      prevalenceCountry,
      prevalenceYears,
      prevalenceDiseaseName,
      hasPrevalenceInputs
    });

    const extractedText = await extractTextFromFile(req.file.buffer, req.file.mimetype);

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from document' });
    }

    const keyTerms = extractKeyTerms(extractedText);

    if (keyTerms.length === 0) {
      return res.status(400).json({ error: 'Could not extract meaningful terms from document' });
    }

    const drugNames = detectPotentialDrugNames(extractedText);

    console.log('Extracted drug names:', drugNames);
    console.log('Key terms:', keyTerms.slice(0, 10));

    if (hasPrevalenceInputs) {
      const resolvedDrugName = sanitizeQueryValue(userDrugName || '');

      // Fetch MeSH terms for disease to improve matching
      let diseaseMesh = null;
      if (prevalenceDiseaseName) {
        try {
          diseaseMesh = await meshService.fetchMeshTerms(prevalenceDiseaseName, 'disease');
        } catch (e) {
          console.log('[MeSH] Failed to fetch disease terms for upload:', e.message);
        }
      }
      const diseaseMeshSearchTerms = [
        prevalenceDiseaseName,
        ...(diseaseMesh?.searchTerms || [])
      ].filter(Boolean);

      const prevalenceMandatoryTerms = {
        enforce: true,
        drugName: resolvedDrugName || null,
        diseaseName: prevalenceDiseaseName || null,
        prevalenceKeywords: [
          'prevalence',
          'prevalence rate',
          'epidemiology',
          'epidemiologic',
          'incidence',
          'incidence rate',
          'disease burden',
          'population-based',
          'population prevalence',
          'cross-sectional',
          'registry',
          'survey',
          'per 100',
          'per 100,000',
          'one-year prevalence',
          'annual prevalence'
        ]
      };

      const prevalenceTemplates = buildPrevalenceKeywordTemplates(prevalenceDiseaseName, prevalenceCountry, resolvedDrugName);
      const anotherTemplates = buildAnotherKeywordTemplates(resolvedDrugName, prevalenceDiseaseName, indication);
      const prevalenceColumnTerms = extractColumnKeyTermsFromTemplates(prevalenceTemplates);
      const prevalenceScoringTerms = [...new Set([
        prevalenceDiseaseName.toLowerCase(),
        ...prevalenceColumnTerms
      ].filter(Boolean))];
      const anotherColumnTerms = extractColumnKeyTermsFromTemplates(anotherTemplates);
      const anotherMandatoryKeywords = extractSingleKeywordsFromTemplates(anotherTemplates);
      const anotherMandatoryTerms = {
        enforce: Boolean(anotherMandatoryKeywords.length > 0 || resolvedDrugName || prevalenceDiseaseName),
        drugName: resolvedDrugName || null,
        diseaseName: prevalenceDiseaseName || null,
        prevalenceKeywords: anotherMandatoryKeywords
      };
      const prevalenceRelaxedMandatoryTerms = {
        enforce: true,
        drugName: null,
        diseaseName: prevalenceDiseaseName || null,
        prevalenceKeywords: prevalenceMandatoryTerms.prevalenceKeywords
      };

      const prevalenceSearchQuery = applyStudyTypeFilter(
        buildColumnSearchQuery({
          templates: prevalenceTemplates,
          country: prevalenceCountry,
          years: prevalenceYears,
          diseaseName: prevalenceDiseaseName,
          maxTemplates: 32,
          maxQueryLength: 12000
        }),
        studyType
      );

      const anotherSearchQuery = applyStudyTypeFilter(
        buildColumnSearchQuery({
          templates: anotherTemplates,
          maxTemplates: 24,
          maxQueryLength: 12000,
          applyCountryFilter: false,
          applyYearFilter: false,
          applyDiseaseFilter: false
        }),
        studyType
      );

      const [strictPrevalenceResult, anotherResult] = await Promise.all([
        executeReferenceSearch({
          searchQuery: prevalenceSearchQuery,
          keyTerms: prevalenceScoringTerms.length > 0 ? prevalenceScoringTerms : keyTerms,
          studyType,
          userDrugName,
          drugNames,
          includeSubheadings,
          mandatoryTerms: prevalenceMandatoryTerms,
          rankingProfile: 'prevalence',
          minimumSimilarityThreshold: MINIMUM_PREVALENCE_SIMILARITY_THRESHOLD,
          searchRetmax: 120,
          diseaseMeshTerms: diseaseMeshSearchTerms
        }),
        executeReferenceSearch({
          searchQuery: anotherSearchQuery,
          keyTerms: anotherColumnTerms.length > 0 ? anotherColumnTerms : keyTerms,
          studyType,
          userDrugName,
          drugNames,
          includeSubheadings,
          mandatoryTerms: anotherMandatoryTerms.enforce ? anotherMandatoryTerms : null,
          rankingProfile: 'another',
          minimumSimilarityThreshold: MINIMUM_ANOTHER_SIMILARITY_THRESHOLD,
          searchRetmax: 120,
          diseaseMeshTerms: diseaseMeshSearchTerms
        })
      ]);

      let prevalenceResult = strictPrevalenceResult;
      if (resolvedDrugName && strictPrevalenceResult.totalArticles === 0) {
        prevalenceResult = await executeReferenceSearch({
          searchQuery: prevalenceSearchQuery,
          keyTerms: prevalenceScoringTerms.length > 0 ? prevalenceScoringTerms : keyTerms,
          studyType,
          userDrugName,
          drugNames,
          includeSubheadings,
          mandatoryTerms: prevalenceRelaxedMandatoryTerms,
          rankingProfile: 'prevalence',
          minimumSimilarityThreshold: MINIMUM_PREVALENCE_SIMILARITY_THRESHOLD,
          searchRetmax: 120,
          diseaseMeshTerms: diseaseMeshSearchTerms
        });

        if (prevalenceResult.totalArticles > 0) {
          prevalenceResult.message = `${prevalenceResult.message} (No strict drug-name matches found; showing disease-focused prevalence results.)`;
        }
      }

      const totalCombinedArticles = prevalenceResult.totalArticles + anotherResult.totalArticles;

      return res.json({
        message: 'Reference document processed successfully',
        fileName: req.file.originalname,
        studyType,
        drugName: userDrugName || (drugNames.length > 0 ? drugNames.join(', ') : 'Auto-detected'),
        doseForm: doseForm || 'Not specified',
        indication: indication || 'Not specified',
        includeSubheadings,
        keyTerms: keyTerms.slice(0, 20),
        dualColumnMode: true,
        prevalenceContext: {
          country: prevalenceCountry || null,
          years: prevalenceYears.length > 0 ? prevalenceYears : null,
          diseaseName: prevalenceDiseaseName || null
        },
        columns: {
          prevalence: {
            label: 'PREVALENCE',
            searchQuery: prevalenceSearchQuery,
            categorizedArticles: prevalenceResult.categorizedArticles,
            totalArticles: prevalenceResult.totalArticles,
            statistics: prevalenceResult.statistics,
            message: prevalenceResult.message
          },
          another: {
            label: 'ANOTHER',
            searchQuery: anotherSearchQuery,
            categorizedArticles: anotherResult.categorizedArticles,
            totalArticles: anotherResult.totalArticles,
            statistics: anotherResult.statistics,
            message: anotherResult.message
          }
        },
        categorizedArticles: {},
        totalArticles: totalCombinedArticles
      });
    }

    const searchQuery = applyStudyTypeFilter(
      buildDefaultReferenceSearchQuery({ keyTerms, userDrugName, drugNames, doseForm, indication }),
      studyType
    );

    const searchResult = await executeReferenceSearch({
      searchQuery,
      keyTerms,
      studyType,
      userDrugName,
      drugNames,
      includeSubheadings
    });

    return res.json({
      message: searchResult.message,
      fileName: req.file.originalname,
      studyType,
      drugName: userDrugName || (drugNames.length > 0 ? drugNames.join(', ') : 'Auto-detected'),
      doseForm: doseForm || 'Not specified',
      indication: indication || 'Not specified',
      includeSubheadings,
      keyTerms: keyTerms.slice(0, 20),
      dualColumnMode: false,
      searchQuery,
      categorizedArticles: searchResult.categorizedArticles,
      totalArticles: searchResult.totalArticles,
      statistics: searchResult.statistics
    });
  } catch (error) {
    console.error('Reference document upload error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process reference document', 
      details: error.details || error.message 
    });
  }
});

/**
 * POST /api/reference-doc/fetch-abstracts
 * Fetch abstracts for selected articles (since initial search doesn't include abstracts)
 */
router.post('/fetch-abstracts', async (req, res) => {
  try {
    const { pmids } = req.body;
    
    if (!pmids || !Array.isArray(pmids) || pmids.length === 0) {
      return res.status(400).json({ error: 'No PMIDs provided' });
    }
    
    const PUBMED_API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    const fetchUrl = `${PUBMED_API_BASE}/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml`;
    
    const response = await axios.get(fetchUrl);
    const xml2js = require('xml2js');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);
    
    const abstracts = {};
    
    if (result.PubmedArticleSet?.PubmedArticle) {
      result.PubmedArticleSet.PubmedArticle.forEach(article => {
        const pmid = article.MedlineCitation?.[0]?.PMID?.[0]?._ || article.MedlineCitation?.[0]?.PMID?.[0];
        const abstractTexts = article.MedlineCitation?.[0]?.Article?.[0]?.Abstract?.[0]?.AbstractText || [];
        
        if (pmid && abstractTexts.length > 0) {
          // Check if abstract has structured sections (with labels)
          const structuredAbstract = [];
          let hasStructure = false;
          
          abstractTexts.forEach(text => {
            if (typeof text === 'object' && text.$ && text.$.Label) {
              hasStructure = true;
              const label = text.$.Label;
              const content = text._ || '';
              structuredAbstract.push({ label, content });
            } else if (typeof text === 'string') {
              structuredAbstract.push({ label: null, content: text });
            } else if (text._) {
              structuredAbstract.push({ label: null, content: text._ });
            }
          });
          
          if (hasStructure) {
            // Store structured abstract
            abstracts[pmid] = {
              structured: true,
              sections: structuredAbstract
            };
          } else {
            // Store plain abstract
            abstracts[pmid] = {
              structured: false,
              text: structuredAbstract.map(s => s.content).join(' ')
            };
          }
        }
      });
    }
    
    res.json({ abstracts });

  } catch (error) {
    console.error('Fetch abstracts error:', error);
    res.status(500).json({
      error: 'Failed to fetch abstracts',
      details: error.message
    });
  }
});

// NEW: Prevalence-only search endpoint (no file required)
router.post('/prevalence-search', async (req, res) => {
  try {
    const {
      studyType = 'all',
      prevalenceCountry = '',
      prevalenceYears = '',
      prevalenceDiseaseName = '',
      drugName = '',
      includeSubheadings = true
    } = req.body;

    if (!prevalenceDiseaseName || !prevalenceDiseaseName.trim()) {
      return res.status(400).json({ error: 'Disease name is required' });
    }

    const resolvedDrugName = drugName && drugName.trim() ? drugName.trim() : null;
    const safeCountry = sanitizeQueryValue(prevalenceCountry || '');
    const safeDisease = sanitizeQueryValue(prevalenceDiseaseName.trim());
    const safeYears = parseSelectedYears(prevalenceYears);
    const safeDrug = sanitizeQueryValue(resolvedDrugName || '');

    console.log('Prevalence-only search:', { safeDisease, safeCountry, safeYears, safeDrug, studyType });

    // STEP 1: Fetch MeSH terms for better context understanding
    console.log('[MeSH] Fetching MeSH terms for disease:', safeDisease);
    const diseaseMesh = await meshService.fetchMeshTerms(safeDisease, 'disease');
    console.log('[MeSH] Disease terms found:', diseaseMesh?.searchTerms?.slice(0, 5));

    let drugMesh = null;
    if (safeDrug) {
      console.log('[MeSH] Fetching MeSH terms for drug:', safeDrug);
      drugMesh = await meshService.fetchMeshTerms(safeDrug, 'drug');
      console.log('[MeSH] Drug terms found:', drugMesh?.searchTerms?.slice(0, 5));
    }

    // STEP 2: Build MeSH-enhanced templates
    const meshEnhancedTemplates = buildMeshEnhancedTemplates(
      safeDisease,
      safeDrug,
      diseaseMesh,
      drugMesh,
      safeCountry
    );

    // Combine with existing templates
    const prevalenceTemplates = [
      ...meshEnhancedTemplates,
      ...buildPrevalenceKeywordTemplates(safeDisease, safeCountry, safeDrug)
    ];

    // Remove duplicates while preserving order
    const uniqueTemplates = [...new Set(prevalenceTemplates)];

    // Build search query
    const prevalenceSearchQuery = buildColumnSearchQuery({
      templates: uniqueTemplates,
      country: safeCountry,
      years: safeYears,
      diseaseName: safeDisease,
      maxTemplates: 48,
      maxQueryLength: 15000
    });

    // Build "Another" column templates (broader search without strict prevalence filter)
    const anotherTemplates = buildAnotherKeywordTemplates(safeDrug, safeDisease, '');
    const anotherSearchQuery = buildColumnSearchQuery({
      templates: anotherTemplates,
      country: safeCountry,
      years: safeYears,
      diseaseName: safeDisease,
      maxTemplates: 32,
      maxQueryLength: 12000
    });

    const prevalenceQueryWithFilter = applyStudyTypeFilter(prevalenceSearchQuery, studyType);
    const anotherQueryWithFilter = applyStudyTypeFilter(anotherSearchQuery, studyType);

    console.log('[Search] Final prevalence query (first 200 chars):', prevalenceQueryWithFilter.substring(0, 200));

    // Build expanded key terms using MeSH synonyms for better scoring
    const prevalenceKeyTerms = [
      safeDisease,
      'prevalence',
      'epidemiology',
      'population',
      safeDrug,
      ...(diseaseMesh?.searchTerms || []).slice(0, 8),
      ...(drugMesh?.searchTerms || []).slice(0, 4)
    ].filter(Boolean);
    const uniquePrevalenceKeyTerms = [...new Set(prevalenceKeyTerms.map(t => t.toLowerCase()))];

    const anotherKeyTerms = [
      safeDisease,
      'environmental risk',
      'pharmaceutical',
      safeDrug,
      ...(diseaseMesh?.searchTerms || []).slice(0, 4),
      ...(drugMesh?.searchTerms || []).slice(0, 2)
    ].filter(Boolean);
    const uniqueAnotherKeyTerms = [...new Set(anotherKeyTerms.map(t => t.toLowerCase()))];

    // Extract MeSH search terms for disease matching in mandatory check
    const diseaseMeshSearchTerms = [
      safeDisease,
      ...(diseaseMesh?.searchTerms || [])
    ].filter(Boolean);

    // Execute both searches in parallel
    const [prevalenceResult, anotherResult] = await Promise.all([
      executeReferenceSearch({
        searchQuery: prevalenceQueryWithFilter,
        keyTerms: uniquePrevalenceKeyTerms,
        studyType,
        userDrugName: resolvedDrugName,
        drugNames: resolvedDrugName ? [resolvedDrugName] : [],
        includeSubheadings,
        mandatoryTerms: {
          enforce: true,
          drugName: resolvedDrugName || null,
          diseaseName: safeDisease,
          prevalenceKeywords: [
            'prevalence', 'epidemiology', 'epidemiologic', 'prevalence rate',
            'population prevalence', 'one-year prevalence', 'annual prevalence',
            'disease burden', 'population-based', 'cross-sectional',
            'incidence', 'survey', 'registry', 'frequency', 'occurrence',
            'per 100', 'per 100,000', 'point prevalence'
          ]
        },
        rankingProfile: 'prevalence',
        minimumSimilarityThreshold: MINIMUM_PREVALENCE_SIMILARITY_THRESHOLD,
        searchRetmax: 120,
        diseaseMeshTerms: diseaseMeshSearchTerms
      }),
      executeReferenceSearch({
        searchQuery: anotherQueryWithFilter,
        keyTerms: uniqueAnotherKeyTerms,
        studyType,
        userDrugName: resolvedDrugName,
        drugNames: resolvedDrugName ? [resolvedDrugName] : [],
        includeSubheadings,
        mandatoryTerms: null,
        rankingProfile: 'another',
        minimumSimilarityThreshold: MINIMUM_ANOTHER_SIMILARITY_THRESHOLD,
        searchRetmax: 120,
        diseaseMeshTerms: diseaseMeshSearchTerms
      })
    ]);

    res.json({
      dualColumnMode: true,
      columns: {
        prevalence: {
          label: 'PREVALENCE',
          searchQuery: prevalenceQueryWithFilter,
          categorizedArticles: prevalenceResult.categorizedArticles,
          totalArticles: prevalenceResult.totalArticles,
          statistics: prevalenceResult.statistics,
          message: prevalenceResult.message
        },
        another: {
          label: 'ANOTHER',
          searchQuery: anotherQueryWithFilter,
          categorizedArticles: anotherResult.categorizedArticles,
          totalArticles: anotherResult.totalArticles,
          statistics: anotherResult.statistics,
          message: anotherResult.message
        }
      },
      prevalenceContext: {
        country: safeCountry || null,
        years: safeYears.length > 0 ? safeYears : null,
        diseaseName: safeDisease
      },
      totalArticles: prevalenceResult.totalArticles + anotherResult.totalArticles,
      filteredArticles: prevalenceResult.totalArticles + anotherResult.totalArticles
    });

  } catch (error) {
    console.error('Prevalence search error:', error);
    res.status(500).json({
      error: 'Prevalence search failed',
      details: error.message
    });
  }
});

module.exports = router;
