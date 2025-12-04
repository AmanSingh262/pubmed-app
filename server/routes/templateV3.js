const express = require('express');
const router = express.Router();
const multer = require('multer');
const mammoth = require('mammoth');
const fs = require('fs').promises;
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  VerticalAlign
} = require('docx');

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
  limits: { fileSize: 10 * 1024 * 1024 }
});

/**
 * Parse template to extract headings structure
 */
async function parseTemplateHeadings(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  
  const htmlResult = await mammoth.convertToHtml(fileBuffer, {
    styleMap: [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Heading 4'] => h4:fresh",
    ]
  });

  const html = htmlResult.value;
  const headingRegex = /<h([1-6])>(.*?)<\/h\1>/g;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    
    if (text) {
      headings.push({
        level,
        text,
        normalizedText: text.toLowerCase().replace(/[^a-z0-9\s]/g, ''),
        content: ''
      });
    }
  }

  return headings;
}

/**
 * Map content to headings based on keywords
 */
function mapContentToHeadings(headings, articleData) {
  const mappings = {
    pharmacology: ['pharmacology', 'pharmacodynamic', 'mechanism', 'action', 'activity', 'receptor', 'binding'],
    primary_pharmacodynamics: ['primary pharmacodynamic', 'primary activity', 'main effect', 'principal action'],
    secondary_pharmacodynamics: ['secondary pharmacodynamic', 'secondary activity', 'secondary effect'],
    pharmacokinetics: ['pharmacokinetic', 'pk', 'adme'],
    absorption: ['absorption', 'bioavailability', 'uptake'],
    distribution: ['distribution', 'tissue', 'volume', 'vd'],
    metabolism: ['metabolism', 'metabolic', 'biotransformation', 'cyp'],
    excretion: ['excretion', 'elimination', 'clearance', 'renal'],
    toxicology: ['toxicology', 'toxicity', 'toxic', 'safety'],
    single_dose_toxicity: ['single dose', 'acute toxicity', 'acute dose'],
    repeat_dose_toxicity: ['repeat dose', 'repeated dose', 'chronic toxicity', 'subacute', 'subchronic'],
    genotoxicity: ['genotoxicity', 'genotoxic', 'mutagenic', 'mutation'],
    carcinogenicity: ['carcinogenicity', 'carcinogenic', 'cancer', 'tumor', 'oncogenic'],
    reproductive_toxicity: ['reproductive', 'fertility', 'reproduction'],
    embryo_fetal: ['embryo', 'fetal', 'teratogen', 'developmental'],
    local_tolerance: ['local tolerance', 'irritation', 'local effect'],
    methods: ['methods', 'methodology', 'materials', 'study design'],
    results: ['results', 'findings', 'outcomes', 'data'],
    conclusions: ['conclusion', 'summary', 'discussion']
  };

  headings.forEach(heading => {
    let bestMatch = null;
    let bestScore = 0;

    // Try to match heading to data fields
    for (const [field, keywords] of Object.entries(mappings)) {
      const score = keywords.reduce((sum, keyword) => {
        return sum + (heading.normalizedText.includes(keyword) ? 1 : 0);
      }, 0);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = field;
      }
    }

    // Assign content if match found
    if (bestMatch && articleData[bestMatch]) {
      heading.content = articleData[bestMatch];
      heading.mappedField = bestMatch;
    }
  });

  return headings;
}

/**
 * Extract comprehensive data from article
 */
function extractArticleData(article) {
  const data = {
    drug_name: '',
    pharmacology: '',
    primary_pharmacodynamics: '',
    secondary_pharmacodynamics: '',
    mechanism_of_action: '',
    pharmacokinetics: '',
    absorption: '',
    distribution: '',
    metabolism: '',
    excretion: '',
    toxicology: '',
    single_dose_toxicity: '',
    repeat_dose_toxicity: '',
    genotoxicity: '',
    carcinogenicity: '',
    reproductive_toxicity: '',
    embryo_fetal: '',
    local_tolerance: '',
    methods: '',
    results: '',
    conclusions: ''
  };

  // Extract drug name from title
  const title = article.title || '';
  const drugNameMatch = title.match(/([A-Z][a-z]+(?:-[A-Z][a-z]+)*)/);
  data.drug_name = drugNameMatch ? drugNameMatch[0] : 'Test Compound';

  // Get abstract text
  let abstractText = '';
  if (article.abstract) {
    if (typeof article.abstract === 'string') {
      abstractText = article.abstract;
    } else if (article.abstract.text) {
      abstractText = article.abstract.text;
    } else if (article.abstract.structured && article.abstract.sections) {
      abstractText = article.abstract.sections.map(s => s.content).join(' ');
      
      // Extract from structured sections
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
           lower.includes('activity') || lower.includes('inhibit') ||
           lower.includes('agonist') || lower.includes('antagonist');
  });
  data.pharmacology = pharmSentences.join('. ') + (pharmSentences.length > 0 ? '.' : '');
  data.primary_pharmacodynamics = pharmSentences.slice(0, 2).join('. ') + (pharmSentences.length > 0 ? '.' : '');
  data.mechanism_of_action = pharmSentences[0] ? pharmSentences[0] + '.' : '';

  // Extract pharmacokinetics
  const pkSentences = sentences.filter(s => {
    const lower = s.toLowerCase();
    return lower.includes('pharmacokinetic') || lower.includes('absorption') ||
           lower.includes('distribution') || lower.includes('metabolism') ||
           lower.includes('excretion') || lower.includes('bioavailability') ||
           lower.includes('clearance') || lower.includes('half-life');
  });
  data.pharmacokinetics = pkSentences.join('. ') + (pkSentences.length > 0 ? '.' : '');

  // Specific PK components
  sentences.forEach(s => {
    const lower = s.toLowerCase();
    if (lower.includes('absorption') || lower.includes('bioavailability')) {
      data.absorption += s + '. ';
    }
    if (lower.includes('distribution')) {
      data.distribution += s + '. ';
    }
    if (lower.includes('metabol')) {
      data.metabolism += s + '. ';
    }
    if (lower.includes('excretion') || lower.includes('elimination')) {
      data.excretion += s + '. ';
    }
  });

  // Extract toxicology
  const toxSentences = sentences.filter(s => {
    const lower = s.toLowerCase();
    return lower.includes('toxic') || lower.includes('safety') ||
           lower.includes('adverse') || lower.includes('tolerat');
  });
  data.toxicology = toxSentences.join('. ') + (toxSentences.length > 0 ? '.' : '');
  data.single_dose_toxicity = toxSentences.filter(s => s.toLowerCase().includes('acute')).join('. ') + '.';
  data.repeat_dose_toxicity = toxSentences.filter(s => s.toLowerCase().includes('chronic') || s.toLowerCase().includes('repeat')).join('. ') + '.';

  // Genotoxicity
  const genoSentences = sentences.filter(s => {
    const lower = s.toLowerCase();
    return lower.includes('geno') || lower.includes('mutagen') || lower.includes('dna');
  });
  data.genotoxicity = genoSentences.join('. ') + (genoSentences.length > 0 ? '.' : '');

  // Carcinogenicity
  const carcinoSentences = sentences.filter(s => {
    const lower = s.toLowerCase();
    return lower.includes('carcino') || lower.includes('tumor') || lower.includes('cancer');
  });
  data.carcinogenicity = carcinoSentences.join('. ') + (carcinoSentences.length > 0 ? '.' : '');

  // Reproductive toxicity
  const reproSentences = sentences.filter(s => {
    const lower = s.toLowerCase();
    return lower.includes('reproduct') || lower.includes('fertility') ||
           lower.includes('embryo') || lower.includes('fetal');
  });
  data.reproductive_toxicity = reproSentences.join('. ') + (reproSentences.length > 0 ? '.' : '');
  data.embryo_fetal = reproSentences.join('. ') + (reproSentences.length > 0 ? '.' : '');

  return data;
}

/**
 * Extract abbreviations from article
 */
function extractAbbreviations(article) {
  const abbreviations = new Map();
  const text = article.title + ' ' + (article.abstract?.text || article.abstract || '');
  
  // Find patterns like "Full Term (ABB)"
  const abbrPattern = /([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)\s*\(([A-Z]{2,6})\)/g;
  let match;
  
  while ((match = abbrPattern.exec(text)) !== null) {
    const fullTerm = match[1].trim();
    const abbr = match[2];
    abbreviations.set(abbr, fullTerm);
  }
  
  // Add common pharmaceutical abbreviations
  const commonAbbrs = {
    'PK': 'Pharmacokinetics',
    'PD': 'Pharmacodynamics',
    'ADME': 'Absorption, Distribution, Metabolism, Excretion',
    'AUC': 'Area Under the Curve',
    'Cmax': 'Maximum Concentration',
    'CNS': 'Central Nervous System',
    'IV': 'Intravenous',
    'PO': 'Per Os (Oral)',
    'LD50': 'Lethal Dose 50%',
    'NOAEL': 'No Observed Adverse Effect Level',
    'MTD': 'Maximum Tolerated Dose'
  };
  
  // Only add common abbreviations if they appear in the text
  for (const [abbr, fullTerm] of Object.entries(commonAbbrs)) {
    if (text.includes(abbr) && !abbreviations.has(abbr)) {
      abbreviations.set(abbr, fullTerm);
    }
  }
  
  // Convert to sorted array
  return Array.from(abbreviations.entries())
    .map(([abbr, fullTerm]) => ({ abbr, fullTerm }))
    .sort((a, b) => a.abbr.localeCompare(b.abbr));
}

/**
 * Create abbreviations table
 */
function createAbbreviationsTable(abbreviations) {
  if (abbreviations.length === 0) {
    return [new Paragraph({
      text: 'No abbreviations found in the article abstract.',
      spacing: { before: 200, after: 200 }
    })];
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // Header row
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              text: 'Abbreviation',
              bold: true
            })],
            shading: { fill: 'D9D9D9' },
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph({
              text: 'Full Term',
              bold: true
            })],
            shading: { fill: 'D9D9D9' },
            verticalAlign: VerticalAlign.CENTER
          })
        ]
      }),
      // Data rows
      ...abbreviations.map(item => new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph(item.abbr)],
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [new Paragraph(item.fullTerm)],
            verticalAlign: VerticalAlign.CENTER
          })
        ]
      }))
    ]
  });

  return [table];
}

/**
 * Generate document by mapping content to template headings
 */
function generateDocumentFromTemplate(headings, articleData, abbreviations, article) {
  const sections = [];

  // Title
  sections.push(new Paragraph({
    text: 'MODULE 2.4',
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 200 }
  }));

  sections.push(new Paragraph({
    text: 'NONCLINICAL OVERVIEW',
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 }
  }));

  sections.push(new Paragraph({
    text: `${articleData.drug_name}`,
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 }
  }));

  sections.push(new Paragraph({
    text: `Reference: PMID ${article.pmid || 'N/A'}`,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 }
  }));

  // Generate headings with content
  headings.forEach(heading => {
    const headingLevel = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4
    ][Math.min(heading.level - 1, 3)];

    sections.push(new Paragraph({
      text: heading.text,
      heading: headingLevel,
      spacing: { before: 300, after: 200 }
    }));

    // Add content if available
    if (heading.content && heading.content.trim()) {
      sections.push(new Paragraph({
        text: heading.content,
        spacing: { before: 100, after: 200 }
      }));
    } else {
      sections.push(new Paragraph({
        text: 'No specific information available in the article abstract. Please refer to published literature and regulatory documents.',
        italics: true,
        spacing: { before: 100, after: 200 }
      }));
    }

    // Special handling for abbreviations section
    if (heading.normalizedText.includes('abbreviation')) {
      sections.pop(); // Remove the "no info" paragraph
      sections.push(...createAbbreviationsTable(abbreviations));
    }
  });

  return sections;
}

// Routes

/**
 * Upload template and parse headings
 */
router.post('/upload', upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No template file uploaded' });
    }

    const headings = await parseTemplateHeadings(req.file.path);

    res.json({
      message: 'Template uploaded successfully',
      templatePath: req.file.path,
      filename: req.file.filename,
      headingsCount: headings.length,
      headings: headings.map(h => ({ level: h.level, text: h.text }))
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process template', details: error.message });
  }
});

/**
 * Generate document by filling template with content
 */
router.post('/generate', async (req, res) => {
  try {
    const { templatePath, article } = req.body;

    if (!templatePath || !article) {
      return res.status(400).json({ error: 'Template path and article required' });
    }

    // Read template file
    const content = await fs.readFile(templatePath, 'binary');
    const zip = new PizZip(content);
    
    // Extract article data
    const articleData = extractArticleData(article);
    
    // Extract abbreviations
    const abbreviations = extractAbbreviations(article);
    
    // Create abbreviations table text
    let abbrText = 'Abbreviation\tFull Term\n';
    abbreviations.forEach(abbr => {
      abbrText += `${abbr.abbr}\t${abbr.fullTerm}\n`;
    });
    
    // Normalize PMID
    const normalizePmid = (pmid) => {
      if (typeof pmid === 'object' && pmid !== null) {
        return String(pmid._ || pmid.i || pmid);
      }
      return String(pmid);
    };
    
    // Prepare template data with all possible fields
    const templateData = {
      // Basic info
      drug_name: articleData.drug_name,
      pmid: normalizePmid(article.pmid) || 'N/A',
      article_title: article.title || '',
      authors: article.authors ? article.authors.join(', ') : '',
      journal: article.journal || '',
      publication_date: article.publicationDate || '',
      
      // Abstract
      abstract: articleData.pharmacology || articleData.toxicology || 
                (article.abstract?.text || article.abstract || 'No abstract available'),
      
      // Pharmacology
      pharmacology: articleData.pharmacology || 'No specific pharmacology information available in the abstract.',
      mechanism_of_action: articleData.mechanism_of_action || 'Not specified in the abstract.',
      primary_pharmacodynamics: articleData.primary_pharmacodynamics || 'Not specified in the abstract.',
      secondary_pharmacodynamics: articleData.secondary_pharmacodynamics || 'Not specified in the abstract.',
      
      // Pharmacokinetics
      pharmacokinetics: articleData.pharmacokinetics || 'No specific pharmacokinetics information available in the abstract.',
      absorption: articleData.absorption || 'Not specified in the abstract.',
      distribution: articleData.distribution || 'Not specified in the abstract.',
      metabolism: articleData.metabolism || 'Not specified in the abstract.',
      excretion: articleData.excretion || 'Not specified in the abstract.',
      
      // Toxicology
      toxicology: articleData.toxicology || 'No specific toxicology information available in the abstract.',
      single_dose_toxicity: articleData.single_dose_toxicity || 'Not specified in the abstract.',
      repeat_dose_toxicity: articleData.repeat_dose_toxicity || 'Not specified in the abstract.',
      genotoxicity: articleData.genotoxicity || 'Not specified in the abstract.',
      carcinogenicity: articleData.carcinogenicity || 'Not specified in the abstract.',
      reproductive_toxicity: articleData.reproductive_toxicity || 'Not specified in the abstract.',
      embryo_fetal: articleData.embryo_fetal || 'Not specified in the abstract.',
      local_tolerance: articleData.local_tolerance || 'Not specified in the abstract.',
      
      // Study info
      methods: articleData.methods || 'Not specified in the abstract.',
      results: articleData.results || 'Not specified in the abstract.',
      conclusions: articleData.conclusions || 'Not specified in the abstract.',
      
      // Abbreviations
      abbreviations_list: abbrText,
      abbreviations_count: abbreviations.length
    };

    // Try to render with docxtemplater
    try {
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => 'Not available in abstract'
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
        }
        setTimeout(() => fs.unlink(outputPath).catch(console.error), 5000);
      });

    } catch (docxError) {
      // If template doesn't have placeholders, fall back to heading-based approach
      console.log('Template lacks placeholders, using heading-based mapping...');
      
      const headings = await parseTemplateHeadings(templatePath);
      const mappedHeadings = mapContentToHeadings(headings, articleData);
      const sections = generateDocumentFromTemplate(mappedHeadings, articleData, abbreviations, article);

      const doc = new Document({
        sections: [{
          children: sections
        }]
      });

      const buffer = await Packer.toBuffer(doc);

      const outputFilename = `Nonclinical_Overview_${article.pmid || Date.now()}.docx`;
      const outputPath = path.join(__dirname, '../uploads/generated', outputFilename);
      
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, buffer);

      res.download(outputPath, outputFilename, (err) => {
        if (err) {
          console.error('Download error:', err);
          res.status(500).json({ error: 'Failed to download file' });
        }
        setTimeout(() => fs.unlink(outputPath).catch(console.error), 5000);
      });
    }

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Failed to generate document', details: error.message });
  }
});

/**
 * Preview content mapping
 */
router.post('/preview', async (req, res) => {
  try {
    const { templatePath, article } = req.body;

    const headings = await parseTemplateHeadings(templatePath);
    const articleData = extractArticleData(article);
    const mappedHeadings = mapContentToHeadings(headings, articleData);
    const abbreviations = extractAbbreviations(article);
    
    // Normalize PMID
    const normalizePmid = (pmid) => {
      if (typeof pmid === 'object' && pmid !== null) {
        return String(pmid._ || pmid.i || pmid);
      }
      return String(pmid);
    };

    res.json({
      headings: mappedHeadings.map(h => ({
        level: h.level,
        text: h.text,
        hasContent: !!h.content,
        contentPreview: h.content ? h.content.substring(0, 100) + '...' : 'No content',
        mappedField: h.mappedField
      })),
      abbreviations,
      articleInfo: {
        title: article.title,
        pmid: normalizePmid(article.pmid),
        drugName: articleData.drug_name
      }
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Failed to preview', details: error.message });
  }
});

/**
 * Delete template
 */
router.delete('/:filename', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../uploads/templates', req.params.filename);
    await fs.unlink(filePath);
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

module.exports = router;
