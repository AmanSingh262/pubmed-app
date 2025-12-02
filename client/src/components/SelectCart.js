import React, { useState } from 'react';
import './SelectCart.css';
import { FaTimes, FaShoppingCart, FaTrash, FaFileWord, FaCheck, FaFileAlt } from 'react-icons/fa';
import { useCart } from '../context/CartContext';
import UnifiedExportModal from './UnifiedExportModal';
import DetailDocumentModal from './DetailDocumentModal';

// Utility function to format category path for display
const formatCategoryPath = (path) => {
  if (!path) return '';
  
  // Split by dots to handle nested categories
  const parts = path.split('.');
  
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
};

function SelectCart() {
  const { cartItems, cartCount, removeFromCart, clearCart, isCartOpen, closeCart } = useCart();
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDetailDocModal, setShowDetailDocModal] = useState(false);

  // Group articles by category
  const groupedArticles = cartItems.reduce((acc, item) => {
    const key = `${item.studyType}|${item.categoryPath}`;
    if (!acc[key]) {
      acc[key] = {
        studyType: item.studyType,
        categoryPath: item.categoryPath,
        articles: []
      };
    }
    acc[key].articles.push(item.article);
    return acc;
  }, {});

  const handleExport = () => {
    if (cartCount > 0) {
      setShowExportModal(true);
    }
  };

  const handleDetailDocument = () => {
    if (cartCount > 0) {
      setShowDetailDocModal(true);
    }
  };

  const handleExportComplete = () => {
    setShowExportModal(false);
    clearCart();
    closeCart();
  };

  if (!isCartOpen) return null;

  return (
    <>
      <div className="cart-overlay" onClick={closeCart}>
        <div className="cart-panel" onClick={(e) => e.stopPropagation()}>
          <div className="cart-header">
            <div className="cart-title">
              <FaShoppingCart className="cart-icon" />
              <h2>Select Cart</h2>
              <span className="cart-badge">{cartCount}</span>
            </div>
            <button className="cart-close-btn" onClick={closeCart}>
              <FaTimes />
            </button>
          </div>

          <div className="cart-body">
            {cartCount === 0 ? (
              <div className="cart-empty">
                <FaShoppingCart size={64} className="empty-icon" />
                <h3>Your cart is empty</h3>
                <p>Add articles from search results to collect them here</p>
              </div>
            ) : (
              <>
                <div className="cart-actions-top">
                  <button className="btn-clear-cart" onClick={clearCart}>
                    <FaTrash />
                    Clear All ({cartCount})
                  </button>
                </div>

                <div className="cart-items-list">
                  {Object.values(groupedArticles).map((group, groupIndex) => (
                    <div key={groupIndex} className="cart-category-group">
                      <div className="cart-category-header">
                        <div className="category-badge">
                          {group.studyType === 'animal' ? '🐁 Animal' : '👤 Human'} Studies
                        </div>
                        <div className="category-path">{formatCategoryPath(group.categoryPath)}</div>
                      </div>
                      
                      <div className="cart-divider"></div>

                      {group.articles.map((article, index) => (
                        <div key={article.pmid} className="cart-item">
                          <div className="cart-item-header">
                            <span className="cart-item-number">
                              #{index + 1}
                            </span>
                            <button
                              className="cart-item-remove"
                              onClick={() => removeFromCart(article.pmid)}
                              title="Remove from cart"
                            >
                              <FaTimes />
                            </button>
                          </div>
                          
                          <h4 className="cart-item-title">{article.title}</h4>
                          
                          <div className="cart-item-meta">
                            <span className="cart-pmid">PMID: {article.pmid}</span>
                            {article.authors && article.authors.length > 0 && (
                              <>
                                <span className="meta-separator">•</span>
                                <span className="cart-authors">
                                  {article.authors.slice(0, 3).join(', ')}
                                  {article.authors.length > 3 && ' et al.'}
                                </span>
                              </>
                            )}
                          </div>

                          {article.journal && (
                            <div className="cart-item-journal">
                              {article.journal}
                              {article.publicationDate && ` • ${article.publicationDate}`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {cartCount > 0 && (
            <div className="cart-footer">
              <div className="cart-footer-info">
                <FaCheck className="footer-icon" />
                <span><strong>{cartCount}</strong> article{cartCount !== 1 ? 's' : ''} ready to export</span>
              </div>
              <div className="cart-footer-buttons">
                <button className="btn-detail-doc" onClick={handleDetailDocument}>
                  <FaFileAlt />
                  Detail Document
                </button>
                <button className="btn-export-cart" onClick={handleExport}>
                  <FaFileWord />
                  Export to Word
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showExportModal && (
        <UnifiedExportModal
          groupedArticles={groupedArticles}
          totalCount={cartCount}
          onClose={() => setShowExportModal(false)}
          onExportComplete={handleExportComplete}
        />
      )}

      {showDetailDocModal && (
        <DetailDocumentModal
          cartItems={cartItems}
          onClose={() => setShowDetailDocModal(false)}
        />
      )}
    </>
  );
}

export default SelectCart;
