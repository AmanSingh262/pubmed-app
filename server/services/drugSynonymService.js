/**
 * Drug Synonym Service
 * Maps brand names to generic names and provides synonym matching
 */

class DrugSynonymService {
  constructor() {
    // Common drug synonyms and brand names
    this.synonymMap = {
      // Augmentin family
      'augmentin': [
        'amoxicillin-clavulanic acid', 
        'amoxicillin and clavulanic acid',  // NEW: added variant with "and"
        'amoxycillin and clavulanic acid', 
        'co-amoxiclav', 
        'amoxicillin clavulanate', 
        'amoxycillin clavulanic acid',
        'amoxicillin/clavulanic acid',  // NEW: added variant with slash
        'amoxicillin-clavulanate',
        'amoxicillin and clavulanate'  // NEW: added variant
      ],
      'amoxicillin-clavulanic acid': ['augmentin', 'co-amoxiclav', 'amoxycillin and clavulanic acid', 'amoxicillin and clavulanic acid'],
      'co-amoxiclav': ['augmentin', 'amoxicillin-clavulanic acid', 'amoxycillin and clavulanic acid', 'amoxicillin and clavulanic acid'],
      
      // Cefixime family
      'cefixime': ['suprax', 'cefixime trihydrate'],
      'suprax': ['cefixime'],
      
      // Aspirin family
      'aspirin': ['acetylsalicylic acid', 'asa', 'acetyl salicylic acid'],
      'acetylsalicylic acid': ['aspirin', 'asa'],
      
      // Paracetamol/Acetaminophen
      'paracetamol': ['acetaminophen', 'tylenol', 'panadol'],
      'acetaminophen': ['paracetamol', 'tylenol'],
      'tylenol': ['paracetamol', 'acetaminophen'],
      
      // Metformin
      'metformin': ['glucophage', 'metformin hydrochloride'],
      'glucophage': ['metformin'],
      
      // Ibuprofen
      'ibuprofen': ['advil', 'motrin', 'nurofen'],
      'advil': ['ibuprofen'],
      'motrin': ['ibuprofen'],
      
      // Omeprazole
      'omeprazole': ['prilosec', 'losec'],
      'prilosec': ['omeprazole'],
      
      // Ciprofloxacin
      'ciprofloxacin': ['cipro', 'ciprofloxacin hydrochloride'],
      'cipro': ['ciprofloxacin'],
      
      // Azithromycin
      'azithromycin': ['zithromax', 'azithromycin dihydrate'],
      'zithromax': ['azithromycin'],
      
      // Add more as needed...
    };
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
