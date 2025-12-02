import React, { useState } from 'react';
import './ResultsDisplay.css';
import ArticleCard from './ArticleCard';
import { FaInfoCircle, FaChartBar, FaFileWord, FaCheckCircle } from 'react-icons/fa';
import ExportModal from './ExportModal';
import { useCart } from '../context/CartContext';

// Utility function to format category path for display
const formatCategoryPath = (path) => {
  if (!path) return '';
  
  // Split by comma if multiple paths, then by dots for hierarchy
  const paths = path.split(',').map(p => p.trim());
  
  const formattedPaths = paths.map(singlePath => {
    const parts = singlePath.split('.');
    
    // Format each part
    const formatted = parts.map(part => {
      // Replace underscores and camelCase with spaces
      let formatted = part.replace(/([A-Z])/g, ' $1').trim();
      formatted = formatted.replace(/_/g, ' ');
      
      // Capitalize first letter of each word
      formatted = formatted.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      
      return formatted;
    });
    
    // Join with " > " for hierarchical display
    return formatted.join(' > ');
  });
  
  // Join multiple paths with ", "
  return formattedPaths.join(', ');
};

function ResultsDisplay({ results, query, studyType, categoryPath }) {
  const [selectedArticles, setSelectedArticles] = useState([]);
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Get cart functions
  const { addToCart, isInCart } = useCart();

  if (!results || !results.articles) {
    return null;
  }

  const { totalArticles, filteredArticles, articles, processingTime } = results;

  const reductionPercentage = totalArticles > 0
    ? Math.round(((totalArticles - filteredArticles) / totalArticles) * 100)
    : 0;

  const handleToggleSelect = (article) => {
    setSelectedArticles(prev => {
      const isAlreadySelected = prev.some(a => a.pmid === article.pmid);
      if (isAlreadySelected) {
        return prev.filter(a => a.pmid !== article.pmid);
      } else {
        return [...prev, article];
      }
    });
  };

  const handleAddToCart = (article) => {
    addToCart(article, categoryPath, studyType);
  };

  const handleDone = () => {
    if (selectedArticles.length > 0) {
      setShowExportModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowExportModal(false);
  };

  const handleExportComplete = () => {
    setShowExportModal(false);
    setSelectedArticles([]);
  };

  return (
    <div className="results-display">
      <div className="results-header">
        <div className="results-title-section">
          <h2>Search Results</h2>
          <div className="results-meta">
            <span className="query-highlight">"{query}"</span>
            <span className="separator">•</span>
            <span>{studyType === 'animal' ? 'Animal Studies' : 'Human Studies'}</span>
            <span className="separator">•</span>
            <span className="category-path">{formatCategoryPath(categoryPath)}</span>
          </div>
        </div>

        <div className="results-stats">
          <div className="stat-card">
            <div className="stat-value">{totalArticles}</div>
            <div className="stat-label">Total Found</div>
          </div>
          <div className="stat-arrow">→</div>
          <div className="stat-card highlight">
            <div className="stat-value">{filteredArticles}</div>
            <div className="stat-label">Relevant</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{reductionPercentage}%</div>
            <div className="stat-label">Filtered</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{(processingTime / 1000).toFixed(2)}s</div>
            <div className="stat-label">Processing Time</div>
          </div>
        </div>
      </div>

      {filteredArticles === 0 ? (
        <div className="no-results">
          <FaInfoCircle size={48} />
          <h3>No Relevant Articles Found</h3>
          <p>No articles matched the selected category criteria. Try selecting a different category or search term.</p>
        </div>
      ) : (
        <>
          <div className="results-info">
            <FaChartBar />
            <span>
              Showing top <strong>{filteredArticles}</strong> relevant articles out of{' '}
              <strong>{totalArticles}</strong> total results
              {reductionPercentage > 0 && (
                <> (reduced manual review by <strong>{reductionPercentage}%</strong>)</>
              )}
            </span>
          </div>

          {selectedArticles.length > 0 && (
            <div className="selection-banner">
              <div className="selection-info">
                <FaCheckCircle className="selection-icon" />
                <span><strong>{selectedArticles.length}</strong> article{selectedArticles.length !== 1 ? 's' : ''} selected</span>
              </div>
              <button className="export-btn" onClick={handleDone}>
                <FaFileWord />
                Export to Word
              </button>
            </div>
          )}

          <div className="articles-list">
            {articles.map((article, index) => (
              <ArticleCard 
                key={article.pmid || index} 
                article={article} 
                rank={index + 1}
                isSelectable={true}
                isSelected={selectedArticles.some(a => a.pmid === article.pmid)}
                onToggleSelect={handleToggleSelect}
                onAddToCart={handleAddToCart}
                isInCart={isInCart(article.pmid)}
              />
            ))}
          </div>

          {showExportModal && (
            <ExportModal
              articles={selectedArticles}
              categoryPath={categoryPath}
              onClose={handleCloseModal}
              onExportComplete={handleExportComplete}
            />
          )}
        </>
      )}
    </div>
  );
}

export default ResultsDisplay;
