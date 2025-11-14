const express = require('express');
const router = express.Router();

/**
 * POST /api/export/csv
 * Export search results to CSV format
 */
router.post('/csv', (req, res) => {
  try {
    const { articles, query, categoryPath } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({
        error: 'No articles to export'
      });
    }

    // Create CSV header
    const csvHeader = 'PMID,Title,Authors,Journal,Publication Date,Relevance Score,MeSH Terms,URL\n';

    // Create CSV rows
    const csvRows = articles.map(article => {
      const pmid = article.pmid || '';
      const title = `"${(article.title || '').replace(/"/g, '""')}"`;
      const authors = `"${(article.authors || []).join('; ').replace(/"/g, '""')}"`;
      const journal = `"${(article.journal || '').replace(/"/g, '""')}"`;
      const pubDate = article.publicationDate || '';
      const score = article.relevanceScore || 0;
      const meshTerms = `"${(article.meshTerms || []).join('; ').replace(/"/g, '""')}"`;
      const url = article.url || '';

      return `${pmid},${title},${authors},${journal},${pubDate},${score},${meshTerms},${url}`;
    }).join('\n');

    const csv = csvHeader + csvRows;

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="pubmed_results_${query}_${Date.now()}.csv"`);
    
    res.send(csv);

  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({
      error: 'Failed to export CSV',
      message: error.message
    });
  }
});

/**
 * POST /api/export/bibtex
 * Export search results to BibTeX format
 */
router.post('/bibtex', (req, res) => {
  try {
    const { articles } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({
        error: 'No articles to export'
      });
    }

    // Generate BibTeX entries
    const bibtexEntries = articles.map((article, index) => {
      const pmid = article.pmid || `unknown${index}`;
      const title = article.title || 'Unknown Title';
      const authors = (article.authors || []).join(' and ');
      const journal = article.journal || 'Unknown Journal';
      const year = article.publicationDate ? article.publicationDate.split(' ')[0] : 'Unknown';

      return `@article{PMID${pmid},
  author = {${authors}},
  title = {${title}},
  journal = {${journal}},
  year = {${year}},
  pmid = {${pmid}},
  url = {https://pubmed.ncbi.nlm.nih.gov/${pmid}/}
}`;
    }).join('\n\n');

    res.setHeader('Content-Type', 'application/x-bibtex');
    res.setHeader('Content-Disposition', `attachment; filename="pubmed_results_${Date.now()}.bib"`);
    
    res.send(bibtexEntries);

  } catch (error) {
    console.error('BibTeX export error:', error);
    res.status(500).json({
      error: 'Failed to export BibTeX',
      message: error.message
    });
  }
});

/**
 * POST /api/export/ris
 * Export search results to RIS format
 */
router.post('/ris', (req, res) => {
  try {
    const { articles } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({
        error: 'No articles to export'
      });
    }

    // Generate RIS entries
    const risEntries = articles.map(article => {
      const pmid = article.pmid || '';
      const title = article.title || 'Unknown Title';
      const authors = (article.authors || []).map(author => `AU  - ${author}`).join('\n');
      const journal = article.journal || 'Unknown Journal';
      const year = article.publicationDate ? article.publicationDate.split(' ')[0] : '';

      return `TY  - JOUR
${authors}
TI  - ${title}
JO  - ${journal}
PY  - ${year}
UR  - https://pubmed.ncbi.nlm.nih.gov/${pmid}/
ID  - ${pmid}
ER  -`;
    }).join('\n\n');

    res.setHeader('Content-Type', 'application/x-research-info-systems');
    res.setHeader('Content-Disposition', `attachment; filename="pubmed_results_${Date.now()}.ris"`);
    
    res.send(risEntries);

  } catch (error) {
    console.error('RIS export error:', error);
    res.status(500).json({
      error: 'Failed to export RIS',
      message: error.message
    });
  }
});

/**
 * POST /api/export/json
 * Export search results to JSON format
 */
router.post('/json', (req, res) => {
  try {
    const { articles, query, studyType, categoryPath } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({
        error: 'No articles to export'
      });
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      query,
      studyType,
      categoryPath,
      totalArticles: articles.length,
      articles
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="pubmed_results_${query}_${Date.now()}.json"`);
    
    res.send(JSON.stringify(exportData, null, 2));

  } catch (error) {
    console.error('JSON export error:', error);
    res.status(500).json({
      error: 'Failed to export JSON',
      message: error.message
    });
  }
});

module.exports = router;
