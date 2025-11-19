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
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('pubmedCart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (article, categoryPath, studyType) => {
    setCartItems(prev => {
      // Check if article already exists in cart
      const exists = prev.some(item => item.article.pmid === article.pmid);
      if (exists) {
        return prev;
      }
      
      return [...prev, {
        article,
        categoryPath,
        studyType,
        addedAt: new Date().toISOString()
      }];
    });
  };

  const removeFromCart = (pmid) => {
    setCartItems(prev => prev.filter(item => item.article.pmid !== pmid));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const isInCart = (pmid) => {
    return cartItems.some(item => item.article.pmid === pmid);
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
