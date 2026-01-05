import React from 'react';
import './SearchFilters.css';
import { FaCalendar, FaFileAlt, FaUnlock, FaBook, FaPaw, FaUserMd } from 'react-icons/fa';

function SearchFilters({ filters, setFilters, disabled }) {
  const currentYear = new Date().getFullYear();

  const handleYearFromChange = (e) => {
    const value = parseInt(e.target.value) || null;
    setFilters({ ...filters, yearFrom: value });
  };

  const handleYearToChange = (e) => {
    const value = parseInt(e.target.value) || null;
    setFilters({ ...filters, yearTo: value });
  };

  const handleToggle = (filterName) => {
    setFilters({ ...filters, [filterName]: !filters[filterName] });
  };

  return (
    <div className="search-filters">
      <h4 className="filters-title">
        <FaCalendar /> Search Filters
      </h4>

      <div className="filter-group">
        <label className="filter-label">Publication Year Range</label>
        <div className="year-range">
          <input
            type="number"
            className="year-input"
            placeholder="From"
            min="1900"
            max={currentYear}
            value={filters.yearFrom || ''}
            onChange={handleYearFromChange}
            disabled={disabled}
          />
          <span className="year-separator">-</span>
          <input
            type="number"
            className="year-input"
            placeholder="To"
            min="1900"
            max={currentYear}
            value={filters.yearTo || ''}
            onChange={handleYearToChange}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="filter-group">
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filters.hasAbstract}
            onChange={() => handleToggle('hasAbstract')}
            disabled={disabled}
          />
          <FaFileAlt className="filter-icon" />
          <span>Has Abstract</span>
        </label>
      </div>

      <div className="filter-group">
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filters.freeFullText}
            onChange={() => handleToggle('freeFullText')}
            disabled={disabled}
          />
          <FaUnlock className="filter-icon" />
          <span>Free Full Text</span>
        </label>
      </div>

      <div className="filter-group">
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filters.fullText}
            onChange={() => handleToggle('fullText')}
            disabled={disabled}
          />
          <FaBook className="filter-icon" />
          <span>Full Text Available</span>
        </label>
      </div>

      <div className="filter-group study-type-verification">
        <label className="filter-label">Study Type Verification</label>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filters.verifyAnimalStudy}
            onChange={() => handleToggle('verifyAnimalStudy')}
            disabled={disabled}
          />
          <FaPaw className="filter-icon animal" />
          <span>Strict Animal Study Only</span>
        </label>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filters.verifyHumanStudy}
            onChange={() => handleToggle('verifyHumanStudy')}
            disabled={disabled}
          />
          <FaUserMd className="filter-icon human" />
          <span>Strict Human Study Only</span>
        </label>
      </div>

      {(filters.yearFrom || filters.yearTo || filters.hasAbstract || filters.freeFullText || filters.fullText || filters.verifyAnimalStudy || filters.verifyHumanStudy) && (
        <button
          className="btn-reset-filters"
          onClick={() => setFilters({
            yearFrom: null,
            yearTo: null,
            hasAbstract: false,
            freeFullText: false,
            fullText: false,
            verifyAnimalStudy: false,
            verifyHumanStudy: false
          })}
          disabled={disabled}
        >
          Reset Filters
        </button>
      )}
    </div>
  );
}

export default SearchFilters;
