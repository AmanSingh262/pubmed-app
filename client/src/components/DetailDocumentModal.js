import React, { useState } from 'react';
import './DetailDocumentModal.css';
import { FaTimes, FaFileWord, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';

function DetailDocumentModal({ cartItems, onClose }) {
  const [loading, setLoading] = useState(false);
  const [selectedStudyType, setSelectedStudyType] = useState(null);

  const handleGenerateDocument = async (studyType) => {
    setSelectedStudyType(studyType);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/generate-detail-document', {
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
        throw new Error('Failed to generate document');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Detail_Document_${studyType}_Studies_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Detail document for ${studyType} studies generated successfully!`);
      onClose();
    } catch (error) {
      console.error('Error generating document:', error);
      toast.error(`Failed to generate detail document: ${error.message}`);
    } finally {
      setLoading(false);
      setSelectedStudyType(null);
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
            Select the type of studies to generate a detailed document with full abstracts,
            categorized sections, and comprehensive formatting.
          </p>

          <div className="study-type-buttons">
            <button
              className="study-type-btn animal"
              onClick={() => handleGenerateDocument('animal')}
              disabled={loading}
            >
              {loading && selectedStudyType === 'animal' ? (
                <>
                  <FaSpinner className="spinner-icon" />
                  Generating...
                </>
              ) : (
                <>
                  <span className="study-icon">🐁</span>
                  <div className="study-info">
                    <h3>Animal Studies</h3>
                    <p>Generate document from animal research articles</p>
                  </div>
                  <FaFileWord className="doc-icon" />
                </>
              )}
            </button>

            <button
              className="study-type-btn human"
              onClick={() => handleGenerateDocument('human')}
              disabled={loading}
            >
              {loading && selectedStudyType === 'human' ? (
                <>
                  <FaSpinner className="spinner-icon" />
                  Generating...
                </>
              ) : (
                <>
                  <span className="study-icon">👤</span>
                  <div className="study-info">
                    <h3>Human Studies</h3>
                    <p>Generate document from human research articles</p>
                  </div>
                  <FaFileWord className="doc-icon" />
                </>
              )}
            </button>
          </div>

          <div className="detail-doc-info">
            <h4>📋 Document Features:</h4>
            <ul>
              <li>✓ Abbreviations table at the top</li>
              <li>✓ Categorized sections with proper headings</li>
              <li>✓ AI-generated detailed summaries from abstracts</li>
              <li>✓ Times New Roman font, professional formatting</li>
              <li>✓ Biological terms in italic</li>
              <li>✓ Full references at the end</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DetailDocumentModal;
