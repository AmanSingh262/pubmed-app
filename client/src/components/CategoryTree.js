import React, { useState } from 'react';
import './CategoryTree.css';
import { FaChevronDown, FaChevronRight, FaCheck } from 'react-icons/fa';

function CategoryTree({ studyType, categories, selectedCategories, onToggleCategory, disabled }) {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedSubcategories, setExpandedSubcategories] = useState({});

  const studyData = studyType === 'animal' ? categories.animalStudies : categories.humanStudies;

  if (!studyData) {
    return <div className="loading-text">Loading categories...</div>;
  }

  const toggleCategory = (catKey) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catKey]: !prev[catKey]
    }));
  };

  const toggleSubcategory = (subKey) => {
    setExpandedSubcategories(prev => ({
      ...prev,
      [subKey]: !prev[subKey]
    }));
  };

  const handleToggleCategory = (categoryData) => {
    if (!disabled) {
      onToggleCategory(categoryData);
    }
  };

  const isSelected = (path) => {
    return selectedCategories.some(cat => cat.path === path);
  };

  return (
    <div className={`category-tree ${studyType === 'animal' ? 'study-animal' : 'study-human'}`}>
      {studyData.categories.map((category) => (
        <div key={category.key} className="category-item">
          <div className="category-header-wrapper">
            <div
              className="category-header"
              onClick={() => toggleCategory(category.key)}
            >
              <span className="category-icon">
                {expandedCategories[category.key] ? <FaChevronDown /> : <FaChevronRight />}
              </span>
              <span className="category-name">{category.name}</span>
            </div>
            
            {/* Allow selecting the main category heading */}
            <div
              className={`category-checkbox ${isSelected(category.key) ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => handleToggleCategory({ 
                key: category.key, 
                name: category.name, 
                path: category.key 
              })}
              title="Select this main category"
            >
              {isSelected(category.key) && <FaCheck className="check-icon" />}
            </div>
          </div>

          {expandedCategories[category.key] && category.subcategories && (
            <div className="subcategory-list">
              {category.subcategories.map((subcategory) => (
                <div key={subcategory.key} className="subcategory-item">
                  <div className="subcategory-header-wrapper">
                    <div
                      className="subcategory-header"
                      onClick={() => toggleSubcategory(subcategory.path)}
                    >
                      <span className="subcategory-icon">
                        {expandedSubcategories[subcategory.path] ? <FaChevronDown /> : <FaChevronRight />}
                      </span>
                      <span className="subcategory-name">{subcategory.name}</span>
                    </div>
                    
                    {/* Allow selecting subcategory */}
                    <div
                      className={`category-checkbox ${isSelected(subcategory.path) ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                      onClick={() => handleToggleCategory(subcategory)}
                      title="Select this subcategory"
                    >
                      {isSelected(subcategory.path) && <FaCheck className="check-icon" />}
                    </div>
                  </div>

                  {expandedSubcategories[subcategory.path] && (
                    <div className="type-list">
                      {subcategory.types && subcategory.types.length > 0 ? (
                        subcategory.types.map((type) => (
                          <div
                            key={type.key}
                            className={`type-item ${isSelected(type.path) ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                            onClick={() => handleToggleCategory(type)}
                          >
                            <span className="type-name">{type.name}</span>
                            {isSelected(type.path) && <FaCheck className="check-icon" />}
                          </div>
                        ))
                      ) : (
                        <div
                          className={`type-item ${isSelected(subcategory.path) ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                          onClick={() => handleToggleCategory(subcategory)}
                        >
                          <span className="type-name">{subcategory.name}</span>
                          {isSelected(subcategory.path) && <FaCheck className="check-icon" />}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default CategoryTree;
