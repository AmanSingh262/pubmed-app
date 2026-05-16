const axios = require('axios');

const PUBMED_API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

// Cache for MeSH terms
const meshCache = new Map();

/**
 * Fetch MeSH terms for a given disease/drug from NCBI
 * MeSH terms include synonyms and related concepts
 */
async function fetchMeshTerms(searchTerm, category = 'disease') {
  const cacheKey = `${searchTerm.toLowerCase()}_${category}`;

  // Check cache first
  if (meshCache.has(cacheKey)) {
    console.log(`[MeSH] Using cached terms for: ${searchTerm}`);
    return meshCache.get(cacheKey);
  }

  try {
    // First, search for the term to get the MeSH heading
    const searchUrl = `${PUBMED_API_BASE}/esearch.fcgi`;
    const searchParams = new URLSearchParams({
      db: 'mesh',
      term: searchTerm,
      retmode: 'json',
      retmax: 5
    });

    console.log(`[MeSH] Fetching terms for: ${searchTerm}`);

    const searchResponse = await axios.get(searchUrl, { params: searchParams, timeout: 10000 });
    const meshIds = searchResponse.data?.esearchresult?.idlist || [];

    if (meshIds.length === 0) {
      // Try PubMed search to find related MeSH terms
      return await searchPubMedForMeshTerms(searchTerm, cacheKey);
    }

    // Fetch details for each MeSH ID
    const fetchUrl = `${PUBMED_API_BASE}/esummary.fcgi`;
    const fetchParams = new URLSearchParams({
      db: 'mesh',
      id: meshIds.join(','),
      retmode: 'json'
    });

    const fetchResponse = await axios.get(fetchUrl, { params: fetchParams, timeout: 10000 });
    const result = fetchResponse.data?.result || {};

    const meshTerms = {
      primary: [],
      synonyms: [],
      related: [],
      searchTerms: []
    };

    Object.values(result).forEach(doc => {
      if (!doc.uid) return;

      // Get the main MeSH term
      if (doc.descriptorname) {
        const primaryTerm = Array.isArray(doc.descriptorname) ? doc.descriptorname[0] : doc.descriptorname;
        meshTerms.primary.push(primaryTerm);
      }

      // Get qualifiers (narrower terms)
      if (doc.qualifiername && doc.qualifiername.length > 0) {
        const qualifiers = Array.isArray(doc.qualifiername) ? doc.qualifiername : [doc.qualifiername];
        qualifiers.forEach(q => {
          meshTerms.related.push(q);
        });
      }
    });

    // Generate search terms from MeSH
    meshTerms.searchTerms = [
      ...meshTerms.primary,
      ...meshTerms.synonyms,
      ...meshTerms.related
    ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates

    // Cache the results
    meshCache.set(cacheKey, meshTerms);
    console.log(`[MeSH] Found ${meshTerms.searchTerms.length} terms for: ${searchTerm}`);

    return meshTerms;

  } catch (error) {
    console.error(`[MeSH] Error fetching terms for ${searchTerm}:`, error.message);
    // Fall back to PubMed-based search
    return await searchPubMedForMeshTerms(searchTerm, cacheKey);
  }
}

/**
 * Fallback: Search PubMed for articles and extract MeSH terms from them
 */
async function searchPubMedForMeshTerms(searchTerm, cacheKey) {
  try {
    const searchUrl = `${PUBMED_API_BASE}/esearch.fcgi`;
    const searchParams = new URLSearchParams({
      db: 'pubmed',
      term: `"${searchTerm}"[Title/Abstract] AND "prevalence"[MeSH Terms]`,
      retmode: 'json',
      retmax: 20,
      sort: 'relevance'
    });

    const searchResponse = await axios.get(searchUrl, { params: searchParams, timeout: 10000 });
    const pmdIds = searchResponse.data?.esearchresult?.idlist || [];

    if (pmdIds.length === 0) {
      const fallbackTerms = {
        primary: [searchTerm],
        synonyms: [],
        related: [],
        searchTerms: [searchTerm]
      };
      meshCache.set(cacheKey, fallbackTerms);
      return fallbackTerms;
    }

    // Fetch details to get MeSH headings
    const fetchUrl = `${PUBMED_API_BASE}/efetch.fcgi`;
    const fetchParams = new URLSearchParams({
      db: 'pubmed',
      id: pmdIds.slice(0, 10).join(','),
      retmode: 'xml',
      rettype: 'abstract'
    });

    const fetchResponse = await axios.get(fetchUrl, { params: fetchParams, timeout: 15000 });

    // Parse XML response for MeSH terms
    const xmlText = fetchResponse.data;
    const meshHeadingMatches = xmlText.matchAll(/<MeshHeading><DescriptorName>([^<]+)<\/DescriptorName>(?:<QualifierName>([^<]+)<\/QualifierName>)?<\/MeshHeading>/g);

    const foundTerms = new Set();
    const relatedTerms = new Set();

    for (const match of meshHeadingMatches) {
      foundTerms.add(match[1]);
      if (match[2]) {
        relatedTerms.add(`${match[1]}/${match[2]}`);
      }
    }

    const meshTerms = {
      primary: Array.from(foundTerms),
      synonyms: [],
      related: Array.from(relatedTerms),
      searchTerms: [...foundTerms, ...relatedTerms]
    };

    meshCache.set(cacheKey, meshTerms);
    console.log(`[MeSH] PubMed fallback found ${meshTerms.searchTerms.length} terms for: ${searchTerm}`);

    return meshTerms;

  } catch (error) {
    console.error(`[MeSH] PubMed fallback error for ${searchTerm}:`, error.message);

    // Final fallback: use the search term itself with common variations
    const fallbackTerms = {
      primary: [searchTerm],
      synonyms: [],
      related: [],
      searchTerms: [
        searchTerm,
        searchTerm.toLowerCase(),
        searchTerm.toUpperCase()
      ]
    };
    meshCache.set(cacheKey, fallbackTerms);
    return fallbackTerms;
  }
}

/**
 * Build a comprehensive MeSH-based search query
 */
function buildMeshSearchQuery(diseaseName, drugName, options = {}) {
  const {
    includePrevalence = true,
    includeEpidemiology = true,
    country = '',
    years = []
  } = options;

  const queries = [];

  // Get MeSH terms for disease
  const diseaseMesh = fetchMeshTermsSync(diseaseName, 'disease');
  const diseaseTerms = diseaseMesh?.searchTerms || [diseaseName];

  // Get MeSH terms for drug if provided
  const drugMesh = drugName ? fetchMeshTermsSync(drugName, 'drug') : null;
  const drugTerms = drugMesh?.searchTerms || (drugName ? [drugName] : []);

  // Build queries with MeSH terms
  if (drugTerms.length > 0 && diseaseTerms.length > 0) {
    // Drug + Disease combination
    drugTerms.forEach(drug => {
      diseaseTerms.forEach(disease => {
        if (includePrevalence) {
          queries.push(
            `("${drug}"[tiab] OR "${drug}"[MeSH Terms]) AND ("${disease}"[tiab] OR "${disease}"[MeSH Terms]) AND ("prevalence"[MeSH Terms] OR "prevalence"[tiab])`
          );
        }
        if (includeEpidemiology) {
          queries.push(
            `("${drug}"[tiab] OR "${drug}"[MeSH Terms]) AND ("${disease}"[tiab] OR "${disease}"[MeSH Terms]) AND ("epidemiology"[MeSH Terms] OR "epidemiology"[tiab])`
          );
        }
      });
    });
  } else if (diseaseTerms.length > 0) {
    // Disease only
    diseaseTerms.forEach(disease => {
      if (includePrevalence) {
        queries.push(
          `("${disease}"[tiab] OR "${disease}"[MeSH Terms]) AND ("prevalence"[MeSH Terms] OR "prevalence"[tiab])`
        );
      }
      if (includeEpidemiology) {
        queries.push(
          `("${disease}"[tiab] OR "${disease}"[MeSH Terms]) AND ("epidemiology"[MeSH Terms] OR "epidemiology"[tiab])`
        );
      }
      // Add population-based study query
      queries.push(
        `("${disease}"[tiab] OR "${disease}"[MeSH Terms]) AND ("population-based"[tiab] OR "cross-sectional"[tiab] OR "cohort"[tiab])`
      );
    });
  }

  // Add geographic filter if provided
  if (country) {
    queries.forEach((q, i) => {
      queries[i] = `(${q}) AND ("${country}"[tiab] OR "${country}"[MeSH Terms])`;
    });
  }

  return queries;
}

// Synchronous version with simplified lookup
function fetchMeshTermsSync(term, category) {
  const cacheKey = `${term.toLowerCase()}_${category}`;
  return meshCache.get(cacheKey);
}

/**
 * Clear the MeSH cache
 */
function clearMeshCache() {
  meshCache.clear();
  console.log('[MeSH] Cache cleared');
}

module.exports = {
  fetchMeshTerms,
  fetchMeshTermsSync,
  buildMeshSearchQuery,
  clearMeshCache
};