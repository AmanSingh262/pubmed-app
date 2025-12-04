import React, { useState } from 'react';
import './ReferenceDocUpload.css';

const ReferenceDocUpload = ({ onResultsReceived }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    validateAndSetFile(file);
  };

  const validateAndSetFile = (file) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload PDF, DOCX, or TXT files only.');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit.');
      return;
    }

    setSelectedFile(file);
    setError('');
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async (studyType) => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError('');

    const formData = new FormData();
    formData.append('document', selectedFile);
    formData.append('studyType', studyType);

    try {
      const response = await fetch('/api/reference-doc/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      
      // Notify parent component with results
      if (onResultsReceived) {
        onResultsReceived(data);
      }

      setUploadProgress(100);
      setSelectedFile(null);
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to process document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError('');
  };

  return (
    <div className="reference-doc-upload">
      <div className="upload-header">
        <h3>📄 Reference Document Search</h3>
        <p>Upload a document to find similar articles in PubMed</p>
      </div>

      <div
        className={`upload-area ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {!selectedFile ? (
          <>
            <div className="upload-icon">📤</div>
            <p className="upload-text">Drag and drop your document here</p>
            <p className="upload-subtext">or</p>
            <label className="file-select-button">
              Browse Files
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </label>
            <p className="upload-format-info">Supported formats: PDF, DOCX, TXT (max 10MB)</p>
          </>
        ) : (
          <div className="selected-file">
            <div className="file-info">
              <span className="file-icon">📎</span>
              <div className="file-details">
                <p className="file-name">{selectedFile.name}</p>
                <p className="file-size">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button className="remove-file-btn" onClick={handleRemoveFile}>
              ✕
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="upload-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {isUploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
          </div>
          <p className="progress-text">Processing document... {uploadProgress}%</p>
        </div>
      )}

      <div className="upload-actions">
        <button
          className="upload-button animal-study-btn"
          onClick={() => handleUpload('animal')}
          disabled={!selectedFile || isUploading}
        >
          {isUploading ? 'Processing...' : 'Animal Study Similar Articles'}
        </button>
        <button
          className="upload-button human-study-btn"
          onClick={() => handleUpload('human')}
          disabled={!selectedFile || isUploading}
        >
          {isUploading ? 'Processing...' : 'Human Study Similar Articles'}
        </button>
      </div>
    </div>
  );
};

export default ReferenceDocUpload;
