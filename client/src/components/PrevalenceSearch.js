import React, { useState } from 'react';
import './PrevalenceSearch.css';

const PrevalenceSearch = ({ onResultsReceived }) => {
  const [studyType, setStudyType] = useState('human'); // 'animal' | 'human'
  const [prevalenceCountry, setPrevalenceCountry] = useState('');
  const [prevalenceYears, setPrevalenceYears] = useState([]);
  const [prevalenceDiseaseName, setPrevalenceDiseaseName] = useState('');
  const [drugName, setDrugName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  const yearOptions = Array.from({ length: 15 }, (_, index) => String(2011 + index)).reverse();

  const prevalenceCountryOptions = [
    { value: '', label: 'All of Europe' },
    { value: 'Europe', label: 'All European Countries' },
    { value: 'United Kingdom', label: 'United Kingdom (UK)' },
    { value: 'England', label: 'England' },
    { value: 'Germany', label: 'Germany' },
    { value: 'France', label: 'France' },
    { value: 'Spain', label: 'Spain' },
    { value: 'Italy', label: 'Italy' },
    { value: 'India', label: 'India' }
  ];

  const handleYearToggle = (year) => {
    setPrevalenceYears((prev) => {
      if (prev.includes(year)) {
        return prev.filter(y => y !== year);
      }
      if (prev.length >= 5) {
        setError('Maximum 5 years allowed');
        return prev;
      }
      setError('');
      return [...prev, year].sort((a, b) => Number(b) - Number(a));
    });
  };

  const handleSearch = async () => {
    if (!prevalenceDiseaseName.trim()) {
      setError('Please enter a disease name');
      return;
    }

    setError('');
    setIsSearching(true);

    try {
      const response = await fetch('/api/reference-doc/prevalence-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyType,
          prevalenceCountry,
          prevalenceYears: JSON.stringify(prevalenceYears),
          prevalenceDiseaseName: prevalenceDiseaseName.trim(),
          drugName: drugName.trim() || '',
          includeSubheadings: true
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Search failed');
      }

      const data = await response.json();
      onResultsReceived(data);
    } catch (err) {
      setError(err.message || 'Failed to search prevalence data');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClear = () => {
    setStudyType('human');
    setPrevalenceCountry('');
    setPrevalenceYears([]);
    setPrevalenceDiseaseName('');
    setDrugName('');
    setError('');
    onResultsReceived(null);
  };

  return (
    <div className="prevalence-search-container">
      <div className="prevalence-header">
        <div className="header-icon">📊</div>
        <div className="header-text">
          <h3>Prevalence Search</h3>
          <p>Find European disease prevalence data for EMA Environmental Risk Assessment</p>
        </div>
      </div>

      <div className="prevalence-form">
        {/* Study Type Toggle */}
        <div className="study-type-toggle">
          <label>Study Type</label>
          <div className="toggle-buttons">
            <button
              type="button"
              className={`toggle-btn ${studyType === 'animal' ? 'active' : ''}`}
              onClick={() => setStudyType('animal')}
              disabled={isSearching}
            >
              <span className="toggle-icon">🐾</span>
              Animal
            </button>
            <button
              type="button"
              className={`toggle-btn ${studyType === 'human' ? 'active' : ''}`}
              onClick={() => setStudyType('human')}
              disabled={isSearching}
            >
              <span className="toggle-icon">👤</span>
              Human
            </button>
          </div>
        </div>

        {/* Drug Name */}
        <div className="form-group">
          <label htmlFor="drugName">
            Drug Name <span className="optional-tag">(Optional)</span>
          </label>
          <input
            type="text"
            id="drugName"
            value={drugName}
            onChange={(e) => setDrugName(e.target.value)}
            placeholder="e.g., metformin, aspirin"
            disabled={isSearching}
            className="form-input"
          />
        </div>

        {/* Disease Name */}
        <div className="form-group">
          <label htmlFor="prevalenceDiseaseName">
            Disease Name <span className="required-tag">* Required</span>
          </label>
          <input
            type="text"
            id="prevalenceDiseaseName"
            value={prevalenceDiseaseName}
            onChange={(e) => setPrevalenceDiseaseName(e.target.value)}
            placeholder="e.g., diabetes, cystic fibrosis, breast cancer"
            disabled={isSearching}
            className="form-input disease-input"
          />
        </div>

        {/* Country */}
        <div className="form-group">
          <label htmlFor="prevalenceCountry">Country/Region</label>
          <select
            id="prevalenceCountry"
            value={prevalenceCountry}
            onChange={(e) => setPrevalenceCountry(e.target.value)}
            disabled={isSearching}
            className="form-select"
          >
            {prevalenceCountryOptions.map((country) => (
              <option key={country.value} value={country.value}>
                {country.label}
              </option>
            ))}
          </select>
        </div>

        {/* Years */}
        <div className="form-group">
          <label>Publication Years (max 5)</label>
          <div className="years-grid">
            {yearOptions.map((year) => (
              <button
                key={year}
                type="button"
                className={`year-chip ${prevalenceYears.includes(year) ? 'selected' : ''}`}
                onClick={() => handleYearToggle(year)}
                disabled={isSearching}
              >
                {year}
              </button>
            ))}
          </div>
          {prevalenceYears.length > 0 && (
            <div className="selected-years">
              Selected: {prevalenceYears.join(', ')}
            </div>
          )}
        </div>

        {error && (
          <div className="error-banner">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Buttons */}
        <div className="button-row">
          <button
            type="button"
            className="btn-search"
            onClick={handleSearch}
            disabled={isSearching || !prevalenceDiseaseName.trim()}
          >
            {isSearching ? (
              <>
                <span className="spinner"></span>
                Searching...
              </>
            ) : (
              <>🔍 Search Prevalence</>
            )}
          </button>
          <button
            type="button"
            className="btn-clear"
            onClick={handleClear}
            disabled={isSearching}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrevalenceSearch;