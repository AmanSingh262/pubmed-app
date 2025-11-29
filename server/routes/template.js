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
 * Parse template document to extract headings and subheadings structure
 */
async function parseTemplateStructure(filePath) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    
    // Extract raw text with styles
    const result = await mammoth.convertToHtml(fileBuffer, {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Heading 6'] => h6:fresh"
      ]
    });

    const html = result.value;
    
    // Parse HTML to extract headings
    const headingRegex = /<h([1-6])>(.*?)<\/h\1>/g;
    const structure = [];
    let match;
    let currentH1 = null;
    let currentH2 = null;

    while ((match = headingRegex.exec(html)) !== null) {
      const level = parseInt(match[1]);
      const text = match[2].trim();
      
      if (!text) continue;

      const heading = {
        level,
        text,
        children: [],
        content: '' // Will be filled with article content
      };

      if (level === 1) {
        structure.push(heading);
        currentH1 = heading;
        currentH2 = null;
      } else if (level === 2 && currentH1) {
        currentH1.children.push(heading);
        currentH2 = heading;
      } else if (level === 3 && currentH2) {
        currentH2.children.push(heading);
      } else if (level === 3 && currentH1) {
        currentH1.children.push(heading);
      }
    }

    return {
      structure,
      success: true,
      headingsCount: structure.length
    };
  } catch (error) {
    console.error('Error parsing template:', error);
    throw error;
  }
}

/**
 * Intelligent mapping of article content to template headings
 * Uses semantic matching to map article sections to template structure
 */
function mapArticleToTemplate(article, templateStructure) {
  // Common heading mappings (case-insensitive matching)
  const headingMappings = {
    // Title/Introduction
    'title': ['title', 'article title', 'study title', 'name', 'heading'],
    'introduction': ['introduction', 'background', 'context', 'overview', 'summary'],
    
    // Abstract sections
    'abstract': ['abstract', 'summary', 'overview'],
    'importance': ['importance', 'significance', 'rationale', 'why'],
    'objective': ['objective', 'objectives', 'aim', 'aims', 'purpose', 'goal', 'goals'],
    'design': ['design', 'study design', 'methodology', 'approach'],
    'setting': ['setting', 'location', 'site', 'place'],
    'participants': ['participants', 'subjects', 'population', 'sample', 'patients'],
    'intervention': ['intervention', 'interventions', 'treatment', 'exposure'],
    'main_outcomes': ['main outcomes', 'outcomes', 'results', 'findings', 'measurements'],
    'results': ['results', 'findings', 'outcomes', 'data'],
    'conclusions': ['conclusions', 'conclusion', 'implications', 'summary', 'takeaway'],
    
    // Metadata
    'authors': ['authors', 'author', 'researchers', 'investigators'],
    'journal': ['journal', 'publication', 'source', 'published in'],
    'publication_date': ['publication date', 'date', 'published', 'year'],
    'pmid': ['pmid', 'pubmed id', 'id', 'identifier'],
    'doi': ['doi', 'digital object identifier'],
    'url': ['url', 'link', 'reference', 'source link']
  };

  /**
   * Find best match for a heading text
   */
  function findBestMatch(headingText) {
    const normalized = headingText.toLowerCase().trim();
    
    // Direct matches
    for (const [key, variations] of Object.entries(headingMappings)) {
      if (variations.some(v => normalized.includes(v) || v.includes(normalized))) {
        return key;
      }
    }
    
    // Partial matches
    if (normalized.includes('author')) return 'authors';
    if (normalized.includes('date') || normalized.includes('year')) return 'publication_date';
    if (normalized.includes('journal') || normalized.includes('publication')) return 'journal';
    if (normalized.includes('abstract') || normalized.includes('summary')) return 'abstract';
    if (normalized.includes('result') || normalized.includes('finding')) return 'results';
    if (normalized.includes('method') || normalized.includes('design')) return 'design';
    if (normalized.includes('conclusion') || normalized.includes('implication')) return 'conclusions';
    if (normalized.includes('objective') || normalized.includes('aim') || normalized.includes('purpose')) return 'objective';
    if (normalized.includes('background') || normalized.includes('introduction')) return 'introduction';
    
    return null;
  }

  /**
   * Get content for a matched section
   */
  function getContentForSection(sectionKey, article) {
    switch (sectionKey) {
      case 'title':
        return article.title || '';
      
      case 'authors':
        return article.authors ? article.authors.join(', ') : '';
      
      case 'journal':
        return article.journal || '';
      
      case 'publication_date':
        return article.publicationDate || '';
      
      case 'pmid':
        return article.pmid || '';
      
      case 'doi':
        return article.doi || '';
      
      case 'url':
        return article.url || `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`;
      
      case 'abstract':
        if (article.abstract) {
          if (article.abstract.structured && article.abstract.sections) {
            // Return full structured abstract
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
        // If abstract has background, use it
        if (article.abstract && article.abstract.structured && article.abstract.sections) {
          const intro = article.abstract.sections.find(s => 
            s.label.toLowerCase().includes('background') || 
            s.label.toLowerCase().includes('importance')
          );
          if (intro) return intro.content;
        }
        // Otherwise use title + first part of abstract
        return article.title || '';
      
      default:
        return '';
    }
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
   */
  function processStructure(headings) {
    headings.forEach(heading => {
      // Add heading
      sections.push(
        new Paragraph({
          text: heading.text,
          heading: getHeadingLevel(heading.level),
          spacing: {
            before: 240,
            after: 120
          }
        })
      );

      // Add content if available
      if (heading.content && heading.content.trim()) {
        // Split content by paragraphs
        const paragraphs = heading.content.split('\n\n');
        paragraphs.forEach(para => {
          if (para.trim()) {
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: para.trim(),
                    font: 'Times New Roman',
                    size: 22 // 11pt
                  })
                ],
                spacing: {
                  before: 120,
                  after: 120,
                  line: 276 // 1.15 line spacing
                },
                alignment: AlignmentType.JUSTIFIED
              })
            );
          }
        });
      } else {
        // Add placeholder if no content
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '[Content not available]',
                font: 'Times New Roman',
                size: 22,
                italics: true,
                color: '999999'
              })
            ],
            spacing: {
              before: 120,
              after: 120
            }
          })
        );
      }

      // Process children recursively
      if (heading.children && heading.children.length > 0) {
        processStructure(heading.children);
      }
    });
  }

  processStructure(filledStructure);

  // Create document
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
