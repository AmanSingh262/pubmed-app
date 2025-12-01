import axios from 'axios';

// Use proxy in development (configured in package.json)
// In production, API is served from same domain
const API_BASE_URL = '/api';

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
  },

  // Template Document features
  uploadTemplate: async (file) => {
    const formData = new FormData();
    formData.append('template', file);
    const response = await axios.post(`${API_BASE_URL}/template/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  previewTemplate: async (templatePath, article) => {
    const response = await axios.post(`${API_BASE_URL}/template/preview`, {
      templatePath,
      article
    });
    return response.data;
  },

  generateTemplateDoc: async (templatePath, article) => {
    const response = await axios.post(`${API_BASE_URL}/template/generate`, {
      templatePath,
      article
    }, {
      responseType: 'blob'
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    const filename = `Template_${article.pmid || 'Article'}_${Date.now()}.docx`;
    link.setAttribute('download', filename);
    
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  deleteTemplate: async (templateId) => {
    const response = await axios.delete(`${API_BASE_URL}/template/${templateId}`);
    return response.data;
  },

  // Template V2 - Placeholder-based (preserves full template)
  uploadTemplateV2: async (file) => {
    const formData = new FormData();
    formData.append('template', file);
    const response = await axios.post(`${API_BASE_URL}/template-v2/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  generateTemplateDocV2: async (templatePath, article) => {
    const response = await axios.post(`${API_BASE_URL}/template-v2/generate`, {
      templatePath,
      article
    }, {
      responseType: 'blob'
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    const filename = `Nonclinical_Overview_${article.pmid || 'Article'}_${Date.now()}.docx`;
    link.setAttribute('download', filename);
    
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  getAvailablePlaceholders: async () => {
    const response = await axios.get(`${API_BASE_URL}/template-v2/placeholders`);
    return response.data;
  },

  // Template V3 - Heading-based mapping with abbreviations list
  uploadTemplateV3: async (file) => {
    const formData = new FormData();
    formData.append('template', file);
    const response = await axios.post(`${API_BASE_URL}/template-v3/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  generateTemplateDocV3: async (templatePath, article) => {
    const response = await axios.post(`${API_BASE_URL}/template-v3/generate`, {
      templatePath,
      article
    }, {
      responseType: 'blob'
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    const filename = `Nonclinical_Overview_${article.pmid || 'Article'}_${Date.now()}.docx`;
    link.setAttribute('download', filename);
    
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  previewTemplateV3: async (templatePath, article) => {
    const response = await axios.post(`${API_BASE_URL}/template-v3/preview`, {
      templatePath,
      article
    });
    return response.data;
  },

  // Template V4 - Simple placeholder-based (recommended)
  uploadTemplateV4: async (file) => {
    const formData = new FormData();
    formData.append('template', file);
    const response = await axios.post(`${API_BASE_URL}/template-v4/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  generateTemplateDocV4: async (templatePath, article) => {
    const response = await axios.post(`${API_BASE_URL}/template-v4/generate`, {
      templatePath,
      article
    }, {
      responseType: 'blob'
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    const filename = `Nonclinical_Overview_${article.pmid || 'Article'}_${Date.now()}.docx`;
    link.setAttribute('download', filename);
    
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  previewTemplateV4: async (templatePath, article) => {
    const response = await axios.post(`${API_BASE_URL}/template-v4/preview`, {
      templatePath,
      article
    });
    return response.data;
  },

  // Template Final - Comprehensive XML-based solution (RECOMMENDED)
  uploadTemplateFinal: async (file) => {
    const formData = new FormData();
    formData.append('template', file);
    const response = await axios.post(`${API_BASE_URL}/template-final/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  generateTemplateDocFinal: async (templatePath, article) => {
    const response = await axios.post(`${API_BASE_URL}/template-final/generate`, {
      templatePath,
      article
    }, {
      responseType: 'blob'
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    const filename = `Nonclinical_Overview_${article.pmid || 'Article'}_${Date.now()}.docx`;
    link.setAttribute('download', filename);
    
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  previewTemplateFinal: async (templatePath, article) => {
    const response = await axios.post(`${API_BASE_URL}/template-final/preview`, {
      templatePath,
      article
    });
    return response.data;
  }
};

export default api;
