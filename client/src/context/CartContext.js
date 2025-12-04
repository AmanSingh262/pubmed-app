import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    // Load cart from localStorage on initialization
    const savedCart = localStorage.getItem('pubmedCart');
    if (!savedCart) return [];
    
    try {
      const parsed = JSON.parse(savedCart);
      
      // Normalize PMIDs in existing cart data
      const normalizePmid = (pmid) => {
        if (typeof pmid === 'object' && pmid !== null) {
          return pmid._ || pmid.i || String(pmid);
        }
        return String(pmid);
      };
      
      const normalized = parsed.map(item => ({
        ...item,
        article: {
          ...item.article,
          pmid: normalizePmid(item.article.pmid)
        }
      }));
      
      // Save normalized data back to localStorage immediately
      localStorage.setItem('pubmedCart', JSON.stringify(normalized));
      
      return normalized;
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      // Clear corrupted cart data
      localStorage.removeItem('pubmedCart');
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('pubmedCart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (article, categoryPath, studyType) => {
    setCartItems(prev => {
      // Normalize PMID (handle both string and object formats)
      const normalizePmid = (pmid) => {
        if (typeof pmid === 'object' && pmid !== null) {
          return pmid._ || pmid.i || String(pmid);
        }
        return String(pmid);
      };

      const articlePmid = normalizePmid(article.pmid);
      
      // Create normalized article with string PMID
      const normalizedArticle = {
        ...article,
        pmid: articlePmid
      };
      
      // Check if article already exists in cart
      const exists = prev.some(item => normalizePmid(item.article.pmid) === articlePmid);
      if (exists) {
        return prev;
      }
      
      return [...prev, {
        article: normalizedArticle,
        categoryPath,
        studyType,
        addedAt: new Date().toISOString()
      }];
    });
  };

  const removeFromCart = (pmid) => {
    const normalizePmid = (p) => {
      if (typeof p === 'object' && p !== null) {
        return p._ || p.i || String(p);
      }
      return String(p);
    };
    const normalizedPmid = normalizePmid(pmid);
    setCartItems(prev => prev.filter(item => normalizePmid(item.article.pmid) !== normalizedPmid));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const isInCart = (pmid) => {
    const normalizePmid = (p) => {
      if (typeof p === 'object' && p !== null) {
        return p._ || p.i || String(p);
      }
      return String(p);
    };
    const normalizedPmid = normalizePmid(pmid);
    return cartItems.some(item => normalizePmid(item.article.pmid) === normalizedPmid);
  };

  const toggleCart = () => {
    setIsCartOpen(prev => !prev);
  };

  const closeCart = () => {
    setIsCartOpen(false);
  };

  const openCart = () => {
    setIsCartOpen(true);
  };

  const value = {
    cartItems,
    cartCount: cartItems.length,
    addToCart,
    removeFromCart,
    clearCart,
    isInCart,
    isCartOpen,
    toggleCart,
    closeCart,
    openCart
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
