import React from 'react';
import './StudyTypeSelector.css';
import { FaPaw, FaUserMd } from 'react-icons/fa';

function StudyTypeSelector({ studyType, setStudyType, disabled, searchFilters, setSearchFilters }) {
  const handleVerificationToggle = (type) => {
    if (type === 'animal') {
      setSearchFilters({ ...searchFilters, verifyAnimalStudy: !searchFilters.verifyAnimalStudy });
    } else {
      setSearchFilters({ ...searchFilters, verifyHumanStudy: !searchFilters.verifyHumanStudy });
    }
  };

  const handleStudyTypeChange = (type) => {
    setStudyType(type);
    // Auto-enable verification when switching study type
    if (type === 'animal') {
      setSearchFilters({ ...searchFilters, verifyAnimalStudy: true, verifyHumanStudy: false });
    } else {
      setSearchFilters({ ...searchFilters, verifyHumanStudy: true, verifyAnimalStudy: false });
    }
  };

  return (
    <div className="study-type-selector">
      <div className="study-type-card">
        <button
          className={`study-type-btn ${studyType === 'animal' ? 'active' : ''}`}
          onClick={() => handleStudyTypeChange('animal')}
          disabled={disabled}
        >
          <FaPaw className="study-icon" />
          <div>
            <div className="study-title">Animal Studies</div>
            <div className="study-subtitle">Pharmacodynamics, Toxicology, PK</div>
          </div>
        </button>
        {studyType === 'animal' && (
          <label className="verification-checkbox-inline" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={searchFilters?.verifyAnimalStudy || false}
              onChange={() => handleVerificationToggle('animal')}
              disabled={disabled}
            />
            <span>Strict Animal Study Only</span>
          </label>
        )}
      </div>

      <div className="study-type-card">
        <button
          className={`study-type-btn ${studyType === 'human' ? 'active' : ''}`}
          onClick={() => handleStudyTypeChange('human')}
          disabled={disabled}
        >
          <FaUserMd className="study-icon" />
          <div>
            <div className="study-title">Human Studies</div>
            <div className="study-subtitle">Clinical Trials, Efficacy, Safety</div>
          </div>
        </button>
        {studyType === 'human' && (
          <label className="verification-checkbox-inline" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={searchFilters?.verifyHumanStudy || false}
              onChange={() => handleVerificationToggle('human')}
              disabled={disabled}
            />
            <span>Strict Human Study Only</span>
          </label>
        )}
      </div>
    </div>
  );
}

export default StudyTypeSelector;
