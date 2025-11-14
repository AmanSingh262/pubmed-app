import React from 'react';
import './SearchBar.css';
import { FaSearch } from 'react-icons/fa';

function SearchBar({ query, setQuery, onSearch, loading }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div className="search-bar-container">
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Enter drug name or topic (e.g., cefixime, aspirin, diabetes)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          className="search-button"
          disabled={loading || !query.trim()}
        >
          {loading ? (
            <>
              <span className="spinner-small"></span>
              Searching...
            </>
          ) : (
            <>
              <FaSearch />
              Search Articles
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default SearchBar;
