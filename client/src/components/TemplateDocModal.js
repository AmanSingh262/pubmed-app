import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import './TemplateDocModal.css';

function TemplateDocModal({ isOpen, onClose, selectedArticles }) {
  const [templateFile, setTemplateFile] = useState(null);
  const [templateInfo, setTemplateInfo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  if (!isOpen) return null;

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.docx')) {
        toast.error('Please upload a .docx file');
        return;
      }
      setTemplateFile(file);
      setTemplateInfo(null);
      setShowPreview(false);
      setPreviewData(null);
    }
  };

  const handleUploadTemplate = async () => {
    if (!templateFile) {
      toast.warning('Please select a template file');
      return;
    }

    setIsUploading(true);
    try {
      const result = await api.uploadTemplate(templateFile);
      setTemplateInfo(result);
      toast.success(`Template parsed! Found ${result.headingsCount} headings`);
    } catch (error) {
      console.error('Template upload error:', error);
      toast.error('Failed to upload template');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreview = async () => {
    if (!templateInfo) {
      toast.warning('Please upload a template first');
      return;
    }

    if (selectedArticles.length === 0) {
      toast.warning('No articles selected');
      return;
    }

    try {
      const article = selectedArticles[0]; // Preview with first article
      const result = await api.previewTemplate(templateInfo.templatePath, article);
      setPreviewData(result);
      setShowPreview(true);
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to preview template');
    }
  };

  const handleGenerate = async () => {
    if (!templateInfo) {
      toast.warning('Please upload a template first');
      return;
    }

    if (selectedArticles.length === 0) {
      toast.warning('No articles selected');
      return;
    }

    setIsGenerating(true);
    try {
      // Generate for first article (can be extended for batch)
      const article = selectedArticles[0];
      await api.generateTemplateDoc(templateInfo.templatePath, article);
      toast.success('Template document generated successfully!');
      
      // Reset and close
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate document');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setTemplateFile(null);
    setTemplateInfo(null);
    setShowPreview(false);
    setPreviewData(null);
    onClose();
  };

  const renderStructureTree = (headings, level = 0) => {
    return (
      <ul className="template-structure-tree" style={{ marginLeft: level * 20 }}>
        {headings.map((heading, index) => (
          <li key={index} className="template-heading-item">
            <div className={`heading-level-${heading.level}`}>
              <span className="heading-text">{heading.text}</span>
              {heading.matchedSection && (
                <span className="matched-section">
                  → {heading.matchedSection}
                </span>
              )}
              {heading.content && (
                <span className="content-available">✓</span>
              )}
            </div>
            {heading.children && heading.children.length > 0 && 
              renderStructureTree(heading.children, level + 1)
            }
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="template-modal-overlay" onClick={handleClose}>
      <div className="template-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="template-modal-header">
          <h2>📄 Template Document Generator</h2>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        <div className="template-modal-body">
          {/* Step 1: Upload Template */}
          <div className="template-section">
            <h3>Step 1: Upload Template Document</h3>
            <p className="template-hint">
              Upload a .docx file with headings and subheadings. The system will automatically
              map article content to matching sections.
            </p>
            
            <div className="file-upload-area">
              <input
                type="file"
                accept=".docx"
                onChange={handleFileSelect}
                id="template-file-input"
                style={{ display: 'none' }}
              />
              <label htmlFor="template-file-input" className="file-upload-btn">
                Choose Template File (.docx)
              </label>
              
              {templateFile && (
                <div className="selected-file">
                  <span>📄 {templateFile.name}</span>
                  <button
                    className="btn-upload-template"
                    onClick={handleUploadTemplate}
                    disabled={isUploading}
                  >
                    {isUploading ? 'Uploading...' : 'Upload & Parse'}
                  </button>
                </div>
              )}
            </div>

            {templateInfo && (
              <div className="template-info-box">
                <div className="info-item">
                  <strong>Template:</strong> {templateFile.name}
                </div>
                <div className="info-item">
                  <strong>Headings Found:</strong> {templateInfo.headingsCount}
                </div>
                <div className="info-item success">
                  ✓ Template parsed successfully
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Preview */}
          {templateInfo && (
            <div className="template-section">
              <h3>Step 2: Preview Mapping</h3>
              <p className="template-hint">
                See how your article content will be mapped to template sections.
              </p>
              
              <button
                className="btn-preview"
                onClick={handlePreview}
                disabled={selectedArticles.length === 0}
              >
                Preview Mapping
              </button>

              {showPreview && previewData && (
                <div className="preview-container">
                  <h4>Preview for: {previewData.article.title}</h4>
                  {renderStructureTree(previewData.structure)}
                  
                  <div className="preview-legend">
                    <div className="legend-item">
                      <span className="content-available">✓</span> Content available
                    </div>
                    <div className="legend-item">
                      <span className="matched-section">→ section</span> Mapped to article section
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Generate */}
          {templateInfo && (
            <div className="template-section">
              <h3>Step 3: Generate Document</h3>
              <p className="template-hint">
                Selected Articles: <strong>{selectedArticles.length}</strong>
              </p>
              
              <div className="selected-articles-preview">
                {selectedArticles.slice(0, 3).map((article, index) => (
                  <div key={index} className="article-preview-item">
                    <span className="pmid-badge">PMID: {article.pmid}</span>
                    <span className="article-title-short">
                      {article.title.substring(0, 60)}...
                    </span>
                  </div>
                ))}
                {selectedArticles.length > 3 && (
                  <div className="more-articles">
                    +{selectedArticles.length - 3} more articles
                  </div>
                )}
              </div>

              <button
                className="btn-generate"
                onClick={handleGenerate}
                disabled={isGenerating || selectedArticles.length === 0}
              >
                {isGenerating ? '⏳ Generating...' : '📥 Generate Document'}
              </button>

              {selectedArticles.length > 1 && (
                <p className="note">
                  Note: Currently generating for the first selected article.
                  Batch generation coming soon!
                </p>
              )}
            </div>
          )}
        </div>

        <div className="template-modal-footer">
          <button className="btn-cancel" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default TemplateDocModal;
