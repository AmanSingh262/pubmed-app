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
  
  // Sort each category by similarity score
  Object.keys(categorized).forEach(category => {
    categorized[category].sort((a, b) => b.similarityScore - a.similarityScore);
  });
  
  return categorized;
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
    
    // Get parameters from request
    const studyType = req.body.studyType || 'all';
    const userDrugName = req.body.drugName || null;
    const doseForm = req.body.doseForm || null;
    const indication = req.body.indication || null;
    const includeSubheadings = req.body.includeSubheadings !== 'false'; // Default true
    
    console.log('User-specified parameters:', { userDrugName, doseForm, indication, includeSubheadings });
    
    // Extract text from uploaded file
    const extractedText = await extractTextFromFile(req.file.buffer, req.file.mimetype);
    
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from document' });
    }
    
    // Extract key medical terms from the text
    const keyTerms = extractKeyTerms(extractedText);
    
    if (keyTerms.length === 0) {
      return res.status(400).json({ error: 'Could not extract meaningful terms from document' });
    }
    
    // Try to detect drug names (usually capitalized words or brand names)
    const drugNamePattern = /\b([A-Z][A-Za-z]+(?:[-][A-Z][a-z]+)?)\b/g;
    const drugNames = [];
    const matches = extractedText.match(drugNamePattern);
    if (matches) {
      const uniqueDrugs = [...new Set(matches)].filter(name => 
        name.length > 3 && 
        !['The', 'This', 'That', 'With', 'From', 'Table', 'Figure'].includes(name)
      );
      drugNames.push(...uniqueDrugs.slice(0, 3)); // Top 3 potential drug names
    }
    
    console.log('Extracted drug names:', drugNames);
    console.log('Key terms:', keyTerms.slice(0, 10));
    
    // Build search query prioritizing drug names
    let searchQuery = '';
    let boostTerms = []; // Terms to boost in search, not require
    
    // PRIORITY 1: Use user-specified drug name if provided
    if (userDrugName && userDrugName.trim().length > 0) {
      searchQuery = `"${userDrugName.trim()}"[Title/Abstract]`;
      console.log('Using user-specified drug name:', userDrugName);
      
      // Add dose form as boost, not requirement (to avoid zero results)
      if (doseForm && doseForm !== 'not-applicable') {
        boostTerms.push(`"${doseForm}"[Title/Abstract]`);
        console.log('Boosting with dose form:', doseForm);
      }
      
      // Add indication as boost, not requirement
      if (indication && indication.trim().length > 0 && indication.toLowerCase() !== 'not applicable') {
        boostTerms.push(`"${indication.trim()}"[Title/Abstract]`);
        console.log('Boosting with indication:', indication);
      }
      
      // Add key terms as additional context
      const topTerms = keyTerms.slice(0, 8).map(term => `${term}[Title/Abstract]`).join(' OR ');
      if (boostTerms.length > 0) {
        searchQuery = `(${searchQuery}) AND ((${topTerms}) OR (${boostTerms.join(' OR ')}))`;
      } else {
        searchQuery = `(${searchQuery}) AND (${topTerms})`;
      }
    }
    // FALLBACK: Auto-detect drug names from document
    else if (drugNames.length > 0) {
      // Primary search with drug names
      searchQuery = drugNames.map(name => `"${name}"[Title/Abstract]`).join(' OR ');
      
      // Add dose form as boost
      if (doseForm && doseForm !== 'not-applicable') {
        boostTerms.push(`"${doseForm}"[Title/Abstract]`);
      }
      
      // Add indication as boost
      if (indication && indication.trim().length > 0 && indication.toLowerCase() !== 'not applicable') {
        boostTerms.push(`"${indication.trim()}"[Title/Abstract]`);
      }
      
      // Add key terms as secondary search
      const topTerms = keyTerms.slice(0, 8).map(term => `${term}[Title/Abstract]`).join(' OR ');
      if (boostTerms.length > 0) {
        searchQuery = `(${searchQuery}) OR (${topTerms}) OR (${boostTerms.join(' OR ')})`;
      } else {
        searchQuery = `(${searchQuery}) OR (${topTerms})`;
      }
    } else {
      // Fallback to key terms only
      searchQuery = keyTerms.slice(0, 15).map(term => `${term}[Title/Abstract]`).join(' OR ');
      
      // Add dose form and indication as boost if specified
      if (doseForm && doseForm !== 'not-applicable') {
        boostTerms.push(`"${doseForm}"[Title/Abstract]`);
      }
      
      if (indication && indication.trim().length > 0 && indication.toLowerCase() !== 'not applicable') {
        boostTerms.push(`"${indication.trim()}"[Title/Abstract]`);
      }
      
      if (boostTerms.length > 0) {
        searchQuery = `(${searchQuery}) OR (${boostTerms.join(' OR ')})`;
      }
    }
    
    // Add study type filter to search query - LENIENT filtering to avoid zero results
    if (studyType === 'animal') {
      // Lenient animal filter - include animal studies
      searchQuery = `(${searchQuery}) AND (Animals[MeSH Terms])`;
    } else if (studyType === 'human') {
      // Lenient human filter - include human studies
      searchQuery = `(${searchQuery}) AND (Humans[MeSH Terms])`;
    }
    // If studyType is 'all', no filter is added
    
    // Search PubMed using the extracted terms
    const PUBMED_API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    
    // Step 1: Search for articles - fetch top 150 results for better coverage
    console.log(`Searching PubMed with ${keyTerms.length} key terms...`);
    console.log('Search query:', searchQuery.substring(0, 500) + '...');
    
    const searchUrl = `${PUBMED_API_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchQuery)}&retmax=150&retmode=json&sort=relevance`;
    
    let searchResponse;
    try {
      searchResponse = await axios.get(searchUrl, { timeout: 30000 });
    } catch (error) {
      console.error('PubMed search API error:', error.message);
      return res.status(500).json({ 
        error: 'Failed to search PubMed',
        details: 'PubMed API is not responding. Please try again later.',
        keyTerms: keyTerms.slice(0, 10)
      });
    }
    
    const pmids = searchResponse.data.esearchresult?.idlist || [];
    
    console.log(`Found ${pmids.length} articles from PubMed for reference document search`);
    
    // No need for batching with 100 articles - PubMed allows up to 200 per request
    // No need for batching with 100 articles - PubMed allows up to 200 per request
    
    if (pmids.length === 0) {
      return res.json({
        message: 'No similar articles found',
        keyTerms,
        categorizedArticles: {},
        totalArticles: 0,
        studyType
      });
    }
    
    // Step 2: Fetch article details with abstracts (using efetch for complete data)
    const articles = [];
    
    // Helper function to normalize PMID
    const normalizePmid = (pmid) => {
      if (typeof pmid === 'object' && pmid !== null) {
        return String(pmid._ || pmid.i || pmid);
      }
      return String(pmid);
    };
    
    console.log(`Fetching abstracts for ${pmids.length} articles...`);
    
    // Use efetch to get full abstracts (not just summaries)
    const fetchUrl = `${PUBMED_API_BASE}/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml&rettype=abstract`;
    
    try {
      const fetchResponse = await axios.get(fetchUrl);
      const xml2js = require('xml2js');
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(fetchResponse.data);
      
      const pubmedArticles = result.PubmedArticleSet?.PubmedArticle;
      const articleArray = Array.isArray(pubmedArticles) ? pubmedArticles : [pubmedArticles];
      
      articleArray.forEach(pubmedArticle => {
        if (!pubmedArticle) return;
        
        const article = pubmedArticle.MedlineCitation?.Article;
        if (!article) return;
        
        const rawPmid = pubmedArticle.MedlineCitation?.PMID;
        const pmid = normalizePmid(rawPmid);
        
        // Ensure title is a string
        let title = article.ArticleTitle || '';
        if (typeof title === 'object' && title !== null) {
          title = title._ || String(title);
        }
        title = String(title || '');
        
        // Extract abstract text
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
        
        // Extract MeSH terms for filtering
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
        
        // Apply strict study type filtering based on title and MeSH
        if (studyType === 'animal' || studyType === 'human') {
          const titleLower = title.toLowerCase();
          const meshLower = meshTerms.map(m => m.toLowerCase());
          const meshText = meshLower.join(' ');
          
          // Animal species indicators
          const animalIndicators = ['in rats', 'in mice', 'in pigs', 'in rabbits', 'in dogs', ' rat ', ' rats ', ' mouse ', ' mice ', ' pig ', ' pigs '];
          const hasAnimalInTitle = animalIndicators.some(ind => titleLower.includes(ind));
          const hasAnimalsMeSH = meshLower.some(m => m === 'animals' || m.includes('animal'));
          
          // Human indicators
          const hasHumansMeSH = meshLower.some(m => m === 'humans' || m === 'human');
          const hasClinicalInTitle = titleLower.includes('clinical trial') || titleLower.includes('patient');
          
          // Skip article if it doesn't match the study type
          if (studyType === 'animal') {
            // For animal studies: must have animal indicators and NOT be clinical
            if (!hasAnimalsMeSH && !hasAnimalInTitle) return; // Skip if no animal indicators
            if (hasHumansMeSH && !hasAnimalsMeSH) return; // Skip if human-only
            if (hasClinicalInTitle) return; // Skip clinical trials
          } else if (studyType === 'human') {
            // For human studies: must NOT have animal-only indicators
            if (hasAnimalInTitle) return; // Skip if animals mentioned in title
            if (hasAnimalsMeSH && !hasHumansMeSH) return; // Skip if animal-only MeSH
          }
        }
        
        // Calculate similarity score using BOTH title and abstract
        // PRIORITY: Pass drug name to boost articles that have BOTH drug AND keywords
        const drugNameForScoring = userDrugName || (drugNames.length > 0 ? drugNames[0] : null);
        const similarityScore = calculateSimilarityScore(keyTerms, title, abstract, drugNameForScoring);
        
        articles.push({
          pmid: pmid,
          title: title,
          authors: article.AuthorList?.Author ? 
            (Array.isArray(article.AuthorList.Author) ? 
              article.AuthorList.Author : [article.AuthorList.Author]
            ).map(a => `${a.LastName || ''} ${a.ForeName || ''}`.trim()).filter(Boolean) : [],
          journal: pubmedArticle.MedlineCitation?.Article?.Journal?.Title || '',
          publicationDate: article.Journal?.JournalIssue?.PubDate?.Year || '',
          abstract: abstract,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          similarityScore: similarityScore,
          meshTerms: meshTerms,
          selected: false
        });
      });
    } catch (error) {
      console.error(`Error fetching articles:`, error.message);
      return res.status(500).json({ 
        error: 'Failed to fetch article details from PubMed', 
        details: error.message 
      });
    }    console.log(`Fetched ${articles.length} articles with abstracts`);
    
    // Filter out articles with very low similarity - LOWERED threshold to show more results
    const MINIMUM_SIMILARITY_THRESHOLD = 10; // Lowered from 20 to 10
    const filteredArticles = articles.filter(a => a.similarityScore >= MINIMUM_SIMILARITY_THRESHOLD);
    
    console.log(`Filtered to ${filteredArticles.length} articles above ${MINIMUM_SIMILARITY_THRESHOLD}% similarity threshold (removed ${articles.length - filteredArticles.length} low-quality matches)`);
    
    if (filteredArticles.length === 0) {
      return res.json({
        message: `No highly relevant articles found (minimum ${MINIMUM_SIMILARITY_THRESHOLD}% similarity required). Your document may need more specific medical/pharmaceutical content, or try a different document.`,
        keyTerms,
        categorizedArticles: {},
        totalArticles: 0,
        studyType,
        statistics: {
          totalSearched: articles.length,
          aboveThreshold: 0,
          belowThreshold: articles.length,
          threshold: `${MINIMUM_SIMILARITY_THRESHOLD}%`,
          averageSimilarity: articles.length > 0 ? (articles.reduce((sum, a) => sum + a.similarityScore, 0) / articles.length).toFixed(1) + '%' : '0%',
          topMatchScore: articles.length > 0 ? Math.max(...articles.map(a => a.similarityScore)).toFixed(1) + '%' : '0%'
        }
      });
    }
    
    // Sort articles by similarity score (highest first)
    filteredArticles.sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Step 3: Categorize articles (only high-quality matches)
    const categorizedArticles = categorizeArticles(filteredArticles, includeSubheadings);
    
    res.json({
      message: 'Reference document processed successfully',
      fileName: req.file.originalname,
      studyType: studyType,
      drugName: userDrugName || (drugNames.length > 0 ? drugNames.join(', ') : 'Auto-detected'),
      doseForm: doseForm || 'Not specified',
      indication: indication || 'Not specified',
      includeSubheadings: includeSubheadings,
      keyTerms: keyTerms.slice(0, 20), // Show top 20 key terms including phrases
      searchQuery,
      categorizedArticles,
      totalArticles: filteredArticles.length,
      statistics: {
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
        lowestMatchScore: filteredArticles.length > 0 ? filteredArticles[filteredArticles.length - 1].similarityScore.toFixed(1) + '%' : '0%',
        qualityDistribution: {
          excellent: filteredArticles.filter(a => a.similarityScore >= 70).length,
          good: filteredArticles.filter(a => a.similarityScore >= 50 && a.similarityScore < 70).length,
          fair: filteredArticles.filter(a => a.similarityScore >= 30 && a.similarityScore < 50).length,
          acceptable: filteredArticles.filter(a => a.similarityScore >= 20 && a.similarityScore < 30).length
        }
      }
    });
    
  } catch (error) {
    console.error('Reference document upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process reference document', 
      details: error.message 
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

/**
 * POST /api/reference-doc/extract-info
 * Extract drug name, dose form, and indication from uploaded document
 */
router.post('/extract-info', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Extract text from uploaded file
    const extractedText = await extractTextFromFile(req.file.buffer, req.file.mimetype);
    
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from document' });
    }
    
    // Extract drug names (capitalized words, potential brand/generic names)
    const drugNamePattern = /\b([A-Z][A-Za-z]+(?:[-][A-Z][a-z]+)?)\b/g;
    const drugNames = [];
    const matches = extractedText.match(drugNamePattern);
    if (matches) {
      const uniqueDrugs = [...new Set(matches)].filter(name => 
        name.length > 3 && 
        !['The', 'This', 'That', 'With', 'From', 'Table', 'Figure', 'Method', 'Results', 'Study', 'Clinical', 'Patient', 'Disease', 'Treatment'].includes(name)
      );
      drugNames.push(...uniqueDrugs.slice(0, 5)); // Top 5 potential drug names
    }
    
    // Extract dose form
    const doseFormPatterns = {
      'tablet': /\b(tablet|tabs?)\b/gi,
      'capsule': /\b(capsule|caps?)\b/gi,
      'injection': /\b(injection|injectable|intravenous|i\.?v\.?|subcutaneous|s\.?c\.?|intramuscular|i\.?m\.?)\b/gi,
      'syrup': /\b(syrup|oral liquid)\b/gi,
      'suspension': /\b(suspension)\b/gi,
      'cream': /\b(cream|ointment|gel|topical)\b/gi,
      'powder': /\b(powder|granule)\b/gi,
      'solution': /\b(solution|drops)\b/gi,
      'patch': /\b(patch|transdermal)\b/gi,
      'inhaler': /\b(inhaler|inhalation|aerosol)\b/gi,
      'suppository': /\b(suppository|rectal)\b/gi
    };
    
    let detectedDoseForm = '';
    let maxMatches = 0;
    for (const [form, pattern] of Object.entries(doseFormPatterns)) {
      const matches = extractedText.match(pattern);
      if (matches && matches.length > maxMatches) {
        maxMatches = matches.length;
        detectedDoseForm = form;
      }
    }
    
    // Extract indication/disease/condition
    const indicationPatterns = [
      /\b(?:indication|treatment of|used for|therapeutic use|indicated for)[\s:]+([A-Za-z\s,]+?)(?:\.|,|\n|$)/gi,
      /\b(diabetes|hypertension|infection|cancer|pain|inflammation|asthma|depression|anxiety|arthritis|tuberculosis|malaria|pneumonia|fever|allergy|migraine|epilepsy|schizophrenia|parkinsons?|alzheimers?|HIV|AIDS)\b/gi
    ];
    
    const indications = [];
    indicationPatterns.forEach(pattern => {
      const matches = extractedText.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleaned = match.replace(/^(indication|treatment of|used for|therapeutic use|indicated for)[\s:]+/i, '').trim();
          if (cleaned.length > 3 && cleaned.length < 50) {
            indications.push(cleaned);
          }
        });
      }
    });
    
    const uniqueIndications = [...new Set(indications)];
    const detectedIndication = uniqueIndications.length > 0 ? uniqueIndications[0] : '';
    
    // Return extracted information
    res.json({
      drugNames: drugNames,
      suggestedDrugName: drugNames.length > 0 ? drugNames[0] : '',
      doseForm: detectedDoseForm || 'not-applicable',
      indication: detectedIndication || 'Not Applicable'
    });
    
  } catch (error) {
    console.error('Extract info error:', error);
    res.status(500).json({ 
      error: 'Failed to extract information', 
      details: error.message 
    });
  }
});

module.exports = router;
