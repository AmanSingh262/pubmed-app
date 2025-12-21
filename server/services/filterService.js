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

    // If only main heading is selected (e.g., "Pharmacokinetics"), 
    // only use the heading name itself as the keyword
    if (pathParts.length === 1 && current.name) {
      return {
        keywords: [current.name],
        meshTerms: [],
        textKeywords: [current.name]
      };
    }

    // If subcategory or type is selected, collect all keywords from children
    const allKeywords = [];
    const allMeshTerms = [];
    const allTextKeywords = [];

    const collectKeywords = (obj) => {
      if (obj.keywords) allKeywords.push(...obj.keywords);
      if (obj.meshTerms) allMeshTerms.push(...obj.meshTerms);
      if (obj.textKeywords) allTextKeywords.push(...obj.textKeywords);

      if (obj.subcategories) {
        Object.values(obj.subcategories).forEach(sub => collectKeywords(sub));
      }
      if (obj.types) {
        Object.values(obj.types).forEach(type => collectKeywords(type));
      }
    };

    collectKeywords(current);

    return {
      keywords: [...new Set(allKeywords)], // Remove duplicates
      meshTerms: [...new Set(allMeshTerms)],
      textKeywords: [...new Set(allTextKeywords)]
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
    
    // If only main heading is selected (e.g., "Pharmacokinetics"), return empty array
    // The heading keyword itself will be used via getHeadingKeyword()
    if (pathParts.length === 1) {
      return [];
    }
    
    // If subcategory or type is selected, get their specific keywords
    const filterKeywords = this.getKeywordsForCategory(studyType, categoryPath);
    
    // Get top 3-5 most relevant keywords for search (reduced from 5-10 for better specificity)
    const primaryKeywords = [];
    
    // PRIORITIZE MeSH terms (most specific and reliable)
    if (filterKeywords.meshTerms.length > 0) {
      // Get unique MeSH terms, prioritize those that aren't in other categories
      const specificMeshTerms = filterKeywords.meshTerms
        .filter(term => {
          const cleanTerm = term.replace(/\[MeSH\]$/i, '').trim().toLowerCase();
          // Exclude overly generic terms that appear everywhere
          return !['efficacy', 'treatment outcome', 'drug therapy'].includes(cleanTerm);
        })
        .slice(0, 3); // Top 3 most specific MeSH terms
      
      specificMeshTerms.forEach(term => {
        const cleanTerm = term.replace(/\[MeSH\]$/i, '').trim();
        primaryKeywords.push(cleanTerm);
      });
    }
    
    // Add specific textKeywords only if we have few MeSH terms
    if (primaryKeywords.length < 3 && filterKeywords.textKeywords.length > 0) {
      const specificTextKeywords = filterKeywords.textKeywords
        .filter(term => {
          const cleanTerm = term.replace(/\[tiab\]$/i, '').trim().toLowerCase();
          // Exclude generic terms
          return !['efficacy', 'safety'].includes(cleanTerm) && cleanTerm.length > 5;
        })
        .slice(0, 2); // Max 2 text keywords
      
      specificTextKeywords.forEach(term => {
        const cleanTerm = term.replace(/\[tiab\]$/i, '').trim();
        primaryKeywords.push(cleanTerm);
      });
    }
    
    return [...new Set(primaryKeywords)]; // Remove duplicates
  }

  /**
   * Calculate relevance score for an article based on keyword matches
   * @param {Object} article - Article object with title, abstract, meshTerms, keywords
   * @param {Object} filterKeywords - Keywords to match against
   * @param {string} drugQuery - Optional drug/query term to check for dual presence
   * @returns {Object} Score details with total score and matches
   */
  calculateRelevanceScore(article, filterKeywords, drugQuery = null) {
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
      
      // Create flexible drug matching patterns
      // Include partial matches and common variations
      const drugPatterns = [
        new RegExp(`\\b${drugQueryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), // Exact word
        new RegExp(`${drugQueryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), // Partial match (e.g., "augmentin" in "augmentin-based")
      ];
      
      // Check if any pattern matches
      for (const pattern of drugPatterns) {
        if (pattern.test(titleStr)) {
          drugInTitle = true;
          hasDrug = true;
          break;
        }
      }
      
      if (!hasDrug) {
        for (const pattern of drugPatterns) {
          if (pattern.test(abstractStr)) {
            drugInAbstract = true;
            hasDrug = true;
            break;
          }
        }
      }
      
      if (hasDrug) {
        // Count drug mentions for frequency scoring - use more flexible matching
        drugMentionCount = (fullText.match(drugPatterns[1]) || []).length;
        matches.drugMatches.push(drugQuery);
        
        console.log(`💊 DRUG FOUND: "${drugQuery}" - Title: ${drugInTitle}, Abstract: ${drugInAbstract}, Mentions: ${drugMentionCount}`);
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
          
          // More flexible matching - exact, contains, or partial
          if (meshLower === cleanFilterMesh) {
            score += 25; // Exact MeSH match - increased for better detection
            matches.meshMatches.push(meshStr);
            meshMatchCount++;
            break;
          } else if (meshLower.includes(cleanFilterMesh) || cleanFilterMesh.includes(meshLower)) {
            score += 20; // Partial MeSH match - increased
            matches.meshMatches.push(meshStr);
            meshMatchCount++;
            break;
          }
        }
      }
    }

    // Title keyword matching (+10 points per match - increased for better detection)
    let titleMatchCount = 0;
    if (article.title) {
      // Ensure title is a string
      const titleStr = typeof article.title === 'string' ? article.title : String(article.title);
      const titleLower = titleStr.toLowerCase();
      
      for (const keyword of allKeywords) {
        const cleanKeyword = keyword.replace(/\[(MeSH|tiab)\]$/i, '').trim().toLowerCase();
        
        // Try both word boundary and partial matching
        const wordBoundaryRegex = new RegExp(`\\b${cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        const partialRegex = new RegExp(cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        
        if (wordBoundaryRegex.test(titleLower)) {
          score += 10; // Exact word match
          matches.titleMatches.push(keyword);
          titleMatchCount++;
        } else if (partialRegex.test(titleLower)) {
          score += 7; // Partial match in title
          matches.titleMatches.push(keyword);
          titleMatchCount++;
        }
      }
    }
    
    // Boost score if both title and MeSH match
    if (titleMatchCount > 0 && meshMatchCount > 0) {
      score += 15; // Bonus for having both types of matches - increased
    }

    // Abstract keyword matching (+3 points per match - increased for better detection)
    let abstractMatchCount = 0;
    if (article.abstract) {
      // Ensure abstract is a string
      const abstractStr = typeof article.abstract === 'string' ? article.abstract : String(article.abstract);
      const abstractLower = abstractStr.toLowerCase();
      for (const keyword of allKeywords) {
        const cleanKeyword = keyword.replace(/\[(MeSH|tiab)\]$/i, '').trim().toLowerCase();
        // Use partial matching for abstracts (more flexible)
        if (abstractLower.includes(cleanKeyword)) {
          score += 3;
          matches.abstractMatches.push(keyword);
          abstractMatchCount++;
        }
      }
    }

    // Article keywords matching (+4 points per match - increased)
    if (article.keywords && article.keywords.length > 0) {
      for (const artKeyword of article.keywords) {
        // Ensure keyword is a string
        const keywordStr = typeof artKeyword === 'string' ? artKeyword : String(artKeyword);
        for (const filterKeyword of allKeywords) {
          const cleanFilterKeyword = filterKeyword.replace(/\[(MeSH|tiab)\]$/i, '').trim().toLowerCase();
          if (keywordStr.toLowerCase().includes(cleanFilterKeyword)) {
            score += 4;
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

    // Apply multiplier for diverse matches
    if (matchTypes >= 3) {
      score = Math.floor(score * 1.6); // 60% bonus for 3+ match types - increased
    } else if (matchTypes >= 2) {
      score = Math.floor(score * 1.3); // 30% bonus for 2+ match types - increased
    }

    // Store filter score before adding drug bonuses
    const filterScore = score;
    const hasFilterMatches = score > 0 || matchTypes > 0;

    // Log filter matching results
    if (hasFilterMatches) {
      console.log(`✓ FILTER MATCHED: Score ${filterScore}, MeSH:${meshMatchCount}, Title:${titleMatchCount}, Abstract:${abstractMatchCount}, Types:${matchTypes}`);
    }

    // CRITICAL: HIGH PRIORITY when article has BOTH drug AND filter matches
    let hasDrugAndFilter = false;
    if (hasDrug && hasFilterMatches) {
      hasDrugAndFilter = true;
      
      // MASSIVE PRIORITY BOOST only when BOTH conditions are met
      if (drugInTitle) {
        score += 250; // Huge boost for drug in title + filters - increased to ensure top ranking
        console.log(`🔥 PERFECT MATCH: Drug "${drugQuery}" in title + filters (Boost: +250)`);
      } else if (drugInAbstract) {
        score += 150; // Strong boost for drug in abstract + filters - increased
        console.log(`🔥 EXCELLENT MATCH: Drug "${drugQuery}" in abstract + filters (Boost: +150)`);
      }
      
      // Frequency bonus for multiple drug mentions (only when filters also match)
      if (drugMentionCount >= 5) {
        score += 50; // Very frequent mentions - increased
      } else if (drugMentionCount >= 3) {
        score += 30; // Multiple mentions - increased
      } else if (drugMentionCount >= 2) {
        score += 20; // Two mentions - increased
      }
      
      console.log(`💊 Drug mentioned ${drugMentionCount} times with filter matches | FINAL SCORE: ${score}`);
    } else if (hasDrug && !hasFilterMatches) {
      // Drug present but NO filter matches - still excluded later, but minimal score
      score = 1; // Minimal score to identify but exclude
      console.log(`⚠️ Drug "${drugQuery}" found but NO filter match - will be excluded`);
    } else if (!hasDrug && hasFilterMatches) {
      // Filters matched but no drug - will be excluded
      score = 1; // Minimal score to identify but exclude  
      console.log(`⚠️ Filters matched but NO drug "${drugQuery}" - will be excluded`);
    }

    return {
      score,
      matches,
      matchTypes,
      hasDrugAndFilter,
      hasDrug,
      drugInTitle,
      drugMentionCount,
      filterScore,
      hasFilterMatches
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
      const scoreData = this.calculateRelevanceScore(article, filterKeywords, drugQuery);
      return {
        ...article,
        relevanceScore: scoreData.score,
        matches: scoreData.matches,
        matchTypes: scoreData.matchTypes,
        hasDrugAndFilter: scoreData.hasDrugAndFilter,
        hasDrug: scoreData.hasDrug,
        drugInTitle: scoreData.drugInTitle,
        drugMentionCount: scoreData.drugMentionCount,
        filterScore: scoreData.filterScore
      };
    });

    // Filter and sort articles
    // STRICT: ONLY show articles with BOTH drug AND filters
    // Exclude: drug only (no filters) OR filter only (no drug)
    const filteredArticles = scoredArticles
      .filter(article => {
        // MUST have both drug AND filter matches
        if (!article.hasDrugAndFilter) {
          if (article.hasDrug && !article.hasDrugAndFilter) {
            console.log(`❌ EXCLUDED (drug only, no filters): ${String(article.title).substring(0, 60)}...`);
          } else if (!article.hasDrug && article.filterScore > 0) {
            console.log(`❌ EXCLUDED (filters only, no drug): ${String(article.title).substring(0, 60)}...`);
          }
          return false;
        }
        // Only include articles with BOTH drug AND filters
        return article.hasDrugAndFilter && article.relevanceScore > 0;
      })
      .sort((a, b) => {
        // Primary sort: BOTH drug and filters (scores 300-500+) rank first
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        // Secondary sort: Prioritize hasDrugAndFilter flag (safety check)
        if (a.hasDrugAndFilter !== b.hasDrugAndFilter) {
          return a.hasDrugAndFilter ? -1 : 1;
        }
        // Tertiary sort: drug in title over abstract (when both have drug+filter)
        if (a.drugInTitle !== b.drugInTitle) {
          return a.drugInTitle ? -1 : 1;
        }
        // Quaternary sort: more drug mentions (when both have drug+filter)
        if (a.drugMentionCount !== b.drugMentionCount) {
          return b.drugMentionCount - a.drugMentionCount;
        }
        // Final sort by match types
        return b.matchTypes - a.matchTypes;
      });

    const articlesWithDrug = filteredArticles.filter(a => a.hasDrug).length;
    const articlesWithDrugAndFilter = filteredArticles.filter(a => a.hasDrugAndFilter).length;
    const articlesWithDrugInTitle = filteredArticles.filter(a => a.drugInTitle).length;
    const excludedFilterOnly = scoredArticles.filter(a => !a.hasDrug && a.filterScore > 0).length;
    const excludedDrugOnly = scoredArticles.filter(a => a.hasDrug && !a.hasDrugAndFilter).length;

    console.log(`📊 RANKING SUMMARY:`);
    console.log(`   - ✅ Total included: ${filteredArticles.length} (ALL have BOTH drug + filters)`);
    console.log(`   - 🔥 Drug in title + filters: ${articlesWithDrugInTitle}`);
    console.log(`   - ❌ Excluded filter only (no drug): ${excludedFilterOnly}`);
    console.log(`   - ❌ Excluded drug only (no filters): ${excludedDrugOnly}`);

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
