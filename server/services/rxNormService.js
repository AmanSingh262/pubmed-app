/**
 * RxNorm API Service
 * Integrates with National Library of Medicine's RxNorm API
 * Free, production-grade drug terminology service
 * Documentation: https://rxnav.nlm.nih.gov/
 */

const axios = require('axios');

class RxNormService {
  constructor() {
    this.baseUrl = 'https://rxnav.nlm.nih.gov/REST';
    this.cache = new Map(); // Cache API results
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Get drug synonyms from RxNorm API
   * @param {string} drugName - Drug name to search
   * @returns {Promise<Array>} Array of synonyms
   */
  async getDrugSynonyms(drugName) {
    if (!drugName) return [];

    const drugLower = drugName.toLowerCase().trim();
    
    // Check cache first
    const cached = this.getCached(drugLower);
    if (cached) {
      console.log(`📦 RxNorm cache hit for: ${drugName}`);
      return cached;
    }

    try {
      console.log(`🌐 RxNorm API lookup: ${drugName}`);
      
      // Step 1: Get RxCUI (RxNorm Concept Unique Identifier)
      const rxcuiResponse = await axios.get(`${this.baseUrl}/rxcui.json`, {
        params: { name: drugName },
        timeout: 5000
      });

      const rxcuiList = rxcuiResponse.data?.idGroup?.rxnormId;
      if (!rxcuiList || rxcuiList.length === 0) {
        console.log(`⚠️ No RxCUI found for: ${drugName}`);
        this.setCached(drugLower, []);
        return [];
      }

      const rxcui = rxcuiList[0]; // Use first match
      console.log(`✅ Found RxCUI: ${rxcui} for ${drugName}`);

      // Step 2: Get related drugs and synonyms
      const relatedResponse = await axios.get(`${this.baseUrl}/rxcui/${rxcui}/related.json`, {
        params: { tty: 'SCD+SBD+GPCK+BPCK+IN+MIN+PIN+BN' },
        timeout: 5000
      });

      const synonyms = new Set();
      const relatedGroup = relatedResponse.data?.relatedGroup;

      if (relatedGroup) {
        // Extract all concept names
        for (const group of relatedGroup.conceptGroup || []) {
          if (group.conceptProperties) {
            for (const concept of group.conceptProperties) {
              if (concept.name) {
                synonyms.add(concept.name.toLowerCase());
              }
            }
          }
        }
      }

      // Step 3: Also get spelling suggestions and approximate matches
      const spellingResponse = await axios.get(`${this.baseUrl}/spellingsuggestions.json`, {
        params: { name: drugName },
        timeout: 5000
      });

      if (spellingResponse.data?.suggestionGroup?.suggestionList?.suggestion) {
        spellingResponse.data.suggestionGroup.suggestionList.suggestion.forEach(s => {
          synonyms.add(s.toLowerCase());
        });
      }

      const synonymArray = Array.from(synonyms).filter(s => s !== drugLower);
      console.log(`✅ RxNorm found ${synonymArray.length} synonyms for ${drugName}`);

      // Cache the results
      this.setCached(drugLower, synonymArray);

      return synonymArray;

    } catch (error) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        console.warn(`⚠️ RxNorm API timeout for: ${drugName}`);
      } else {
        console.warn(`⚠️ RxNorm API error for ${drugName}:`, error.message);
      }
      
      // Cache empty result to avoid repeated failed API calls
      this.setCached(drugLower, []);
      return [];
    }
  }

  /**
   * Get cached result
   * @param {string} drugName - Drug name
   * @returns {Array|null} Cached synonyms or null
   */
  getCached(drugName) {
    const cached = this.cache.get(drugName);
    if (!cached) return null;

    // Check if cache expired
    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.cache.delete(drugName);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cache
   * @param {string} drugName - Drug name
   * @param {Array} synonyms - Synonyms array
   */
  setCached(drugName, synonyms) {
    this.cache.set(drugName, {
      data: synonyms,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ RxNorm cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

module.exports = RxNormService;
