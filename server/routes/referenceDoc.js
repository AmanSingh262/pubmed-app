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
 * Enhanced version with better term extraction and medical term recognition
 */
function extractKeyTerms(text) {
  if (!text) return [];
  
  // Medical term patterns to boost importance
  const medicalPatterns = [
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, // Capitalized terms (drug names, conditions)
    /\b\d+\s*(?:mg|mcg|g|ml|%)\b/gi, // Dosages and measurements
    /\b(?:phase|trial|study|treatment|therapy|diagnosis|prognosis)\b/gi, // Clinical terms
  ];
  
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
    'therefore', 'thus', 'although', 'since', 'while', 'whereas'
  ]);
  
  // Medical keywords to prioritize
  const medicalKeywords = new Set([
    'pharmacokinetic', 'pharmacodynamic', 'efficacy', 'safety', 'toxicity',
    'adverse', 'clinical', 'trial', 'randomized', 'placebo', 'dose', 'treatment',
    'therapy', 'patient', 'disease', 'condition', 'diagnosis', 'prognosis',
    'metabolism', 'absorption', 'distribution', 'excretion', 'clearance',
    'bioavailability', 'protein', 'receptor', 'inhibitor', 'antagonist', 'agonist'
  ]);
  
  // Count word frequency with medical term boosting
  const wordCount = {};
  words.forEach(word => {
    if (stopWords.has(word)) return;
    
    // Boost medical keywords
    const boost = medicalKeywords.has(word) ? 3 : 1;
    wordCount[word] = (wordCount[word] || 0) + boost;
  });
  
  // Get top frequent words
  const keyTerms = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30) // Top 30 terms
    .map(([word]) => word);
  
  return keyTerms;
}

/**
 * Helper function to calculate similarity score between reference document and article
 * Enhanced with TF-IDF-like scoring and context matching
 */
function calculateSimilarityScore(referenceKeyTerms, articleTitle, articleAbstract = '') {
  if (!referenceKeyTerms || referenceKeyTerms.length === 0) return 0;
  
  const articleText = `${articleTitle} ${articleAbstract}`.toLowerCase();
  const articleWords = articleText.split(/\s+/);
  
  let matchCount = 0;
  let weightedScore = 0;
  let titleBonus = 0;
  
  referenceKeyTerms.forEach((term, index) => {
    const weight = referenceKeyTerms.length - index;
    const termLower = term.toLowerCase();
    
    // Check for exact term match
    if (articleText.includes(termLower)) {
      matchCount++;
      
      // Count occurrences for frequency boost
      const occurrences = (articleText.match(new RegExp(termLower, 'g')) || []).length;
      weightedScore += weight * Math.min(occurrences, 3); // Cap at 3 to avoid over-weighting
      
      // Extra bonus if term appears in title
      if (articleTitle.toLowerCase().includes(termLower)) {
        titleBonus += weight * 2;
      }
    }
  });
  
  // Calculate base score
  const maxPossibleScore = referenceKeyTerms.reduce((sum, _, idx) => 
    sum + (referenceKeyTerms.length - idx), 0);
  
  const baseScore = (weightedScore / maxPossibleScore) * 70; // 70% weight
  const titleScore = (titleBonus / maxPossibleScore) * 20; // 20% weight for title matches
  const coverageScore = (matchCount / referenceKeyTerms.length) * 10; // 10% weight for term coverage
  
  const finalScore = baseScore + titleScore + coverageScore;
  
  return Math.min(100, Math.round(finalScore * 10) / 10);
}

/**
 * Helper function to categorize articles based on content
 * Enhanced with better pattern matching and multiple category support
 */
function categorizeArticles(articles) {
  const categorized = {
    'Pharmacokinetics': [],
    'Pharmacodynamics': [],
    'Efficacy & Clinical Trials': [],
    'Safety & Toxicity': []
  };
  
  // Limit to top 50 per category
  const maxPerCategory = 50;
  
  articles.forEach(article => {
    const titleLower = (article.title || '').toLowerCase();
    const abstractLower = (article.abstract || '').toLowerCase();
    const combined = titleLower + ' ' + abstractLower;
    
    // Track which categories this article belongs to
    const matchedCategories = [];
    
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
          categorized[category].push({...article, primaryCategory: matchedCategories[0]});
        }
      });
    } else {
      // If no specific category, add to the first category that has space
      const firstAvailable = Object.keys(categorized).find(cat => categorized[cat].length < maxPerCategory);
      if (firstAvailable) {
        categorized[firstAvailable].push({...article, primaryCategory: 'General'});
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
    
    // Get study type from request (animal or human)
    const studyType = req.body.studyType || 'all';
    
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
    
    // Create search query from key terms, adding study type filter
    let searchQuery = keyTerms.slice(0, 15).join(' OR '); // Use top 15 terms for better coverage
    
    // Add study type filter to search query
    if (studyType === 'animal') {
      searchQuery += ' AND (animal[MeSH Terms] OR animals[MeSH Terms] OR mouse[Title/Abstract] OR mice[Title/Abstract] OR rat[Title/Abstract] OR rats[Title/Abstract] OR rabbit[Title/Abstract] OR rabbits[Title/Abstract] OR dog[Title/Abstract] OR dogs[Title/Abstract] OR pig[Title/Abstract] OR pigs[Title/Abstract] OR primate[Title/Abstract] OR primates[Title/Abstract] OR monkey[Title/Abstract] OR monkeys[Title/Abstract] OR guinea pig[Title/Abstract] OR hamster[Title/Abstract] OR ferret[Title/Abstract] OR sheep[Title/Abstract] OR goat[Title/Abstract] OR cattle[Title/Abstract] OR feline[Title/Abstract] OR canine[Title/Abstract] OR murine[Title/Abstract] OR porcine[Title/Abstract] OR bovine[Title/Abstract] OR equine[Title/Abstract] OR ovine[Title/Abstract] OR rodent[Title/Abstract] OR rodents[Title/Abstract] OR in vivo[Title/Abstract] OR animal model[Title/Abstract] OR animal study[Title/Abstract])';
    } else if (studyType === 'human') {
      searchQuery += ' AND (human[MeSH Terms] OR humans[MeSH Terms] OR patient[Title/Abstract] OR patients[Title/Abstract] OR clinical trial[Title/Abstract] OR clinical study[Title/Abstract] OR human study[Title/Abstract] OR volunteer[Title/Abstract] OR volunteers[Title/Abstract] OR participant[Title/Abstract] OR participants[Title/Abstract] OR subject[Title/Abstract] OR subjects[Title/Abstract] OR adult[Title/Abstract] OR adults[Title/Abstract] OR child[Title/Abstract] OR children[Title/Abstract] OR adolescent[Title/Abstract] OR infant[Title/Abstract] OR elderly[Title/Abstract] OR geriatric[Title/Abstract] OR pediatric[Title/Abstract])';
    }
    
    // Search PubMed using the extracted terms
    const PUBMED_API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    
    // Step 1: Search for articles - fetch 200 results (top 50 per category = 4 pages)
    const searchUrl = `${PUBMED_API_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchQuery)}&retmax=200&retmode=json&sort=relevance`;
    const searchResponse = await axios.get(searchUrl);
    const pmids = searchResponse.data.esearchresult?.idlist || [];
    
    if (pmids.length === 0) {
      return res.json({
        message: 'No similar articles found',
        keyTerms,
        categorizedArticles: {},
        totalArticles: 0,
        studyType
      });
    }
    
    // Step 2: Fetch article details
    const fetchUrl = `${PUBMED_API_BASE}/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`;
    const fetchResponse = await axios.get(fetchUrl);
    const articles = [];
    
    // Helper function to normalize PMID
    const normalizePmid = (pmid) => {
      if (typeof pmid === 'object' && pmid !== null) {
        return String(pmid._ || pmid.i || pmid);
      }
      return String(pmid);
    };
    
    if (fetchResponse.data.result) {
      pmids.forEach((pmid, index) => {
        const article = fetchResponse.data.result[pmid];
        if (article) {
          const title = article.title || '';
          const normalizedPmid = normalizePmid(pmid);
          
          // Calculate similarity score based on keyword overlap with reference document
          const similarityScore = calculateSimilarityScore(keyTerms, title);
          
          articles.push({
            pmid: normalizedPmid,
            title: title,
            authors: article.authors?.map(a => a.name) || [],
            journal: article.fulljournalname || article.source || '',
            publicationDate: article.pubdate || '',
            abstract: '', // Will be fetched if needed
            url: `https://pubmed.ncbi.nlm.nih.gov/${normalizedPmid}/`,
            similarityScore: similarityScore,
            selected: false // For selection in UI
          });
        }
      });
    }
    
    // Sort articles by similarity score (highest first)
    articles.sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Step 3: Categorize articles
    const categorizedArticles = categorizeArticles(articles);
    
    res.json({
      message: 'Reference document processed successfully',
      fileName: req.file.originalname,
      studyType: studyType,
      keyTerms: keyTerms.slice(0, 15), // Show top 15 key terms
      searchQuery,
      categorizedArticles,
      totalArticles: articles.length,
      statistics: {
        totalFound: articles.length,
        categoryCounts: Object.fromEntries(
          Object.entries(categorizedArticles).map(([cat, arts]) => [cat, arts.length])
        ),
        averageSimilarity: articles.length > 0 
          ? (articles.reduce((sum, a) => sum + a.similarityScore, 0) / articles.length).toFixed(1)
          : 0,
        topMatchScore: articles.length > 0 ? articles[0].similarityScore : 0
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

module.exports = router;
