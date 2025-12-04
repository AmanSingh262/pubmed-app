const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

// Configure multer for template upload
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
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Extract comprehensive data from article for template filling
 */
function extractArticleData(article) {
  const data = {
    // Basic metadata
    drug_name: article.title || 'Not available',
    strength: 'To be determined',
    dosage_form: 'To be determined',
    company_name: 'Your Company Name',
    pmid: article.pmid || '',
    doi: article.doi || '',
    
    // Article information
    article_title: article.title || '',
    article_authors: article.authors ? article.authors.join(', ') : '',
    article_journal: article.journal || '',
    article_date: article.publicationDate || '',
    article_url: article.url || `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
    
    // Abstract and summary
    full_abstract: '',
    introduction: '',
    background: '',
    
    // Pharmacology
    pharmacology: '',
    mechanism_of_action: '',
    primary_pharmacodynamics: '',
    pd_in_vitro: '',
    pd_in_vivo: '',
    secondary_pharmacodynamics: '',
    safety_pharmacology: '',
    cns_effects: '',
    cardiovascular_effects: '',
    respiratory_effects: '',
    pd_interactions: '',
    
    // Pharmacokinetics
    pharmacokinetics: '',
    absorption: '',
    distribution: '',
    metabolism: '',
    excretion: '',
    pk_method: '',
    pk_interactions: '',
    
    // Toxicology
    toxicology: '',
    single_dose_toxicity: '',
    repeat_dose_toxicity: '',
    genotoxicity: '',
    carcinogenicity: '',
    reproductive_toxicity: '',
    fertility: '',
    embryo_fetal: '',
    perinatal_postnatal: '',
    local_tolerance: '',
    other_toxicity: '',
    
    // Study design
    study_design: '',
    study_methods: '',
    study_animals: '',
    study_dose: '',
    study_results: '',
    study_conclusions: ''
  };
  
  // Extract abstract
  let abstractText = '';
  if (article.abstract) {
    if (article.abstract.structured && article.abstract.sections) {
      abstractText = article.abstract.sections
        .map(s => `${s.label}: ${s.content}`)
        .join('\n\n');
      data.full_abstract = abstractText;
      
      // Extract specific sections
      article.abstract.sections.forEach(section => {
        const label = section.label.toLowerCase();
        const content = section.content;
        
        if (label.includes('background') || label.includes('importance')) {
          data.background = content;
          data.introduction = content;
        }
        if (label.includes('objective') || label.includes('purpose')) {
          data.introduction += '\n\n' + content;
        }
        if (label.includes('method') || label.includes('design')) {
          data.study_methods = content;
          data.study_design = content;
        }
        if (label.includes('result') || label.includes('finding')) {
          data.study_results = content;
        }
        if (label.includes('conclusion')) {
          data.study_conclusions = content;
        }
      });
    } else if (article.abstract.text) {
      abstractText = article.abstract.text;
      data.full_abstract = abstractText;
    } else if (typeof article.abstract === 'string') {
      abstractText = article.abstract;
      data.full_abstract = abstractText;
    }
  }
  
  // Smart extraction from abstract text
  if (abstractText) {
    const sentences = abstractText.split(/[.!?]+/).filter(s => s.trim());
    
    // Pharmacology extraction
    const pharmSentences = sentences.filter(s => {
      const lower = s.toLowerCase();
      return lower.includes('pharmacolog') || lower.includes('mechanism') || 
             lower.includes('activity') || lower.includes('receptor') ||
             lower.includes('binding') || lower.includes('target') ||
             lower.includes('inhibit') || lower.includes('activate');
    });
    if (pharmSentences.length > 0) {
      data.pharmacology = pharmSentences.join('. ') + '.';
      data.primary_pharmacodynamics = pharmSentences.join('. ') + '.';
      data.mechanism_of_action = pharmSentences[0] + '.';
    }
    
    // Pharmacokinetics extraction
    const pkSentences = sentences.filter(s => {
      const lower = s.toLowerCase();
      return lower.includes('pharmacokinetic') || lower.includes('pk') ||
             lower.includes('absorption') || lower.includes('distribution') ||
             lower.includes('metabolism') || lower.includes('excretion') ||
             lower.includes('bioavailability') || lower.includes('clearance') ||
             lower.includes('half-life') || lower.includes('auc') || lower.includes('cmax');
    });
    if (pkSentences.length > 0) {
      data.pharmacokinetics = pkSentences.join('. ') + '.';
      
      // Specific PK components
      pkSentences.forEach(s => {
        const lower = s.toLowerCase();
        if (lower.includes('absorption') || lower.includes('bioavailability')) {
          data.absorption += s + '. ';
        }
        if (lower.includes('distribution') || lower.includes('volume')) {
          data.distribution += s + '. ';
        }
        if (lower.includes('metabol')) {
          data.metabolism += s + '. ';
        }
        if (lower.includes('excretion') || lower.includes('elimination') || lower.includes('clearance')) {
          data.excretion += s + '. ';
        }
      });
    }
    
    // Toxicology extraction
    const toxSentences = sentences.filter(s => {
      const lower = s.toLowerCase();
      return lower.includes('toxic') || lower.includes('safety') ||
             lower.includes('adverse') || lower.includes('tolerat') ||
             lower.includes('dose') && (lower.includes('safe') || lower.includes('effect'));
    });
    if (toxSentences.length > 0) {
      data.toxicology = toxSentences.join('. ') + '.';
      data.safety_pharmacology = toxSentences.join('. ') + '.';
    }
    
    // Genotoxicity/Carcinogenicity
    const genoSentences = sentences.filter(s => {
      const lower = s.toLowerCase();
      return lower.includes('geno') || lower.includes('mutagen') ||
             lower.includes('carcino') || lower.includes('tumor');
    });
    if (genoSentences.length > 0) {
      data.genotoxicity = genoSentences.join('. ') + '.';
      data.carcinogenicity = genoSentences.join('. ') + '.';
    }
    
    // Reproductive toxicity
    const reproSentences = sentences.filter(s => {
      const lower = s.toLowerCase();
      return lower.includes('reproduct') || lower.includes('fertility') ||
             lower.includes('embryo') || lower.includes('fetal') ||
             lower.includes('teratogen') || lower.includes('development');
    });
    if (reproSentences.length > 0) {
      data.reproductive_toxicity = reproSentences.join('. ') + '.';
      data.embryo_fetal = reproSentences.join('. ') + '.';
    }
  }
  
  // Fill in "not available" for empty fields
  Object.keys(data).forEach(key => {
    if (!data[key] || data[key].trim() === '') {
      data[key] = 'No specific information available in the article abstract. Please refer to published literature and regulatory documents.';
    }
  });
  
  return data;
}

/**
 * Create abbreviations list from article
 */
function extractAbbreviations(article) {
  const abbreviations = [];
  const text = article.title + ' ' + (article.abstract?.text || article.abstract || '');
  
  // Find patterns like "Full Term (ABB)"
  const abbrPattern = /([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)\s*\(([A-Z]{2,6})\)/g;
  let match;
  
  const seen = new Set();
  while ((match = abbrPattern.exec(text)) !== null) {
    const fullTerm = match[1].trim();
    const abbr = match[2].trim();
    
    if (!seen.has(abbr)) {
      abbreviations.push({ abbr, fullTerm });
      seen.add(abbr);
    }
  }
  
  // Add common pharmaceutical abbreviations
  const commonAbbr = [
    { abbr: 'PK', fullTerm: 'Pharmacokinetics' },
    { abbr: 'PD', fullTerm: 'Pharmacodynamics' },
    { abbr: 'ADME', fullTerm: 'Absorption, Distribution, Metabolism, Excretion' },
    { abbr: 'AUC', fullTerm: 'Area Under Curve' },
    { abbr: 'Cmax', fullTerm: 'Maximum Plasma Concentration' },
    { abbr: 'CNS', fullTerm: 'Central Nervous System' },
    { abbr: 'NOAEL', fullTerm: 'No Observed Adverse Effect Level' },
    { abbr: 'NOEL', fullTerm: 'No Observed Effect Level' },
    { abbr: 'LD50', fullTerm: 'Lethal Dose 50%' }
  ];
  
  commonAbbr.forEach(item => {
    if (!seen.has(item.abbr)) {
      abbreviations.push(item);
      seen.add(item.abbr);
    }
  });
  
  // Sort alphabetically
  abbreviations.sort((a, b) => a.abbr.localeCompare(b.abbr));
  
  return abbreviations;
}

// ==================== ROUTES ====================

/**
 * POST /api/template-v2/upload
 * Upload template document
 */
router.post('/upload', upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No template file uploaded' });
    }

    res.json({
      success: true,
      message: 'Template uploaded successfully',
      templateId: path.basename(req.file.path, '.docx'),
      templatePath: req.file.path,
      filename: req.file.filename
    });

  } catch (error) {
    console.error('Template upload error:', error);
    res.status(500).json({
      error: 'Failed to upload template',
      details: error.message
    });
  }
});

/**
 * POST /api/template-v2/generate
 * Generate filled document from template using placeholders
 */
router.post('/generate', async (req, res) => {
  try {
    const { templatePath, article } = req.body;

    if (!templatePath || !article) {
      return res.status(400).json({
        error: 'Missing required fields: templatePath and article'
      });
    }

    // Normalize PMID
    const normalizePmid = (pmid) => {
      if (typeof pmid === 'object' && pmid !== null) {
        return String(pmid._ || pmid.i || pmid);
      }
      return String(pmid || '');
    };

    // Normalize article PMID before processing
    const normalizedArticle = {
      ...article,
      pmid: normalizePmid(article.pmid)
    };

    // Read template file
    const content = await fs.readFile(templatePath);
    const zip = new PizZip(content);
    
    // Extract article data
    const articleData = extractArticleData(normalizedArticle);
    const abbreviations = extractAbbreviations(normalizedArticle);
    
    // Create abbreviations table text
    let abbrText = '';
    abbreviations.forEach(({ abbr, fullTerm }) => {
      abbrText += `${abbr}\t${fullTerm}\n`;
    });
    articleData.abbreviations_list = abbrText;
    
    // Try to fill template with placeholders
    try {
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => 'Not available'
      });
      
      // Set data
      doc.render(articleData);
      
      // Generate buffer
      const buf = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE'
      });
      
      // Send file
      const filename = `Nonclinical_Overview_${normalizedArticle.pmid}_${Date.now()}.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buf.length);
      res.send(buf);
      
    } catch (templateError) {
      // Template doesn't have placeholders, return error with instructions
      console.error('Template rendering error:', templateError);
      
      res.status(400).json({
        error: 'Template does not contain placeholders',
        message: 'Please add placeholders like {drug_name}, {pharmacology}, {toxicology} etc. in your template',
        details: templateError.message,
        availablePlaceholders: Object.keys(articleData)
      });
    }

  } catch (error) {
    console.error('Document generation error:', error);
    res.status(500).json({
      error: 'Failed to generate document',
      details: error.message
    });
  }
});

/**
 * GET /api/template-v2/placeholders
 * Get list of available placeholders
 */
router.get('/placeholders', (req, res) => {
  const placeholders = {
    basic: [
      '{drug_name}', '{strength}', '{dosage_form}', '{company_name}',
      '{pmid}', '{doi}', '{article_title}', '{article_authors}',
      '{article_journal}', '{article_date}', '{article_url}'
    ],
    content: [
      '{full_abstract}', '{introduction}', '{background}',
      '{study_design}', '{study_methods}', '{study_results}', '{study_conclusions}'
    ],
    pharmacology: [
      '{pharmacology}', '{mechanism_of_action}', '{primary_pharmacodynamics}',
      '{pd_in_vitro}', '{pd_in_vivo}', '{secondary_pharmacodynamics}',
      '{safety_pharmacology}', '{cns_effects}', '{cardiovascular_effects}',
      '{respiratory_effects}', '{pd_interactions}'
    ],
    pharmacokinetics: [
      '{pharmacokinetics}', '{absorption}', '{distribution}',
      '{metabolism}', '{excretion}', '{pk_method}', '{pk_interactions}'
    ],
    toxicology: [
      '{toxicology}', '{single_dose_toxicity}', '{repeat_dose_toxicity}',
      '{genotoxicity}', '{carcinogenicity}', '{reproductive_toxicity}',
      '{fertility}', '{embryo_fetal}', '{perinatal_postnatal}',
      '{local_tolerance}', '{other_toxicity}'
    ],
    other: [
      '{abbreviations_list}'
    ]
  };
  
  res.json({
    success: true,
    placeholders,
    usage: 'Add these placeholders to your Word template where you want content to appear'
  });
});

/**
 * DELETE /api/template-v2/:filename
 * Delete template file
 */
router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const templatePath = path.join(__dirname, '../uploads/templates', `${filename}.docx`);
    
    await fs.unlink(templatePath);
    
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });

  } catch (error) {
    console.error('Template deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete template',
      details: error.message
    });
  }
});

module.exports = router;
