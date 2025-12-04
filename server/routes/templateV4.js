const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

// Configure multer
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/templates');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `template-${uniqueSuffix}.docx`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

/**
 * Extract article data for template filling
 */
function extractArticleData(article) {
  const data = {
    drug_name: '',
    pharmacology: '',
    primary_pharmacodynamics: '',
    mechanism_of_action: '',
    pharmacokinetics: '',
    absorption: '',
    distribution: '',
    metabolism: '',
    excretion: '',
    toxicology: '',
    genotoxicity: '',
    carcinogenicity: '',
    reproductive_toxicity: '',
    methods: '',
    results: '',
    conclusions: ''
  };

  // Extract drug name
  const title = article.title || '';
  const drugNameMatch = title.match(/([A-Z][a-z]+(?:-[A-Z][a-z]+)*)/);
  data.drug_name = drugNameMatch ? drugNameMatch[0] : 'Test Compound';

  // Get abstract
  let abstractText = '';
  if (article.abstract) {
    if (typeof article.abstract === 'string') {
      abstractText = article.abstract;
    } else if (article.abstract.text) {
      abstractText = article.abstract.text;
    } else if (article.abstract.structured && article.abstract.sections) {
      abstractText = article.abstract.sections.map(s => s.content).join(' ');
      
      article.abstract.sections.forEach(section => {
        const label = section.label.toLowerCase();
        if (label.includes('method')) data.methods = section.content;
        if (label.includes('result')) data.results = section.content;
        if (label.includes('conclusion')) data.conclusions = section.content;
      });
    }
  }

  if (!abstractText) return data;

  const sentences = abstractText.split(/[.!?]+/).filter(s => s.trim().length > 20);

  // Extract pharmacology
  const pharmSentences = sentences.filter(s => {
    const lower = s.toLowerCase();
    return lower.includes('pharmacolog') || lower.includes('mechanism') ||
           lower.includes('receptor') || lower.includes('binding') ||
           lower.includes('activity') || lower.includes('inhibit');
  });
  data.pharmacology = pharmSentences.join('. ') + (pharmSentences.length > 0 ? '.' : '');
  data.primary_pharmacodynamics = pharmSentences.slice(0, 2).join('. ') + (pharmSentences.length > 0 ? '.' : '');
  data.mechanism_of_action = pharmSentences[0] ? pharmSentences[0] + '.' : '';

  // Extract PK
  const pkSentences = sentences.filter(s => {
    const lower = s.toLowerCase();
    return lower.includes('pharmacokinetic') || lower.includes('absorption') ||
           lower.includes('distribution') || lower.includes('metabolism') ||
           lower.includes('excretion') || lower.includes('bioavailability');
  });
  data.pharmacokinetics = pkSentences.join('. ') + (pkSentences.length > 0 ? '.' : '');

  sentences.forEach(s => {
    const lower = s.toLowerCase();
    if (lower.includes('absorption')) data.absorption += s + '. ';
    if (lower.includes('distribution')) data.distribution += s + '. ';
    if (lower.includes('metabol')) data.metabolism += s + '. ';
    if (lower.includes('excretion') || lower.includes('elimination')) data.excretion += s + '. ';
  });

  // Extract toxicology
  const toxSentences = sentences.filter(s => {
    const lower = s.toLowerCase();
    return lower.includes('toxic') || lower.includes('safety') || lower.includes('adverse');
  });
  data.toxicology = toxSentences.join('. ') + (toxSentences.length > 0 ? '.' : '');

  const genoSentences = sentences.filter(s => s.toLowerCase().includes('geno') || s.toLowerCase().includes('mutagen'));
  data.genotoxicity = genoSentences.join('. ') + (genoSentences.length > 0 ? '.' : '');

  const carcinoSentences = sentences.filter(s => s.toLowerCase().includes('carcino') || s.toLowerCase().includes('tumor'));
  data.carcinogenicity = carcinoSentences.join('. ') + (carcinoSentences.length > 0 ? '.' : '');

  const reproSentences = sentences.filter(s => s.toLowerCase().includes('reproduct') || s.toLowerCase().includes('fertility'));
  data.reproductive_toxicity = reproSentences.join('. ') + (reproSentences.length > 0 ? '.' : '');

  return data;
}

/**
 * Extract abbreviations
 */
function extractAbbreviations(article) {
  const abbreviations = new Map();
  const text = article.title + ' ' + (article.abstract?.text || article.abstract || '');
  
  const abbrPattern = /([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)\s*\(([A-Z]{2,6})\)/g;
  let match;
  
  while ((match = abbrPattern.exec(text)) !== null) {
    abbreviations.set(match[2], match[1].trim());
  }
  
  const commonAbbrs = {
    'PK': 'Pharmacokinetics',
    'PD': 'Pharmacodynamics',
    'ADME': 'Absorption, Distribution, Metabolism, Excretion',
    'AUC': 'Area Under the Curve',
    'Cmax': 'Maximum Concentration',
    'CNS': 'Central Nervous System',
    'IV': 'Intravenous',
    'PO': 'Per Os (Oral)'
  };
  
  for (const [abbr, fullTerm] of Object.entries(commonAbbrs)) {
    if (text.includes(abbr) && !abbreviations.has(abbr)) {
      abbreviations.set(abbr, fullTerm);
    }
  }
  
  return Array.from(abbreviations.entries())
    .map(([abbr, fullTerm]) => ({ abbr, fullTerm }))
    .sort((a, b) => a.abbr.localeCompare(b.abbr));
}

/**
 * Upload template
 */
router.post('/upload', upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No template file uploaded' });
    }

    res.json({
      message: 'Template uploaded successfully. Add placeholders like {pharmacology}, {toxicology}, {abbreviations_list} to your template.',
      templatePath: req.file.path,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload template', details: error.message });
  }
});

/**
 * Generate document using template with placeholders
 */
router.post('/generate', async (req, res) => {
  try {
    const { templatePath, article } = req.body;

    if (!templatePath || !article) {
      return res.status(400).json({ error: 'Template path and article required' });
    }

    // Read template
    const content = await fs.readFile(templatePath, 'binary');
    const zip = new PizZip(content);
    
    // Extract data
    const articleData = extractArticleData(article);
    const abbreviations = extractAbbreviations(article);
    
    // Create abbreviations table
    let abbrTable = '';
    if (abbreviations.length > 0) {
      abbrTable = 'Abbreviation\t\tFull Term\n';
      abbrTable += '─'.repeat(60) + '\n';
      abbreviations.forEach(abbr => {
        abbrTable += `${abbr.abbr}\t\t${abbr.fullTerm}\n`;
      });
    } else {
      abbrTable = 'No abbreviations found in the article abstract.';
    }
    
    // Get abstract text
    let abstractText = '';
    if (article.abstract) {
      if (typeof article.abstract === 'string') {
        abstractText = article.abstract;
      } else if (article.abstract.text) {
        abstractText = article.abstract.text;
      } else if (article.abstract.structured) {
        abstractText = article.abstract.sections.map(s => `${s.label}: ${s.content}`).join('\n\n');
      }
    }
    
    // Normalize PMID
    const normalizePmid = (pmid) => {
      if (typeof pmid === 'object' && pmid !== null) {
        return String(pmid._ || pmid.i || pmid);
      }
      return String(pmid);
    };
    
    // Prepare template data
    const templateData = {
      drug_name: articleData.drug_name,
      pmid: normalizePmid(article.pmid) || 'N/A',
      article_title: article.title || '',
      authors: article.authors ? article.authors.join(', ') : '',
      journal: article.journal || '',
      publication_date: article.publicationDate || '',
      
      abstract: abstractText || 'No abstract available.',
      
      pharmacology: articleData.pharmacology || 'No specific pharmacology information available in the abstract. Please refer to published literature and regulatory documents.',
      mechanism_of_action: articleData.mechanism_of_action || 'Not specified in the abstract.',
      primary_pharmacodynamics: articleData.primary_pharmacodynamics || 'Not specified in the abstract.',
      secondary_pharmacodynamics: 'Not specified in the abstract.',
      
      pharmacokinetics: articleData.pharmacokinetics || 'No specific pharmacokinetics information available in the abstract.',
      absorption: articleData.absorption || 'Not specified in the abstract.',
      distribution: articleData.distribution || 'Not specified in the abstract.',
      metabolism: articleData.metabolism || 'Not specified in the abstract.',
      excretion: articleData.excretion || 'Not specified in the abstract.',
      adme: articleData.pharmacokinetics || 'Not specified in the abstract.',
      
      toxicology: articleData.toxicology || 'No specific toxicology information available in the abstract.',
      single_dose_toxicity: 'Not specified in the abstract.',
      repeat_dose_toxicity: 'Not specified in the abstract.',
      genotoxicity: articleData.genotoxicity || 'Not specified in the abstract.',
      carcinogenicity: articleData.carcinogenicity || 'Not specified in the abstract.',
      reproductive_toxicity: articleData.reproductive_toxicity || 'Not specified in the abstract.',
      embryo_fetal: articleData.reproductive_toxicity || 'Not specified in the abstract.',
      local_tolerance: 'Not specified in the abstract.',
      
      methods: articleData.methods || 'Not specified in the abstract.',
      results: articleData.results || 'Not specified in the abstract.',
      conclusions: articleData.conclusions || 'Not specified in the abstract.',
      
      abbreviations_list: abbrTable
    };

    // Render template
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: (part) => {
        return 'Not available in abstract.';
      }
    });

    doc.render(templateData);

    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });

    const outputFilename = `Nonclinical_Overview_${article.pmid || Date.now()}.docx`;
    const outputPath = path.join(__dirname, '../uploads/generated', outputFilename);
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, buf);

    res.download(outputPath, outputFilename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
      }
      setTimeout(() => fs.unlink(outputPath).catch(console.error), 5000);
    });

  } catch (error) {
    console.error('Generation error:', error);
    
    if (error.message && error.message.includes('multi_error')) {
      return res.status(400).json({ 
        error: 'Template error: Please add placeholders like {pharmacology}, {toxicology}, {abbreviations_list} to your template.',
        details: 'The template must contain placeholders in curly braces where you want content inserted.'
      });
    }
    
    res.status(500).json({ error: 'Failed to generate document', details: error.message });
  }
});

/**
 * Preview
 */
router.post('/preview', async (req, res) => {
  try {
    const { templatePath, article } = req.body;

    const articleData = extractArticleData(article);
    const abbreviations = extractAbbreviations(article);
    
    // Normalize PMID
    const normalizePmid = (pmid) => {
      if (typeof pmid === 'object' && pmid !== null) {
        return String(pmid._ || pmid.i || pmid);
      }
      return String(pmid);
    };

    res.json({
      articleInfo: {
        title: article.title,
        pmid: normalizePmid(article.pmid),
        drugName: articleData.drug_name
      },
      extractedData: {
        pharmacology: articleData.pharmacology ? 'Available' : 'Not found',
        pharmacokinetics: articleData.pharmacokinetics ? 'Available' : 'Not found',
        toxicology: articleData.toxicology ? 'Available' : 'Not found',
        methods: articleData.methods ? 'Available' : 'Not found',
        results: articleData.results ? 'Available' : 'Not found'
      },
      abbreviations,
      message: 'Make sure your template contains placeholders like {pharmacology}, {pharmacokinetics}, {toxicology}, {abbreviations_list}'
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Failed to preview', details: error.message });
  }
});

module.exports = router;
