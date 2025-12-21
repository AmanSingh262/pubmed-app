const axios = require('axios');
const xml2js = require('xml2js');
const NodeCache = require('node-cache');

class PubMedService {
  constructor() {
    this.baseURL = process.env.PUBMED_API_BASE_URL || 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    this.apiKey = process.env.PUBMED_API_KEY || '';
    this.cache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_SECONDS || '3600') });
    this.parser = new xml2js.Parser({ explicitArray: false });
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second initial delay
  }

  /**
   * Retry helper function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {number} retries - Number of retries remaining
   * @param {number} delay - Current delay in ms
   * @returns {Promise<any>}
   */
  async retryWithBackoff(fn, retries = this.maxRetries, delay = this.retryDelay) {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) {
        throw error;
      }
      
      // Don't retry on 4xx errors (client errors)
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        throw error;
      }

      console.log(`Retrying... (${this.maxRetries - retries + 1}/${this.maxRetries}) after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryWithBackoff(fn, retries - 1, delay * 2);
    }
  }

  /**
   * Search PubMed for articles matching the query with advanced filters
   * @param {string} query - Search term (e.g., drug name)
   * @param {Object} options - Search options
   * @param {number} options.maxResults - Maximum number of results to return
   * @param {Array} options.categoryKeywords - Additional keywords from selected categories
   * @param {string} options.headingKeyword - Main heading keyword (e.g., "Safety", "Pharmacokinetics")
   * @param {number} options.yearFrom - Start year for publication date filter
   * @param {number} options.yearTo - End year for publication date filter
   * @param {boolean} options.hasAbstract - Filter for articles with abstracts
   * @param {boolean} options.freeFullText - Filter for free full text articles
   * @param {boolean} options.fullText - Filter for articles with full text
   * @returns {Promise<Array>} Array of PubMed IDs
   */
  async searchArticles(query, options = {}) {
    const {
      maxResults = 200,
      categoryKeywords = [],
      headingKeyword = '',
      studyType = null,
      categoryPath = '',
      yearFrom = null,
      yearTo = null,
      hasAbstract = false,
      freeFullText = false,
      fullText = false
    } = options;

    // Build enhanced search query with MeSH-first approach
    let searchQuery = query;

    // Add heading keyword if provided (e.g., "cefixime AND safety")
    if (headingKeyword) {
      searchQuery = `${query} AND ${headingKeyword}`;
    }

    // Add category keywords with OR logic - prioritize MeSH terms
    if (categoryKeywords && categoryKeywords.length > 0) {
      // Use top 3-5 keywords for more specific search
      const keywordQuery = categoryKeywords.slice(0, 3).join(' OR ');
      searchQuery = `${searchQuery} AND (${keywordQuery})`;
    }

    // Add study type filter (animal or human) - Simplified for reliability
    if (studyType === 'animal') {
      // Animal filter: Include Animals MeSH term
      searchQuery = `${searchQuery} AND Animals[MeSH Terms]`;
    } else if (studyType === 'human') {
      // Human filter: Include Humans MeSH term
      searchQuery = `${searchQuery} AND Humans[MeSH Terms]`;
    }

    // Add publication type filters based on category to prevent overlap
    if (categoryPath) {
      if (categoryPath.includes('activeControlled') || categoryPath.includes('randomized') || categoryPath.includes('placebo')) {
        // For clinical trials, exclude meta-analyses and reviews
        searchQuery = `${searchQuery} NOT (Meta-Analysis[Publication Type] OR Systematic Review[Publication Type] OR Review[Publication Type])`;
      } else if (categoryPath.includes('metaAnalysis')) {
        // For meta-analyses, require specific publication type
        searchQuery = `${searchQuery} AND (Meta-Analysis[Publication Type] OR Systematic Review[Publication Type])`;
      } else if (categoryPath.includes('uncontrolled')) {
        // For uncontrolled studies, exclude RCTs and meta-analyses
        searchQuery = `${searchQuery} NOT (Randomized Controlled Trial[Publication Type] OR Meta-Analysis[Publication Type])`;
      }
    }

    // Add date range filter
    if (yearFrom || yearTo) {
      const fromYear = yearFrom || '1900';
      const toYear = yearTo || new Date().getFullYear();
      searchQuery = `${searchQuery} AND ${fromYear}:${toYear}[dp]`;
    }

    // Add abstract filter
    if (hasAbstract) {
      searchQuery = `${searchQuery} AND hasabstract`;
    }

    // Add free full text filter
    if (freeFullText) {
      searchQuery = `${searchQuery} AND free full text[sb]`;
    }

    // Add full text filter
    if (fullText) {
      searchQuery = `${searchQuery} AND full text[sb]`;
    }

    const cacheKey = `search_${searchQuery}_${maxResults}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached search results');
      return cached;
    }

    try {
      console.log(`PubMed Search Query: ${searchQuery}`);
      
      const params = {
        db: 'pubmed',
        term: searchQuery,
        retmax: maxResults,
        retmode: 'json',
        sort: 'relevance'
      };

      if (this.apiKey) {
        params.api_key = this.apiKey;
      }

      // Use retry mechanism for the API call
      const response = await this.retryWithBackoff(async () => {
        return await axios.get(`${this.baseURL}/esearch.fcgi`, { 
          params,
          timeout: 30000, // 30 second timeout
          validateStatus: (status) => status < 500 // Don't throw on 4xx errors
        });
      });

      // Check for API errors
      if (response.status >= 400) {
        console.error(`PubMed API error: Status ${response.status}`);
        throw new Error(`PubMed API returned status ${response.status}`);
      }

      // Check if response has the expected structure
      if (!response.data || !response.data.esearchresult) {
        console.error('Invalid response structure from PubMed:', response.data);
        throw new Error('Invalid response from PubMed API');
      }

      // Check for error messages in the response
      if (response.data.esearchresult.errorlist) {
        const errors = response.data.esearchresult.errorlist;
        console.error('PubMed query errors:', errors);
        throw new Error(`PubMed query error: ${JSON.stringify(errors)}`);
      }
      
      const idList = response.data.esearchresult?.idlist || [];
      const count = response.data.esearchresult?.count || 0;

      console.log(`Found ${count} articles, retrieved ${idList.length} IDs`);

      const result = { ids: idList, totalCount: parseInt(count) };
      this.cache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error searching PubMed:', error.message);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        query: searchQuery
      });
      
      // Return more specific error message
      if (error.response) {
        throw new Error(`PubMed API error: ${error.response.status} - ${error.message}`);
      } else if (error.request) {
        throw new Error(`PubMed API network error: ${error.message}`);
      } else {
        throw new Error(`PubMed search failed: ${error.message}`);
      }
    }
  }

  /**
   * Fetch detailed article information for given IDs
   * @param {Array} ids - Array of PubMed IDs
   * @returns {Promise<Array>} Array of article details
   */
  async fetchArticleDetails(ids) {
    if (!ids || ids.length === 0) {
      return [];
    }

    const cacheKey = `details_${ids.join('_')}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached article details');
      return cached;
    }

    try {
      const params = {
        db: 'pubmed',
        id: ids.join(','),
        retmode: 'xml',
        rettype: 'abstract'
      };

      if (this.apiKey) {
        params.api_key = this.apiKey;
      }

      // Use retry mechanism for the API call
      const response = await this.retryWithBackoff(async () => {
        return await axios.get(`${this.baseURL}/efetch.fcgi`, { 
          params,
          timeout: 60000, // 60 second timeout for fetching details
          validateStatus: (status) => status < 500
        });
      });

      // Check for API errors
      if (response.status >= 400) {
        console.error(`PubMed API error: Status ${response.status}`);
        throw new Error(`PubMed API returned status ${response.status}`);
      }

      if (!response.data) {
        console.error('Empty response from PubMed efetch');
        throw new Error('Empty response from PubMed API');
      }
      
      const result = await this.parser.parseStringPromise(response.data);
      const articles = this.parseArticles(result);
      
      this.cache.set(cacheKey, articles);
      return articles;
    } catch (error) {
      console.error('Error fetching article details:', error.message);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.status,
        idsCount: ids.length
      });
      
      // Return more specific error message
      if (error.response) {
        throw new Error(`PubMed API error fetching details: ${error.response.status}`);
      } else if (error.request) {
        throw new Error(`Network error fetching article details: ${error.message}`);
      } else {
        throw new Error(`Failed to fetch article details: ${error.message}`);
      }
    }
  }

  /**
   * Parse XML response to extract article information
   * @param {Object} xmlData - Parsed XML data
   * @returns {Array} Array of parsed articles
   */
  parseArticles(xmlData) {
    const articles = [];
    
    try {
      const pubmedArticles = xmlData?.PubmedArticleSet?.PubmedArticle || [];
      const articleArray = Array.isArray(pubmedArticles) ? pubmedArticles : [pubmedArticles];

      for (const pubmedArticle of articleArray) {
        const article = pubmedArticle?.MedlineCitation?.Article;
        if (!article) continue;

        // Extract and normalize PMID to string
        const rawPmid = pubmedArticle?.MedlineCitation?.PMID;
        const pmid = String(rawPmid?._ || rawPmid?.i || rawPmid || '');
        const title = article?.ArticleTitle || 'No title';
        
        // Extract abstract
        let abstract = '';
        if (article?.Abstract?.AbstractText) {
          const abstractText = article.Abstract.AbstractText;
          if (Array.isArray(abstractText)) {
            abstract = abstractText.map(a => a._ || a).join(' ');
          } else {
            abstract = abstractText._ || abstractText;
          }
        }

        // Extract authors
        const authors = [];
        if (article?.AuthorList?.Author) {
          const authorList = Array.isArray(article.AuthorList.Author) 
            ? article.AuthorList.Author 
            : [article.AuthorList.Author];
          
          for (const author of authorList) {
            const lastName = author?.LastName || '';
            const foreName = author?.ForeName || author?.Initials || '';
            if (lastName) {
              authors.push(`${lastName} ${foreName}`.trim());
            }
          }
        }

        // Extract journal info
        const journal = article?.Journal?.Title || 'Unknown Journal';
        const pubDate = this.extractPublicationDate(article?.Journal?.JournalIssue?.PubDate);

        // Extract MeSH terms
        const meshTerms = [];
        if (pubmedArticle?.MedlineCitation?.MeshHeadingList?.MeshHeading) {
          const meshList = Array.isArray(pubmedArticle.MedlineCitation.MeshHeadingList.MeshHeading)
            ? pubmedArticle.MedlineCitation.MeshHeadingList.MeshHeading
            : [pubmedArticle.MedlineCitation.MeshHeadingList.MeshHeading];
          
          for (const mesh of meshList) {
            const descriptorName = mesh?.DescriptorName?._ || mesh?.DescriptorName;
            if (descriptorName) {
              meshTerms.push(descriptorName);
            }
          }
        }

        // Extract keywords
        const keywords = [];
        if (pubmedArticle?.MedlineCitation?.KeywordList?.Keyword) {
          const keywordList = Array.isArray(pubmedArticle.MedlineCitation.KeywordList.Keyword)
            ? pubmedArticle.MedlineCitation.KeywordList.Keyword
            : [pubmedArticle.MedlineCitation.KeywordList.Keyword];
          
          for (const keyword of keywordList) {
            const kw = keyword._ || keyword;
            if (kw) {
              keywords.push(kw);
            }
          }
        }

        articles.push({
          pmid,
          title,
          abstract,
          authors: authors.slice(0, 10), // Limit to first 10 authors
          journal,
          publicationDate: pubDate,
          meshTerms,
          keywords,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
        });
      }
    } catch (error) {
      console.error('Error parsing articles:', error.message);
    }

    return articles;
  }

  /**
   * Extract publication date from PubDate object
   * @param {Object} pubDate - Publication date object
   * @returns {string} Formatted date string
   */
  extractPublicationDate(pubDate) {
    if (!pubDate) return 'Unknown';

    const year = pubDate?.Year || '';
    const month = pubDate?.Month || '';
    const day = pubDate?.Day || '';

    if (year) {
      return [year, month, day].filter(Boolean).join(' ');
    }

    return pubDate?.MedlineDate || 'Unknown';
  }

  /**
   * Clear cache for specific query or all cache
   * @param {string} key - Optional cache key to clear
   */
  clearCache(key = null) {
    if (key) {
      this.cache.del(key);
    } else {
      this.cache.flushAll();
    }
  }
}

module.exports = PubMedService;
