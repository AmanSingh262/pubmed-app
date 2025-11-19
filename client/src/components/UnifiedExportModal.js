import React, { useState } from 'react';
import './UnifiedExportModal.css';
import { FaTimes, FaFileWord, FaCheck } from 'react-icons/fa';

function UnifiedExportModal({ groupedArticles, totalCount, onClose, onExportComplete }) {
  const [formatting, setFormatting] = useState({
    font: 'Times New Roman',
    fontSize: 12,
    lineSpacing: 1.0,
    spacingBefore: 0,
    spacingAfter: 6,
    alignment: 'justify',
    citationStyle: 'APA'
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
      const response = await fetch('/api/export/unified-word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupedArticles,
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
      a.download = `pubmed_unified_export_${Date.now()}.docx`;
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

  const categoryCount = Object.keys(groupedArticles).length;

  return (
    <div className="unified-modal-overlay" onClick={onClose}>
      <div className="unified-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="unified-modal-header">
          <div className="unified-modal-title">
            <FaFileWord className="unified-modal-icon" />
            <h2>Export Unified Document</h2>
          </div>
          <button className="unified-modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="unified-modal-body">
          <div className="unified-export-info">
            <FaCheck className="unified-info-icon" />
            <div>
              <div><strong>{totalCount}</strong> article{totalCount !== 1 ? 's' : ''} from <strong>{categoryCount}</strong> categor{categoryCount !== 1 ? 'ies' : 'y'}</div>
              <div className="unified-info-subtitle">Articles will be grouped by category with dividers</div>
            </div>
          </div>

          <div className="unified-formatting-section">
            <h3>Document Formatting</h3>
            
            <div className="unified-form-row">
              <div className="unified-form-group">
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

              <div className="unified-form-group">
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

            <div className="unified-form-row">
              <div className="unified-form-group">
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

              <div className="unified-form-group">
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

            <div className="unified-form-row">
              <div className="unified-form-group">
                <label>Spacing Before (pt)</label>
                <input
                  type="number"
                  value={formatting.spacingBefore}
                  onChange={(e) => handleChange('spacingBefore', parseInt(e.target.value))}
                  min="0"
                  max="48"
                />
              </div>

              <div className="unified-form-group">
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

            <div className="unified-form-group unified-full-width">
              <label>Citation Style for References</label>
              <select
                value={formatting.citationStyle}
                onChange={(e) => handleChange('citationStyle', e.target.value)}
              >
                <option value="APA">APA (American Psychological Association)</option>
                <option value="MLA">MLA (Modern Language Association)</option>
                <option value="Chicago">Chicago</option>
                <option value="Vancouver">Vancouver</option>
              </select>
            </div>
          </div>

          <div className="unified-preview-info">
            <h4>Document Structure:</h4>
            <ul>
              <li>Each category will have a heading: "A Study was conducted to evaluate the [category]"</li>
              <li>Articles grouped by category with horizontal dividers</li>
              <li>References section at the end with properly formatted citations</li>
            </ul>
          </div>
        </div>

        <div className="unified-modal-footer">
          <button className="unified-btn-cancel" onClick={onClose} disabled={isExporting}>
            Cancel
          </button>
          <button 
            className="unified-btn-export" 
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <div className="unified-spinner"></div>
                Generating...
              </>
            ) : (
              <>
                <FaFileWord />
                Generate Unified Document
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UnifiedExportModal;
