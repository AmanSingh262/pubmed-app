import React, { useState } from 'react';
import './ReferenceDocUpload.css';

const ReferenceDocUpload = ({ onResultsReceived }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  
  // New fields for enhanced search
  const [drugName, setDrugName] = useState('');
  const [doseForm, setDoseForm] = useState('');
  const [indication, setIndication] = useState('');
  const [includeSubheadings, setIncludeSubheadings] = useState(true);
  const [extractedInfo, setExtractedInfo] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    validateAndSetFile(file);
  };

  const validateAndSetFile = async (file) => {
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
    
    // Auto-extract information from document
    await extractDocumentInfo(file);
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

  const extractDocumentInfo = async (file) => {
    setIsExtracting(true);
    setExtractedInfo(null);
    
    const formData = new FormData();
    formData.append('document', file);

    try {
      const response = await fetch('/api/reference-doc/extract-info', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setExtractedInfo(data);
        
        // Auto-populate fields with extracted information
        if (data.suggestedDrugName) {
          setDrugName(data.suggestedDrugName);
        }
        if (data.doseForm && data.doseForm !== 'not-applicable') {
          setDoseForm(data.doseForm);
        }
        if (data.indication && data.indication !== 'Not Applicable') {
          setIndication(data.indication);
        }
      }
    } catch (error) {
      console.error('Failed to extract document info:', error);
      // Continue without extraction - user can fill manually
    } finally {
      setIsExtracting(false);
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
    
    // Add new optional fields
    if (drugName && drugName.trim()) {
      formData.append('drugName', drugName.trim());
    }
    if (doseForm && doseForm !== 'not-applicable') {
      formData.append('doseForm', doseForm);
    }
    if (indication && indication !== 'not-applicable') {
    setExtractedInfo(null);
    // Optionally clear the fields when removing file
    // setDrugName('');
    // setDoseForm('');
    // setIndication('');
      formData.append('indication', indication.trim());
    }
    formData.append('includeSubheadings', includeSubheadings);

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
         Extracting && (
        <div className="extraction-progress">
          <span className="extraction-icon">🔍</span>
          <span>Extracting information from document...</span>
        </div>
      )}

      {extractedInfo && !isExtracting && (
        <div className="extraction-success">
          <span className="success-icon">✅</span>
          <span>Document analyzed! Fields populated with extracted information.</span>
          {extractedInfo.drugNames && extractedInfo.drugNames.length > 1 && (
            <div className="drug-suggestions">
              <small>Other detected drugs: {extractedInfo.drugNames.slice(1, 4).join(', ')}</small>
            </div>
          )}
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

      {/* New fields for enhanced search */}
      <div className="search-options">
        <h4>🎯 Search Options (Optional)</h4>
        
        <div className="form-group">
          <label htmlFor="drugName">
            Drug Name <span className="optional-tag">(Optional)</span>
          </label>
          <input
            type="text"
            id="drugName"
            value={drugName}
            onChange={(e) => setDrugName(e.target.value)}
            placeholder="e.g., Augmentin, Aspirin, Ibuprofen"
            disabled={isUploading}
            className="form-input"
          />
          <p className="field-hint">Specify the drug name to find more accurate similar articles</p>
        </div>

        <div className="form-group">
          <label htmlFor="doseForm">
            Dose Form <span className="optional-tag">(Optional)</span>
          </label>
          <select
            id="doseForm"
            value={doseForm}
            onChange={(e) => setDoseForm(e.target.value)}
            disabled={isUploading}
            className="form-select"
          >
            <option value="">Select dose form</option>
            <option value="not-applicable">Not Applicable</option>
            <option value="tablet">Tablet</option>
            <option value="capsule">Capsule</option>
            <option value="injection">Injection</option>
            <option value="syrup">Syrup</option>
            <option value="suspension">Suspension</option>
            <option value="cream">Cream/Ointment</option>
            <option value="powder">Powder</option>
            <option value="solution">Solution</option>
            <option value="patch">Transdermal Patch</option>
            <option value="inhaler">Inhaler</option>
            <option value="suppository">Suppository</option>
          </select>
          <p className="field-hint">Filter articles by dosage form (e.g., tablet, injection)</p>
        </div>

        <div className="form-group">
          <label htmlFor="indication">
            Indication <span className="optional-tag">(Optional)</span>
          </label>
          <input
            type="text"
            id="indication"
            value={indication}
            onChange={(e) => setIndication(e.target.value)}
            placeholder="e.g., Diabetes, Hypertension, Infection"
            disabled={isUploading}
            className="form-input"
          />
          <p className="field-hint">Specify the condition/indication or type "Not Applicable"</p>
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeSubheadings}
              onChange={(e) => setIncludeSubheadings(e.target.checked)}
              disabled={isUploading}
            />
            <span>Include subheadings in results (Absorption, Method of Analysis, Single Dose, etc.)</span>
          </label>
        </div>
      </div>

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
