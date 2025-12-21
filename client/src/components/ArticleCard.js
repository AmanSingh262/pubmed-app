import React, { useState } from 'react';
import './ArticleCard.css';
import { FaExternalLinkAlt, FaTags, FaCalendar, FaBookOpen, FaChevronDown, FaChevronUp, FaStar, FaCheckCircle, FaCircle, FaShoppingCart, FaCheck } from 'react-icons/fa';

function ArticleCard({ article, rank, isSelectable, isSelected, onToggleSelect, onAddToCart, isInCart }) {
  const [expanded, setExpanded] = useState(false);

  const {
    pmid: rawPmid,
    title: rawTitle,
    abstract: rawAbstract,
    authors: rawAuthors,
    journal: rawJournal,
    publicationDate,
    meshTerms: rawMeshTerms,
    // keywords, // Not currently used in display
    url,
    relevanceScore,
    matches
  } = article;

  // Normalize PMID (handle both string and object formats)
  const pmid = typeof rawPmid === 'object' && rawPmid !== null ? 
               (rawPmid._ || rawPmid.i || String(rawPmid)) : 
               String(rawPmid);

  // Safely convert title to string
  const title = typeof rawTitle === 'string' ? rawTitle : 
                typeof rawTitle === 'object' && rawTitle !== null ? JSON.stringify(rawTitle) : 
                'No title available';

  // Safely convert abstract to string
  const abstract = typeof rawAbstract === 'string' ? rawAbstract : 
                   typeof rawAbstract === 'object' && rawAbstract !== null ? JSON.stringify(rawAbstract) : 
                   'No abstract available';

  // Safely convert journal to string
  const journal = typeof rawJournal === 'string' ? rawJournal : 
                  typeof rawJournal === 'object' && rawJournal !== null ? JSON.stringify(rawJournal) : 
                  'Unknown journal';

  // Safely handle authors array
  const authors = Array.isArray(rawAuthors) ? rawAuthors.filter(a => typeof a === 'string') : [];
  
  // Safely handle meshTerms array
  const meshTerms = Array.isArray(rawMeshTerms) ? rawMeshTerms.filter(t => typeof t === 'string') : [];

  const displayAuthors = authors && authors.length > 0
    ? authors.slice(0, 5).join(', ') + (authors.length > 5 ? ' et al.' : '')
    : 'Unknown authors';

  const abstractPreview = abstract && abstract.length > 300
    ? String(abstract).substring(0, 300) + '...'
    : abstract || 'No abstract available';

  const getScoreColor = (score) => {
    if (score >= 30) return '#10b981';
    if (score >= 15) return '#f59e0b';
    return '#6b7280';
  };

  const getScoreLabel = (score) => {
    if (score >= 30) return 'Highly Relevant';
    if (score >= 15) return 'Relevant';
    return 'Moderately Relevant';
  };

  return (
    <div className={`article-card ${isSelected ? 'selected' : ''}`}>
      <div className="article-header">
        {isSelectable && (
          <div 
            className="article-select-checkbox" 
            onClick={() => onToggleSelect(article)}
            title={isSelected ? "Remove from selection" : "Mark as useful"}
          >
            {isSelected ? (
              <FaCheckCircle className="select-icon selected" />
            ) : (
              <FaCircle className="select-icon" />
            )}
          </div>
        )}
        <div className="article-rank">#{rank}</div>
        <div className="article-title-section">
          <h3 className="article-title">
            <a href={url} target="_blank" rel="noopener noreferrer">
              {title}
              <FaExternalLinkAlt className="external-link-icon" />
            </a>
          </h3>
          <div className="article-meta">
            <span className="pmid-badge">PMID: {pmid}</span>
            <span className="meta-separator">•</span>
            <span className="authors">{displayAuthors}</span>
          </div>
        </div>
        <div className="article-score" style={{ borderColor: getScoreColor(relevanceScore) }}>
          <FaStar style={{ color: getScoreColor(relevanceScore) }} />
          <div>
            <div className="score-value" style={{ color: getScoreColor(relevanceScore) }}>
              {relevanceScore}
            </div>
            <div className="score-label">{getScoreLabel(relevanceScore)}</div>
          </div>
        </div>
        {onAddToCart && (
          <button
            className={`add-to-cart-btn ${isInCart ? 'in-cart' : ''}`}
            onClick={() => onAddToCart(article)}
            disabled={isInCart}
            title={isInCart ? "Already in cart" : "Add to cart"}
          >
            {isInCart ? (
              <>
                <FaCheck /> In Cart
              </>
            ) : (
              <>
                <FaShoppingCart /> Add to Cart
              </>
            )}
          </button>
        )}
      </div>

      <div className="article-info">
        <div className="info-item">
          <FaBookOpen className="info-icon" />
          <span>{journal}</span>
        </div>
        <div className="info-item">
          <FaCalendar className="info-icon" />
          <span>{publicationDate}</span>
        </div>
      </div>

      <div className="article-abstract">
        <p>{expanded ? abstract : abstractPreview}</p>
        {abstract && abstract.length > 300 && (
          <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
            {expanded ? (
              <>
                <FaChevronUp /> Show Less
              </>
            ) : (
              <>
                <FaChevronDown /> Show More
              </>
            )}
          </button>
        )}
      </div>

      {matches && (
        <div className="article-matches">
          <div className="matches-header">
            <FaTags className="matches-icon" />
            <span>Keyword Matches ({(matches.meshMatches?.length || 0) + (matches.titleMatches?.length || 0) + (matches.abstractMatches?.length || 0) + (matches.keywordMatches?.length || 0)})</span>
          </div>
          <div className="matches-content">
            {matches.keywordMatches && matches.keywordMatches.length > 0 && (
              <div className="match-group">
                <span className="match-type">🎯 Keywords:</span>
                <div className="match-tags">
                  {matches.keywordMatches.slice(0, 5).map((term, idx) => (
                    <span key={idx} className="match-tag keyword-tag">{String(term)}</span>
                  ))}
                  {matches.keywordMatches.length > 5 && (
                    <span className="match-more">+{matches.keywordMatches.length - 5} more</span>
                  )}
                </div>
              </div>
            )}
            {matches.meshMatches && matches.meshMatches.length > 0 && (
              <div className="match-group">
                <span className="match-type">MeSH Terms:</span>
                <div className="match-tags">
                  {matches.meshMatches.slice(0, 5).map((term, idx) => (
                    <span key={idx} className="match-tag mesh-tag">{String(term)}</span>
                  ))}
                  {matches.meshMatches.length > 5 && (
                    <span className="match-more">+{matches.meshMatches.length - 5} more</span>
                  )}
                </div>
              </div>
            )}
            {matches.titleMatches && matches.titleMatches.length > 0 && (
              <div className="match-group">
                <span className="match-type">Title:</span>
                <div className="match-tags">
                  {matches.titleMatches.slice(0, 3).map((term, idx) => (
                    <span key={idx} className="match-tag title-tag">{String(term)}</span>
                  ))}
                  {matches.titleMatches.length > 3 && (
                    <span className="match-more">+{matches.titleMatches.length - 3} more</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {meshTerms && meshTerms.length > 0 && (
        <div className="article-mesh-terms">
          <span className="mesh-label">MeSH Terms:</span>
          <div className="mesh-tags">
            {meshTerms.slice(0, 8).map((term, idx) => (
              <span key={idx} className="mesh-tag-small">{String(term)}</span>
            ))}
            {meshTerms.length > 8 && (
              <span className="mesh-more">+{meshTerms.length - 8} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ArticleCard;
