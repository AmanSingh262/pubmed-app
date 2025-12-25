const express = require('express');
const router = express.Router();

/**
 * GET /api/drug-stats
 * Get drug synonym service statistics
 */
router.get('/', (req, res) => {
  try {
    const FilterService = require('../services/filterService');
    const filterService = new FilterService();
    
    const stats = filterService.drugSynonymService.getStats();
    
    res.json({
      success: true,
      stats: {
        localDatabase: {
          drugs: stats.localDatabaseSize,
          hits: stats.localHits
        },
        rxNormAPI: {
          calls: stats.apiCalls,
          hits: stats.apiHits,
          cacheSize: stats.rxNormCacheSize,
          hitRate: stats.apiCalls > 0 ? `${((stats.apiHits / stats.apiCalls) * 100).toFixed(1)}%` : '0%'
        },
        performance: {
          localVsApi: `${stats.localHits} local / ${stats.apiCalls} API`,
          cacheEfficiency: stats.rxNormCacheSize > 0 ? 'Caching active' : 'No cache yet'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/drug-stats/clear-cache
 * Clear RxNorm API cache
 */
router.post('/clear-cache', (req, res) => {
  try {
    const FilterService = require('../services/filterService');
    const filterService = new FilterService();
    
    filterService.drugSynonymService.clearCache();
    
    res.json({
      success: true,
      message: 'RxNorm cache cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
