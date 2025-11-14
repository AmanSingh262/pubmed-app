import React from 'react';
import './ExportOptions.css';
import { FaFileDownload, FaFileCsv, FaFileAlt, FaFileCode } from 'react-icons/fa';

function ExportOptions({ onExport, disabled }) {
  return (
    <div className="export-options">
      <div className="export-header">
        <FaFileDownload className="export-icon" />
        <span>Export Results</span>
      </div>
      <div className="export-buttons">
        <button
          className="export-btn csv"
          onClick={() => onExport('csv')}
          disabled={disabled}
          title="Export as CSV"
        >
          <FaFileCsv />
          CSV
        </button>
        <button
          className="export-btn json"
          onClick={() => onExport('json')}
          disabled={disabled}
          title="Export as JSON"
        >
          <FaFileCode />
          JSON
        </button>
        <button
          className="export-btn bibtex"
          onClick={() => onExport('bibtex')}
          disabled={disabled}
          title="Export as BibTeX"
        >
          <FaFileAlt />
          BibTeX
        </button>
        <button
          className="export-btn ris"
          onClick={() => onExport('ris')}
          disabled={disabled}
          title="Export as RIS"
        >
          <FaFileAlt />
          RIS
        </button>
      </div>
    </div>
  );
}

export default ExportOptions;
