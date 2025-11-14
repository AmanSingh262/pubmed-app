import React from 'react';
import './ResultsDisplay.css';
import ArticleCard from './ArticleCard';
import { FaInfoCircle, FaChartBar } from 'react-icons/fa';

function ResultsDisplay({ results, query, studyType, categoryPath }) {
  if (!results || !results.articles) {
    return null;
  }

  const { totalArticles, filteredArticles, articles, processingTime } = results;

  const reductionPercentage = totalArticles > 0
    ? Math.round(((totalArticles - filteredArticles) / totalArticles) * 100)
    : 0;

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
            <span className="category-path">{categoryPath}</span>
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
              Showing <strong>{filteredArticles}</strong> most relevant articles out of{' '}
              <strong>{totalArticles}</strong> total results
              {reductionPercentage > 0 && (
                <> (reduced manual review by <strong>{reductionPercentage}%</strong>)</>
              )}
            </span>
          </div>

          <div className="articles-list">
            {articles.map((article, index) => (
              <ArticleCard key={article.pmid || index} article={article} rank={index + 1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ResultsDisplay;
