const express = require('express');
const router = express.Router();
const multer = require('multer');
const mammoth = require('mammoth');
const fs = require('fs').promises;
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  convertInchesToTwip,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle
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
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Parse template document to extract ALL content including headings, text, and structure
 * This preserves the complete document structure
 */
async function parseTemplateStructure(filePath) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    
    // Extract document with complete structure
    const result = await mammoth.extractRawText(fileBuffer);
    const rawText = result.value;
    
    // Also get HTML version with styles for better parsing
    const htmlResult = await mammoth.convertToHtml(fileBuffer, {
      styleMap: [
        "p[style-name='Heading 1'] => h1.heading1:fresh",
        "p[style-name='Heading 2'] => h2.heading2:fresh",
        "p[style-name='Heading 3'] => h3.heading3:fresh",
        "p[style-name='Heading 4'] => h4.heading4:fresh",
        "p[style-name='Heading 5'] => h5.heading5:fresh",
        "p[style-name='Heading 6'] => h6.heading6:fresh",
        "p => p.normal"
      ],
      includeDefaultStyleMap: true
    });

    const html = htmlResult.value;
    
    // Parse HTML to extract complete structure
    const elementRegex = /<(h[1-6]|p)(?:\s+class="([^"]*)")?>(.*?)<\/\1>/g;
    const elements = [];
    let match;

    while ((match = elementRegex.exec(html)) !== null) {
      const tag = match[1];
      const className = match[2] || '';
      const text = match[3].replace(/<[^>]*>/g, '').trim();
      
      if (!text) continue;

      if (tag.startsWith('h')) {
        const level = parseInt(tag[1]);
        elements.push({
          type: 'heading',
          level,
          text,
          originalText: text,
          content: '',
          isPlaceholder: false
        });
      } else if (tag === 'p' && text) {
        // Store existing paragraph text as template content
        elements.push({
          type: 'paragraph',
          text,
          isTemplateText: true
        });
      }
    }

    // Build hierarchical structure
    const structure = buildHierarchy(elements);

    return {
      structure,
      elements,
      success: true,
      headingsCount: elements.filter(e => e.type === 'heading').length,
      totalElements: elements.length
    };
  } catch (error) {
    console.error('Error parsing template:', error);
    throw error;
  }
}

/**
 * Build hierarchical structure from flat elements
 */
function buildHierarchy(elements) {
  const structure = [];
  const stack = []; // Stack to track current hierarchy

  elements.forEach(element => {
    if (element.type !== 'heading') return;

    const heading = {
      ...element,
      children: [],
      paragraphs: [] // Store paragraphs under this heading
    };

    // Pop stack until we find a parent with lower level
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top level heading
      structure.push(heading);
    } else {
      // Add as child to parent
      stack[stack.length - 1].children.push(heading);
    }

    stack.push(heading);
  });

  return structure;
}

/**
 * Intelligent mapping of article content to template headings
 * Enhanced to handle Nonclinical Overview and complex document structures
 */
function mapArticleToTemplate(article, templateStructure) {
  // Expanded heading mappings for pharmaceutical/nonclinical documents
  const headingMappings = {
    // Basic metadata
    'title': ['title', 'article title', 'study title', 'name', 'heading', 'drug name', 'compound'],
    'introduction': ['introduction', 'background', 'context', 'overview', 'summary', 'general information'],
    
    // Abstract sections
    'abstract': ['abstract', 'summary', 'overview', 'synopsis'],
    'importance': ['importance', 'significance', 'rationale', 'why', 'relevance'],
    'objective': ['objective', 'objectives', 'aim', 'aims', 'purpose', 'goal', 'goals'],
    'design': ['design', 'study design', 'methodology', 'approach', 'study type'],
    'setting': ['setting', 'location', 'site', 'place', 'study location'],
    'participants': ['participants', 'subjects', 'population', 'sample', 'patients', 'animals', 'test subjects'],
    'intervention': ['intervention', 'interventions', 'treatment', 'exposure', 'dosing', 'administration'],
    'main_outcomes': ['main outcomes', 'outcomes', 'results', 'findings', 'measurements', 'endpoints'],
    'results': ['results', 'findings', 'outcomes', 'data', 'observations'],
    'conclusions': ['conclusions', 'conclusion', 'implications', 'summary', 'takeaway', 'interpretation'],
    
    // Pharmacology sections (4.2)
    'pharmacology': ['pharmacology', 'pharmacodynamics', 'pharmacological', 'mechanism', 'mode of action'],
    'primary_pharmacodynamics': ['primary pharmacodynamics', 'pharmacodynamic', 'pd', 'mechanism of action', 'moa'],
    'secondary_pharmacodynamics': ['secondary pharmacodynamics', 'secondary effects', 'off-target'],
    'safety_pharmacology': ['safety pharmacology', 'safety', 'cardiovascular', 'respiratory', 'cns effects'],
    'pharmacodynamic_interactions': ['pharmacodynamic interactions', 'drug interactions', 'pd interactions'],
    
    // Pharmacokinetics sections (4.3)
    'pharmacokinetics': ['pharmacokinetics', 'pk', 'absorption', 'distribution', 'metabolism', 'excretion', 'adme'],
    'absorption': ['absorption', 'bioavailability', 'oral absorption'],
    'distribution': ['distribution', 'tissue distribution', 'protein binding', 'volume of distribution'],
    'metabolism': ['metabolism', 'metabolic', 'biotransformation', 'metabolites'],
    'excretion': ['excretion', 'elimination', 'clearance', 'renal excretion'],
    'pk_interactions': ['pharmacokinetic interactions', 'pk interactions', 'drug-drug interactions', 'ddi'],
    
    // Toxicology sections (4.4)
    'toxicology': ['toxicology', 'toxicity', 'toxic', 'safety', 'preclinical safety'],
    'single_dose': ['single dose toxicity', 'acute toxicity', 'single administration'],
    'repeat_dose': ['repeat dose toxicity', 'repeated dose', 'chronic toxicity', 'subchronic'],
    'genotoxicity': ['genotoxicity', 'genetic toxicology', 'mutagenicity', 'ames test'],
    'carcinogenicity': ['carcinogenicity', 'carcinogenic', 'tumorigenicity', 'oncogenicity'],
    'reproductive_toxicity': ['reproductive toxicity', 'reproduction', 'fertility', 'developmental toxicity'],
    'developmental_toxicity': ['developmental toxicity', 'teratogenicity', 'embryo', 'fetal'],
    'juvenile_toxicity': ['juvenile toxicity', 'pediatric', 'juvenile animals'],
    'local_tolerance': ['local tolerance', 'local irritation', 'tissue irritation'],
    'immunotoxicity': ['immunotoxicity', 'immune', 'immunological'],
    'phototoxicity': ['phototoxicity', 'photosafety', 'light exposure'],
    
    // Other sections
    'special_toxicology': ['special toxicology', 'special studies', 'other toxicity'],
    'antigenicity': ['antigenicity', 'immunogenicity', 'antigenic'],
    'dependence': ['dependence', 'abuse potential', 'withdrawal'],
    'metabolites': ['metabolites', 'impurities', 'degradation products'],
    
    // Metadata
    'authors': ['authors', 'author', 'researchers', 'investigators', 'scientists'],
    'journal': ['journal', 'publication', 'source', 'published in'],
    'publication_date': ['publication date', 'date', 'published', 'year'],
    'pmid': ['pmid', 'pubmed id', 'id', 'identifier'],
    'doi': ['doi', 'digital object identifier'],
    'url': ['url', 'link', 'reference', 'source link'],
    
    // Methods
    'methods': ['methods', 'methodology', 'materials and methods', 'experimental'],
    'materials': ['materials', 'reagents', 'test article', 'test system'],
    'animals': ['animals', 'test animals', 'species', 'animal model'],
    'dose': ['dose', 'dosage', 'dose levels', 'dose selection'],
    'statistics': ['statistics', 'statistical analysis', 'data analysis']
  };

  /**
   * Find best match for a heading text
   * Enhanced to handle numbered sections like "4.2 Pharmacology" or "4.2.1.1 Mechanism of action"
   */
  function findBestMatch(headingText) {
    // Remove numbering (e.g., "4.2.1.1" or "4.2") and get clean text
    const cleanText = headingText.replace(/^[\d\.]+\s*/, '').toLowerCase().trim();
    
    if (!cleanText) return null;
    
    // Try exact match first
    for (const [key, variations] of Object.entries(headingMappings)) {
      for (const variation of variations) {
        if (cleanText === variation.toLowerCase()) {
          return key;
        }
      }
    }
    
    // Try partial match
    for (const [key, variations] of Object.entries(headingMappings)) {
      for (const variation of variations) {
        if (cleanText.includes(variation.toLowerCase()) || variation.toLowerCase().includes(cleanText)) {
          return key;
        }
      }
    }
    
    // Additional smart matching for common patterns
    if (cleanText.includes('pharmacology') || cleanText.includes('pharmacodynamic')) {
      if (cleanText.includes('primary')) return 'primary_pharmacodynamics';
      if (cleanText.includes('secondary')) return 'secondary_pharmacodynamics';
      if (cleanText.includes('safety')) return 'safety_pharmacology';
      if (cleanText.includes('interaction')) return 'pharmacodynamic_interactions';
      return 'pharmacology';
    }
    
    if (cleanText.includes('pharmacokinetic') || cleanText.includes('pk')) {
      if (cleanText.includes('absorption')) return 'absorption';
      if (cleanText.includes('distribution')) return 'distribution';
      if (cleanText.includes('metabolism') || cleanText.includes('metaboli')) return 'metabolism';
      if (cleanText.includes('excretion') || cleanText.includes('elimination')) return 'excretion';
      if (cleanText.includes('interaction')) return 'pk_interactions';
      return 'pharmacokinetics';
    }
    
    if (cleanText.includes('toxic') || cleanText.includes('safety')) {
      if (cleanText.includes('single') || cleanText.includes('acute')) return 'single_dose';
      if (cleanText.includes('repeat') || cleanText.includes('chronic') || cleanText.includes('subchronic')) return 'repeat_dose';
      if (cleanText.includes('geno') || cleanText.includes('genetic') || cleanText.includes('mutagen')) return 'genotoxicity';
      if (cleanText.includes('carcino') || cleanText.includes('tumor') || cleanText.includes('oncogen')) return 'carcinogenicity';
      if (cleanText.includes('reproductive') || cleanText.includes('fertility')) return 'reproductive_toxicity';
      if (cleanText.includes('developmental') || cleanText.includes('teratogen') || cleanText.includes('embryo')) return 'developmental_toxicity';
      if (cleanText.includes('juvenile') || cleanText.includes('pediatric')) return 'juvenile_toxicity';
      if (cleanText.includes('local') || cleanText.includes('irritation')) return 'local_tolerance';
      if (cleanText.includes('immuno')) return 'immunotoxicity';
      if (cleanText.includes('photo')) return 'phototoxicity';
      return 'toxicology';
    }
    
    if (cleanText.includes('method')) return 'methods';
    if (cleanText.includes('material')) return 'materials';
    if (cleanText.includes('animal')) return 'animals';
    if (cleanText.includes('dose') || cleanText.includes('dosage')) return 'dose';
    if (cleanText.includes('statistic')) return 'statistics';
    if (cleanText.includes('author')) return 'authors';
    if (cleanText.includes('journal') || cleanText.includes('publication')) return 'journal';
    if (cleanText.includes('date') || cleanText.includes('year')) return 'publication_date';
    if (cleanText.includes('abstract') || cleanText.includes('summary')) return 'abstract';
    if (cleanText.includes('result') || cleanText.includes('finding')) return 'results';
    if (cleanText.includes('conclusion') || cleanText.includes('implication')) return 'conclusions';
    if (cleanText.includes('objective') || cleanText.includes('aim') || cleanText.includes('purpose')) return 'objective';
    if (cleanText.includes('background') || cleanText.includes('introduction')) return 'introduction';
    
    return null;
  }

  /**
   * Get content for a matched section
   * Enhanced to extract more detailed information from articles
   */
  function getContentForSection(sectionKey, article) {
    switch (sectionKey) {
      case 'title':
        return article.title || '';
      
      case 'authors':
        if (article.authors && Array.isArray(article.authors)) {
          return article.authors.join(', ');
        }
        return '';
      
      case 'journal':
        return article.journal || '';
      
      case 'publication_date':
        return article.publicationDate || '';
      
      case 'pmid':
        return `PubMed ID: ${article.pmid || 'N/A'}`;
      
      case 'doi':
        return article.doi ? `DOI: ${article.doi}` : '';
      
      case 'url':
        return article.url || `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`;
      
      case 'abstract':
        if (article.abstract) {
          if (article.abstract.structured && article.abstract.sections) {
            return article.abstract.sections
              .map(s => `${s.label}: ${s.content}`)
              .join('\n\n');
          } else if (article.abstract.text) {
            return article.abstract.text;
          } else if (typeof article.abstract === 'string') {
            return article.abstract;
          }
        }
        return '';
      
      // Structured abstract sections
      case 'importance':
      case 'objective':
      case 'design':
      case 'setting':
      case 'participants':
      case 'intervention':
      case 'main_outcomes':
      case 'results':
      case 'conclusions':
        if (article.abstract && article.abstract.structured && article.abstract.sections) {
          const section = article.abstract.sections.find(s => 
            s.label.toLowerCase().includes(sectionKey.replace('_', ' '))
          );
          return section ? section.content : '';
        }
        return '';
      
      case 'introduction':
        if (article.abstract && article.abstract.structured && article.abstract.sections) {
          const intro = article.abstract.sections.find(s => 
            s.label.toLowerCase().includes('background') || 
            s.label.toLowerCase().includes('importance')
          );
          if (intro) return intro.content;
        }
        return article.title || '';
      
      // Pharmacology sections
      case 'pharmacology':
      case 'primary_pharmacodynamics':
      case 'secondary_pharmacodynamics':
      case 'safety_pharmacology':
      case 'pharmacodynamic_interactions':
        return extractSectionFromAbstract(article, [
          'pharmacology', 'pharmacodynamics', 'mechanism', 'mode of action',
          'activity', 'target', 'receptor', 'pathway'
        ]);
      
      // Pharmacokinetics sections
      case 'pharmacokinetics':
      case 'absorption':
      case 'distribution':
      case 'metabolism':
      case 'excretion':
      case 'pk_interactions':
        return extractSectionFromAbstract(article, [
          'pharmacokinetics', 'pk', 'absorption', 'distribution', 
          'metabolism', 'excretion', 'adme', 'bioavailability',
          'clearance', 'half-life', 'auc', 'cmax'
        ]);
      
      // Toxicology sections
      case 'toxicology':
      case 'single_dose':
      case 'repeat_dose':
      case 'genotoxicity':
      case 'carcinogenicity':
      case 'reproductive_toxicity':
      case 'developmental_toxicity':
      case 'juvenile_toxicity':
      case 'local_tolerance':
      case 'immunotoxicity':
      case 'phototoxicity':
      case 'special_toxicology':
      case 'antigenicity':
      case 'dependence':
        return extractSectionFromAbstract(article, [
          'toxicity', 'toxic', 'safety', 'adverse', 'side effect',
          'tolerat', 'dose', 'noael', 'noel', 'ld50'
        ]);
      
      // Methods and materials
      case 'methods':
      case 'materials':
      case 'animals':
      case 'dose':
      case 'statistics':
        if (article.abstract && article.abstract.structured && article.abstract.sections) {
          const methods = article.abstract.sections.find(s => 
            s.label.toLowerCase().includes('method') ||
            s.label.toLowerCase().includes('design') ||
            s.label.toLowerCase().includes('material')
          );
          return methods ? methods.content : '';
        }
        return '';
      
      case 'metabolites':
        return extractSectionFromAbstract(article, [
          'metabolite', 'metabolism', 'biotransformation'
        ]);
      
      default:
        return '';
    }
  }
  
  /**
   * Helper function to extract relevant content from abstract based on keywords
   */
  function extractSectionFromAbstract(article, keywords) {
    let abstractText = '';
    
    // Get full abstract text
    if (article.abstract) {
      if (article.abstract.structured && article.abstract.sections) {
        abstractText = article.abstract.sections
          .map(s => s.content)
          .join(' ');
      } else if (article.abstract.text) {
        abstractText = article.abstract.text;
      } else if (typeof article.abstract === 'string') {
        abstractText = article.abstract;
      }
    }
    
    if (!abstractText) return '';
    
    // Split into sentences
    const sentences = abstractText.split(/[.!?]+/).filter(s => s.trim());
    
    // Find sentences containing relevant keywords
    const relevantSentences = sentences.filter(sentence => {
      const lowerSentence = sentence.toLowerCase();
      return keywords.some(keyword => lowerSentence.includes(keyword.toLowerCase()));
    });
    
    if (relevantSentences.length > 0) {
      return relevantSentences.join('. ') + '.';
    }
    
    // If no specific match, return the abstract or a portion of it
    return abstractText.substring(0, 500) + (abstractText.length > 500 ? '...' : '');
  }

  /**
   * Recursively fill template structure with article content
   */
  function fillStructure(headings, article) {
    return headings.map(heading => {
      const match = findBestMatch(heading.text);
      const content = match ? getContentForSection(match, article) : '';
      
      return {
        ...heading,
        content,
        matchedSection: match,
        children: heading.children.length > 0 
          ? fillStructure(heading.children, article) 
          : []
      };
    });
  }

  return fillStructure(templateStructure, article);
}

/**
 * Generate Word document from filled template structure
 * Enhanced to preserve template formatting and numbering
 */
async function generateFilledDocument(filledStructure, article) {
  const sections = [];

  /**
   * Convert heading level to docx HeadingLevel
   */
  function getHeadingLevel(level) {
    switch (level) {
      case 1: return HeadingLevel.HEADING_1;
      case 2: return HeadingLevel.HEADING_2;
      case 3: return HeadingLevel.HEADING_3;
      case 4: return HeadingLevel.HEADING_4;
      case 5: return HeadingLevel.HEADING_5;
      case 6: return HeadingLevel.HEADING_6;
      default: return HeadingLevel.HEADING_1;
    }
  }

  /**
   * Recursively process structure to create paragraphs
   * Preserves original heading text including numbering
   */
  function processStructure(headings, depth = 0) {
    headings.forEach(heading => {
      // Add heading with original text (preserving numbering like "4.2 Pharmacology")
      sections.push(
        new Paragraph({
          text: heading.originalText || heading.text,
          heading: getHeadingLevel(heading.level),
          spacing: {
            before: 240,
            after: 120
          }
        })
      );

      // Add content if available
      if (heading.content && heading.content.trim()) {
        // Split content by double newlines (paragraphs)
        const paragraphs = heading.content.split('\n\n').filter(p => p.trim());
        
        paragraphs.forEach(para => {
          // Handle labeled sections (e.g., "OBJECTIVE: text")
          const labelMatch = para.match(/^([A-Z\s]+):\s*(.+)/s);
          
          if (labelMatch) {
            // Render label in bold, content in normal
            const label = labelMatch[1];
            const content = labelMatch[2];
            
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${label}: `,
                    font: 'Times New Roman',
                    size: 22,
                    bold: true
                  }),
                  new TextRun({
                    text: content.trim(),
                    font: 'Times New Roman',
                    size: 22
                  })
                ],
                spacing: {
                  before: 120,
                  after: 120,
                  line: 276
                },
                alignment: AlignmentType.JUSTIFIED
              })
            );
          } else {
            // Normal paragraph
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: para.trim(),
                    font: 'Times New Roman',
                    size: 22
                  })
                ],
                spacing: {
                  before: 120,
                  after: 120,
                  line: 276
                },
                alignment: AlignmentType.JUSTIFIED
              })
            );
          }
        });
      } else {
        // Add placeholder with lighter styling
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '[No relevant content found in the article]',
                font: 'Times New Roman',
                size: 20,
                italics: true,
                color: '999999'
              })
            ],
            spacing: {
              before: 120,
              after: 120
            },
            alignment: AlignmentType.LEFT
          })
        );
      }

      // Process children recursively
      if (heading.children && heading.children.length > 0) {
        processStructure(heading.children, depth + 1);
      }
    });
  }

  // Add document title
  if (article.title) {
    sections.unshift(
      new Paragraph({
        text: 'NONCLINICAL OVERVIEW',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: {
          before: 0,
          after: 480
        }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Based on: ${article.title}`,
            font: 'Times New Roman',
            size: 24,
            italics: true
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: {
          before: 0,
          after: 240
        }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `PubMed ID: ${article.pmid}`,
            font: 'Times New Roman',
            size: 20
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: {
          before: 0,
          after: 480
        }
      })
    );
  }

  processStructure(filledStructure);

  // Create document with proper formatting
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

  return doc;
}

// ==================== ROUTES ====================

/**
 * POST /api/template/upload
 * Upload and parse template document
 */
router.post('/upload', upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No template file uploaded' });
    }

    const templatePath = req.file.path;
    
    // Parse template structure
    const parseResult = await parseTemplateStructure(templatePath);
    
    res.json({
      success: true,
      message: 'Template uploaded and parsed successfully',
      templateId: path.basename(templatePath, '.docx'),
      templatePath: templatePath,
      structure: parseResult.structure,
      headingsCount: parseResult.headingsCount
    });

  } catch (error) {
    console.error('Template upload error:', error);
    res.status(500).json({
      error: 'Failed to process template',
      details: error.message
    });
  }
});

/**
 * POST /api/template/generate
 * Generate filled document from template and article
 */
router.post('/generate', async (req, res) => {
  try {
    const { templatePath, article } = req.body;

    if (!templatePath || !article) {
      return res.status(400).json({
        error: 'Missing required fields: templatePath and article'
      });
    }

    // Parse template
    const parseResult = await parseTemplateStructure(templatePath);
    
    // Map article to template
    const filledStructure = mapArticleToTemplate(article, parseResult.structure);
    
    // Generate document
    const doc = await generateFilledDocument(filledStructure, article);
    
    // Convert to buffer
    const buffer = await Packer.toBuffer(doc);
    
    // Set response headers
    const filename = `Template_${article.pmid || 'Article'}_${Date.now()}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);

  } catch (error) {
    console.error('Document generation error:', error);
    res.status(500).json({
      error: 'Failed to generate document',
      details: error.message
    });
  }
});

/**
 * POST /api/template/preview
 * Preview template structure with mapped content
 */
router.post('/preview', async (req, res) => {
  try {
    const { templatePath, article } = req.body;

    if (!templatePath || !article) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    // Parse template
    const parseResult = await parseTemplateStructure(templatePath);
    
    // Map article to template
    const filledStructure = mapArticleToTemplate(article, parseResult.structure);
    
    res.json({
      success: true,
      structure: filledStructure,
      article: {
        pmid: article.pmid,
        title: article.title
      }
    });

  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({
      error: 'Failed to preview template',
      details: error.message
    });
  }
});

/**
 * DELETE /api/template/:filename
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
