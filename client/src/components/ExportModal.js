import React, { useState } from 'react';
import './ExportModal.css';
import { FaTimes, FaFileWord, FaCheck } from 'react-icons/fa';

function ExportModal({ articles, categoryPath, onClose, onExportComplete }) {
  const [formatting, setFormatting] = useState({
    font: 'Times New Roman',
    fontSize: 12,
    lineSpacing: 1.0,
    spacingBefore: 0,
    spacingAfter: 6,
    alignment: 'justify',
    heading: `A Study was conducted to evaluate the ${categoryPath}`
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleChange = (field, value) => {
    setFormatting(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const response = await fetch('/api/export/word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articles,
          formatting
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pubmed_export_${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onExportComplete();
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export document. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <FaFileWord className="modal-icon" />
            <h2>Export to Word Document</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-body">
          <div className="export-info">
            <FaCheck className="info-icon" />
            <span><strong>{articles.length}</strong> article{articles.length !== 1 ? 's' : ''} will be exported</span>
          </div>

          <div className="formatting-section">
            <h3>Document Formatting</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Font</label>
                <select 
                  value={formatting.font} 
                  onChange={(e) => handleChange('font', e.target.value)}
                >
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Arial">Arial</option>
                  <option value="Calibri">Calibri</option>
                  <option value="Georgia">Georgia</option>
                </select>
              </div>

              <div className="form-group">
                <label>Font Size</label>
                <input
                  type="number"
                  value={formatting.fontSize}
                  onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
                  min="8"
                  max="24"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Line Spacing</label>
                <select
                  value={formatting.lineSpacing}
                  onChange={(e) => handleChange('lineSpacing', parseFloat(e.target.value))}
                >
                  <option value="1.0">1.0 (Single)</option>
                  <option value="1.5">1.5</option>
                  <option value="2.0">2.0 (Double)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Alignment</label>
                <select
                  value={formatting.alignment}
                  onChange={(e) => handleChange('alignment', e.target.value)}
                >
                  <option value="justify">Justified</option>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Spacing Before (pt)</label>
                <input
                  type="number"
                  value={formatting.spacingBefore}
                  onChange={(e) => handleChange('spacingBefore', parseInt(e.target.value))}
                  min="0"
                  max="48"
                />
              </div>

              <div className="form-group">
                <label>Spacing After (pt)</label>
                <input
                  type="number"
                  value={formatting.spacingAfter}
                  onChange={(e) => handleChange('spacingAfter', parseInt(e.target.value))}
                  min="0"
                  max="48"
                />
              </div>
            </div>

            <div className="form-group full-width">
              <label>Document Heading</label>
              <input
                type="text"
                value={formatting.heading}
                onChange={(e) => handleChange('heading', e.target.value)}
                placeholder="Enter document heading"
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose} disabled={isExporting}>
            Cancel
          </button>
          <button 
            className="btn-export" 
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <div className="spinner"></div>
                Generating...
              </>
            ) : (
              <>
                <FaFileWord />
                Export Document
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportModal;
