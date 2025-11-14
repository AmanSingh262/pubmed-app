import React from 'react';
import './StudyTypeSelector.css';
import { FaPaw, FaUserMd } from 'react-icons/fa';

function StudyTypeSelector({ studyType, setStudyType, disabled }) {
  return (
    <div className="study-type-selector">
      <button
        className={`study-type-btn ${studyType === 'animal' ? 'active' : ''}`}
        onClick={() => setStudyType('animal')}
        disabled={disabled}
      >
        <FaPaw className="study-icon" />
        <div>
          <div className="study-title">Animal Studies</div>
          <div className="study-subtitle">Pharmacodynamics, Toxicology, PK</div>
        </div>
      </button>

      <button
        className={`study-type-btn ${studyType === 'human' ? 'active' : ''}`}
        onClick={() => setStudyType('human')}
        disabled={disabled}
      >
        <FaUserMd className="study-icon" />
        <div>
          <div className="study-title">Human Studies</div>
          <div className="study-subtitle">Clinical Trials, Efficacy, Safety</div>
        </div>
      </button>
    </div>
  );
}

export default StudyTypeSelector;
