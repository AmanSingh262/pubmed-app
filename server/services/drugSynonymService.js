/**
 * Drug Synonym Service
 * Maps brand names to generic names and provides synonym matching
 */

const fs = require('fs');
const path = require('path');

class DrugSynonymService {
  constructor() {
    // Load comprehensive drug database from JSON file
    this.synonymMap = this.loadDrugDatabase();
  }

  /**
   * Load drug synonym database from JSON file
   * @returns {Object} Drug synonym mappings
   */
  loadDrugDatabase() {
    try {
      const filePath = path.join(__dirname, '../data/drugSynonyms.json');
      const data = fs.readFileSync(filePath, 'utf8');
      const drugCategories = JSON.parse(data);
      
      // Flatten all categories into a single synonym map
      const synonymMap = {};
      
      for (const category of Object.values(drugCategories)) {
        for (const [drugName, synonyms] of Object.entries(category)) {
          synonymMap[drugName.toLowerCase()] = synonyms.map(s => s.toLowerCase());
          
          // Also create reverse mappings (synonym -> original drug)
          synonyms.forEach(synonym => {
            const synLower = synonym.toLowerCase();
            if (!synonymMap[synLower]) {
              synonymMap[synLower] = [drugName.toLowerCase()];
            } else if (!synonymMap[synLower].includes(drugName.toLowerCase())) {
              synonymMap[synLower].push(drugName.toLowerCase());
            }
          });
        }
      }
      
      console.log(`✅ Loaded ${Object.keys(synonymMap).length} drugs from database`);
      return synonymMap;
      
    } catch (error) {
      console.error('⚠️ Error loading drug database, using minimal fallback:', error.message);
      
      // Fallback to minimal hard-coded list if file not found
      return {
      console.error('⚠️ Error loading drug database, using minimal fallback:', error.message);
      
      // Fallback to minimal hard-coded list if file not found
      return {
        // Augmentin family
        'augmentin': [
          'amoxicillin-clavulanic acid', 
          'amoxicillin and clavulanic acid',
          'amoxycillin and clavulanic acid', 
          'co-amoxiclav', 
          'amoxicillin clavulanate', 
          'amoxycillin clavulanic acid',
          'amoxicillin/clavulanic acid',
          'amoxicillin-clavulanate',
          'amoxicillin and clavulanate'
        ],
        'amoxicillin-clavulanic acid': ['augmentin', 'co-amoxiclav'],
        'co-amoxiclav': ['augmentin', 'amoxicillin-clavulanic acid'],
        
        // Basic drugs
        'aspirin': ['acetylsalicylic acid', 'asa'],
        'paracetamol': ['acetaminophen', 'tylenol'],
        'ibuprofen': ['advil', 'motrin']
      };
    }
  }

  /**
   * Get all synonyms for a drug name
   * @param {string} drugName - Drug name to find synonyms for
   * @returns {Array} Array of synonyms including the original name
   */
  getSynonyms(drugName) {
    if (!drugName) return [];
    
    const drugLower = drugName.toLowerCase().trim();
    const synonyms = [drugLower];
    
    // Get direct synonyms
    if (this.synonymMap[drugLower]) {
      synonyms.push(...this.synonymMap[drugLower]);
    }
    
    // Check if this drug is a synonym of another
    for (const [key, values] of Object.entries(this.synonymMap)) {
      if (values.includes(drugLower) && !synonyms.includes(key)) {
        synonyms.push(key);
      }
    }
    
    return [...new Set(synonyms)];
  }

  /**
   * Check if text contains any drug synonyms
   * @param {string} text - Text to search
   * @param {string} drugName - Drug name to match
   * @returns {Object} Match details
   */
  matchDrugSynonyms(text, drugName) {
    if (!text || !drugName) {
      return { found: false, matchedTerms: [], count: 0 };
    }
    
    const textLower = text.toLowerCase();
    const synonyms = this.getSynonyms(drugName);
    const matchedTerms = [];
    let totalCount = 0;
    
    for (const synonym of synonyms) {
      // Create regex for word boundary matching
      const regex = new RegExp(`\\b${this.escapeRegex(synonym)}\\b`, 'gi');
      const matches = textLower.match(regex);
      
      if (matches) {
        matchedTerms.push(synonym);
        totalCount += matches.length;
      }
    }
    
    // SPECIAL HANDLING: For combination drugs, check if components appear separately
    // E.g., "amoxicillin" and "clavulanic acid" might be in different sentences
    if (matchedTerms.length === 0) {
      const drugLower = drugName.toLowerCase();
      
      // Check for Augmentin/Co-amoxiclav components
      if (['augmentin', 'co-amoxiclav', 'amoxicillin-clavulanic acid'].includes(drugLower)) {
        const hasAmoxicillin = /\b(amoxicillin|amoxycillin)\b/i.test(textLower);
        const hasClavulanic = /\b(clavulanic|clavulanate)\b/i.test(textLower);
        
        if (hasAmoxicillin && hasClavulanic) {
          matchedTerms.push('amoxicillin and clavulanic acid');
          totalCount = 1;
        }
      }
    }
    
    return {
      found: matchedTerms.length > 0,
      matchedTerms: [...new Set(matchedTerms)],
      count: totalCount,
      queriedDrug: drugName,
      allSynonyms: synonyms
    };
  }

  /**
   * Escape special regex characters
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Add custom drug synonym mapping
   * @param {string} drugName - Primary drug name
   * @param {Array} synonyms - Array of synonym names
   */
  addSynonym(drugName, synonyms) {
    const drugLower = drugName.toLowerCase().trim();
    if (!this.synonymMap[drugLower]) {
      this.synonymMap[drugLower] = [];
    }
    
    const synonymsLower = synonyms.map(s => s.toLowerCase().trim());
    this.synonymMap[drugLower].push(...synonymsLower);
    this.synonymMap[drugLower] = [...new Set(this.synonymMap[drugLower])];
  }
}

module.exports = DrugSynonymService;
