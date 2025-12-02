const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

const uploadDir = path.join(__dirname, '../uploads/templates');

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
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

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Template Final route is active' });
});

router.post('/upload', upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No template file uploaded' });
    }

    res.json({
      message: 'Template uploaded successfully.',
      templatePath: req.file.path,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload template', details: error.message });
  }
});

router.post('/preview', async (req, res) => {
  try {
    const { templatePath, articles = [], selectedCategories = [] } = req.body;
    if (!templatePath) {
      return res.status(400).json({ error: 'templatePath is required' });
    }

    const resolvedTemplatePath = path.isAbsolute(templatePath) ? templatePath : path.join(process.cwd(), templatePath);
    const templateContent = await fs.readFile(resolvedTemplatePath, 'binary');
    const zip = new PizZip(templateContent);
    const docXml = zip.file('word/document.xml').asText();

    const headings = extractHeadings(docXml);

    res.json({
      headingCount: headings.length,
      headingSamples: headings.slice(0, 15),
      matchedHeadings: headings.length,
      selectedCategories,
      message: 'Template analyzed successfully.'
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Failed to analyze template', details: error.message });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const { templatePath, articles = [], selectedCategories = [] } = req.body;

    if (!templatePath) {
      return res.status(400).json({ error: 'templatePath is required' });
    }
    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: 'At least one article is required' });
    }

    const resolvedTemplatePath = path.isAbsolute(templatePath) ? templatePath : path.join(process.cwd(), templatePath);
    const templateContent = await fs.readFile(resolvedTemplatePath, 'binary');
    const zip = new PizZip(templateContent);
    let docXml = zip.file('word/document.xml').asText();

    const headings = extractHeadings(docXml);
    const relevantHeadings = selectedCategories.length > 0
      ? headings.filter(heading => shouldIncludeHeading(heading, selectedCategories))
      : headings;

    relevantHeadings.sort((a, b) => b.index - a.index).forEach(heading => {
      const content = generateHeadingContent(heading, articles);
      if (content) {
        const contentXml = buildParagraphXml(content);
        docXml = docXml.slice(0, heading.index + heading.length) + contentXml + docXml.slice(heading.index + heading.length);
      }
    });

    zip.file('word/document.xml', docXml);

    const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    const outputFilename = `Document_${Date.now()}.docx`;
    const outputPath = path.join(__dirname, '../uploads/generated', outputFilename);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, buffer);

    res.download(outputPath, outputFilename, err => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download generated document' });
      }
      setTimeout(() => fs.unlink(outputPath).catch(() => {}), 5000);
    });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Failed to generate document', details: error.message });
  }
});

function extractHeadings(docXml) {
  const headings = [];
  const paragraphRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let match;

  while ((match = paragraphRegex.exec(docXml)) !== null) {
    const block = match[0];
    const text = (extractParagraphText(block) || '').trim();
    if (!text) continue;

    let isHeading = false;
    let levelNumber = 1;

    const styleMatch = block.match(/<w:pStyle\b[^>]*w:val="?([^"\s>]+)"?/i);
    if (styleMatch) {
      const styleVal = styleMatch[1];
      if (/^(?:heading\s?\d+|Heading\s?\d+|title|Title)$/i.test(styleVal)) {
        isHeading = true;
        const levelMatch = styleVal.match(/\d+/);
        levelNumber = levelMatch ? parseInt(levelMatch[0], 10) : 1;
      }
    }

    if (!isHeading && /<w:numPr\b/.test(block)) {
      const levelMatch = block.match(/<w:ilvl[^>]*w:val="?(\d+)"?/);
      if (levelMatch) {
        isHeading = true;
        levelNumber = parseInt(levelMatch[1], 10) + 1;
      } else {
        const normalizedText = text.replace(/^[-•\s]+/, '');
        const numberingMatch = normalizedText.match(/^(\d+(?:\.\d+)*)/);
        if (numberingMatch) {
          isHeading = true;
          levelNumber = numberingMatch[1].split('.').length;
        } else {
          isHeading = true;
          levelNumber = 2;
        }
      }
    } else if (!isHeading) {
      const textualNumberMatch = text.match(/^(\d+(?:\.\d+)+)\s+/);
      if (textualNumberMatch) {
        isHeading = true;
        levelNumber = textualNumberMatch[1].split('.').length;
      }
    }

    if (!isHeading) continue;

    headings.push({ index: match.index, length: block.length, text, level: levelNumber });
  }

  return headings;
}

function extractParagraphText(paragraphXml) {
  const textMatches = paragraphXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
  if (!textMatches) return '';
  return textMatches
    .map(run => run.replace(/<\/?.*?>/g, ''))
    .map(run => decodeXml(run))
    .join('');
}

function decodeXml(value) {
  if (!value) return '';
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function shouldIncludeHeading(heading, selectedCategories) {
  if (!selectedCategories || selectedCategories.length === 0) return true;
  
  const normalized = heading.text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanText = heading.text.replace(/^[\d\.\s]+/, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  return selectedCategories.some(category => {
    const fullCategoryNormalized = category.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalized.includes(fullCategoryNormalized) || cleanText.includes(fullCategoryNormalized);
  });
}

function generateHeadingContent(heading, articles) {
  if (!articles || articles.length === 0) {
    return '[No matching abstract found in provided sources]';
  }

  const sections = articles.map(article => {
    const title = article.title || 'Untitled source';
    const authors = formatAuthors(article);
    const journal = article.journal || 'Journal unavailable';
    const yearMatch = (article.publicationDate || '').match(/\d{4}/);
    const year = yearMatch ? yearMatch[0] : 'Year unavailable';
    const identifier = article.pmid ? `PMID ${article.pmid}` : (article.doi ? `DOI ${article.doi}` : '');
    
    const header = `Source: ${title} — ${authors} — ${journal} — ${year}${identifier ? ' — ' + identifier : ''}`;
    const abstractText = getAbstractText(article);
    
    if (!abstractText) {
      return `${header}\n[No abstract available]`;
    }
    
    return `${header}\n${abstractText}`;
  }).filter(Boolean);

  return sections.join('\n\n----\n\n');
}

function formatAuthors(article = {}) {
  if (Array.isArray(article.authors) && article.authors.length > 0) {
    return article.authors.join(', ');
  }
  if (typeof article.authors === 'string') {
    return article.authors;
  }
  return 'Authors unavailable';
}

function getAbstractText(article = {}) {
  if (!article) return '';
  const abstract = article.abstract;
  if (!abstract) return '';
  if (typeof abstract === 'string') return abstract;
  if (abstract.text) return abstract.text;
  if (Array.isArray(abstract.sections)) {
    return abstract.sections.map(section => {
      const label = section.label ? `${section.label}: ` : '';
      return `${label}${section.content || ''}`;
    }).join(' ');
  }
  return '';
}

function buildParagraphXml(content) {
  return content
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => createParagraphXml(block))
    .join('');
}

function createParagraphXml(text) {
  const safeText = escapeXml(text);
  return [
    '<w:p>',
    '  <w:pPr>',
    '    <w:pStyle w:val="Normal"/>',
    '  </w:pPr>',
    '  <w:r>',
    '    <w:t xml:space="preserve">' + safeText + '</w:t>',
    '  </w:r>',
    '</w:p>'
  ].join('');
}

function escapeXml(text) {
  const safe = text == null ? '' : String(text);
  return safe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = router;
