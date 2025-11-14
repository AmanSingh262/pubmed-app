# PubMed Intelligent Article Filtration System

A comprehensive web application for intelligent filtering of PubMed research articles based on hierarchical research categories.

## Features

- 🔍 Intelligent search with PubMed API integration
- 📊 Hierarchical category filtering (Animal & Human Studies)
- 🎯 Advanced keyword matching with MeSH terms
- ⚡ Fast article ranking algorithm
- 📈 Relevance scoring and highlighting
- 💾 Export results to CSV/PDF
- 🔖 Save search history
- 📚 Citation export (BibTeX, RIS, EndNote)

## Tech Stack

### Backend
- Node.js + Express
- PubMed E-utilities API
- Node-Cache for performance
- Rate limiting

### Frontend
- React.js
- Tailwind CSS
- Axios
- React Router

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm run install-all
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your NCBI API key
```

4. Start the application:
```bash
npm run dev
```

The backend will run on `http://localhost:5000` and the frontend on `http://localhost:3000`.

## API Endpoints

### POST /api/search
Search PubMed articles
```json
{
  "query": "cefixime",
  "category": "animal",
  "subcategory": "pharmacodynamics.primary.invivo",
  "maxResults": 20
}
```

### GET /api/categories
Get all available categories and their keyword mappings

### POST /api/export
Export filtered results

## Category Structure

### Animal Studies
- Pharmacodynamics (Primary, Secondary)
- Safety Pharmacology (CNS, CVS, Other)
- Pharmacokinetics (ADME)
- Toxicology (Single dose, Repeat dose, etc.)

### Human Studies
- Pharmacokinetics (ADME, Special Populations)
- Pharmacodynamics (Indications, Interactions)
- Efficacy (RCTs, Paediatrics)
- Safety (ADRs, Pregnancy, Overdose)

## Performance

- Handles 200+ articles in <5 seconds
- Intelligent caching for repeated searches
- Rate limiting to comply with NCBI guidelines

## License

MIT
