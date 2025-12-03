import React, { useState } from 'react';
import './DetailDocumentModal.css';
import { FaTimes, FaFileWord, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';

function DetailDocumentModal({ cartItems, onClose }) {
  const [loading, setLoading] = useState(false);
  const [selectedStudyType, setSelectedStudyType] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState(null);

  const handleGenerateDocument = async (studyType, docType = 'detail') => {
    setSelectedStudyType(studyType);
    setSelectedDocType(docType);
    setLoading(true);

    try {
      // Use relative URL for API calls - works in both development and production
      const apiBase = process.env.REACT_APP_API_URL || '/api';
      const endpoint = docType === 'detail' 
        ? `${apiBase}/generate-detail-document`
        : `${apiBase}/generate-short-summary`;
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cartItems,
          studyType
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate document: ${response.status} - ${errorText}`);
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = docType === 'detail'
        ? `Detail_Document_${studyType}_Studies_${new Date().toISOString().split('T')[0]}.docx`
        : `Short_Summary_${studyType}_Studies_${new Date().toISOString().split('T')[0]}.docx`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const docName = docType === 'detail' ? 'Detail document' : 'Short summary document';
      toast.success(`${docName} for ${studyType} studies generated successfully!`);
      onClose();
    } catch (error) {
      console.error('Error generating document:', error);
      toast.error(`Failed to generate document: ${error.message}`);
    } finally {
      setLoading(false);
      setSelectedStudyType(null);
      setSelectedDocType(null);
    }
  };

  return (
    <div className="detail-doc-modal-overlay" onClick={onClose}>
      <div className="detail-doc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-doc-header">
          <h2>📄 Generate Detail Document</h2>
          <button className="modal-close-btn" onClick={onClose} disabled={loading}>
            <FaTimes />
          </button>
        </div>

        <div className="detail-doc-body">
          <p className="detail-doc-description">
            Select the type of studies and document format to generate.
          </p>

          <h3 className="doc-type-title">📄 Detail Document (Full Abstracts)</h3>
          <div className="study-type-buttons">
            <button
              className="study-type-btn animal"
              onClick={() => handleGenerateDocument('animal', 'detail')}
              disabled={loading}
            >
              {loading && selectedStudyType === 'animal' && selectedDocType === 'detail' ? (
                <>
                  <FaSpinner className="spinner-icon" />
                  Generating...
                </>
              ) : (
                <>
                  <span className="study-icon">🐁</span>
                  <div className="study-info">
                    <h3>Animal Studies</h3>
                    <p>Full detailed document</p>
                  </div>
                  <FaFileWord className="doc-icon" />
                </>
              )}
            </button>

            <button
              className="study-type-btn human"
              onClick={() => handleGenerateDocument('human', 'detail')}
              disabled={loading}
            >
              {loading && selectedStudyType === 'human' && selectedDocType === 'detail' ? (
                <>
                  <FaSpinner className="spinner-icon" />
                  Generating...
                </>
              ) : (
                <>
                  <span className="study-icon">👤</span>
                  <div className="study-info">
                    <h3>Human Studies</h3>
                    <p>Full detailed document</p>
                  </div>
                  <FaFileWord className="doc-icon" />
                </>
              )}
            </button>
          </div>

          <h3 className="doc-type-title">📊 Short Summary (Tables + Summaries)</h3>
          <div className="study-type-buttons">
            <button
              className="study-type-btn animal"
              onClick={() => handleGenerateDocument('animal', 'short')}
              disabled={loading}
            >
              {loading && selectedStudyType === 'animal' && selectedDocType === 'short' ? (
                <>
                  <FaSpinner className="spinner-icon" />
                  Generating...
                </>
              ) : (
                <>
                  <span className="study-icon">🐁</span>
                  <div className="study-info">
                    <h3>Animal Studies</h3>
                    <p>Tables with short summaries</p>
                  </div>
                  <FaFileWord className="doc-icon" />
                </>
              )}
            </button>

            <button
              className="study-type-btn human"
              onClick={() => handleGenerateDocument('human', 'short')}
              disabled={loading}
            >
              {loading && selectedStudyType === 'human' && selectedDocType === 'short' ? (
                <>
                  <FaSpinner className="spinner-icon" />
                  Generating...
                </>
              ) : (
                <>
                  <span className="study-icon">👤</span>
                  <div className="study-info">
                    <h3>Human Studies</h3>
                    <p>Tables with short summaries</p>
                  </div>
                  <FaFileWord className="doc-icon" />
                </>
              )}
            </button>
          </div>

          <div className="detail-doc-info">
            <h4>📋 Document Features:</h4>
            <div className="features-grid">
              <div className="feature-column">
                <strong>Detail Document:</strong>
                <ul>
                  <li>✓ Full abstracts & detailed summaries</li>
                  <li>✓ Categorized sections</li>
                  <li>✓ AI-generated detailed content</li>
                  <li>✓ Biological terms in italic</li>
                </ul>
              </div>
              <div className="feature-column">
                <strong>Short Summary:</strong>
                <ul>
                  <li>✓ Tables for each main heading</li>
                  <li>✓ Concise 2-3 sentence summaries</li>
                  <li>✓ Key study parameters extracted</li>
                  <li>✓ Quick overview format</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DetailDocumentModal;
