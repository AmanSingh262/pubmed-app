# PubMed Intelligent Article Filtration System

## What This Project Does
A full-stack web app for searching/filtering PubMed research articles by hierarchical categories (Animal & Human studies), with:
- **Reference Document Search**: Upload PDF/DOC to find similar articles
- **Prevalence Search**: European disease prevalence data for EMA Environmental Risk Assessment (ERA)
- **MeSH Integration**: Uses NCBI MeSH terms for better context understanding
- Relevance scoring, export (CSV/PDF), cart system, and AI-powered document generation via OpenAI

## Tech Stack
- **Backend**: Node.js + Express, PubMed E-utilities API, OpenAI
- **Frontend**: React, axios, react-toastify
- **Build**: concurrently (runs both server:5000 & client:3000)

## Quick Start
```bash
npm run dev          # Start both server + client
npm run server       # Server only (port 5000)
npm run client       # Client only (port 3000)
```

## Key Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/search` | Search PubMed articles |
| GET | `/api/categories` | Get category tree |
| POST | `/api/export` | Export results (CSV/PDF) |
| POST | `/api/reference-doc/upload` | Upload reference PDF/DOC |
| POST | `/api/reference-doc/prevalence-search` | Prevalence-only search (no file) |
| POST | `/api/reference-doc/fetch-abstracts` | Fetch article abstracts |
| POST | `/api/detail-document` | Generate detail doc |
| POST | `/api/drug-stats` | Generate drug stats |

## Project Structure
```
/pubmed
├── client/src/
│   ├── App.js                     # Main component, state management
│   ├── App.css                    # Main styles
│   ├── components/
│   │   ├── SearchBar.js           # Query input
│   │   ├── ResultsDisplay.js      # Article list with pagination
│   │   ├── CategoryTree.js       # Hierarchical category selector
│   │   ├── ReferenceDocUpload.js # Upload PDF to find similar articles
│   │   ├── PrevalenceSearch.js   # Standalone prevalence search (EMA ERA)
│   │   ├── PrevalenceSearch.css  # Prevalence search styles
│   │   └── SelectCart.js         # Cart modal
│   ├── context/CartContext.js    # Cart state (localStorage)
│   └── services/api.js           # Axios wrapper
├── server/
│   ├── index.js                  # Express app
│   ├── routes/
│   │   ├── referenceDoc.js       # PDF upload + prevalence search (main file ~1800 lines)
│   │   ├── search.js             # Article search logic
│   │   ├── detailDocument.js     # Document generation
│   │   └── shortSummaryDoc.js    # Summary generation
│   └── services/
│       ├── meshService.js        # MeSH term lookup (NEW)
│       ├── pubmedService.js      # PubMed API wrapper
│       ├── drugSynonymService.js # Drug synonyms
│       └── rxNormService.js      # RxNorm API
└── .env                          # PORT=5000, OPENAI_API_KEY
```

## Core Features

### 1. Prevalence Search (EMA ERA)
- **Purpose**: Find European disease prevalence data to refine Fpen (Market Penetration Factor)
- **Component**: `PrevalenceSearch.js` - standalone search form
- **Study Type**: Animal / Human toggle
- **Fields**: Disease Name (required), Drug Name (optional), Country, Years
- **Display**: Dual columns - PREVALENCE + ANOTHER

### 2. MeSH Integration (Better Accuracy)
- **Service**: `meshService.js` - fetches MeSH terms from NCBI
- **How it works**:
  1. User enters disease name (e.g., "diabetes")
  2. System fetches MeSH terms from NCBI MeSH database
  3. Builds queries using MeSH Terms + synonyms + related concepts
  4. Searches with multiple strategies: MeSH exact, MeSH major topic, Title/Abstract + MeSH

- **Query Strategies**:
  ```javascript
  // MeSH Exact
  '"diabetes"[MeSH Terms] AND "prevalence"[MeSH Terms]'
  // MeSH Major Topic
  '"diabetes"[MeSH Terms:exp] AND "Europe"[tiab]'
  // Title/Abstract + MeSH
  '("diabetes"[tiab] OR "diabetes"[MeSH Terms]) AND "prevalence"'
  ```

### 3. Reference Document Search
- Upload PDF/DOC to find similar articles
- Uses dual column mode: PREVALENCE + ANOTHER
- Includes prevalence extraction, authority tiers, EMA compliance notes

### 4. Enhanced Article Data
Articles now include:
- `prevalenceData.value` - Extracted % value (e.g., "5.2%")
- `prevalenceData.authorityTier` - 1-4 (1=WHO/GBD/EMA, 2=SysReview, 3=Registry, 4=Peer-reviewed)
- `prevalenceData.emaComplianceNote` - EMA justification text
- Recency boost - newer publications (2021-2026) rank higher

## Key State (App.js)
```javascript
const [query, setQuery] = useState('')
const [studyType, setStudyType] = useState('animal')  // 'animal' | 'human'
const [selectedCategories, setSelectedCategories] = useState([])
const [searchResults, setSearchResults] = useState(null)
const [referenceDocResults, setReferenceDocResults] = useState(null)
const [showReferenceResults, setShowReferenceResults] = useState(false)
const [cartItems, setCartItems] = useCart()
```

## Important Files
- **server/services/meshService.js**: MeSH term lookup with caching
- **server/routes/referenceDoc.js**: Main search logic, dual column handling
- **client/src/components/PrevalenceSearch.js**: Standalone prevalence search UI
- **keywordMappings.json**: Category → MeSH keywords mapping
- **drugSynonyms.json**: Drug name synonyms

## Common Tasks
- **Fix prevalence search**: Check `server/routes/referenceDoc.js` → `router.post('/prevalence-search')`
- **Add MeSH terms**: Edit `server/services/meshService.js`
- **Update prevalence UI**: Edit `client/src/components/PrevalenceSearch.js`
- **Debug export**: `server/routes/export.js`

## Environment
- `.env`: PORT=5000, OPENAI_API_KEY, PUBMED_API_KEY (optional)
- Rate limiting: 100 req/min per IP
- MeSH cache: In-memory Map
- PubMed API: https://eutils.ncbi.nlm.nih.gov/entrez/eutils

## Current Known Limitations
- Rate limiter has trust proxy warning (non-critical)
- MeSH database may not have terms for rare diseases (falls back to keyword search)