const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');

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
  const drugNamePattern = /\b([A-Z][A-Za-z]+(?:[-][A-Z][a-z]+)?)\b/g;
  const matches = extractedText.match(drugNamePattern);

  if (!matches) {
    return [];
  }

  const uniqueDrugs = [...new Set(matches)].filter(name =>
    name.length > 3 &&
    !['The', 'This', 'That', 'With', 'From', 'Table', 'Figure'].includes(name)
  );

  return uniqueDrugs.slice(0, 3);
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

function buildPrevalenceKeywordTemplates(diseaseName, drugName) {
  const templates = [
    '"disease prevalence" "Europe" "systematic review"',
    '"epidemiology" "Europe" "population-based study"',
    '"prevalence" "European Union" "EU27" "meta-analysis"',
    '"prevalence" "Europe" "inhabitants" "per 100"',
    '"disease burden" "Europe" "epidemiological data"',
    '"patient population" "Europe" "prevalence estimate"',
    '"prevalence rate" "European region" "cross-sectional"',
    '"incidence" "prevalence" "Europe" "cohort study"',
    '"national registry" "Europe" "disease statistics"',
    '"WHO Europe" prevalence epidemiology report',
    '"ECDC" prevalence "European" disease surveillance',
    '"Eurostat" health statistics prevalence Europe',
    '"GBD" "Global Burden of Disease" prevalence Europe',
    '"IHME" prevalence "European" disease estimate',
    '"systematic review" "meta-analysis" "prevalence" "Europe"',
    '"population-based" "prevalence" "EU Member State"',
    '"observational study" "prevalence" "European" "adults"',
    '"survey" "prevalence" "European population" epidemiology',
    '"registry data" "prevalence" "European" patients',
    '"peer-reviewed" "prevalence" "Europe" "independent source"',
    '"reliable source" "prevalence" "European" "recent data"',
    '"one-year prevalence" "Europe" disease',
    '"annual prevalence" "Europe" "per inhabitant"',
    '"prevalence" "United Kingdom" "population-based"',
    '"disease prevalence" "England" "adults" "NHS"',
    '"CPRD" "prevalence" "United Kingdom" disease',
    '"QResearch" "prevalence" "England" primary care',
    '"ONS" "Office for National Statistics" "prevalence" disease',
    '"Public Health England" OR "UKHSA" prevalence surveillance',
    '"NHS Digital" "prevalence" "England" disease statistics',
    '"NICE" "epidemiology" "prevalence" UK guideline',
    '"Health Survey for England" "prevalence" disease'
  ];

  const prioritizedTemplates = [];
  const safeDisease = diseaseName ? sanitizeQueryValue(diseaseName) : '';
  const safeDrug = drugName ? sanitizeQueryValue(drugName) : '';

  if (safeDrug && safeDisease) {
    prioritizedTemplates.push(
      `"${safeDrug}" "${safeDisease}" prevalence`,
      `"${safeDrug}" "${safeDisease}" epidemiology`,
      `"${safeDrug}" "${safeDisease}" incidence prevalence`,
      `"${safeDrug}" "${safeDisease}" "prevalence rate"`,
      `"${safeDrug}" "${safeDisease}" "population-based" prevalence`,
      `"${safeDrug}" "${safeDisease}" "cross-sectional" prevalence`,
      `"${safeDrug}" "${safeDisease}" "systematic review" prevalence`,
      `"${safeDrug}" "${safeDisease}" "meta-analysis" prevalence`,
      `"${safeDrug}" "${safeDisease}" "per 100,000" prevalence`,
      `"${safeDrug}" "${safeDisease}" "disease burden" prevalence`
    );
  } else if (safeDrug) {
    prioritizedTemplates.push(
      `"${safeDrug}" prevalence epidemiology`,
      `"${safeDrug}" prevalence "systematic review"`
    );
  }

  if (diseaseName) {
    templates.push(
      `"${safeDisease}" "prevalence" "Europe" "systematic review"`,
      `"${safeDisease}" "prevalence" "EU" "meta-analysis"`,
      `"${safeDisease}" "epidemiology" "Europe" "population-based"`,
      `"${safeDisease}" "prevalence" "European population" "adults"`,
      `"${safeDisease}" "disease burden" "Europe" "DALY"`,
      `"${safeDisease}" "per 100 inhabitants" OR "per 100,000" Europe`,
      `"${safeDisease}" "prevalence" "ECDC" "European Centre" disease`,
      `"${safeDisease}" "prevalence" "WHO Europe" "World Health Organization"`,
      `"${safeDisease}" "prevalence" "Global Burden of Disease" "GBD" Europe`,
      `"${safeDisease}" "prevalence" "United Kingdom"`,
      `"${safeDisease}" "prevalence" "England" "NHS"`,
      `"${safeDisease}" "prevalence" "UK" "population-based study"`,
      `"${safeDisease}" "prevalence" "UK" "primary care" "GP"`,
      `"${safeDisease}" "prevalence" "CPRD" "Clinical Practice Research Datalink"`,
      `"${safeDisease}" "prevalence" "QResearch" "England"`,
      `"${safeDisease}" "prevalence" "UK Biobank" "population"`,
      `"${safeDisease}" "prevalence" "ONS" "Office for National Statistics"`,
      `"${safeDisease}" "NICE" "epidemiology" "prevalence" guideline UK`,
      `"${safeDisease}" AND "prevalence" AND "Europe" AND "systematic review"`,
      `"${safeDisease}" AND "epidemiology" AND "EU" AND ("adults" OR "population")`,
      `"${safeDisease}" AND "one-year prevalence" AND "Europe"`,
      `"${safeDisease}" AND "prevalence" AND ("WHO" OR "Global Burden of Disease" OR "GBD") AND ("Europe" OR "UK")`,
      `"${safeDisease}" AND "prevalence" AND ("CPRD" OR "QResearch" OR "THIN") AND "England"`
    );
  }

  return [...new Set([...prioritizedTemplates, ...templates])];
}

function buildAnotherKeywordTemplates(drugName, diseaseName, indication) {
  const templates = [
    '"environmental risk assessment" "medicinal products for human use"',
    '"pharmaceutical ERA" "EMA guideline" "EMEA/CHMP/SWP/4447/00"',
    '"Module 1.6" "marketing authorisation" ERA pharmaceutical',
    '"pharmaceutical environmental contamination" review',
    '"FPEN refinement" "disease prevalence" pharmaceutical ERA',
    '"treatment regimen" FPEN "environmental exposure" pharmaceutical',
    '"tTREATMENT" "nTREATMENT" pharmaceutical ERA refinement',
    '"predicted environmental concentration surface water" pharmaceutical',
    '"market penetration factor" FPEN pharmaceutical ERA',
    '"PECsw calculation" "default FPEN 0.01" pharmaceutical',
    '"action limit 0.01 µg/L" pharmaceutical ERA',
    '"wastewater pharmaceutical" "200 L inhabitant" ERA',
    '"water solubility" "OECD 105" pharmaceutical environment',
    '"log Kow" "OECD 107" pharmaceutical "octanol water partition"',
    '"pKa" "dissociation constant" "OECD 112" pharmaceutical',
    '"KFOC" "Freundlich adsorption" "OECD 106" pharmaceutical',
    '"ready biodegradability" "OECD 301" pharmaceutical',
    '"STP removal" pharmaceutical "activated sludge"',
    '"SimpleTreat" "STPWIN" pharmaceutical wastewater removal',
    '"algae growth inhibition" "OECD 201" pharmaceutical',
    '"Daphnia magna" "acute immobilisation" "OECD 202" pharmaceutical',
    '"fish acute toxicity" "OECD 203" "LC50" pharmaceutical',
    '"Daphnia magna reproduction" "OECD 211" "NOEC" pharmaceutical',
    '"fish early life stage" "OECD 210" "NOEC" pharmaceutical',
    '"activated sludge respiration inhibition" "OECD 209" pharmaceutical',
    '"PNEC" "assessment factor" "AF 1000" QSAR pharmaceutical',
    '"ECOSAR" ecotoxicity prediction pharmaceutical QSAR',
    '"PBT criteria" "REACH Annex XIII" pharmaceutical environment',
    '"persistence" "DT50 > 60 days" pharmaceutical P criterion',
    '"bioaccumulation" "BCF > 2000" pharmaceutical B criterion',
    '"vPvB" "very persistent very bioaccumulative" pharmaceutical',
    '"OECD 308" "water sediment" "DT50" pharmaceutical persistence',
    '"BCFBAF" "EPI Suite" bioaccumulation pharmaceutical QSAR',
    '"PNECsw" "chronic NOEC" "three trophic levels" pharmaceutical',
    '"surface water risk quotient" "RQsw" pharmaceutical ERA',
    '"PECsed" "equilibrium partitioning" pharmaceutical sediment',
    '"Chironomus riparius" "OECD 218" pharmaceutical sediment',
    '"PECgw" "bank filtration" "0.25" "PECsw" pharmaceutical',
    '"drinking water directive" "0.1 µg/L" pharmaceutical groundwater',
    '"secondary poisoning" "BCF" "biomagnification" pharmaceutical ERA',
    '"CRED method" "ecotoxicity data" reliability Moermond 2016',
    '"Klimisch score" pharmaceutical ecotoxicity data reliability',
    '"GLP" "OECD guideline" pharmaceutical environmental study quality'
  ];

  const prioritizedTemplates = [];

  const safeDrug = drugName ? sanitizeQueryValue(drugName) : '';
  const safeDisease = diseaseName ? sanitizeQueryValue(diseaseName) : '';

  if (safeDrug && safeDisease) {
    prioritizedTemplates.push(
      `"${safeDrug}" "${safeDisease}" prevalence`,
      `"${safeDrug}" "${safeDisease}" epidemiology`,
      `"${safeDrug}" "${safeDisease}" incidence`,
      `"${safeDrug}" "${safeDisease}" "systematic review" prevalence`,
      `"${safeDrug}" "${safeDisease}" "population-based study"`,
      `"${safeDrug}" AND "${safeDisease}" AND ("prevalence" OR "incidence" OR "epidemiology")`,
      `"${safeDrug}" "${safeDisease}" "disease burden"`
    );
  }

  if (diseaseName) {
    prioritizedTemplates.push(
      `"${safeDisease} prevalence" "Europe" epidemiology "systematic review"`,
      `"${safeDisease}" prevalence epidemiology Europe`
    );
  }

  const resolvedIndication = indication ? sanitizeQueryValue(indication) : '';
  if (resolvedIndication) {
    prioritizedTemplates.push(`"European prevalence" "${resolvedIndication}" "peer-reviewed" population`);
  }

  prioritizedTemplates.push('"PREGION" "highest prevalence" pharmaceutical ERA');

  if (safeDrug) {
    prioritizedTemplates.push(
      `"${safeDrug} treatment duration" "treatment episodes" posology`,
      `"${safeDrug} PBT assessment" persistence bioaccumulation toxicity`
    );
  }

  return [...new Set([...prioritizedTemplates, ...templates])];
}

function getMandatoryMatchDetails(title, abstract, mandatoryTerms) {
  if (!mandatoryTerms || !mandatoryTerms.enforce) {
    return {
      isMatch: true,
      matchedPrevalenceKeywords: [],
      hasDrug: true,
      hasDisease: true,
      hasPrevalence: true
    };
  }

  const text = `${String(title || '')} ${String(abstract || '')}`.toLowerCase();
  const requiredDrug = sanitizeQueryValue(mandatoryTerms.drugName || '').toLowerCase();
  const requiredDisease = sanitizeQueryValue(mandatoryTerms.diseaseName || '').toLowerCase();
  const prevalenceKeywords = (mandatoryTerms.prevalenceKeywords || []).map(k => String(k || '').toLowerCase()).filter(Boolean);

  const hasDrug = requiredDrug ? text.includes(requiredDrug) : true;
  const hasDisease = requiredDisease ? text.includes(requiredDisease) : true;
  const matchedPrevalenceKeywords = prevalenceKeywords.filter(keyword => text.includes(keyword));
  const hasPrevalence = matchedPrevalenceKeywords.length > 0;

  return {
    isMatch: hasDrug && hasDisease && hasPrevalence,
    matchedPrevalenceKeywords,
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
  maxQueryLength = 2200
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

  if (safeCountry) {
    filters.push(`("${safeCountry}"[Title/Abstract] OR "${safeCountry}"[Affiliation])`);
  }

  if (safeYears.length === 1) {
    filters.push(`(${safeYears[0]}[PDAT])`);
  } else if (safeYears.length > 1) {
    filters.push(`(${safeYears.map(yearValue => `${yearValue}[PDAT]`).join(' OR ')})`);
  }

  if (safeDisease) {
    filters.push(`("${safeDisease}"[Title/Abstract])`);
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

function buildReferenceStatistics(articles, filteredArticles, categorizedArticles) {
  return {
    totalSearched: articles.length,
    totalFound: filteredArticles.length,
    filteredOut: articles.length - filteredArticles.length,
    threshold: `${MINIMUM_SIMILARITY_THRESHOLD}%`,
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
  rankingProfile = 'default'
}) {
  const PUBMED_API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const SEARCH_RETMAX = 80;
  const searchUrl = `${PUBMED_API_BASE}/esearch.fcgi`;
  const searchPayload = new URLSearchParams({
    db: 'pubmed',
    term: searchQuery,
    retmax: String(SEARCH_RETMAX),
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
            retmax: SEARCH_RETMAX,
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

  const pmids = (searchResponse.data.esearchresult?.idlist || []).slice(0, SEARCH_RETMAX);

  if (pmids.length === 0) {
    return {
      searchQuery,
      categorizedArticles: {},
      totalArticles: 0,
      statistics: {
        totalSearched: 0,
        totalFound: 0,
        filteredOut: 0,
        threshold: `${MINIMUM_SIMILARITY_THRESHOLD}%`,
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
          threshold: `${MINIMUM_SIMILARITY_THRESHOLD}%`,
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

      const mandatoryMatchDetails = getMandatoryMatchDetails(title, abstract, mandatoryTerms);
      if (mandatoryTerms?.enforce && !mandatoryMatchDetails.isMatch) {
        return;
      }

      const drugNameForScoring = userDrugName || (drugNames.length > 0 ? drugNames[0] : null);
      const similarityScore = calculateSimilarityScore(keyTerms, title, abstract, drugNameForScoring);
      const prevalenceBoost = rankingProfile === 'prevalence'
        ? calculatePrevalencePriorityBoost(title, abstract)
        : 0;
      const rankingScore = Math.round((similarityScore + prevalenceBoost) * 10) / 10;

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
        publicationDate: article.Journal?.JournalIssue?.PubDate?.Year || '',
        abstract,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        similarityScore,
        rankingScore,
        meshTerms,
        mandatoryMatch: mandatoryTerms?.enforce ? {
          drugName: mandatoryTerms.drugName || null,
          diseaseName: mandatoryTerms.diseaseName || null,
          prevalenceKeywords: mandatoryMatchDetails.matchedPrevalenceKeywords
        } : undefined,
        selected: false
      });
    });
  } catch (error) {
    const wrappedError = new Error('Failed to fetch article details from PubMed');
    wrappedError.details = error.message;
    wrappedError.original = error;
    throw wrappedError;
  }

  const filteredArticles = articles.filter(a => a.similarityScore >= MINIMUM_SIMILARITY_THRESHOLD);
  filteredArticles.sort((a, b) => {
    const rankingDelta = (b.rankingScore ?? b.similarityScore) - (a.rankingScore ?? a.similarityScore);
    if (rankingDelta !== 0) {
      return rankingDelta;
    }

    return b.similarityScore - a.similarityScore;
  });

  const categorizedArticles = categorizeArticles(filteredArticles, includeSubheadings);
  const statistics = buildReferenceStatistics(articles, filteredArticles, categorizedArticles);

  if (filteredArticles.length === 0) {
    return {
      searchQuery,
      categorizedArticles,
      totalArticles: 0,
      statistics,
      message: `No highly relevant articles found (minimum ${MINIMUM_SIMILARITY_THRESHOLD}% similarity required).`
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
      const resolvedDrugName = sanitizeQueryValue(userDrugName || (drugNames[0] || ''));
      const mandatoryTerms = {
        enforce: true,
        drugName: resolvedDrugName,
        diseaseName: prevalenceDiseaseName,
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

      const prevalenceTemplates = buildPrevalenceKeywordTemplates(prevalenceDiseaseName, resolvedDrugName);
      const anotherTemplates = buildAnotherKeywordTemplates(resolvedDrugName, prevalenceDiseaseName, indication);

      const prevalenceSearchQuery = applyStudyTypeFilter(
        buildColumnSearchQuery({
          templates: prevalenceTemplates,
          country: prevalenceCountry,
          years: prevalenceYears,
          diseaseName: prevalenceDiseaseName,
          maxTemplates: 30,
          maxQueryLength: 3200
        }),
        studyType
      );

      const anotherSearchQuery = applyStudyTypeFilter(
        buildColumnSearchQuery({
          templates: anotherTemplates,
          country: prevalenceCountry,
          diseaseName: prevalenceDiseaseName,
          maxTemplates: 12,
          maxQueryLength: 1700
        }),
        studyType
      );

      const [prevalenceResult, anotherResult] = await Promise.all([
        executeReferenceSearch({
          searchQuery: prevalenceSearchQuery,
          keyTerms,
          studyType,
          userDrugName,
          drugNames,
          includeSubheadings,
          mandatoryTerms,
          rankingProfile: 'prevalence'
        }),
        executeReferenceSearch({
          searchQuery: anotherSearchQuery,
          keyTerms,
          studyType,
          userDrugName,
          drugNames,
          includeSubheadings,
          mandatoryTerms,
          rankingProfile: 'another'
        })
      ]);

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

module.exports = router;
