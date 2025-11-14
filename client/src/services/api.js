import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = {
  // Get all categories
  getCategories: async () => {
    const response = await axios.get(`${API_BASE_URL}/categories`);
    return response.data;
  },

  // Get categories for specific study type
  getCategoriesByType: async (studyType) => {
    const response = await axios.get(`${API_BASE_URL}/categories/${studyType}`);
    return response.data;
  },

  // Get keywords for a category
  getKeywords: async (studyType, categoryPath) => {
    const response = await axios.get(`${API_BASE_URL}/categories/${studyType}/${categoryPath}/keywords`);
    return response.data;
  },

  // Search articles
  searchArticles: async (searchParams) => {
    const response = await axios.post(`${API_BASE_URL}/search`, searchParams);
    return response.data;
  },

  // Batch search with multiple categories
  batchSearch: async (searchParams) => {
    const response = await axios.post(`${API_BASE_URL}/search/batch`, searchParams);
    return response.data;
  },

  // Export results
  exportResults: async (format, data) => {
    const response = await axios.post(`${API_BASE_URL}/export/${format}`, data, {
      responseType: 'blob'
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    const extension = format === 'bibtex' ? 'bib' : format;
    link.setAttribute('download', `pubmed_results_${Date.now()}.${extension}`);
    
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Clear cache
  clearCache: async () => {
    const response = await axios.delete(`${API_BASE_URL}/search/cache`);
    return response.data;
  }
};

export default api;
