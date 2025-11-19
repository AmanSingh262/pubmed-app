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
 */
function extractKeyTerms(text) {
  if (!text) return [];
  
  // Remove common words and extract meaningful medical terms
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3); // Filter out very short words
  
  // Count word frequency
  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  // Get top frequent words (excluding common stop words)
  const stopWords = new Set(['that', 'this', 'with', 'from', 'have', 'were', 'been', 'their', 'there', 'which', 'these', 'would', 'about', 'into', 'than', 'more', 'other', 'such', 'only', 'also', 'some', 'when', 'where', 'them', 'then', 'will', 'could', 'should']);
  
  const keyTerms = Object.entries(wordCount)
    .filter(([word]) => !stopWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20) // Top 20 terms
    .map(([word]) => word);
  
  return keyTerms;
}

/**
 * Helper function to categorize articles based on content
 */
function categorizeArticles(articles) {
  const categorized = {
    'Pharmacokinetics': [],
    'Pharmacodynamics': [],
    'Efficacy': [],
    'Safety': [],
    'Clinical Trials': [],
    'Other': []
  };
  
  articles.forEach(article => {
    const titleLower = (article.title || '').toLowerCase();
    const abstractLower = (article.abstract || '').toLowerCase();
    const combined = titleLower + ' ' + abstractLower;
    
    let categorizedFlag = false;
    
    // Pharmacokinetics keywords
    if (combined.match(/pharmacokinetic|absorption|distribution|metabolism|excretion|clearance|half-life|bioavailability|cmax|tmax|auc/i)) {
      categorized['Pharmacokinetics'].push(article);
      categorizedFlag = true;
    }
    
    // Pharmacodynamics keywords
    if (combined.match(/pharmacodynamic|mechanism|receptor|binding|efficacy|potency|dose-response/i)) {
      categorized['Pharmacodynamics'].push(article);
      categorizedFlag = true;
    }
    
    // Efficacy keywords
    if (combined.match(/efficacy|effectiveness|treatment|outcome|response rate|success/i)) {
      categorized['Efficacy'].push(article);
      categorizedFlag = true;
    }
    
    // Safety keywords
    if (combined.match(/safety|adverse|toxicity|side effect|tolerability|contraindication/i)) {
      categorized['Safety'].push(article);
      categorizedFlag = true;
    }
    
    // Clinical Trials keywords
    if (combined.match(/clinical trial|randomized|placebo|multicenter|phase [i|ii|iii|iv]/i)) {
      categorized['Clinical Trials'].push(article);
      categorizedFlag = true;
    }
    
    // If not categorized, add to Other
    if (!categorizedFlag) {
      categorized['Other'].push(article);
    }
  });
  
  // Remove empty categories
  Object.keys(categorized).forEach(key => {
    if (categorized[key].length === 0) {
      delete categorized[key];
    }
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
    
    // Create search query from key terms
    const searchQuery = keyTerms.slice(0, 10).join(' OR '); // Use top 10 terms
    
    // Search PubMed using the extracted terms
    const PUBMED_API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    
    // Step 1: Search for articles
    const searchUrl = `${PUBMED_API_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchQuery)}&retmax=50&retmode=json&sort=relevance`;
    const searchResponse = await axios.get(searchUrl);
    const pmids = searchResponse.data.esearchresult?.idlist || [];
    
    if (pmids.length === 0) {
      return res.json({
        message: 'No similar articles found',
        keyTerms,
        categorizedArticles: {},
        totalArticles: 0
      });
    }
    
    // Step 2: Fetch article details
    const fetchUrl = `${PUBMED_API_BASE}/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`;
    const fetchResponse = await axios.get(fetchUrl);
    const articles = [];
    
    if (fetchResponse.data.result) {
      pmids.forEach(pmid => {
        const article = fetchResponse.data.result[pmid];
        if (article) {
          articles.push({
            pmid: pmid,
            title: article.title || '',
            authors: article.authors?.map(a => a.name) || [],
            journal: article.fulljournalname || article.source || '',
            publicationDate: article.pubdate || '',
            abstract: '', // Will be fetched if needed
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
          });
        }
      });
    }
    
    // Step 3: Categorize articles
    const categorizedArticles = categorizeArticles(articles);
    
    res.json({
      message: 'Reference document processed successfully',
      fileName: req.file.originalname,
      keyTerms: keyTerms.slice(0, 10),
      searchQuery,
      categorizedArticles,
      totalArticles: articles.length
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
          abstracts[pmid] = abstractTexts.map(text => {
            if (typeof text === 'string') return text;
            if (text._) return text._;
            return '';
          }).join(' ');
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
