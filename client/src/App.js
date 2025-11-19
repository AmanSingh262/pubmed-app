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

import api from './services/api';

function App() {
  const [query, setQuery] = useState('');
  const [studyType, setStudyType] = useState('animal');
  const [categories, setCategories] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]); // Changed to array for multi-selection
  const [searchFilters, setSearchFilters] = useState({
    yearFrom: null,
    yearTo: null,
    hasAbstract: false,
    freeFullText: false,
    fullText: false
  });
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

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
      
      const data = await api.searchArticles({
        query: query.trim(),
        studyType,
        categoryPath: categoryPaths.join(','), // Send comma-separated paths
        maxResults: 200,
        topN: 30,
        ...searchFilters // Include all search filters
      });

      setSearchResults(data);
      setShowResults(true);

      if (data.filteredArticles === 0) {
        toast.info('No articles found matching the selected criteria');
      } else {
        toast.success(`Found ${data.filteredArticles} relevant articles!`);
      }
    } catch (error) {
      toast.error('Failed to search articles. Please try again.');
      console.error('Search error:', error);
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
                        <span>{cat.name}</span>
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
            {loading && <LoadingSpinner />}

            {!loading && !showResults && (
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
