const express = require('express');
const router = express.Router();
const PubMedService = require('../services/pubmedService');
const FilterService = require('../services/filterService');

const pubmedService = new PubMedService();
const filterService = new FilterService();

/**
 * POST /api/search
 * Search and filter PubMed articles
 * 
 * Body:
 * {
 *   "query": "cefixime",
 *   "studyType": "animal",
 *   "categoryPath": "pharmacokinetics.absorption",
 *   "maxResults": 200,
 *   "topN": 20
 * }
 */
router.post('/', async (req, res) => {
  try {
    const {
      query,
      studyType = 'animal',
      categoryPath,
      customKeywords = null,
      maxResults = 2000, // Increased to fetch all available articles from PubMed
      topN = 30,
      yearFrom = null,
      yearTo = null,
      hasAbstract = false,
      freeFullText = false,
      fullText = false
    } = req.body;

    // Validation
    if (!query) {
      return res.status(400).json({
        error: 'Query parameter is required'
      });
    }

    if (!categoryPath) {
      return res.status(400).json({
        error: 'Category path is required'
      });
    }

    if (!['animal', 'human'].includes(studyType)) {
      return res.status(400).json({
        error: 'Study type must be either "animal" or "human"'
      });
    }

    const startTime = Date.now();

    // Step 1: Handle multiple category paths
    const categoryPaths = categoryPath.includes(',') 
      ? categoryPath.split(',').map(p => p.trim()) 
      : [categoryPath];

    // Get heading keyword from first category path
    const headingKeyword = filterService.getHeadingKeyword(studyType, categoryPaths[0]);
    
    // Get primary search keywords for enhanced search
    let primaryKeywords = filterService.getPrimarySearchKeywords(studyType, categoryPaths[0]);
    
    // If custom keywords are provided, use them instead of default keywords
    if (customKeywords) {
      const customKeywordArray = customKeywords.split(',').map(k => k.trim()).filter(k => k);
      if (customKeywordArray.length > 0) {
        primaryKeywords = customKeywordArray;
        console.log(`Using custom keywords: ${customKeywordArray.join(', ')}`);
      }
    }

    console.log(`Searching PubMed for: ${query}`);
    console.log(`Heading keyword: ${headingKeyword}`);
    console.log(`Primary keywords: ${primaryKeywords.slice(0, 5).join(', ')}`);

    // Step 2: Search PubMed with enhanced query
    const searchResults = await pubmedService.searchArticles(query, {
      maxResults,
      categoryKeywords: primaryKeywords,
      headingKeyword,
      studyType,
      categoryPath: categoryPaths[0], // Use first category path for publication type filtering
      yearFrom,
      yearTo,
      hasAbstract,
      freeFullText,
      fullText
    });
    
    if (!searchResults.ids || searchResults.ids.length === 0) {
      return res.json({
        query,
        studyType,
        categoryPath,
        totalArticles: 0,
        filteredArticles: 0,
        articles: [],
        processingTime: Date.now() - startTime,
        searchEnhancements: {
          headingKeyword,
          categoryKeywords: primaryKeywords.slice(0, 5)
        }
      });
    }

    console.log(`Found ${searchResults.ids.length} articles`);

    // Step 3: Fetch article details
    console.log('Fetching article details...');
    const articles = await pubmedService.fetchArticleDetails(searchResults.ids);
    console.log(`Retrieved ${articles.length} article details`);

    // Validate articles have required fields
    const validArticles = articles.filter(article => article && (article.title || article.abstract));
    if (validArticles.length < articles.length) {
      console.log(`Filtered out ${articles.length - validArticles.length} articles with missing data`);
    }

    // Step 3.5: STRICT filtering based on study type - focus on TITLE for accuracy
    const studyTypeFilteredArticles = validArticles.filter(article => {
      const title = (typeof article.title === 'string' ? article.title : String(article.title || '')).toLowerCase();
      const meshTermsLower = (article.meshTerms || []).map(term => 
        (typeof term === 'string' ? term : String(term)).toLowerCase()
      );

      // Animal species keywords for title checking
      const animalSpeciesInTitle = ['in rats', 'in mice', 'in pigs', 'in rabbits', 'in dogs', 'in monkeys', 'in guinea pig', 'rat model', 'mouse model', 'animal model'];
      const strongAnimalWords = [' rat ', ' rats ', ' mouse ', ' mice ', ' pig ', ' pigs ', 'porcine', 'murine', 'in swine'];
      
      if (studyType === 'human') {
        // STRICT for human studies - check title for obvious animal species
        
        // Reject if title clearly indicates animal study
        const hasObviousAnimalInTitle = animalSpeciesInTitle.some(phrase => title.includes(phrase)) ||
                                        strongAnimalWords.some(word => title.includes(word));
        if (hasObviousAnimalInTitle) {
          console.log(`❌ REJECTED (obvious animal in title): ${title.substring(0, 60)}...`);
          return false;
        }
        
        // If MeSH terms exist, check them
        if (meshTermsLower.length > 0) {
          const hasHumansMeSH = meshTermsLower.some(term => term.includes('human'));
          const hasAnimalOnlyMeSH = meshTermsLower.some(term => term === 'animals') && !hasHumansMeSH;
          
          // Reject if it's clearly an animal-only study
          if (hasAnimalOnlyMeSH) {
            console.log(`❌ REJECTED (Animals MeSH without Humans): ${title.substring(0, 60)}...`);
            return false;
          }
        }
        
        console.log(`✅ ACCEPTED (human study): ${title.substring(0, 60)}...`);
        return true;
        
      } else if (studyType === 'animal') {
        // STRICT for animal studies - check for clinical trials
        
        // Reject if title clearly indicates clinical trial
        const hasClinicalInTitle = title.includes('clinical trial') || 
                                   title.includes('randomized controlled trial') ||
                                   (title.includes('patient') && title.includes('study'));
        if (hasClinicalInTitle) {
          console.log(`❌ REJECTED (clinical trial in title): ${title.substring(0, 60)}...`);
          return false;
        }
        
        console.log(`✅ ACCEPTED (animal study): ${title.substring(0, 60)}...`);
        return true;
      }

      return true;
    });

    console.log(`Study type filtering: ${validArticles.length} -> ${studyTypeFilteredArticles.length} articles`);
    console.log(`Filtering by ${studyType} > [${categoryPaths.join(', ')}]`);

    // Step 4: Collect all filtered articles from all categories
    const allFilteredArticles = new Map(); // Use Map to avoid duplicates by PMID

    for (const path of categoryPaths) {
      const filtered = filterService.filterAndRankArticles(
        studyTypeFilteredArticles,
        studyType,
        path,
        maxResults, // Get all matching articles, not just topN
        query // Pass the drug query for priority boosting
      );

      // Add to map, keeping highest score if article appears in multiple categories
      filtered.forEach(article => {
        const existing = allFilteredArticles.get(article.pmid);
        if (!existing || article.relevanceScore > existing.relevanceScore) {
          // Combine matches if article appears in multiple categories
          if (existing) {
            article.matches = {
              meshMatches: [...new Set([...(existing.matches.meshMatches || []), ...(article.matches.meshMatches || [])])],
              titleMatches: [...new Set([...(existing.matches.titleMatches || []), ...(article.matches.titleMatches || [])])],
              abstractMatches: [...new Set([...(existing.matches.abstractMatches || []), ...(article.matches.abstractMatches || [])])],
              keywordMatches: [...new Set([...(existing.matches.keywordMatches || []), ...(article.matches.keywordMatches || [])])],
              drugMatches: [...new Set([...(existing.matches.drugMatches || []), ...(article.matches.drugMatches || [])])]
            };
            // Boost score for appearing in multiple categories
            article.relevanceScore = Math.max(article.relevanceScore, existing.relevanceScore) + 2;
            // Preserve drug-related flags
            article.hasDrugAndFilter = article.hasDrugAndFilter || existing.hasDrugAndFilter;
            article.hasDrug = article.hasDrug || existing.hasDrug;
            article.drugInTitle = article.drugInTitle || existing.drugInTitle;
            article.drugMentionCount = Math.max(article.drugMentionCount || 0, existing.drugMentionCount || 0);
            article.filterScore = Math.max(article.filterScore || 0, existing.filterScore || 0);
          }
          allFilteredArticles.set(article.pmid, article);
        }
      });
    }

    // Convert map to array and sort by relevance score
    // Articles with BOTH drug AND filters will be at the top (200-300+ points)
    const combinedArticles = Array.from(allFilteredArticles.values())
      .sort((a, b) => {
        // Primary sort by relevance score (drug+filter = 200-300+ points, others much lower)
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        // Secondary sort: ensure hasDrugAndFilter is prioritized
        if (a.hasDrugAndFilter !== b.hasDrugAndFilter) {
          return a.hasDrugAndFilter ? -1 : 1;
        }
        // Tertiary sort: drug in title beats drug in abstract
        if (a.drugInTitle !== b.drugInTitle) {
          return a.drugInTitle ? -1 : 1;
        }
        // Quaternary sort: more drug mentions
        if ((a.drugMentionCount || 0) !== (b.drugMentionCount || 0)) {
          return (b.drugMentionCount || 0) - (a.drugMentionCount || 0);
        }
        // Final sort by match types
        return (b.matchTypes || 0) - (a.matchTypes || 0);
      })
      .slice(0, topN);

    const articlesWithDrugAndFilter = combinedArticles.filter(a => a.hasDrugAndFilter).length;
    const articlesWithDrugInTitle = combinedArticles.filter(a => a.drugInTitle).length;

    console.log(`Filtered to ${combinedArticles.length} relevant articles from ${categoryPaths.length} categories`);
    console.log(`✅ ALL results have BOTH drug + filters | 🔥 Drug in title: ${articlesWithDrugInTitle}`);

    const processingTime = Date.now() - startTime;

    res.json({
      query,
      studyType,
      categoryPath,
      categories: categoryPaths,
      totalArticles: searchResults.totalCount,
      retrievedArticles: articles.length,
      filteredArticles: combinedArticles.length,
      articles: combinedArticles,
      processingTime,
      searchEnhancements: {
        headingKeyword,
        categoryKeywords: primaryKeywords.slice(0, 5),
        filters: {
          yearFrom,
          yearTo,
          hasAbstract,
          freeFullText,
          fullText
        }
      },
      message: `Found top ${combinedArticles.length} relevant articles out of ${searchResults.totalCount} total results`
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Failed to search and filter articles',
      message: error.message
    });
  }
});

/**
 * POST /api/search/batch
 * Search with multiple categories
 * 
 * Body:
 * {
 *   "query": "cefixime",
 *   "studyType": "animal",
 *   "categoryPaths": ["pharmacokinetics.absorption", "pharmacokinetics.metabolism"],
 *   "maxResults": 200,
 *   "topN": 20
 * }
 */
router.post('/batch', async (req, res) => {
  try {
    const {
      query,
      studyType = 'animal',
      categoryPaths = [],
      maxResults = 2000, // Increased to fetch all available articles from PubMed
      topN = 30
    } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Query parameter is required'
      });
    }

    if (!categoryPaths || categoryPaths.length === 0) {
      return res.status(400).json({
        error: 'At least one category path is required'
      });
    }

    const startTime = Date.now();

    // Search PubMed once
    const searchResults = await pubmedService.searchArticles(query, maxResults);
    
    if (!searchResults.ids || searchResults.ids.length === 0) {
      return res.json({
        query,
        studyType,
        results: [],
        processingTime: Date.now() - startTime
      });
    }

    // Fetch article details once
    const articles = await pubmedService.fetchArticleDetails(searchResults.ids);

    // Filter for each category
    const results = categoryPaths.map(categoryPath => {
      const filteredArticles = filterService.filterAndRankArticles(
        articles,
        studyType,
        categoryPath,
        topN,
        query // Pass the drug query for priority boosting
      );

      return {
        categoryPath,
        filteredArticles: filteredArticles.length,
        articles: filteredArticles
      };
    });

    res.json({
      query,
      studyType,
      totalArticles: searchResults.totalCount,
      results,
      processingTime: Date.now() - startTime
    });

  } catch (error) {
    console.error('Batch search error:', error);
    res.status(500).json({
      error: 'Failed to perform batch search',
      message: error.message
    });
  }
});

/**
 * GET /api/search/suggest/:query
 * Get keyword suggestions for a query
 */
router.get('/suggest/:query', async (req, res) => {
  try {
    const { query } = req.params;
    
    // This is a placeholder for future implementation
    // Could use PubMed's spell check or suggestion API
    
    res.json({
      query,
      suggestions: [query],
      message: 'Suggestion feature coming soon'
    });

  } catch (error) {
    console.error('Suggestion error:', error);
    res.status(500).json({
      error: 'Failed to get suggestions',
      message: error.message
    });
  }
});

/**
 * DELETE /api/search/cache
 * Clear search cache
 */
router.delete('/cache', (req, res) => {
  try {
    pubmedService.clearCache();
    res.json({
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

module.exports = router;
