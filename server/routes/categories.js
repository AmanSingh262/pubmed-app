const express = require('express');
const router = express.Router();
const FilterService = require('../services/filterService');

const filterService = new FilterService();

/**
 * GET /api/categories
 * Get all available categories and subcategories
 */
router.get('/', (req, res) => {
  try {
    const categories = filterService.getAllCategories();
    
    res.json({
      categories,
      message: 'Categories retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      error: 'Failed to fetch categories',
      message: error.message
    });
  }
});

/**
 * GET /api/categories/:studyType
 * Get categories for specific study type (animal or human)
 */
router.get('/:studyType', (req, res) => {
  try {
    const { studyType } = req.params;
    
    if (!['animal', 'human'].includes(studyType)) {
      return res.status(400).json({
        error: 'Invalid study type. Must be "animal" or "human"'
      });
    }

    const allCategories = filterService.getAllCategories();
    const categories = studyType === 'animal' 
      ? allCategories.animalStudies 
      : allCategories.humanStudies;

    res.json({
      studyType,
      categories,
      message: `${studyType} study categories retrieved successfully`
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      error: 'Failed to fetch categories',
      message: error.message
    });
  }
});

/**
 * GET /api/categories/:studyType/:categoryPath/keywords
 * Get keywords for a specific category
 */
router.get('/:studyType/:categoryPath(*)/keywords', (req, res) => {
  try {
    const { studyType, categoryPath } = req.params;
    
    if (!['animal', 'human'].includes(studyType)) {
      return res.status(400).json({
        error: 'Invalid study type. Must be "animal" or "human"'
      });
    }

    const keywords = filterService.getKeywordsForCategory(studyType, categoryPath);

    res.json({
      studyType,
      categoryPath,
      keywords: keywords.keywords,
      meshTerms: keywords.meshTerms,
      textKeywords: keywords.textKeywords,
      totalKeywords: keywords.keywords.length + keywords.meshTerms.length + keywords.textKeywords.length
    });
  } catch (error) {
    console.error('Error fetching keywords:', error);
    res.status(500).json({
      error: 'Failed to fetch keywords',
      message: error.message
    });
  }
});

module.exports = router;
