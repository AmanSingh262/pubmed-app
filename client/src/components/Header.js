import React from 'react';
import './Header.css';
import { FaFlask, FaGithub } from 'react-icons/fa';

function Header() {
  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <FaFlask className="logo-icon" />
            <div>
              <h1>PubMed Intelligent Filter</h1>
              <p className="tagline">Smart Research Article Filtration System</p>
            </div>
          </div>
          <div className="header-actions">
            <a
              href="https://pubmed.ncbi.nlm.nih.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="header-link"
            >
              PubMed
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="header-link"
            >
              <FaGithub size={20} />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
