import React, { useState, useEffect } from 'react';
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
      const result = await api.uploadTemplateFinal(templateFile);
      setTemplateInfo(result);
      toast.success(`✅ Template analyzed! Found ${result.analysis?.headingsCount || 0} headings, ${result.analysis?.tablesCount || 0} tables`);
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
      const article = selectedArticles[0];
      const result = await api.previewTemplateFinal(templateInfo.templatePath, article);
      setPreviewData(result);
      setShowPreview(true);
      toast.success('Preview generated with complete content!');
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to generate preview');
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
      const article = selectedArticles[0];
      await api.generateTemplateDocFinal(templateInfo.templatePath, article);
      toast.success('✅ Complete document generated with ALL sections filled! Check downloads.');
      
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error('Generation error:', error);
      if (error.response?.data?.error?.includes('placeholder')) {
        toast.error('⚠️ Template needs placeholders! Add {pharmacology}, {toxicology}, {abbreviations_list}');
      } else {
        toast.error('Failed to generate document');
      }
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
            <h3>Step 1: Prepare & Upload Template</h3>
            
            <div style={{ backgroundColor: '#fff3e0', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '2px solid #ff9800' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#e65100' }}>⚠️ IMPORTANT: Add Placeholders to Your Template First!</h4>
              <p style={{ margin: '5px 0' }}>Your Word template must contain placeholders where you want content:</p>
              <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9em', marginTop: '10px' }}>
                <strong>Example placeholders:</strong><br/>
                • <code>{'{abstract}'}</code> - Full abstract text<br/>
                • <code>{'{pharmacology}'}</code> - Pharmacology section<br/>
                • <code>{'{pharmacokinetics}'}</code> - PK section<br/>
                • <code>{'{absorption}'}</code> - Absorption data<br/>
                • <code>{'{distribution}'}</code> - Distribution data<br/>
                • <code>{'{metabolism}'}</code> - Metabolism data<br/>
                • <code>{'{excretion}'}</code> - Excretion data<br/>
                • <code>{'{toxicology}'}</code> - Toxicology section<br/>
                • <code>{'{genotoxicity}'}</code> - Genotoxicity data<br/>
                • <code>{'{abbreviations_list}'}</code> - Abbreviations table<br/>
              </div>
            </div>
            
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
                    {isUploading ? 'Uploading...' : 'Upload Template'}
                  </button>
                </div>
              )}
            </div>

            {templateInfo && (
              <div className="template-info-box">
                <div className="info-item success">
                  ✓ Template uploaded! The system will fill all placeholders with content from the article.
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Preview */}
          {templateInfo && (
            <div className="template-section">
              <h3>Step 2: Preview Content (Optional)</h3>
              <p className="template-hint">
                See what content will be extracted from the article.
              </p>
              
              <button
                className="btn-preview"
                onClick={handlePreview}
                disabled={selectedArticles.length === 0}
              >
                👁️ Preview Extracted Content
              </button>

              {showPreview && previewData && (
                <div className="preview-container" style={{ 
                  maxHeight: '400px', 
                  overflow: 'auto', 
                  backgroundColor: '#f5f5f5', 
                  padding: '15px',
                  borderRadius: '8px',
                  marginTop: '15px'
                }}>
                  <h4>Preview for PMID: {previewData.articleInfo?.pmid}</h4>
                  
                  <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
                    <strong>Drug Name:</strong> {previewData.articleInfo?.drugName}<br/>
                    <strong>Title:</strong> {previewData.articleInfo?.title ? String(previewData.articleInfo.title).substring(0, 80) + '...' : 'N/A'}
                  </div>

                  <h5>Content Availability:</h5>
                  <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px' }}>
                    {Object.entries(previewData.extractedData || {}).map(([key, value]) => (
                      <div key={key} style={{ 
                        marginBottom: '8px',
                        padding: '6px',
                        backgroundColor: value === 'Available' ? '#e8f5e9' : '#fff3e0',
                        borderLeft: `3px solid ${value === 'Available' ? '#4caf50' : '#ff9800'}`,
                        borderRadius: '4px'
                      }}>
                        <strong>{key}:</strong> {value}
                        {value === 'Available' && <span style={{ color: '#4caf50', marginLeft: '8px' }}>✓</span>}
                      </div>
                    ))}
                  </div>

                  {previewData.abbreviations && previewData.abbreviations.length > 0 && (
                    <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px' }}>
                      <h5>Abbreviations ({previewData.abbreviations.length}):</h5>
                      <div style={{ fontSize: '0.9em', maxHeight: '150px', overflow: 'auto' }}>
                        {previewData.abbreviations.map((abbr, idx) => (
                          <div key={idx} style={{ marginBottom: '4px' }}>
                            <strong>{abbr.abbr}</strong> - {abbr.fullTerm}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {previewData.message && (
                    <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff3e0', borderRadius: '4px', fontSize: '0.9em' }}>
                      💡 {previewData.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Generate */}
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
                    {article.title ? String(article.title).substring(0, 60) + '...' : 'N/A'}
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
              disabled={!templateInfo || isGenerating || selectedArticles.length === 0}
            >
              {isGenerating ? '⏳ Generating...' : '📥 Generate Document with All Content'}
            </button>

            {selectedArticles.length > 1 && (
              <p className="note">
                Note: Generating for the first selected article. You can generate multiple documents by running this for each article.
              </p>
            )}
            
            <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '0.9em' }}>
              <strong>💡 What will be filled:</strong><br/>
              • Abstract text<br/>
              • Pharmacology, Pharmacokinetics, Toxicology sections<br/>
              • ADME data (Absorption, Distribution, Metabolism, Excretion)<br/>
              • Genotoxicity, Carcinogenicity data<br/>
              • Auto-generated abbreviations table<br/>
              • All placeholders you added to your template
            </div>
          </div>
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
