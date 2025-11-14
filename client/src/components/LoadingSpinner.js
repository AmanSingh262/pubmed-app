import React from 'react';
import './LoadingSpinner.css';
import { FaSpinner } from 'react-icons/fa';

function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="loading-spinner-container">
      <div className="loading-content">
        <FaSpinner className="spinner-icon" />
        <p className="loading-message">{message}</p>
        <div className="loading-steps">
          <div className="step">🔍 Searching PubMed database...</div>
          <div className="step">📚 Fetching article details...</div>
          <div className="step">🎯 Applying intelligent filters...</div>
          <div className="step">📊 Ranking by relevance...</div>
        </div>
      </div>
    </div>
  );
}

export default LoadingSpinner;
