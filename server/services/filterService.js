const fs = require('fs');
const path = require('path');

class FilterService {
  constructor() {
    this.keywordMappings = this.loadKeywordMappings();
  }

  /**
   * Load keyword mappings from JSON file
   * @returns {Object} Keyword mappings object
   */
  loadKeywordMappings() {
    try {
      const filePath = path.join(__dirname, '../data/keywordMappings.json');
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading keyword mappings:', error.message);
      return { animalStudies: { categories: {} }, humanStudies: { categories: {} } };
    }
  }

  /**
   * Get keywords for a specific category path
   * @param {string} studyType - 'animal' or 'human'
   * @param {string} categoryPath - Dot-separated path (e.g., 'pharmacokinetics.absorption' or just 'pharmacokinetics')
   * @returns {Object} Keywords object with meshTerms, textKeywords, and all keywords
   */
  getKeywordsForCategory(studyType, categoryPath) {
    const studyKey = studyType === 'animal' ? 'animalStudies' : 'humanStudies';
    const study = this.keywordMappings[studyKey];
    
    if (!study) return { keywords: [], meshTerms: [], textKeywords: [] };

    const pathParts = categoryPath.split('.');
    let current = study.categories;

    for (const part of pathParts) {
      if (current[part]) {
        current = current[part];
      } else if (current.subcategories && current.subcategories[part]) {
        current = current.subcategories[part];
      } else if (current.types && current.types[part]) {
        current = current.types[part];
      } else {
        return { keywords: [], meshTerms: [], textKeywords: [] };
      }
    }

    const allKeywords = [];
    const allMeshTerms = [];
    const allTextKeywords = [];

    // CORRECT BEHAVIOR:
    // - Parent heading only (pathParts.length === 1): Collect from ALL children (BROAD search)
    // - Child/grandchild selected (pathParts.length > 1): Collect ONLY from selected node (NARROW search)

    if (pathParts.length === 1) {
      // PARENT HEADING ONLY: Collect ALL keywords from ALL subcategories (BROAD)
      // This gives comprehensive results for the entire category
      const collectAllKeywords = (obj) => {
        if (obj.keywords) allKeywords.push(...obj.keywords);
        if (obj.meshTerms) allMeshTerms.push(...obj.meshTerms);
        if (obj.textKeywords) allTextKeywords.push(...obj.textKeywords);

        if (obj.subcategories) {
          Object.values(obj.subcategories).forEach(sub => collectAllKeywords(sub));
        }
        if (obj.types) {
          Object.values(obj.types).forEach(type => collectAllKeywords(type));
        }
      };

      collectAllKeywords(current);

      // Also add the heading name itself
      if (current.name) {
        allKeywords.push(current.name);
        allTextKeywords.push(current.name);
      }
    } else {
      // CHILD/GRANDCHILD SELECTED: Collect ONLY from current node (NARROW)
      // This gives specific results for just this subcategory
      if (current.keywords) allKeywords.push(...current.keywords);
      if (current.meshTerms) allMeshTerms.push(...current.meshTerms);
      if (current.textKeywords) allTextKeywords.push(...current.textKeywords);

      // If this is a subcategory with types, include type keywords too
      // but ONLY if we're at the subcategory level (not if specific type selected)
      if (current.types && pathParts.length === 2) {
        Object.values(current.types).forEach(type => {
          if (type.keywords) allKeywords.push(...type.keywords);
          if (type.meshTerms) allMeshTerms.push(...type.meshTerms);
          if (type.textKeywords) allTextKeywords.push(...type.textKeywords);
        });
      }
    }

    return {
      keywords: [...new Set(allKeywords)], // Remove duplicates
      meshTerms: [...new Set(allMeshTerms)],
      textKeywords: [...new Set(allTextKeywords)]
    };
  }

  /**
   * Get category names from path for title matching
   * @param {string} studyType - 'animal' or 'human'
   * @param {string} categoryPath - Category path (e.g., 'pharmacokinetics.distribution')
   * @returns {Object} Object with parentName, childName, fullPath, isSubheading, and innerKeywords
   */
  getCategoryNamesFromPath(studyType, categoryPath) {
    const studyKey = studyType === 'animal' ? 'animalStudies' : 'humanStudies';
    const study = this.keywordMappings[studyKey];
    
    if (!study) return { parentName: '', childName: '', fullPath: '', isSubheading: false, innerKeywords: [] };

    const pathParts = categoryPath.split('.');
    let parentName = '';
    let childName = '';
    let current = study.categories;
    const categoryNames = [];

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      
      if (current[part]) {
        categoryNames.push(current[part].name);
        if (i === 0) parentName = current[part].name;
        current = current[part];
      } else if (current.subcategories && current.subcategories[part]) {
        categoryNames.push(current.subcategories[part].name);
        if (i === 1) childName = current.subcategories[part].name;
        current = current.subcategories[part];
      } else if (current.types && current.types[part]) {
        categoryNames.push(current.types[part].name);
        if (i === pathParts.length - 1) childName = current.types[part].name;
        current = current.types[part];
      }
    }

    const isSubheading = pathParts.length > 1;
    const fullPath = categoryNames.join(' > ');
    
    // Extract inner keywords (specific to the child category, not the parent)
    const innerKeywords = [];
    if (current.keywords) innerKeywords.push(...current.keywords);
    if (current.textKeywords) innerKeywords.push(...current.textKeywords);
    if (childName) innerKeywords.push(childName);

    return {
      parentName,
      childName,
      fullPath,
      isSubheading,
      innerKeywords: [...new Set(innerKeywords.map(k => k.replace(/\[(MeSH|tiab)\]$/i, '').trim().toLowerCase()))]
    };
  }

  /**
   * Get heading keyword for PubMed search query
   * @param {string} studyType - 'animal' or 'human'
   * @param {string} categoryPath - Category path
   * @returns {string} Heading keyword for search
   */
  getHeadingKeyword(studyType, categoryPath) {
    const studyKey = studyType === 'animal' ? 'animalStudies' : 'humanStudies';
    const study = this.keywordMappings[studyKey];
    
    if (!study) return '';

    const pathParts = categoryPath.split('.');
    let current = study.categories;
    let headingName = '';

    // Get the first level heading name
    if (pathParts.length > 0 && current[pathParts[0]]) {
      headingName = current[pathParts[0]].name;
    }

    return headingName;
  }

  /**
   * Get primary search keywords for a category (for PubMed query enhancement)
   * @param {string} studyType - 'animal' or 'human'
   * @param {string} categoryPath - Category path
   * @returns {Array} Array of top keywords for search
   */
  getPrimarySearchKeywords(studyType, categoryPath) {
    const pathParts = categoryPath.split('.');
    
    // Get all keywords for this category (respects parent vs child hierarchy)
    const filterKeywords = this.getKeywordsForCategory(studyType, categoryPath);
    
    // Get top keywords for PubMed search query
    const primaryKeywords = [];
    
    // DIFFERENT BEHAVIOR for parent vs child:
    // Parent (pathParts.length === 1): Use more keywords for BROAD search
    // Child (pathParts.length > 1): Use fewer, more specific keywords for NARROW search
    const maxKeywords = pathParts.length === 1 ? 8 : 3;
    
    // PRIORITIZE MeSH terms (most specific and reliable)
    if (filterKeywords.meshTerms.length > 0) {
      const specificMeSH = filterKeywords.meshTerms
        .filter(term => {
          const cleanTerm = term.replace(/\[MeSH\]$/i, '').trim().toLowerCase();
          // Exclude overly generic terms
          return !['efficacy', 'treatment outcome', 'drug therapy'].includes(cleanTerm);
        })
        .slice(0, Math.ceil(maxKeywords * 0.6)); // 60% MeSH terms
      
      specificMeSH.forEach(term => {
        const cleanTerm = term.replace(/\[MeSH\]$/i, '').trim();
        primaryKeywords.push(cleanTerm);
      });
    }
    
    // Add textKeywords to fill up to maxKeywords
    if (primaryKeywords.length < maxKeywords && filterKeywords.textKeywords.length > 0) {
      const specificText = filterKeywords.textKeywords
        .filter(term => {
          const cleanTerm = term.replace(/\[tiab\]$/i, '').trim().toLowerCase();
          // For parent, be more lenient; for child, be strict
          if (pathParts.length === 1) {
            return cleanTerm.length > 3;
          } else {
            return !['efficacy', 'safety', 'pharmacokinetics'].includes(cleanTerm) && cleanTerm.length > 5;
          }
        })
        .slice(0, maxKeywords - primaryKeywords.length);
      
      specificText.forEach(term => {
        const cleanTerm = term.replace(/\[tiab\]$/i, '').trim();
        primaryKeywords.push(cleanTerm);
      });
    }
    
    // Parent needs broader search, so return more keywords
    // Child needs narrow search, so return fewer keywords
    return [...new Set(primaryKeywords)]; // Remove duplicates
  }

  /**
   * Calculate relevance score for an article based on keyword matches
   * @param {Object} article - Article object with title, abstract, meshTerms, keywords
   * @param {Object} filterKeywords - Keywords to match against
   * @param {string} drugQuery - Optional drug/query term to check for dual presence
   * @param {string} studyType - Study type for category name extraction
   * @param {string} categoryPath - Category path for precise matching
   * @returns {Object} Score details with total score and matches
   */
  calculateRelevanceScore(article, filterKeywords, drugQuery = null, studyType = null, categoryPath = null) {
    let score = 0;
    const matches = {
      meshMatches: [],
      titleMatches: [],
      abstractMatches: [],
      keywordMatches: [],
      drugMatches: []
    };

    // Safety check
    if (!article) {
      return { score: 0, matches, matchTypes: 0, hasDrugAndFilter: false, hasDrug: false };
    }

    // PRIORITY 1: Check for drug name presence FIRST (most important)
    let hasDrug = false;
    let drugInTitle = false;
    let drugInAbstract = false;
    let drugMentionCount = 0;

    if (drugQuery) {
      const drugQueryLower = drugQuery.toLowerCase().trim();
      const titleStr = typeof article.title === 'string' ? article.title.toLowerCase() : '';
      const abstractStr = typeof article.abstract === 'string' ? article.abstract.toLowerCase() : '';
      const fullText = `${titleStr} ${abstractStr}`;
      
      // Check drug presence - RELAXED: allow partial matches for brand names and variations
      // Try word boundary first (most accurate)
      const drugRegex = new RegExp(`\\b${drugQueryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      drugInTitle = drugRegex.test(titleStr);
      drugInAbstract = drugRegex.test(abstractStr);
      hasDrug = drugInTitle || drugInAbstract;
      
      // If not found with word boundary, try substring match (catches "augmentin" in "augmentins" etc.)
      if (!hasDrug && drugQueryLower.length >= 4) {
        drugInTitle = titleStr.includes(drugQueryLower);
        drugInAbstract = abstractStr.includes(drugQueryLower);
        hasDrug = drugInTitle || drugInAbstract;
        if (hasDrug) {
          console.log(`💊 DRUG FOUND (partial match): "${drugQuery}" in ${drugInTitle ? 'title' : 'abstract'}`);
        }
      }
      
      if (hasDrug) {
        // Count drug mentions for frequency scoring
        drugMentionCount = (fullText.match(drugRegex) || []).length;
        // If partial match, count manually
        if (drugMentionCount === 0) {
          const regex = new RegExp(drugQueryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          drugMentionCount = (fullText.match(regex) || []).length;
        }
        matches.drugMatches.push(drugQuery);
        
        // MASSIVE BASE SCORE for drug presence - ensures drug articles rank highest
        if (drugInTitle) {
          score += 150; // Huge base score for drug in title
          console.log(`💊 DRUG IN TITLE: "${drugQuery}" found in title (Base: +150)`);
        } else if (drugInAbstract) {
          score += 80; // Strong base score for drug in abstract
          console.log(`💊 DRUG IN ABSTRACT: "${drugQuery}" found in abstract (Base: +80)`);
        }
        
        // Frequency bonus - more mentions = more relevant
        if (drugMentionCount >= 5) {
          score += 40; // Very frequent mentions
        } else if (drugMentionCount >= 3) {
          score += 25; // Multiple mentions
        } else if (drugMentionCount >= 2) {
          score += 15; // Two mentions
        }
        
        console.log(`💊 Drug "${drugQuery}" mentioned ${drugMentionCount} times (Frequency bonus: +${drugMentionCount >= 5 ? 40 : drugMentionCount >= 3 ? 25 : drugMentionCount >= 2 ? 15 : 0})`);
      }
    }

    // PRIORITY 2: Check for TITLE/HEADING matches with FULL FILTER PATH (highest priority)
    let titleHasFullPath = false;
    let titleHasInnerKeywords = false;
    let titleHasParentOnly = false;
    let shouldRejectParentOnly = false;

    if (studyType && categoryPath) {
      const titleStr = typeof article.title === 'string' ? article.title.toLowerCase() : '';
      const categoryInfo = this.getCategoryNamesFromPath(studyType, categoryPath);
      
      // Check for full path match (e.g., "Pharmacokinetics > Distribution")
      if (categoryInfo.fullPath) {
        const fullPathLower = categoryInfo.fullPath.toLowerCase();
        // Check for exact or close matches with common separators
        const pathVariations = [
          fullPathLower,
          fullPathLower.replace(/ > /g, ': '),
          fullPathLower.replace(/ > /g, ' - '),
          fullPathLower.replace(/ > /g, ' '),
        ];
        titleHasFullPath = pathVariations.some(variation => titleStr.includes(variation));
        
        if (titleHasFullPath && hasDrug) {
          score += 500; // MASSIVE boost for drug + full filter path in title
          console.log(`🔥🔥🔥 PERFECT MATCH: Drug "${drugQuery}" + Full Path "${categoryInfo.fullPath}" in title (Boost: +500)`);
          matches.titleMatches.push(categoryInfo.fullPath);
        } else if (titleHasFullPath) {
          score += 100; // Strong boost for full path in title even without drug
          console.log(`📋 FULL PATH IN TITLE: "${categoryInfo.fullPath}" found in title (Boost: +100)`);
          matches.titleMatches.push(categoryInfo.fullPath);
        }
      }

      // For subheading filters, check for inner keywords (child-specific terms)
      if (categoryInfo.isSubheading && !titleHasFullPath) {
        const abstractStr = typeof article.abstract === 'string' ? article.abstract.toLowerCase() : '';
        const fullText = `${titleStr} ${abstractStr}`;
        
        // Check if title OR abstract contains any inner keywords (child-specific)
        titleHasInnerKeywords = categoryInfo.innerKeywords.some(keyword => fullText.includes(keyword));
        
        if (titleHasInnerKeywords && hasDrug) {
          score += 300; // High boost for drug + inner keywords
          console.log(`🎯 INNER KEYWORDS MATCH: Drug "${drugQuery}" + child keywords found (Boost: +300)`);
        } else if (titleHasInnerKeywords) {
          score += 50; // Moderate boost for inner keywords
          console.log(`🎯 INNER KEYWORDS: Child-specific terms found (Boost: +50)`);
        }

        // Check if ONLY has parent keyword (we'll decide rejection after calculating filterScore)
        if (categoryInfo.parentName) {
          const parentLower = categoryInfo.parentName.toLowerCase();
          const hasParent = fullText.includes(parentLower);
          titleHasParentOnly = hasParent && !titleHasInnerKeywords;
        }
      }
    }

    const { keywords, meshTerms, textKeywords } = filterKeywords;
    const allKeywords = [...keywords, ...meshTerms, ...textKeywords];

    // MeSH term matching (HIGHEST weight: +15 points per match, increased from 10)
    let meshMatchCount = 0;
    if (article.meshTerms && meshTerms.length > 0) {
      for (const mesh of article.meshTerms) {
        // Ensure mesh is a string
        const meshStr = typeof mesh === 'string' ? mesh : String(mesh);
        const meshLower = meshStr.toLowerCase();
        
        for (const filterMesh of meshTerms) {
          // Remove [MeSH] tag for comparison
          const cleanFilterMesh = filterMesh.replace(/\[MeSH\]$/i, '').trim().toLowerCase();
          
          // Exact match gets higher score
          if (meshLower === cleanFilterMesh) {
            score += 20; // Exact MeSH match is very strong indicator
            matches.meshMatches.push(meshStr);
            meshMatchCount++;
            break;
          } else if (meshLower.includes(cleanFilterMesh) || cleanFilterMesh.includes(meshLower)) {
            score += 15; // Partial MeSH match
            matches.meshMatches.push(meshStr);
            meshMatchCount++;
            break;
          }
          // Also check for word-level partial matches (more lenient)
          else {
            const meshWords = meshLower.split(/\s+/);
            const filterWords = cleanFilterMesh.split(/\s+/);
            const hasWordMatch = meshWords.some(mw => filterWords.some(fw => 
              mw.includes(fw) || fw.includes(mw)
            ));
            if (hasWordMatch) {
              score += 8; // Partial word match in MeSH
              matches.meshMatches.push(meshStr);
              meshMatchCount++;
              break;
            }
          }
        }
      }
    }

    // Title keyword matching (+8 points per match, increased from 5)
    let titleMatchCount = 0;
    if (article.title) {
      // Ensure title is a string
      const titleStr = typeof article.title === 'string' ? article.title : String(article.title);
      const titleLower = titleStr.toLowerCase();
      
      for (const keyword of allKeywords) {
        const cleanKeyword = keyword.replace(/\[(MeSH|tiab)\]$/i, '').trim().toLowerCase();
        
        // Use word boundary for more accurate matching
        const wordBoundaryRegex = new RegExp(`\\b${cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (wordBoundaryRegex.test(titleLower)) {
          score += 8;
          matches.titleMatches.push(keyword);
          titleMatchCount++;
        }
        // Also check for partial matches (more lenient)
        else if (titleLower.includes(cleanKeyword)) {
          score += 4; // Partial match in title
          matches.titleMatches.push(keyword);
          titleMatchCount++;
        }
      }
    }
    
    // Boost score if both title and MeSH match
    if (titleMatchCount > 0 && meshMatchCount > 0) {
      score += 10; // Bonus for having both types of matches
    }

    // Abstract keyword matching (+5 points per match - increased to value abstracts more)
    let abstractMatchCount = 0;
    if (article.abstract) {
      // Ensure abstract is a string
      const abstractStr = typeof article.abstract === 'string' ? article.abstract : String(article.abstract);
      const abstractLower = abstractStr.toLowerCase();
      for (const keyword of allKeywords) {
        const cleanKeyword = keyword.replace(/\[(MeSH|tiab)\]$/i, '').trim().toLowerCase();
        // Use word boundary for better matching
        const wordBoundaryRegex = new RegExp(`\\b${cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (wordBoundaryRegex.test(abstractLower)) {
          score += 5; // Increased from 2 to 5
          matches.abstractMatches.push(keyword);
          abstractMatchCount++;
        }
        // Also accept partial matches in abstract (very lenient)
        else if (abstractLower.includes(cleanKeyword) && cleanKeyword.length > 4) {
          score += 2; // Partial match
          matches.abstractMatches.push(keyword);
          abstractMatchCount++;
        }
      }
    }

    // Article keywords matching (+3 points per match)
    if (article.keywords && article.keywords.length > 0) {
      for (const artKeyword of article.keywords) {
        // Ensure keyword is a string
        const keywordStr = typeof artKeyword === 'string' ? artKeyword : String(artKeyword);
        for (const filterKeyword of allKeywords) {
          const cleanFilterKeyword = filterKeyword.replace(/\[(MeSH|tiab)\]$/i, '').trim().toLowerCase();
          if (keywordStr.toLowerCase().includes(cleanFilterKeyword)) {
            score += 3;
            matches.keywordMatches.push(keywordStr);
            break;
          }
        }
      }
    }

    // Bonus multiplier for multiple types of matches
    const matchTypes = [
      matches.meshMatches.length > 0,
      matches.titleMatches.length > 0,
      matches.abstractMatches.length > 0,
      matches.keywordMatches.length > 0
    ].filter(Boolean).length;

    if (matchTypes >= 3) {
      score = Math.floor(score * 1.5); // 50% bonus for 3+ match types
    } else if (matchTypes >= 2) {
      score = Math.floor(score * 1.2); // 20% bonus for 2+ match types
    }

    // Store filter score before adding drug bonuses
    const filterScore = score;
    const hasFilterMatches = score > 0 || matchTypes > 0;

    // NOW determine if parent-only should be rejected (after filterScore is calculated)
    if (titleHasParentOnly) {
      // ONLY reject if NO filter matches at all (very strict parent-only case)
      shouldRejectParentOnly = filterScore === 0;
      if (shouldRejectParentOnly) {
        console.log(`⚠️ PARENT-ONLY MATCH: Has parent term but NO child term and NO filter keywords - WILL REJECT`);
      } else {
        console.log(`✅ HAS PARENT: Has parent term and some filter keywords (score: ${filterScore}), keeping article`);
      }
    }

    // CRITICAL: HIGH PRIORITY only if article has BOTH drug AND filter matches
    // RELAXED: Accept even small filter scores to show more relevant results
    let hasDrugAndFilter = false;
    if (hasDrug && filterScore > 0) { // Changed from hasFilterMatches to filterScore > 0
      hasDrugAndFilter = true;
      
      // MASSIVE PRIORITY BOOST only when BOTH conditions are met
      if (drugInTitle) {
        score += 200; // Huge boost for drug in title + filters
        console.log(`🔥 HIGH PRIORITY: Drug "${drugQuery}" in title + filters matched (Boost: +200)`);
      } else if (drugInAbstract) {
        score += 120; // Strong boost for drug in abstract + filters
        console.log(`🔥 HIGH PRIORITY: Drug "${drugQuery}" in abstract + filters matched (Boost: +120)`);
      }
      
      // Frequency bonus for multiple drug mentions (only when filters also match)
      if (drugMentionCount >= 5) {
        score += 40; // Very frequent mentions
      } else if (drugMentionCount >= 3) {
        score += 25; // Multiple mentions
      } else if (drugMentionCount >= 2) {
        score += 15; // Two mentions
      }
      
      console.log(`💊 Drug mentioned ${drugMentionCount} times with filter matches (filterScore: ${filterScore})`);
    } else if (hasDrug && !hasFilterMatches) {
      // Drug present but NO filter matches - LOW priority (small boost only)
      if (drugInTitle) {
        score += 5; // Minimal boost
        console.log(`⚠️ LOW PRIORITY: Drug "${drugQuery}" in title but NO filter match (Boost: +5)`);
      } else {
        score += 2; // Very minimal boost
        console.log(`⚠️ LOW PRIORITY: Drug "${drugQuery}" in abstract but NO filter match (Boost: +2)`);
      }
    }

    // Calculate final priority score
    const finalScore = score;
    const priorityLevel = hasDrugAndFilter ? 'HIGHEST' : 
                         hasDrug ? 'LOW' : 
                         matchTypes >= 2 ? 'MEDIUM' : 'LOW';

    if (hasDrug || hasDrugAndFilter) {
      console.log(`📊 FINAL SCORE: ${finalScore} | Priority: ${priorityLevel} | Drug: ${hasDrug} | Filters: ${hasFilterMatches} | Drug+Filter: ${hasDrugAndFilter}`);
    }

    return {
      score: finalScore,
      matches,
      matchTypes,
      hasDrugAndFilter,
      hasDrug,
      drugInTitle,
      drugMentionCount,
      filterScore,
      titleHasFullPath,
      titleHasInnerKeywords,
      shouldRejectParentOnly
    };
  }

  /**
   * Check if article should be excluded based on study type
   * @param {Object} article - Article object
   * @param {string} studyType - 'animal' or 'human'
   * @returns {boolean} True if article should be excluded
   */
  shouldExcludeArticle(article, studyType) {
    // Enhanced animal-related keywords with more specific terms
    const animalKeywords = [
      'rat', 'rats', 'rattus', 'mouse', 'mice', 'murine', 'mus musculus',
      'rabbit', 'rabbits', 'oryctolagus', 'dog', 'dogs', 'canine', 'canis',
      'cat', 'cats', 'feline', 'felis', 'pig', 'pigs', 'porcine', 'swine', 'sus scrofa',
      'monkey', 'monkeys', 'primate', 'primates', 'macaque', 'rhesus',
      'guinea pig', 'guinea pigs', 'cavia porcellus', 'hamster', 'hamsters',
      'animal model', 'animal models', 'animal study', 'animal studies', 
      'in vivo', 'rodent', 'rodents', 'bovine', 'cattle', 'cow', 'cows',
      'ovine', 'sheep', 'equine', 'horse', 'horses', 'goat', 'goats',
      'xenograft', 'transgenic', 'knockout mice', 'wild-type',
      'sprague-dawley', 'wistar rat', 'balb/c', 'c57bl', 'nude mice'
    ];

    // Enhanced human-related keywords
    const humanKeywords = [
      'human', 'humans', 'homo sapiens', 'patient', 'patients', 
      'subject', 'subjects', 'participant', 'participants',
      'volunteer', 'volunteers', 'clinical trial', 'clinical trials', 
      'clinical study', 'clinical studies', 'randomized controlled trial',
      'man', 'woman', 'men', 'women', 'male', 'female', 'males', 'females',
      'adult', 'adults', 'child', 'children', 'pediatric', 'paediatric',
      'infant', 'infants', 'neonate', 'neonates', 'elderly', 'geriatric',
      'adolescent', 'adolescents', 'teenager', 'teenagers',
      'phase i', 'phase ii', 'phase iii', 'phase iv',
      'double-blind', 'single-blind', 'placebo-controlled',
      'cohort study', 'case-control', 'cross-sectional'
    ];

    // MeSH terms that strongly indicate animal studies
    const animalMeshTerms = [
      'animals', 'rats', 'mice', 'rabbits', 'dogs', 'cats', 'swine',
      'disease models, animal', 'models, animal'
    ];

    // MeSH terms that strongly indicate human studies
    const humanMeshTerms = [
      'humans', 'adult', 'male', 'female', 'aged', 'middle aged',
      'young adult', 'child', 'infant', 'adolescent'
    ];

    const title = typeof article.title === 'string' ? article.title.toLowerCase() : '';
    const abstract = typeof article.abstract === 'string' ? article.abstract.toLowerCase() : '';
    const meshTerms = Array.isArray(article.meshTerms) ? article.meshTerms.map(m => String(m).toLowerCase()) : [];
    
    const fullText = `${title} ${abstract}`;
    const meshText = meshTerms.join(' ');

    // Check MeSH terms first (most reliable)
    const hasAnimalMesh = animalMeshTerms.some(term => meshText.includes(term.toLowerCase()));
    const hasHumanMesh = humanMeshTerms.some(term => meshText.includes(term.toLowerCase()));

    // Count keyword occurrences for weighted decision
    let animalScore = 0;
    let humanScore = 0;

    // MeSH terms have highest weight
    if (hasAnimalMesh) animalScore += 10;
    if (hasHumanMesh) humanScore += 10;

    // Count keyword matches in title (high weight)
    animalKeywords.forEach(keyword => {
      if (title.includes(keyword)) animalScore += 3;
    });
    humanKeywords.forEach(keyword => {
      if (title.includes(keyword)) humanScore += 3;
    });

    // Count keyword matches in abstract (lower weight)
    animalKeywords.forEach(keyword => {
      if (abstract.includes(keyword)) animalScore += 1;
    });
    humanKeywords.forEach(keyword => {
      if (abstract.includes(keyword)) humanScore += 1;
    });

    if (studyType === 'human') {
      // STRICT for human studies - check title primarily
      
      // High priority rejection: obvious animal species in title
      const obviousAnimalInTitle = title.includes(' in rats') || title.includes(' in mice') || 
                                    title.includes(' in pigs') || title.includes(' in rabbits') ||
                                    title.includes('rat model') || title.includes('mouse model') ||
                                    title.includes('animal model');
      if (obviousAnimalInTitle) {
        return true;
      }
      
      // Reject if animal MeSH present but no human MeSH
      if (hasAnimalMesh && !hasHumanMesh) {
        return true;
      }
      
      // Reject if title has strong animal indicators and low human score
      const strongAnimalInTitle = animalKeywords.slice(0, 10).some(keyword => 
        title.includes(` ${keyword} `) || title.includes(` ${keyword},`)
      );
      if (strongAnimalInTitle && humanScore < animalScore) {
        return true;
      }
      
    } else if (studyType === 'animal') {
      // STRICT for animal studies
      
      // Reject if obvious clinical trial in title
      const obviousClinicalInTitle = title.includes('clinical trial') || 
                                      title.includes('randomized controlled trial') ||
                                      (title.includes('patients') && title.includes('study'));
      if (obviousClinicalInTitle) {
        return true;
      }
      
      // Reject if has human MeSH but no animal indicators
      if (hasHumanMesh && !hasAnimalMesh && animalScore < 3) {
        return true;
      }
    }

    return false;
  }

  /**
   * Filter and rank articles based on category keywords
   * @param {Array} articles - Array of article objects
   * @param {string} studyType - 'animal' or 'human'
   * @param {string} categoryPath - Category path string
   * @param {number} topN - Number of top results to return
   * @param {string} drugQuery - Optional drug/query term for priority boosting
   * @returns {Array} Filtered and ranked articles
   */
  filterAndRankArticles(articles, studyType, categoryPath, topN = 30, drugQuery = null) {
    const filterKeywords = this.getKeywordsForCategory(studyType, categoryPath);
    
    if (filterKeywords.keywords.length === 0) {
      console.warn(`No keywords found for ${studyType} > ${categoryPath}`);
      return articles.slice(0, topN);
    }

    // First, exclude articles that don't match the study type
    const typeFilteredArticles = articles.filter(article => !this.shouldExcludeArticle(article, studyType));
    
    console.log(`Excluded ${articles.length - typeFilteredArticles.length} articles based on study type`);

    // Calculate scores for all articles, passing drugQuery for priority boosting
    const scoredArticles = typeFilteredArticles.map(article => {
      const scoreData = this.calculateRelevanceScore(article, filterKeywords, drugQuery, studyType, categoryPath);
      return {
        ...article,
        relevanceScore: scoreData.score,
        matches: scoreData.matches,
        matchTypes: scoreData.matchTypes,
        hasDrugAndFilter: scoreData.hasDrugAndFilter,
        hasDrug: scoreData.hasDrug,
        drugInTitle: scoreData.drugInTitle,
        drugMentionCount: scoreData.drugMentionCount,
        filterScore: scoreData.filterScore,
        titleHasFullPath: scoreData.titleHasFullPath,
        titleHasInnerKeywords: scoreData.titleHasInnerKeywords,
        shouldRejectParentOnly: scoreData.shouldRejectParentOnly
      };
    });

    // Filter and sort articles
    // VERY LENIENT: Trust PubMed's search results - just rank them by relevance
    // If PubMed found them, they're likely relevant - we just prioritize the best ones
    const filteredArticles = scoredArticles
      .filter(article => {
        const titleStr = typeof article.title === 'string' ? article.title : (article.title ? String(article.title) : 'Unknown');
        
        // Only reject if clearly wrong study type or parent-only with zero matches
        if (article.shouldRejectParentOnly && article.filterScore === 0 && !article.hasDrug) {
          console.log(`❌ EXCLUDED (parent-only, no drug, no keywords): ${titleStr.substring(0, 60)}...`);
          return false;
        }
        
        // Accept ALL articles that have the drug name (PubMed already filtered for relevance)
        if (article.hasDrug) {
          return true;
        }
        
        // Also accept articles with strong filter matches even without explicit drug mention
        // (drug might be a synonym or in different form)
        if (article.filterScore >= 10 || article.matchTypes >= 2) {
          console.log(`✅ INCLUDED (strong filter match, implicit drug): ${titleStr.substring(0, 60)}...`);
          return true;
        }
        
        // Exclude only if no drug AND weak/no filter matches
        console.log(`❌ EXCLUDED (no drug, weak matches): ${titleStr.substring(0, 60)}...`);
        return false;
      })
      .sort((a, b) => {
        // HIGHEST PRIORITY: Title has full filter path + drug (scores 650+)
        if ((a.titleHasFullPath && a.hasDrug) !== (b.titleHasFullPath && b.hasDrug)) {
          return (b.titleHasFullPath && b.hasDrug) ? 1 : -1;
        }
        // Second priority: Title has inner keywords + drug (scores 450+)
        if ((a.titleHasInnerKeywords && a.hasDrug) !== (b.titleHasInnerKeywords && b.hasDrug)) {
          return (b.titleHasInnerKeywords && b.hasDrug) ? 1 : -1;
        }
        // Third priority: Sort by relevance score (drug+filter = 200-300+ points)
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        // Fourth sort: Prioritize hasDrugAndFilter flag (safety check)
        if (a.hasDrugAndFilter !== b.hasDrugAndFilter) {
          return a.hasDrugAndFilter ? -1 : 1;
        }
        // Fifth sort: drug in title over abstract (when both have drug+filter)
        if (a.drugInTitle !== b.drugInTitle) {
          return a.drugInTitle ? -1 : 1;
        }
        // Sixth sort: more drug mentions (when both have drug+filter)
        if (a.drugMentionCount !== b.drugMentionCount) {
          return b.drugMentionCount - a.drugMentionCount;
        }
        // Final sort by match types
        return b.matchTypes - a.matchTypes;
      });

    const articlesWithDrug = filteredArticles.filter(a => a.hasDrug).length;
    const articlesWithDrugAndFilter = filteredArticles.filter(a => a.hasDrugAndFilter).length;
    const articlesWithDrugInTitle = filteredArticles.filter(a => a.drugInTitle).length;
    const articlesWithFullPath = filteredArticles.filter(a => a.titleHasFullPath && a.hasDrug).length;
    const articlesWithInnerKeywords = filteredArticles.filter(a => a.titleHasInnerKeywords && a.hasDrug).length;
    const weakMatches = filteredArticles.filter(a => a.hasDrug && a.filterScore >= 0 && a.filterScore < 10).length;
    const strongFilterOnly = filteredArticles.filter(a => !a.hasDrug && a.filterScore >= 10).length;
    const totalExcluded = scoredArticles.length - filteredArticles.length;

    console.log(`📊 RANKING SUMMARY:`);
    console.log(`   - ✅ Total included: ${filteredArticles.length} articles (from ${scoredArticles.length} scored)`);
    console.log(`   - 🔥🔥🔥 Title: Drug + Full Path: ${articlesWithFullPath}`);
    console.log(`   - 🎯🎯 Title: Drug + Inner Keywords: ${articlesWithInnerKeywords}`);
    console.log(`   - 🔥 Drug in title: ${articlesWithDrugInTitle}`);
    console.log(`   - 💊 Has drug name: ${articlesWithDrug}`);
    console.log(`   - 💊 Drug + any filters: ${articlesWithDrugAndFilter}`);
    console.log(`   - 📄 Drug + weak matches: ${weakMatches}`);
    console.log(`   - 🔍 Strong filter only (no drug): ${strongFilterOnly}`);
    console.log(`   - ❌ Total excluded: ${totalExcluded}`);
    console.log(`   - 📈 Inclusion rate: ${Math.round((filteredArticles.length / scoredArticles.length) * 100)}%`);

    // Return top N results
    return filteredArticles.slice(0, topN);
  }

  /**
   * Get all categories structure for frontend
   * @returns {Object} Categories structure
   */
  getAllCategories() {
    return {
      animalStudies: this.buildCategoryTree(this.keywordMappings.animalStudies),
      humanStudies: this.buildCategoryTree(this.keywordMappings.humanStudies)
    };
  }

  /**
   * Build a simplified category tree for frontend
   * @param {Object} study - Study object from mappings
   * @returns {Object} Simplified category tree
   */
  buildCategoryTree(study) {
    const tree = {
      name: study.name,
      categories: []
    };

    for (const [catKey, catValue] of Object.entries(study.categories)) {
      const category = {
        key: catKey,
        name: catValue.name,
        subcategories: []
      };

      if (catValue.subcategories) {
        for (const [subKey, subValue] of Object.entries(catValue.subcategories)) {
          const subcategory = {
            key: subKey,
            name: subValue.name,
            path: `${catKey}.${subKey}`,
            types: []
          };

          if (subValue.types) {
            for (const [typeKey, typeValue] of Object.entries(subValue.types)) {
              subcategory.types.push({
                key: typeKey,
                name: typeValue.name,
                path: `${catKey}.${subKey}.${typeKey}`
              });
            }
          }

          category.subcategories.push(subcategory);
        }
      }

      tree.categories.push(category);
    }

    return tree;
  }

  /**
   * Highlight matched keywords in text
   * @param {string} text - Text to highlight
   * @param {Array} keywords - Keywords to highlight
   * @returns {string} HTML string with highlighted keywords
   */
  highlightKeywords(text, keywords) {
    if (!text || !keywords || keywords.length === 0) {
      return text;
    }

    let highlightedText = text;
    const cleanKeywords = keywords.map(kw => 
      kw.replace(/\[(MeSH|tiab)\]$/i, '').trim()
    );

    for (const keyword of cleanKeywords) {
      const regex = new RegExp(`(${this.escapeRegex(keyword)})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    }

    return highlightedText;
  }

  /**
   * Escape special regex characters
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = FilterService;
