import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

import Header from './components/Header';
import SearchBar from './components/SearchBar';
import StudyTypeSelector from './components/StudyTypeSelector';
import CategoryTree from './components/CategoryTree';
import SearchFilters from './components/SearchFilters';
import ResultsDisplay from './components/ResultsDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import ExportOptions from './components/ExportOptions';
import SelectCart from './components/SelectCart';
import ReferenceDocUpload from './components/ReferenceDocUpload';
import { CartProvider, useCart } from './context/CartContext';
import { clearBadCartData } from './utils/clearBadCartData';

import api from './services/api';

// Clear bad cart data on app load (one-time migration)
clearBadCartData();

function AppContent() {
  const [query, setQuery] = useState('');
  const [studyType, setStudyType] = useState('animal');
  const [categories, setCategories] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]); // Changed to array for multi-selection
  const [searchFilters, setSearchFilters] = useState({
    yearFrom: null,
    yearTo: null,
    hasAbstract: false,
    freeFullText: false,
    fullText: false,
    verifyAnimalStudy: true,  // Auto-enabled by default for animal studies
    verifyHumanStudy: false
  });
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [referenceDocResults, setReferenceDocResults] = useState(null);
  const [currentPage, setCurrentPage] = useState({});
  const [articlesPerPage] = useState(20); // Show 20 articles per page
  const [showReferenceResults, setShowReferenceResults] = useState(false);

  // Get cart context
  const { cartItems, openCart, addToCart, isInCart } = useCart();

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(data.categories);
    } catch (error) {
      toast.error('Failed to load categories');
      console.error('Error loading categories:', error);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.warning('Please enter a search term');
      return;
    }

    if (selectedCategories.length === 0) {
      toast.warning('Please select at least one category');
      return;
    }

    setLoading(true);
    setShowResults(false);

    try {
      // Combine all selected category paths
      const categoryPaths = selectedCategories.map(cat => cat.path);
      
      // Extract custom keywords from selected categories
      const customKeywords = selectedCategories
        .filter(cat => cat.customKeywords)
        .map(cat => cat.customKeywords)
        .join(', ');
      
      const data = await api.searchArticles({
        query: query.trim(),
        studyType,
        categoryPath: categoryPaths.join(','), // Send comma-separated paths
        customKeywords: customKeywords || undefined, // Send custom keywords if any
        maxResults: 200, // Reduced from 300 to 200 for better performance
        topN: 30,
        ...searchFilters // Include all search filters
      });

      setSearchResults(data);
      setShowResults(true);

      if (data.filteredArticles === 0) {
        toast.info('No articles found matching the selected criteria');
      } else {
        toast.success(`Found top ${data.filteredArticles} relevant articles!`);
      }
    } catch (error) {
      console.error('Search error:', error);
      
      // Extract error message from response if available
      const errorMessage = error.response?.data?.message || error.message || 'Failed to search articles';
      toast.error(errorMessage + '. Please try again.');
      
      // Log additional details for debugging
      if (error.response?.data?.details) {
        console.error('Error details:', error.response.data.details);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCategory = (categoryData) => {
    setSelectedCategories(prev => {
      const isSelected = prev.some(cat => cat.path === categoryData.path);
      if (isSelected) {
        // Remove from selection
        return prev.filter(cat => cat.path !== categoryData.path);
      } else {
        // Add to selection
        return [...prev, categoryData];
      }
    });
  };

  const handleClearFilters = () => {
    setSelectedCategories([]);
    setSearchResults(null);
    setShowResults(false);
  };

  const handleExport = async (format) => {
    if (!searchResults || !searchResults.articles || searchResults.articles.length === 0) {
      toast.warning('No results to export');
      return;
    }

    try {
      await api.exportResults(format, {
        articles: searchResults.articles,
        query,
        studyType,
        categoryPath: selectedCategories.map(cat => cat.path).join(', ')
      });
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export results');
      console.error('Export error:', error);
    }
  };

  const normalizePmid = (pmid) => {
    if (typeof pmid === 'object' && pmid !== null) {
      return pmid._ || pmid.i || String(pmid);
    }
    return String(pmid);
  };

  const normalizeCategorizedArticles = (categorizedArticles = {}) => {
    const normalized = {};
    Object.keys(categorizedArticles).forEach(category => {
      normalized[category] = categorizedArticles[category].map(article => ({
        ...article,
        pmid: normalizePmid(article.pmid)
      }));
    });
    return normalized;
  };

  const buildInitialReferencePages = (normalizedData) => {
    const initialPages = {};

    if (normalizedData.dualColumnMode && normalizedData.columns) {
      Object.entries(normalizedData.columns).forEach(([columnKey, columnData]) => {
        Object.keys(columnData.categorizedArticles || {}).forEach(category => {
          initialPages[`${columnKey}:${category}`] = 1;
        });
      });
      return initialPages;
    }

    Object.keys(normalizedData.categorizedArticles || {}).forEach(category => {
      initialPages[category] = 1;
    });

    return initialPages;
  };

  const getCategorySectionId = (pageKey) => {
    return `category-${pageKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`;
  };

  const getPrevalenceYearLabel = (prevalenceContext) => {
    if (!prevalenceContext) {
      return '';
    }

    if (Array.isArray(prevalenceContext.years) && prevalenceContext.years.length > 0) {
      return prevalenceContext.years.join(', ');
    }

    return prevalenceContext.year || '';
  };

  const handleReferenceDocResults = (data) => {
    const normalizedData = {
      ...data,
      categorizedArticles: normalizeCategorizedArticles(data.categorizedArticles || {})
    };

    if (data.dualColumnMode && data.columns) {
      normalizedData.columns = {};
      Object.entries(data.columns).forEach(([columnKey, columnData]) => {
        normalizedData.columns[columnKey] = {
          ...columnData,
          categorizedArticles: normalizeCategorizedArticles(columnData.categorizedArticles || {})
        };
      });
    }

    setReferenceDocResults(normalizedData);
    setShowReferenceResults(true);
    setShowResults(false);
    setCurrentPage(buildInitialReferencePages(normalizedData));

    if (normalizedData.dualColumnMode && normalizedData.columns) {
      const prevalenceCount = normalizedData.columns.prevalence?.totalArticles || 0;
      const anotherCount = normalizedData.columns.another?.totalArticles || 0;
      toast.success(`Found ${prevalenceCount} PREVALENCE and ${anotherCount} ANOTHER references`);
    } else {
      toast.success(`Found ${data.totalArticles} similar articles organized into ${Object.keys(normalizedData.categorizedArticles).length} categories`);
    }
  };

  const handleToggleReferenceArticle = (pmid) => {
    setReferenceDocResults(prev => {
      if (!prev) return prev;

      if (prev.dualColumnMode && prev.columns) {
        const updatedColumns = {};

        Object.keys(prev.columns).forEach(columnKey => {
          const columnData = prev.columns[columnKey];
          const updatedCategories = {};

          Object.keys(columnData.categorizedArticles || {}).forEach(category => {
            updatedCategories[category] = columnData.categorizedArticles[category].map(article => {
              if (article.pmid === pmid) {
                return { ...article, selected: !article.selected };
              }
              return article;
            });
          });

          updatedColumns[columnKey] = {
            ...columnData,
            categorizedArticles: updatedCategories
          };
        });

        return {
          ...prev,
          columns: updatedColumns
        };
      }

      const updatedCategories = {};
      Object.keys(prev.categorizedArticles).forEach(category => {
        updatedCategories[category] = prev.categorizedArticles[category].map(article => {
          if (article.pmid === pmid) {
            return { ...article, selected: !article.selected };
          }
          return article;
        });
      });
      
      return {
        ...prev,
        categorizedArticles: updatedCategories
      };
    });
  };

  const handleAddReferenceToCart = async (article, category) => {
    try {
      // Fetch abstract if not already present
      if (!article.abstract) {
        const response = await fetch('/api/reference-doc/fetch-abstracts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pmids: [article.pmid] }),
        });

        if (response.ok) {
          const data = await response.json();
          const abstractData = data.abstracts[article.pmid];
          if (abstractData) {
            article.abstract = abstractData;
          }
        }
      }

      // Add article to cart with category information
      addToCart(article, category, 'reference');
      toast.success(`Added "${article.title.substring(0, 50)}..." to cart`);
    } catch (error) {
      console.error('Error adding to cart:', error);
      // Still add to cart even if abstract fetch fails
      addToCart(article, category, 'reference');
      toast.success(`Added "${article.title.substring(0, 50)}..." to cart`);
    }
  };

  const handleExportReferenceDoc = async (format) => {
    if (!referenceDocResults) {
      toast.warning('No reference document results to export');
      return;
    }

    const selectedArticles = [];

    if (referenceDocResults.dualColumnMode && referenceDocResults.columns) {
      Object.entries(referenceDocResults.columns).forEach(([columnKey, columnData]) => {
        Object.entries(columnData.categorizedArticles || {}).forEach(([category, articles]) => {
          articles.forEach(article => {
            if (article.selected) {
              selectedArticles.push({
                ...article,
                category: `${columnData.label}: ${category}`,
                columnKey
              });
            }
          });
        });
      });
    } else {
      Object.entries(referenceDocResults.categorizedArticles).forEach(([category, articles]) => {
        articles.forEach(article => {
          if (article.selected) {
            selectedArticles.push({ ...article, category });
          }
        });
      });
    }

    if (selectedArticles.length === 0) {
      toast.warning('Please select at least one article to export');
      return;
    }

    try {
      const detectedCategories = [...new Set(selectedArticles.map(a => a.category))];
      
      await api.exportResults(format, {
        articles: selectedArticles,
        query: `Reference Document: ${referenceDocResults.fileName}`,
        studyType: 'reference',
        categoryPath: detectedCategories.join(', '),
        isReferenceDoc: true,
        detectedCategories: detectedCategories
      });
      toast.success(`Exported ${selectedArticles.length} selected articles as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export results');
      console.error('Export error:', error);
    }
  };

  const renderReferenceCategorySections = (categorizedArticles = {}, columnKey = null, columnLabel = null) => {
    return Object.entries(categorizedArticles).map(([category, articles]) => {
      const pageKey = columnKey ? `${columnKey}:${category}` : category;
      const sectionId = getCategorySectionId(pageKey);
      const currentPageNum = currentPage[pageKey] || 1;
      const indexOfLastArticle = currentPageNum * articlesPerPage;
      const indexOfFirstArticle = indexOfLastArticle - articlesPerPage;
      const currentArticles = articles.slice(indexOfFirstArticle, indexOfLastArticle);
      const totalPages = Math.ceil(articles.length / articlesPerPage);
      const cartCategory = columnLabel ? `${columnLabel}: ${category}` : category;

      const handlePageChange = (pageNumber) => {
        setCurrentPage(prev => ({
          ...prev,
          [pageKey]: pageNumber
        }));
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };

      return (
        <div key={pageKey} className="category-results-section" id={sectionId}>
          <div className="category-header-with-pagination">
            <h3 className="category-heading">{category} ({articles.length} articles)</h3>
            <div className="pagination-info">
              Showing {indexOfFirstArticle + 1}-{Math.min(indexOfLastArticle, articles.length)} of {articles.length}
            </div>
          </div>

          <div className="articles-grid">
            {currentArticles.map((article, idx) => {
              const inCart = isInCart(article.pmid);
              return (
                <div key={idx} className={`article-card-ref ${article.selected ? 'selected' : ''}`}>
                  <div className="article-select-header">
                    <input
                      type="checkbox"
                      checked={article.selected || false}
                      onChange={() => handleToggleReferenceArticle(article.pmid)}
                      className="article-checkbox"
                    />
                    <span className="relevance-score">Similarity: {article.similarityScore}%</span>
                  </div>
                  {article.mandatoryMatch && (
                    <div className="mandatory-match-row">
                      {article.mandatoryMatch.drugName && (
                        <span className="mandatory-chip">Drug: {article.mandatoryMatch.drugName}</span>
                      )}
                      {article.mandatoryMatch.diseaseName && (
                        <span className="mandatory-chip">Disease: {article.mandatoryMatch.diseaseName}</span>
                      )}
                      <span className="mandatory-chip">
                        Prevalence: {(article.mandatoryMatch.prevalenceKeywords || []).slice(0, 3).join(', ')}
                      </span>
                    </div>
                  )}
                  <h4 className="article-title">{article.title}</h4>
                  <div className="article-meta">
                    <span className="article-pmid">PMID: {article.pmid}</span>
                    {article.authors && article.authors.length > 0 && (
                      <span className="article-authors">
                        {article.authors.slice(0, 3).join(', ')}
                        {article.authors.length > 3 ? ', et al.' : ''}
                      </span>
                    )}
                  </div>
                  {article.journal && (
                    <div className="article-journal">{article.journal}</div>
                  )}
                  {article.publicationDate && (
                    <div className="article-date">{article.publicationDate}</div>
                  )}
                  <div className="article-actions">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="article-link"
                    >
                      View on PubMed →
                    </a>
                    <button
                      className={`btn-add-to-cart ${inCart ? 'in-cart' : ''}`}
                      onClick={() => handleAddReferenceToCart(article, cartCategory)}
                      disabled={inCart}
                    >
                      {inCart ? '✓ In Cart' : '🛒 Add to Cart'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentPageNum - 1)}
                disabled={currentPageNum === 1}
              >
                ← Previous
              </button>

              <div className="pagination-numbers">
                {[...Array(totalPages)].map((_, index) => {
                  const pageNum = index + 1;
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= currentPageNum - 1 && pageNum <= currentPageNum + 1)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        className={`pagination-number ${currentPageNum === pageNum ? 'active' : ''}`}
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  if (pageNum === currentPageNum - 2 || pageNum === currentPageNum + 2) {
                    return <span key={pageNum} className="pagination-ellipsis">...</span>;
                  }
                  return null;
                })}
              </div>

              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentPageNum + 1)}
                disabled={currentPageNum === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="App">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

      <Header />

      {/* Cart Button */}
      <button 
        className="cart-toggle-btn" 
        onClick={openCart}
        title="View Cart"
      >
        <span className="cart-icon">🛒</span>
        {cartItems.length > 0 && (
          <span className="cart-badge">{cartItems.length}</span>
        )}
      </button>

      <div className="container">
        <div className="search-section">
          <SearchBar
            query={query}
            setQuery={setQuery}
            onSearch={handleSearch}
            loading={loading}
          />

          <StudyTypeSelector
            studyType={studyType}
            setStudyType={setStudyType}
            disabled={loading}
            searchFilters={searchFilters}
            setSearchFilters={setSearchFilters}
          />
        </div>

        <div className="main-content">
          <div className="sidebar">
            <div className={`card ${studyType === 'animal' ? 'study-animal' : 'study-human'}`}>
              <div className="card-header">
                <h3>Filter Categories</h3>
                {selectedCategories.length > 0 && (
                  <button
                    className="btn-clear"
                    onClick={handleClearFilters}
                    disabled={loading}
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {categories && (
                <CategoryTree
                  studyType={studyType}
                  categories={categories}
                  selectedCategories={selectedCategories}
                  onToggleCategory={handleToggleCategory}
                  disabled={loading}
                />
              )}
            </div>

            {selectedCategories.length > 0 && (
              <div className={`card mt-3 ${studyType === 'animal' ? 'study-animal' : 'study-human'}`}>
                <h4>Selected Categories ({selectedCategories.length})</h4>
                <div className="selected-category-info">
                  <p><strong>Type:</strong> {studyType === 'animal' ? '🐾 Animal Studies' : '👨‍⚕️ Human Studies'}</p>
                  <div className="selected-categories-list">
                    {selectedCategories.map((cat, idx) => (
                      <div key={idx} className={`selected-category-item ${studyType === 'animal' ? 'animal-theme' : 'human-theme'}`}>
                        <div className="category-item-content">
                          <span className="category-name">{cat.name}</span>
                          {cat.customKeywords && (
                            <span className="custom-keywords-badge">
                              + Custom: "{cat.customKeywords}"
                            </span>
                          )}
                        </div>
                        <button 
                          className="btn-remove-category"
                          onClick={() => handleToggleCategory(cat)}
                          disabled={loading}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className={`card mt-3 ${studyType === 'animal' ? 'study-animal' : 'study-human'}`}>
              <SearchFilters
                filters={searchFilters}
                setFilters={setSearchFilters}
                disabled={loading}
              />
            </div>
          </div>

          <div className="content-area">
            {/* Reference Document Upload */}
            <ReferenceDocUpload onResultsReceived={handleReferenceDocResults} />

            {loading && <LoadingSpinner />}

            {!loading && !showResults && !showReferenceResults && (
              <div className="welcome-message">
                <div className="welcome-card">
                  <h2>🔬 Welcome to PubMed Intelligent Filter</h2>
                  <p>Search for research articles and filter them by specific research categories.</p>
                  <div className="instructions">
                    <h3>How to use:</h3>
                    <ol>
                      <li>Enter a drug or topic name in the search bar</li>
                      <li>Select study type (Animal or Human Studies)</li>
                      <li>Choose a specific category from the filter panel</li>
                      <li>Click "Search Articles" to get filtered results</li>
                    </ol>
                  </div>
                  <div className="features">
                    <div className="feature">
                      <span className="feature-icon">⚡</span>
                      <span>Fast & Accurate</span>
                    </div>
                    <div className="feature">
                      <span className="feature-icon">🎯</span>
                      <span>Intelligent Filtering</span>
                    </div>
                    <div className="feature">
                      <span className="feature-icon">📊</span>
                      <span>Relevance Scoring</span>
                    </div>
                    <div className="feature">
                      <span className="feature-icon">📥</span>
                      <span>Multiple Export Formats</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!loading && showResults && searchResults && (
              <>
                <ExportOptions
                  onExport={handleExport}
                  disabled={!searchResults.articles || searchResults.articles.length === 0}
                />

                <ResultsDisplay
                  results={searchResults}
                  query={query}
                  studyType={studyType}
                  categoryPath={selectedCategories.map(cat => cat.path).join(', ')}
                />
              </>
            )}

            {!loading && showReferenceResults && referenceDocResults && (
              <div className="reference-doc-results">
                <div className="results-header">
                  <h2>📄 Similar Articles from Reference Document</h2>
                  <div className="results-info">
                    <p><strong>File:</strong> {referenceDocResults.fileName}</p>
                    <p><strong>Total Articles:</strong> {referenceDocResults.totalArticles}</p>
                    <p><strong>Key Terms Used:</strong> {referenceDocResults.keyTerms?.join(', ')}</p>
                    {referenceDocResults.dualColumnMode && (
                      <p><strong>Mode:</strong> PREVALENCE | ANOTHER</p>
                    )}
                    {referenceDocResults.dualColumnMode && referenceDocResults.prevalenceContext && (
                      <p>
                        <strong>Prevalence Filters:</strong>{' '}
                        {[
                          referenceDocResults.prevalenceContext.country && `Country: ${referenceDocResults.prevalenceContext.country}`,
                          (() => {
                            const yearLabel = getPrevalenceYearLabel(referenceDocResults.prevalenceContext);
                            return yearLabel ? `Year: ${yearLabel}` : null;
                          })(),
                          referenceDocResults.prevalenceContext.diseaseName && `Disease: ${referenceDocResults.prevalenceContext.diseaseName}`
                        ].filter(Boolean).join(' | ') || 'Not specified'}
                      </p>
                    )}
                  </div>
                </div>

                <ExportOptions
                  onExport={handleExportReferenceDoc}
                  disabled={false}
                />

                {referenceDocResults.dualColumnMode && referenceDocResults.columns ? (
                  <div className="reference-dual-layout">
                    <div className="reference-dual-header">
                      <div className="reference-dual-header-cell">PREVALENCE</div>
                      <div className="reference-dual-header-cell">ANOTHER</div>
                    </div>

                    <div className="reference-dual-columns">
                      <div className="reference-dual-column">
                        {(Object.keys(referenceDocResults.columns.prevalence?.categorizedArticles || {}).length > 0)
                          ? renderReferenceCategorySections(
                            referenceDocResults.columns.prevalence.categorizedArticles,
                            'prevalence',
                            referenceDocResults.columns.prevalence.label || 'PREVALENCE'
                          )
                          : <p className="column-empty-message">No PREVALENCE matches found for the selected filters.</p>
                        }
                      </div>

                      <div className="reference-dual-column">
                        {(Object.keys(referenceDocResults.columns.another?.categorizedArticles || {}).length > 0)
                          ? renderReferenceCategorySections(
                            referenceDocResults.columns.another.categorizedArticles,
                            'another',
                            referenceDocResults.columns.another.label || 'ANOTHER'
                          )
                          : <p className="column-empty-message">No ANOTHER matches found for the selected filters.</p>
                        }
                      </div>
                    </div>
                  </div>
                ) : (
                  renderReferenceCategorySections(referenceDocResults.categorizedArticles || {})
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Select Cart Panel */}
      <SelectCart />
    </div>
  );
}

function App() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}

export default App;
