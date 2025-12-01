const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const xml2js = require('xml2js');
const ABBREVIATIONS_TABLE_MARKER = '___ABBREVIATIONS_TABLE_PLACEHOLDER___';

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
 * Analyze complete template structure including headings, tables, and placeholders
 */
async function analyzeTemplateStructure(filePath) {
  const content = await fs.readFile(filePath, 'binary');
  const zip = new PizZip(content);
  
  // Get document.xml which contains the main content
  const docXml = zip.file('word/document.xml').asText();
  
  const parser = new xml2js.Parser();
  const doc = await parser.parseStringPromise(docXml);
  
  const structure = {
    headings: [],
    tables: [],
    hasAbbreviationSection: false,
    hasAbstractSection: false,
    totalParagraphs: 0,
    totalTables: 0
  };
  
  // Parse paragraphs and tables
  const body = doc['w:document']['w:body'][0];
  let currentHeadingLevel = 0;
  
  if (body['w:p']) {
    body['w:p'].forEach((para, index) => {
      structure.totalParagraphs++;
      
      // Check for heading style
      const pPr = para['w:pPr'] ? para['w:pPr'][0] : null;
      if (pPr && pPr['w:pStyle']) {
        const styleId = pPr['w:pStyle'][0]['$']['w:val'];
        
        if (styleId.includes('Heading')) {
          const level = parseInt(styleId.replace(/\D/g, '')) || 1;
          const text = extractTextFromParagraph(para);
          
          structure.headings.push({
            level,
            text,
            position: index,
            normalizedText: text.toLowerCase().replace(/[^a-z0-9\s]/g, '')
          });
          
          // Check for special sections
          if (text.toLowerCase().includes('abbreviation')) {
            structure.hasAbbreviationSection = true;
          }
          if (text.toLowerCase().includes('abstract')) {
            structure.hasAbstractSection = true;
          }
        }
      }
    });
  }
  
  if (body['w:tbl']) {
    structure.totalTables = body['w:tbl'].length;
  }
  
  return structure;
}

/**
 * Extract text from paragraph XML
 */
function extractTextFromParagraph(para) {
  let text = '';
  if (para['w:r']) {
    para['w:r'].forEach(run => {
      if (run['w:t']) {
        run['w:t'].forEach(t => {
          text += typeof t === 'string' ? t : (t._ || '');
        });
      }
    });
  }
  return text.trim();
}

/**
 * Extract comprehensive data from article
 */
function extractArticleData(article) {
  const data = {
    // Basic metadata
    drug_name: '',
    pmid: article.pmid || 'N/A',
    doi: article.doi || '',
    article_title: article.title || '',
    authors: '',
    journal: article.journal || '',
    publication_date: article.publicationDate || '',
    
    // Abstract - FULL TEXT
    abstract: '',
    abstract_background: '',
    abstract_methods: '',
    abstract_results: '',
    abstract_conclusions: '',
    
    // Pharmacology
    pharmacology: '',
    mechanism_of_action: '',
    primary_pharmacodynamics: '',
    secondary_pharmacodynamics: '',
    receptor_binding: '',
    
    // Pharmacokinetics
    pharmacokinetics: '',
    absorption: '',
    distribution: '',
    metabolism: '',
    excretion: '',
    adme: '',
    bioavailability: '',
    
    // Toxicology
    toxicology: '',
    acute_toxicity: '',
    single_dose_toxicity: '',
    repeat_dose_toxicity: '',
    chronic_toxicity: '',
    genotoxicity: '',
    carcinogenicity: '',
    reproductive_toxicity: '',
    embryo_fetal_toxicity: '',
    fertility: '',
    local_tolerance: '',
    
    // Study information
    study_design: '',
    study_methods: '',
    study_population: '',
    study_results: '',
    study_conclusions: '',
    study_objectives: '',
    
    // Safety
    safety: '',
    adverse_effects: '',
    side_effects: ''
  };

  // Extract drug name from title
  const title = article.title || '';
  const drugMatch = title.match(/([A-Z][a-z]+(?:-[A-Z][a-z]+)*)/);
  data.drug_name = drugMatch ? drugMatch[0] : 'Test Compound';

  // Authors
  if (article.authors) {
    data.authors = Array.isArray(article.authors) 
      ? article.authors.join(', ') 
      : article.authors;
  }

  // Extract FULL ABSTRACT
  let fullAbstractText = '';
  
  if (article.abstract) {
    if (typeof article.abstract === 'string') {
      fullAbstractText = article.abstract;
      data.abstract = article.abstract;
    } else if (article.abstract.text) {
      fullAbstractText = article.abstract.text;
      data.abstract = article.abstract.text;
    } else if (article.abstract.structured && article.abstract.sections) {
      // Structured abstract - preserve all sections
      const structuredText = article.abstract.sections
        .map(s => `${s.label}: ${s.content}`)
        .join('\n\n');
      fullAbstractText = structuredText;
      data.abstract = structuredText;
      
      // Extract specific sections
      article.abstract.sections.forEach(section => {
        const label = section.label.toLowerCase();
        const content = section.content;
        
        if (label.includes('background') || label.includes('introduction')) {
          data.abstract_background = content;
        }
        if (label.includes('method') || label.includes('material')) {
          data.abstract_methods = content;
          data.study_methods = content;
        }
        if (label.includes('result') || label.includes('finding')) {
          data.abstract_results = content;
          data.study_results = content;
        }
        if (label.includes('conclusion') || label.includes('discussion')) {
          data.abstract_conclusions = content;
          data.study_conclusions = content;
        }
        if (label.includes('objective') || label.includes('purpose')) {
          data.study_objectives = content;
        }
      });
    }
  }

  if (!fullAbstractText) {
    data.abstract = 'No abstract available for this article.';
    return data;
  }

  // Split into sentences for intelligent extraction
  const sentences = fullAbstractText.split(/[.!?]+/).filter(s => s.trim().length > 20);

  // PHARMACOLOGY EXTRACTION
  const pharmKeywords = [
    'pharmacolog', 'mechanism', 'activity', 'receptor', 'binding', 
    'target', 'inhibit', 'activate', 'agonist', 'antagonist', 'affinity',
    'potency', 'efficacy', 'selectivity', 'modulator'
  ];
  
  const pharmSentences = sentences.filter(s => {
    const lower = s.toLowerCase();
    return pharmKeywords.some(kw => lower.includes(kw));
  });
  
  if (pharmSentences.length > 0) {
    data.pharmacology = pharmSentences.join('. ') + '.';
    data.primary_pharmacodynamics = pharmSentences.slice(0, 3).join('. ') + '.';
    data.mechanism_of_action = pharmSentences[0] + '.';
    
    // Extract receptor binding info
    const receptorSentences = pharmSentences.filter(s => 
      s.toLowerCase().includes('receptor') || s.toLowerCase().includes('binding')
    );
    if (receptorSentences.length > 0) {
      data.receptor_binding = receptorSentences.join('. ') + '.';
    }
  }

  // PHARMACOKINETICS EXTRACTION
  const pkKeywords = [
    'pharmacokinetic', 'pk', 'absorption', 'distribution', 'metabolism', 
    'excretion', 'bioavailability', 'clearance', 'half-life', 'auc', 
    'cmax', 'tmax', 'volume', 'adme'
  ];
  
  const pkSentences = sentences.filter(s => {
    const lower = s.toLowerCase();
    return pkKeywords.some(kw => lower.includes(kw));
  });
  
  if (pkSentences.length > 0) {
    data.pharmacokinetics = pkSentences.join('. ') + '.';
    data.adme = pkSentences.join('. ') + '.';
  }
  
  // Specific PK components
  sentences.forEach(s => {
    const lower = s.toLowerCase();
    if (lower.includes('absorption') || lower.includes('bioavailability') || lower.includes('uptake')) {
      data.absorption += s.trim() + '. ';
    }
    if (lower.includes('distribution') || lower.includes('tissue') || lower.includes('volume')) {
      data.distribution += s.trim() + '. ';
    }
    if (lower.includes('metabol') || lower.includes('cyp') || lower.includes('biotransform')) {
      data.metabolism += s.trim() + '. ';
    }
    if (lower.includes('excretion') || lower.includes('elimination') || lower.includes('clearance') || lower.includes('renal')) {
      data.excretion += s.trim() + '. ';
    }
    if (lower.includes('bioavailability')) {
      data.bioavailability += s.trim() + '. ';
    }
  });

  // TOXICOLOGY EXTRACTION
  const toxKeywords = [
    'toxic', 'safety', 'adverse', 'tolerat', 'dose', 'ld50', 'noael', 
    'loael', 'mtd', 'hazard'
  ];
  
  const toxSentences = sentences.filter(s => {
    const lower = s.toLowerCase();
    return toxKeywords.some(kw => lower.includes(kw));
  });
  
  if (toxSentences.length > 0) {
    data.toxicology = toxSentences.join('. ') + '.';
    data.safety = toxSentences.join('. ') + '.';
  }
  
  // Specific toxicology types
  sentences.forEach(s => {
    const lower = s.toLowerCase();
    if (lower.includes('acute') && (lower.includes('toxic') || lower.includes('dose'))) {
      data.acute_toxicity += s.trim() + '. ';
      data.single_dose_toxicity += s.trim() + '. ';
    }
    if (lower.includes('chronic') || lower.includes('repeat') || lower.includes('subchronic')) {
      data.chronic_toxicity += s.trim() + '. ';
      data.repeat_dose_toxicity += s.trim() + '. ';
    }
    if (lower.includes('geno') || lower.includes('mutagen') || lower.includes('ames')) {
      data.genotoxicity += s.trim() + '. ';
    }
    if (lower.includes('carcino') || lower.includes('tumor') || lower.includes('cancer') || lower.includes('neoplasm')) {
      data.carcinogenicity += s.trim() + '. ';
    }
    if (lower.includes('reproduct') || lower.includes('fertility') || lower.includes('sperm') || lower.includes('ovarian')) {
      data.reproductive_toxicity += s.trim() + '. ';
      data.fertility += s.trim() + '. ';
    }
    if (lower.includes('embryo') || lower.includes('fetal') || lower.includes('teratogen') || lower.includes('development')) {
      data.embryo_fetal_toxicity += s.trim() + '. ';
    }
    if (lower.includes('local') && lower.includes('tolerat')) {
      data.local_tolerance += s.trim() + '. ';
    }
    if (lower.includes('adverse') || lower.includes('side effect')) {
      data.adverse_effects += s.trim() + '. ';
      data.side_effects += s.trim() + '. ';
    }
  });

  // Clean up empty fields
  Object.keys(data).forEach(key => {
    if (!data[key] || data[key].trim() === '' || data[key].trim() === '.') {
      data[key] = 'Not specified in the article abstract.';
    }
  });

  return data;
}

/**
 * Extract abbreviations from article
 */
function extractAbbreviations(article) {
  const abbreviations = new Map();
  
  // Get all text
  let allText = article.title || '';
  if (article.abstract) {
    if (typeof article.abstract === 'string') {
      allText += ' ' + article.abstract;
    } else if (article.abstract.text) {
      allText += ' ' + article.abstract.text;
    } else if (article.abstract.sections) {
      allText += ' ' + article.abstract.sections.map(s => s.content).join(' ');
    }
  }
  
  // Find patterns like "Full Term (ABBR)" with more restrictive patterns
  const patterns = [
    // Pattern 1: "pharmacokinetics (PK)" - captures up to 5 words before abbreviation
    /\b([A-Z][a-z]+(?:\s+[a-z]+){0,4})\s*\(([A-Z]{2,6})\)/g,
    // Pattern 2: "central nervous system (CNS)" - handles multiple capitalized words
    /\b([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+){1,3})\s*\(([A-Z]{2,6})\)/g,
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(allText)) !== null) {
      const fullTerm = match[1].trim();
      const abbr = match[2];
      
      // Only accept if full term is reasonably short (not a full sentence)
      if (abbr.length >= 2 && abbr.length <= 6 && fullTerm.length < 100) {
        // Clean up the full term - capitalize first letter properly
        const cleanTerm = fullTerm.charAt(0).toUpperCase() + fullTerm.slice(1).toLowerCase();
        abbreviations.set(abbr, cleanTerm);
      }
    }
  });
  
  // Add common pharmaceutical abbreviations if they appear in text
  const commonAbbrs = {
    'a.c.': 'before food or meals',
    'a.m.': 'before noon',
    'admin': 'administration',
    'approx.': 'approximately',
    'ATC': 'anatomical therapeutic chemical',
    'AUC': 'area under the curve',
    'bid': 'twice daily',
    'CAS': 'chemical abstract services',
    'CL/F': 'oral clearance',
    'CLcr': 'creatinine clearance',
    'cm': 'centimeter',
    'Cmax': 'maximal plasma concentrations',
    'CNS': 'central nervous system',
    'CV': 'cardiovascular',
    'g': 'gram',
    'h': 'hours',
    'im': 'intramuscular',
    'IV': 'intravenous',
    'kg': 'kilogram',
    'L': 'liters',
    'mg': 'milligram',
    'mL': 'milliliter',
    'PI': 'product information',
    'PK': 'pharmacokinetics',
    'PD': 'pharmacodynamics',
    'µg': 'microgram',
    'ADME': 'absorption, distribution, metabolism, excretion',
    'Tmax': 'time to maximum concentration',
    'PO': 'per os (oral)',
    'LD50': 'lethal dose 50%',
    'NOAEL': 'no observed adverse effect level',
    'LOAEL': 'lowest observed adverse effect level',
    'MTD': 'maximum tolerated dose',
    'IC50': 'half maximal inhibitory concentration',
    'EC50': 'half maximal effective concentration',
    'ED50': 'median effective dose',
    'CYP': 'cytochrome P450',
    'FDA': 'Food and Drug Administration',
    'GLP': 'good laboratory practice',
    'OECD': 'Organisation for Economic Co-operation and Development'
  };
  
  for (const [abbr, fullTerm] of Object.entries(commonAbbrs)) {
    const regex = new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(allText) && !abbreviations.has(abbr)) {
      abbreviations.set(abbr, fullTerm);
    }
  }
  
  // Convert to sorted array
  return Array.from(abbreviations.entries())
    .map(([abbr, fullTerm]) => ({ abbr, fullTerm }))
    .sort((a, b) => a.abbr.localeCompare(b.abbr));
}

/**
 * Create formatted abbreviations table in Word XML format
 * This creates a properly formatted table with borders that will be injected into the document
 */
function createAbbreviationsTable(abbreviations) {
  if (abbreviations.length === 0) {
    return '<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:r><w:t>No abbreviations were found in the article abstract.</w:t></w:r></w:p>';
  }
  
  const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  
  // Start building the table XML
  let tableXML = `<w:tbl xmlns:w="${w}">`;
  
  // Table properties with borders
  tableXML += '<w:tblPr>';
  tableXML += '<w:tblStyle w:val="TableGrid"/>';
  tableXML += '<w:tblW w:w="9000" w:type="dxa"/>';
  tableXML += '<w:tblBorders>';
  tableXML += '<w:top w:val="single" w:sz="12" w:space="0" w:color="000000"/>';
  tableXML += '<w:left w:val="single" w:sz="12" w:space="0" w:color="000000"/>';
  tableXML += '<w:bottom w:val="single" w:sz="12" w:space="0" w:color="000000"/>';
  tableXML += '<w:right w:val="single" w:sz="12" w:space="0" w:color="000000"/>';
  tableXML += '<w:insideH w:val="single" w:sz="12" w:space="0" w:color="000000"/>';
  tableXML += '<w:insideV w:val="single" w:sz="12" w:space="0" w:color="000000"/>';
  tableXML += '</w:tblBorders>';
  tableXML += '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>';
  tableXML += '</w:tblPr>';
  
  // Table grid
  tableXML += '<w:tblGrid>';
  tableXML += '<w:gridCol w:w="2000"/>';
  tableXML += '<w:gridCol w:w="7000"/>';
  tableXML += '</w:tblGrid>';
  
  // Header row with bold text and centered
  tableXML += '<w:tr>';
  
  // Header cell 1: Abbreviation
  tableXML += '<w:tc>';
  tableXML += '<w:tcPr>';
  tableXML += '<w:tcW w:w="2000" w:type="dxa"/>';
  tableXML += '<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>';
  tableXML += '</w:tcPr>';
  tableXML += '<w:p>';
  tableXML += '<w:pPr><w:jc w:val="center"/></w:pPr>';
  tableXML += '<w:r><w:rPr><w:b/></w:rPr><w:t>Abbreviation</w:t></w:r>';
  tableXML += '</w:p>';
  tableXML += '</w:tc>';
  
  // Header cell 2: Definition
  tableXML += '<w:tc>';
  tableXML += '<w:tcPr>';
  tableXML += '<w:tcW w:w="7000" w:type="dxa"/>';
  tableXML += '<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>';
  tableXML += '</w:tcPr>';
  tableXML += '<w:p>';
  tableXML += '<w:pPr><w:jc w:val="center"/></w:pPr>';
  tableXML += '<w:r><w:rPr><w:b/></w:rPr><w:t>Definition</w:t></w:r>';
  tableXML += '</w:p>';
  tableXML += '</w:tc>';
  
  tableXML += '</w:tr>';
  
  // Data rows
  abbreviations.forEach(item => {
    tableXML += '<w:tr>';
    
    // Cell 1: Abbreviation
    tableXML += '<w:tc>';
    tableXML += '<w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>';
    tableXML += '<w:p><w:r><w:t>' + escapeXml(item.abbr) + '</w:t></w:r></w:p>';
    tableXML += '</w:tc>';
    
    // Cell 2: Definition
    tableXML += '<w:tc>';
    tableXML += '<w:tcPr><w:tcW w:w="7000" w:type="dxa"/></w:tcPr>';
    tableXML += '<w:p><w:r><w:t>' + escapeXml(item.fullTerm) + '</w:t></w:r></w:p>';
    tableXML += '</w:tc>';
    
    tableXML += '</w:tr>';
  });
  
  tableXML += '</w:tbl>';
  
  return tableXML;
}



/**
 * Escape XML special characters
 */
function escapeXml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate Word table XML for abbreviations
 * Creates a properly formatted table with borders
 */
function generateWordTableXML(abbreviations) {
  if (!abbreviations || abbreviations.length === 0) {
    return '<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:r><w:t>No abbreviations found.</w:t></w:r></w:p>';
  }
  
  const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const bodyParagraphPr = '<w:pPr><w:pStyle w:val="FFBodyText"/><w:jc w:val="both"/></w:pPr>';
  
  let xml = `<w:tbl xmlns:w="${w}">`;
  
  // Table properties
  xml += '<w:tblPr>';
  xml += '<w:tblW w:w="9000" w:type="dxa"/>';
  xml += '<w:tblBorders>';
  xml += '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
  xml += '<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
  xml += '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
  xml += '<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
  xml += '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
  xml += '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
  xml += '</w:tblBorders>';
  xml += '</w:tblPr>';
  
  // Table grid
  xml += '<w:tblGrid>';
  xml += '<w:gridCol w:w="2000"/>';
  xml += '<w:gridCol w:w="7000"/>';
  xml += '</w:tblGrid>';
  
  // Header row
  xml += '<w:tr>';
  xml += '<w:tc>';
  xml += '<w:tcPr><w:tcW w:w="2000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/><w:vAlign w:val="center"/></w:tcPr>';
  xml += '<w:p><w:pPr><w:pStyle w:val="FFBodyText"/><w:jc w:val="center"/></w:pPr>';
  xml += '<w:r><w:rPr><w:b/></w:rPr><w:t>Abbreviation</w:t></w:r></w:p>';
  xml += '</w:tc>';
  xml += '<w:tc>';
  xml += '<w:tcPr><w:tcW w:w="7000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/><w:vAlign w:val="center"/></w:tcPr>';
  xml += '<w:p><w:pPr><w:pStyle w:val="FFBodyText"/><w:jc w:val="center"/></w:pPr>';
  xml += '<w:r><w:rPr><w:b/></w:rPr><w:t>Definition</w:t></w:r></w:p>';
  xml += '</w:tc>';
  xml += '</w:tr>';
  
  // Data rows
  abbreviations.forEach(item => {
    xml += '<w:tr>';
    xml += '<w:tc>';
    xml += '<w:tcPr><w:tcW w:w="2000" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>';
    xml += `<w:p>${bodyParagraphPr}<w:r><w:t>${escapeXml(item.abbr)}</w:t></w:r></w:p>`;
    xml += '</w:tc>';
    xml += '<w:tc>';
    xml += '<w:tcPr><w:tcW w:w="7000" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>';
    xml += `<w:p>${bodyParagraphPr}<w:r><w:t>${escapeXml(item.fullTerm)}</w:t></w:r></w:p>`;
    xml += '</w:tc>';
    xml += '</w:tr>';
  });
  
  xml += '</w:tbl>';
  
  return xml;
}

/**
 * Upload and analyze template
 */
router.post('/upload', upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No template file uploaded' });
    }

    const structure = await analyzeTemplateStructure(req.file.path);

    res.json({
      message: 'Template analyzed successfully',
      templatePath: req.file.path,
      filename: req.file.filename,
      structure: {
        totalHeadings: structure.headings.length,
        totalTables: structure.totalTables,
        totalParagraphs: structure.totalParagraphs,
        hasAbbreviationSection: structure.hasAbbreviationSection,
        hasAbstractSection: structure.hasAbstractSection,
        headings: structure.headings.map(h => ({
          level: h.level,
          text: h.text
        })).slice(0, 20) // Show first 20 headings
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to analyze template', details: error.message });
  }
});

/**
 * Generate filled document
 */
router.post('/generate', async (req, res) => {
  try {
    const { templatePath, article } = req.body;

    if (!templatePath || !article) {
      return res.status(400).json({ error: 'Template path and article required' });
    }

    // Read template file
    const content = await fs.readFile(templatePath, 'binary');
    const templateZip = new PizZip(content);
    
    // Extract comprehensive article data
    const articleData = extractArticleData(article);
    
    // Extract abbreviations
    const abbreviations = extractAbbreviations(article);
    
    // Create simple text list for {abbreviations_list} placeholder
    let abbreviationsList = '';
    if (abbreviations.length === 0) {
      abbreviationsList = 'No abbreviations were found in the article abstract.';
    } else {
      abbreviations.forEach(item => {
        abbreviationsList += `${item.abbr}: ${item.fullTerm}\n`;
      });
    }
    
    // Prepare complete template data
    const templateData = {
      ...articleData,
      abbreviations_list: ABBREVIATIONS_TABLE_MARKER, // Marker so we can inject real table later
      abbreviations_plain: abbreviationsList.trim(), // Optional plain-text backup
      abbreviations: abbreviations, // Array for loops or other uses
      abbreviations_count: abbreviations.length,
      has_abbreviations: abbreviations.length > 0,
      
      // Add formatted versions
      abstract_full: articleData.abstract,
      abstract_section: articleData.abstract,
      introduction: articleData.abstract_background || articleData.abstract,
      
      // Ensure no undefined values
      compound_name: articleData.drug_name,
      test_article: articleData.drug_name,
      study_title: article.title || '',
      reference: `PMID ${article.pmid || 'N/A'}`,
      citation: `${articleData.authors}. ${article.title}. ${article.journal}. ${article.publicationDate}.`
    };

    // Use docxtemplater to fill the template
    const doc = new Docxtemplater(templateZip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: (part) => {
        console.log('Missing placeholder:', part.value);
        return 'Not available in article abstract.';
      }
    });

    // Render with data
    doc.render(templateData);
    
    console.log('✅ Template rendered successfully');
    console.log('📊 Total abbreviations available:', abbreviations.length);
    if (abbreviations.length > 0) {
      console.log('First 5 abbreviations:', abbreviations.slice(0, 5).map(a => a.abbr).join(', '));
    }

    const outputZip = doc.getZip();

    if (abbreviations.length > 0) {
      console.log('📝 Injecting abbreviations table at placeholder...');
      let docXml = outputZip.file('word/document.xml').asText();
      const tableXml = generateWordTableXML(abbreviations);
      const markerRegex = new RegExp(`(<w:p[^>]*>[\\s\\S]*?${ABBREVIATIONS_TABLE_MARKER}[\\s\\S]*?<\\/w:p>)`);

      if (markerRegex.test(docXml)) {
        docXml = docXml.replace(markerRegex, (match) => {
          // Keep the paragraph (and any section properties) but strip the marker text
          const cleanedParagraph = match.replace(ABBREVIATIONS_TABLE_MARKER, '');
          return `${cleanedParagraph}${tableXml}`;
        });

        outputZip.file('word/document.xml', docXml);
        console.log('✅ Replaced marker with table containing', abbreviations.length, 'rows');
      } else {
        console.log('⚠️ Abbreviations marker not found; table appended at end');
        docXml = docXml.replace('</w:body>', `${tableXml}</w:body>`);
        outputZip.file('word/document.xml', docXml);
      }
    }

    const buf = outputZip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });

    // Save and send file
    const outputFilename = `Nonclinical_Overview_${article.pmid || Date.now()}.docx`;
    const outputPath = path.join(__dirname, '../uploads/generated', outputFilename);
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, buf);

    res.download(outputPath, outputFilename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
      }
      // Clean up after 5 seconds
      setTimeout(() => fs.unlink(outputPath).catch(console.error), 5000);
    });

  } catch (error) {
    console.error('Generation error:', error);
    
    if (error.message && error.message.includes('multi_error')) {
      const missingTags = error.properties?.errors?.map(e => e.properties?.id).filter(Boolean) || [];
      return res.status(400).json({ 
        error: 'Template missing placeholders',
        details: 'Add placeholders like {abstract}, {pharmacology}, {toxicology}, {abbreviations_list}',
        missingTags: missingTags.length > 0 ? missingTags : undefined
      });
    }
    
    res.status(500).json({ error: 'Failed to generate document', details: error.message });
  }
});

/**
 * Preview extracted data
 */
router.post('/preview', async (req, res) => {
  try {
    const { templatePath, article } = req.body;

    // Analyze template
    const structure = await analyzeTemplateStructure(templatePath);
    
    // Extract article data
    const articleData = extractArticleData(article);
    const abbreviations = extractAbbreviations(article);

    res.json({
      template: {
        headings: structure.headings.map(h => h.text),
        hasAbbreviationSection: structure.hasAbbreviationSection,
        hasAbstractSection: structure.hasAbstractSection,
        totalSections: structure.headings.length
      },
      article: {
        pmid: article.pmid,
        title: article.title,
        drugName: articleData.drug_name,
        abstractLength: articleData.abstract.length,
        abbreviationsFound: abbreviations.length
      },
      extractedContent: {
        abstract: articleData.abstract.substring(0, 200) + '...',
        pharmacology: articleData.pharmacology !== 'Not specified in the article abstract.' ? 'Available' : 'Not found',
        pharmacokinetics: articleData.pharmacokinetics !== 'Not specified in the article abstract.' ? 'Available' : 'Not found',
        toxicology: articleData.toxicology !== 'Not specified in the article abstract.' ? 'Available' : 'Not found',
        genotoxicity: articleData.genotoxicity !== 'Not specified in the article abstract.' ? 'Available' : 'Not found',
        carcinogenicity: articleData.carcinogenicity !== 'Not specified in the article abstract.' ? 'Available' : 'Not found'
      },
      abbreviations: abbreviations,
      message: 'Ensure your template has placeholders: {abstract}, {pharmacology}, {toxicology}, {abbreviations_list}'
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Failed to preview', details: error.message });
  }
});

module.exports = router;
