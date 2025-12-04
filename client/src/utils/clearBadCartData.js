/**
 * Utility to clear and migrate cart data with object PMIDs
 * This should be called once when the app loads
 */
export const clearBadCartData = () => {
  try {
    const savedCart = localStorage.getItem('pubmedCart');
    if (!savedCart) return;

    const parsed = JSON.parse(savedCart);
    
    // Check if any PMIDs are objects
    const hasBadData = parsed.some(item => 
      typeof item.article?.pmid === 'object'
    );

    if (hasBadData) {
      console.log('Detected cart data with object PMIDs, clearing...');
      localStorage.removeItem('pubmedCart');
      // Force reload to clear React state
      window.location.reload();
    }
  } catch (error) {
    console.error('Error checking cart data:', error);
    localStorage.removeItem('pubmedCart');
  }
};
