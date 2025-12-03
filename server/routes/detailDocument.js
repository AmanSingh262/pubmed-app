const express = require('express');
const router = express.Router();
const { Document, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, HeadingLevel, convertInchesToTwip } = require('docx');
const { Packer } = require('docx');

// OpenAI integration for abstract summarization
const OpenAI = require('openai');

// Initialize OpenAI client (optional - will use fallback if not configured)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

/**
 * Extract category hierarchy from categoryPath
 * Example: "Animal Studies - Pharmacokinetics" -> { main: "Pharmacokinetics", sub: null }
 * Example: "Primary Pharmacodynamics" -> { main: "Pharmacodynamics", sub: "Primary Pharmacodynamics" }
 */
function extractCategoryHierarchy(categoryPath) {
  // Remove "Animal Studies - " or "Human Studies - " prefix
  let cleaned = categoryPath.replace(/^(Animal Studies|Human Studies)\s*-\s*/i, '').trim();
  
  // Check if it's a sub-category (e.g., "Primary Pharmacodynamics")
  const subCategoryPatterns = [
    /^(Primary|Secondary|Tertiary)\s+(.+)$/i,
    /^(\d+\.)\s*(.+)$/
  ];
  
  for (const pattern of subCategoryPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return {
        main: match[2],
        sub: cleaned,
        prefix: match[1]
      };
    }
  }
  
  return {
    main: cleaned,
    sub: null,
    prefix: null
  };
}

/**
 * Generate detailed summary from abstract using ChatGPT
 */
async function generateDetailedSummary(article, categoryName) {
  const abstract = article.abstract || 'No abstract available';
  const title = article.title || 'Untitled';
  const authors = article.authors && article.authors.length > 0 
    ? article.authors[0] 
    : 'Unknown';
  const year = article.publicationDate ? article.publicationDate.split(' ')[0] : 'n.d.';
  
  try {
    // If OpenAI is not configured, use enhanced fallback format
    if (!openai) {
      return formatAbstractFallback(abstract, categoryName, authors, year);
    }
    
    const prompt = `You are a scientific writer. Convert the following research abstract into a detailed summary paragraph for a ${categoryName} section.

ARTICLE ABSTRACT:
"${abstract}"

REQUIREMENTS:
1. Start EXACTLY with: "A study was conducted to evaluate ${categoryName.toLowerCase()}"
2. After the opening, describe the study aim clearly
3. Specify the study type and model used (e.g., "using mice", "in rats", "using C. elegans model", "in human subjects")
4. Present the complete results with specific data and findings in a flowing narrative
5. End EXACTLY with: (${authors} et al, ${year})
6. Write as ONE continuous paragraph
7. Use scientific terminology naturally (species names, genes, compounds will be italicized later)
8. Focus specifically on ${categoryName} findings and data
9. Be comprehensive but maintain academic writing style

EXAMPLE FORMAT:
"A study was conducted to evaluate [category]. The aim was to [specific objective]. [Study type and model]. The results showed [specific findings with data]. [Additional results]. (Author et al, Year)"

Now generate the summary:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a professional scientific writing assistant. You create detailed, accurate summaries from research abstracts following exact formatting requirements. Never add introductory phrases or explanations - only provide the requested summary paragraph."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 600
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating summary with ChatGPT:', error);
    // Use enhanced fallback format
    return formatAbstractFallback(abstract, categoryName, authors, year);
  }
}

/**
 * Format abstract into structured summary when ChatGPT is unavailable
 */
function formatAbstractFallback(abstract, categoryName, authors, year) {
  if (!abstract || abstract === 'No abstract available') {
    return `A study was conducted to evaluate ${categoryName.toLowerCase()}. No abstract available. (${authors} et al, ${year})`;
  }
  
  // Extract key components from abstract
  let studyAim = '';
  let studyType = '';
  let results = '';
  
  // Look for aim/objective/purpose patterns
  const aimPatterns = [
    /(?:aim|objective|purpose|goal)(?:\s+of\s+this\s+study)?\s+(?:was|is|were)\s+to\s+([^.]+)/i,
    /we\s+(?:aimed|sought|investigated|evaluated|examined|assessed|studied)\s+(?:to\s+)?([^.]+)/i,
    /(?:to\s+(?:investigate|evaluate|examine|assess|determine|identify))\s+([^.]+)/i
  ];
  
  for (const pattern of aimPatterns) {
    const match = abstract.match(pattern);
    if (match) {
      studyAim = match[1].trim();
      break;
    }
  }
  
  // Look for study type/model patterns
  const modelPatterns = [
    /(?:using|in|with)\s+(?:the\s+)?(?:nematode\s+)?([A-Z][a-z]+\s+[a-z]+)/,
    /(?:in\s+)?(\d+\s+(?:mice|rats|patients|subjects|participants|animals))/i,
    /(?:in\s+)?(human\s+(?:subjects|patients|participants))/i,
    /(?:in\s+)?(mice|rats|rabbits|dogs|primates|cell\s+culture|tissue)/i,
    /(?:model|system)(?:\s+of)?\s+([^.]+)/i
  ];
  
  for (const pattern of modelPatterns) {
    const match = abstract.match(pattern);
    if (match) {
      studyType = match[0].trim();
      break;
    }
  }
  
  // Look for results patterns
  const resultsPatterns = [
    /(?:results?|findings?|data)\s+(?:showed?|demonstrated?|indicated?|revealed?|suggested?)\s+(?:that\s+)?([^.]+(?:\.[^.]+)?)/i,
    /(?:these|the)\s+(?:data|results|findings)\s+(?:suggest|indicate|show|demonstrate)\s+(?:that\s+)?([^.]+)/i,
    /we\s+(?:found|observed|discovered)\s+(?:that\s+)?([^.]+(?:\.[^.]+)?)/i
  ];
  
  for (const pattern of resultsPatterns) {
    const match = abstract.match(pattern);
    if (match) {
      results = match[0].trim();
      // Get more context if it's too short
      const fullResults = abstract.substring(match.index);
      const sentences = fullResults.split(/\.\s+/).slice(0, 3);
      results = sentences.join('. ');
      break;
    }
  }
  
  // If no results found, take the second half of abstract
  if (!results) {
    const sentences = abstract.split(/\.\s+/);
    const midPoint = Math.floor(sentences.length / 2);
    results = sentences.slice(midPoint).join('. ');
  }
  
  // Construct the formatted summary
  let summary = `A study was conducted to evaluate ${categoryName.toLowerCase()}.`;
  
  if (studyAim) {
    summary += ` The aim was to ${studyAim}.`;
  }
  
  if (studyType) {
    summary += ` The study was conducted ${studyType}.`;
  }
  
  if (results) {
    summary += ` ${results}`;
  } else {
    // If no specific results found, include the whole abstract
    summary += ` ${abstract}`;
  }
  
  // Ensure it ends with a period before citation
  if (!summary.endsWith('.')) {
    summary += '.';
  }
  
  summary += ` (${authors} et al, ${year})`;
  
  return summary;
}

/**
 * Extract biological terms from text for italicization
 */
function extractBiologicalTerms(text) {
  const biologicalPatterns = [
    // Species names (e.g., Caenorhabditis elegans, Homo sapiens, Mus musculus)
    /\b([A-Z][a-z]+\s+[a-z]+)\b/g,
    // Abbreviated species (e.g., C. elegans, H. sapiens, E. coli)
    /\b([A-Z]\.\s+[a-z]+)\b/g,
    // DNA/RNA related
    /\b(DNA|RNA|mRNA|tRNA|rRNA|cDNA|siRNA|miRNA)\b/gi,
    // Latin terms
    /\b(in vitro|in vivo|ex vivo|in situ|de novo|per se|et al)\b/gi,
    // Gene names (e.g., TP53, BRCA1, alpha-synuclein)
    /\b([A-Z]{2,}[0-9]+[A-Z]*)\b/g,
    /\b(alpha|beta|gamma|delta)-[a-z]+\b/gi,
    // Protein/enzyme names with Greek letters or numbers
    /\b([a-z]+-[a-z]+|[A-Z][a-z]+[0-9]+)\b/g
  ];
  
  const terms = new Set();
  biologicalPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      // Exclude common words that match patterns but aren't biological terms
      const term = match[0];
      if (!['A study', 'The aim', 'et al'].includes(term)) {
        terms.add(term);
      }
    }
  });
  
  return Array.from(terms);
}

/**
 * Create formatted text runs with biological terms in italic
 */
function createFormattedTextRuns(text, fontSize = 24) {
  const biologicalTerms = extractBiologicalTerms(text);
  
  if (biologicalTerms.length === 0) {
    return [new TextRun({ text, size: fontSize, font: 'Times New Roman' })];
  }
  
  // Create regex to split text while preserving biological terms
  const pattern = new RegExp(`(${biologicalTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const parts = text.split(pattern);
  
  return parts.map(part => {
    const isItalic = biologicalTerms.includes(part);
    return new TextRun({
      text: part,
      size: fontSize,
      font: 'Times New Roman',
      italics: isItalic
    });
  });
}

/**
 * Test endpoint to check OpenAI API status
 */
router.get('/test-openai', async (req, res) => {
  try {
    if (!openai) {
      return res.json({
        status: 'not_configured',
        message: 'OpenAI API key is not set in environment variables',
        hasApiKey: false
      });
    }

    // Try a minimal API call to test
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: "Say 'API Working'"
        }
      ],
      max_tokens: 10
    });

    res.json({
      status: 'working',
      message: 'OpenAI API is configured and working',
      hasApiKey: true,
      testResponse: completion.choices[0].message.content
    });
  } catch (error) {
    res.json({
      status: 'error',
      message: error.message,
      hasApiKey: !!openai,
      errorType: error.type || 'unknown',
      errorCode: error.code || error.status
    });
  }
});

/**
 * Extract abbreviations from articles
 */
function extractAbbreviations(articles) {
  const abbreviations = {
    'PK': 'Pharmacokinetics',
    'PD': 'Pharmacodynamics',
    'AUC': 'Area Under the Curve',
    'Cmax': 'Maximum Concentration',
    'Tmax': 'Time to Maximum Concentration',
    't1/2': 'Half-life',
    'IV': 'Intravenous',
    'PO': 'Per Os (Oral)',
    'CNS': 'Central Nervous System',
    'CVS': 'Cardiovascular System',
    'RCT': 'Randomized Controlled Trial',
    'LD50': 'Lethal Dose 50%',
    'NOAEL': 'No Observed Adverse Effect Level',
    'LOAEL': 'Lowest Observed Adverse Effect Level'
  };
  
  // Could be enhanced to extract from article text
  return abbreviations;
}

/**
 * Get fixed template structure for Animal Studies
 */
function getAnimalStudiesTemplate() {
  return [
    {
      heading: 'Pharmacodynamics',
      subheadings: [
        'Primary Pharmacodynamics',
        'Secondary Pharmacodynamics'
      ]
    },
    {
      heading: 'Safety Pharmacology',
      subheadings: [
        'Effect on Central Nervous System (CNS)',
        'Effect on Cardiovascular System (CVS)',
        'Other Effects'
      ]
    },
    {
      heading: 'Pharmacokinetics',
      subheadings: [
        'Method of Analysis',
        'Absorption',
        'Distribution',
        'Metabolism',
        'Excretion',
        'Other Pharmacokinetic Studies'
      ]
    },
    {
      heading: 'Toxicology',
      subheadings: [
        'Single Dose Toxicity',
        'Repeat Dose Toxicity',
        'Genotoxicity',
        'Carcinogenicity',
        'Reproductive and Developmental Toxicity',
        'Local Tolerance',
        'Other Toxicity Studies'
      ]
    }
  ];
}

/**
 * Get fixed template structure for Human Studies
 */
function getHumanStudiesTemplate() {
  return [
    {
      heading: 'Pharmacokinetics',
      subheadings: [
        'Method of Analysis',
        'Absorption',
        'Distribution',
        'Metabolism',
        'Excretion',
        'Pharmacokinetics in Special Populations',
        'Pharmacokinetic Drug Interaction'
      ]
    },
    {
      heading: 'Pharmacodynamics',
      subheadings: [
        'Related to Proposed Indications',
        'Pharmacodynamic Drug Interaction'
      ]
    },
    {
      heading: 'Efficacy',
      subheadings: [
        'Placebo-Controlled Studies',
        'Active-Controlled Studies',
        'Uncontrolled Studies',
        'Efficacy in Paediatrics',
        'Dosage'
      ]
    },
    {
      heading: 'Safety',
      subheadings: [
        'Adverse Drug Reactions (ADR)',
        'Pregnancy and Lactation',
        'Overdose',
        'Post-marketing Surveillance'
      ]
    }
  ];
}

/**
 * Match article to template section based on category path and content analysis
 */
function matchArticleToSection(article, categoryPath, studyType = 'animal') {
  const pathLower = categoryPath.toLowerCase();
  const titleLower = (article.title || '').toLowerCase();
  const abstractLower = (article.abstract || '').toLowerCase();
  const combinedText = `${pathLower} ${titleLower} ${abstractLower}`;
  
  // Mapping of keywords to template sections for Animal Studies
  const animalMappings = {
    // Pharmacodynamics
    'primary': { heading: 'Pharmacodynamics', subheading: 'Primary Pharmacodynamics' },
    'primarypharmacodynamics': { heading: 'Pharmacodynamics', subheading: 'Primary Pharmacodynamics' },
    'secondary': { heading: 'Pharmacodynamics', subheading: 'Secondary Pharmacodynamics' },
    'secondarypharmacodynamics': { heading: 'Pharmacodynamics', subheading: 'Secondary Pharmacodynamics' },
    'invivo': { heading: 'Pharmacodynamics', subheading: 'Primary Pharmacodynamics' },
    'invitro': { heading: 'Pharmacodynamics', subheading: 'Primary Pharmacodynamics' },
    'mechanism': { heading: 'Pharmacodynamics', subheading: 'Primary Pharmacodynamics' },
    'mechanismofaction': { heading: 'Pharmacodynamics', subheading: 'Primary Pharmacodynamics' },
    'efficacy': { heading: 'Pharmacodynamics', subheading: 'Primary Pharmacodynamics' },
    'potency': { heading: 'Pharmacodynamics', subheading: 'Primary Pharmacodynamics' },
    'receptor': { heading: 'Pharmacodynamics', subheading: 'Primary Pharmacodynamics' },
    'binding': { heading: 'Pharmacodynamics', subheading: 'Primary Pharmacodynamics' },
    
    // Safety Pharmacology
    'safetypharmacology': { heading: 'Safety Pharmacology', subheading: null },
    'cns': { heading: 'Safety Pharmacology', subheading: 'Effect on Central Nervous System (CNS)' },
    'centralnervous': { heading: 'Safety Pharmacology', subheading: 'Effect on Central Nervous System (CNS)' },
    'nervous': { heading: 'Safety Pharmacology', subheading: 'Effect on Central Nervous System (CNS)' },
    'neurological': { heading: 'Safety Pharmacology', subheading: 'Effect on Central Nervous System (CNS)' },
    'neurobehavioral': { heading: 'Safety Pharmacology', subheading: 'Effect on Central Nervous System (CNS)' },
    'brain': { heading: 'Safety Pharmacology', subheading: 'Effect on Central Nervous System (CNS)' },
    'cvs': { heading: 'Safety Pharmacology', subheading: 'Effect on Cardiovascular System (CVS)' },
    'cardiovascular': { heading: 'Safety Pharmacology', subheading: 'Effect on Cardiovascular System (CVS)' },
    'cardiac': { heading: 'Safety Pharmacology', subheading: 'Effect on Cardiovascular System (CVS)' },
    'heart': { heading: 'Safety Pharmacology', subheading: 'Effect on Cardiovascular System (CVS)' },
    'ecg': { heading: 'Safety Pharmacology', subheading: 'Effect on Cardiovascular System (CVS)' },
    'bloodpressure': { heading: 'Safety Pharmacology', subheading: 'Effect on Cardiovascular System (CVS)' },
    'hemodynamic': { heading: 'Safety Pharmacology', subheading: 'Effect on Cardiovascular System (CVS)' },
    'respiratory': { heading: 'Safety Pharmacology', subheading: 'Other Effects' },
    'renal': { heading: 'Safety Pharmacology', subheading: 'Other Effects' },
    'gastrointestinal': { heading: 'Safety Pharmacology', subheading: 'Other Effects' },
    'hepatic': { heading: 'Safety Pharmacology', subheading: 'Other Effects' },
    'pulmonary': { heading: 'Safety Pharmacology', subheading: 'Other Effects' },
    
    // Pharmacokinetics (Animal)
    'methodofanalysis': { heading: 'Pharmacokinetics', subheading: 'Method of Analysis' },
    'bioanalytical': { heading: 'Pharmacokinetics', subheading: 'Method of Analysis' },
    'analytical': { heading: 'Pharmacokinetics', subheading: 'Method of Analysis' },
    'lcms': { heading: 'Pharmacokinetics', subheading: 'Method of Analysis' },
    'hplc': { heading: 'Pharmacokinetics', subheading: 'Method of Analysis' },
    'absorption': { heading: 'Pharmacokinetics', subheading: 'Absorption' },
    'bioavailability': { heading: 'Pharmacokinetics', subheading: 'Absorption' },
    'oral': { heading: 'Pharmacokinetics', subheading: 'Absorption' },
    'distribution': { heading: 'Pharmacokinetics', subheading: 'Distribution' },
    'tissue': { heading: 'Pharmacokinetics', subheading: 'Distribution' },
    'plasmabinding': { heading: 'Pharmacokinetics', subheading: 'Distribution' },
    'proteinbinding': { heading: 'Pharmacokinetics', subheading: 'Distribution' },
    'volumeofdistribution': { heading: 'Pharmacokinetics', subheading: 'Distribution' },
    'metabolism': { heading: 'Pharmacokinetics', subheading: 'Metabolism' },
    'metabolite': { heading: 'Pharmacokinetics', subheading: 'Metabolism' },
    'biotransformation': { heading: 'Pharmacokinetics', subheading: 'Metabolism' },
    'cyp': { heading: 'Pharmacokinetics', subheading: 'Metabolism' },
    'excretion': { heading: 'Pharmacokinetics', subheading: 'Excretion' },
    'elimination': { heading: 'Pharmacokinetics', subheading: 'Excretion' },
    'clearance': { heading: 'Pharmacokinetics', subheading: 'Excretion' },
    'halflife': { heading: 'Pharmacokinetics', subheading: 'Excretion' },
    'urinary': { heading: 'Pharmacokinetics', subheading: 'Excretion' },
    'fecal': { heading: 'Pharmacokinetics', subheading: 'Excretion' },
    'biliary': { heading: 'Pharmacokinetics', subheading: 'Excretion' },
    
    // Toxicology
    'singledose': { heading: 'Toxicology', subheading: 'Single Dose Toxicity' },
    'singledosetoxicity': { heading: 'Toxicology', subheading: 'Single Dose Toxicity' },
    'acutetoxicity': { heading: 'Toxicology', subheading: 'Single Dose Toxicity' },
    'acute': { heading: 'Toxicology', subheading: 'Single Dose Toxicity' },
    'ld50': { heading: 'Toxicology', subheading: 'Single Dose Toxicity' },
    'repeatdose': { heading: 'Toxicology', subheading: 'Repeat Dose Toxicity' },
    'repeatdosetoxicity': { heading: 'Toxicology', subheading: 'Repeat Dose Toxicity' },
    'subacute': { heading: 'Toxicology', subheading: 'Repeat Dose Toxicity' },
    'subchronic': { heading: 'Toxicology', subheading: 'Repeat Dose Toxicity' },
    'chronic': { heading: 'Toxicology', subheading: 'Repeat Dose Toxicity' },
    'chronictoxicity': { heading: 'Toxicology', subheading: 'Repeat Dose Toxicity' },
    'genotoxicity': { heading: 'Toxicology', subheading: 'Genotoxicity' },
    'mutagenicity': { heading: 'Toxicology', subheading: 'Genotoxicity' },
    'ames': { heading: 'Toxicology', subheading: 'Genotoxicity' },
    'micronucleus': { heading: 'Toxicology', subheading: 'Genotoxicity' },
    'chromosomal': { heading: 'Toxicology', subheading: 'Genotoxicity' },
    'carcinogenicity': { heading: 'Toxicology', subheading: 'Carcinogenicity' },
    'oncogenicity': { heading: 'Toxicology', subheading: 'Carcinogenicity' },
    'tumor': { heading: 'Toxicology', subheading: 'Carcinogenicity' },
    'cancer': { heading: 'Toxicology', subheading: 'Carcinogenicity' },
    'reproductive': { heading: 'Toxicology', subheading: 'Reproductive and Developmental Toxicity' },
    'reproductivetoxicity': { heading: 'Toxicology', subheading: 'Reproductive and Developmental Toxicity' },
    'developmental': { heading: 'Toxicology', subheading: 'Reproductive and Developmental Toxicity' },
    'developmentaltoxicity': { heading: 'Toxicology', subheading: 'Reproductive and Developmental Toxicity' },
    'teratogenicity': { heading: 'Toxicology', subheading: 'Reproductive and Developmental Toxicity' },
    'embryofetal': { heading: 'Toxicology', subheading: 'Reproductive and Developmental Toxicity' },
    'embryotoxicity': { heading: 'Toxicology', subheading: 'Reproductive and Developmental Toxicity' },
    'fetotoxicity': { heading: 'Toxicology', subheading: 'Reproductive and Developmental Toxicity' },
    'prenatal': { heading: 'Toxicology', subheading: 'Reproductive and Developmental Toxicity' },
    'postnatal': { heading: 'Toxicology', subheading: 'Reproductive and Developmental Toxicity' },
    'fertility': { heading: 'Toxicology', subheading: 'Reproductive and Developmental Toxicity' },
    'localtolerance': { heading: 'Toxicology', subheading: 'Local Tolerance' },
    'local': { heading: 'Toxicology', subheading: 'Local Tolerance' },
    'irritation': { heading: 'Toxicology', subheading: 'Local Tolerance' },
    'sensitization': { heading: 'Toxicology', subheading: 'Local Tolerance' },
    'dermal': { heading: 'Toxicology', subheading: 'Local Tolerance' },
    'ocular': { heading: 'Toxicology', subheading: 'Local Tolerance' },
    'skin': { heading: 'Toxicology', subheading: 'Local Tolerance' }
  };
  
  // Mapping of keywords to template sections for Human Studies
  const humanMappings = {
    // Pharmacokinetics (Human)
    'methodofanalysis': { heading: 'Pharmacokinetics', subheading: 'Method of Analysis' },
    'bioanalytical': { heading: 'Pharmacokinetics', subheading: 'Method of Analysis' },
    'absorption': { heading: 'Pharmacokinetics', subheading: 'Absorption' },
    'bioavailability': { heading: 'Pharmacokinetics', subheading: 'Absorption' },
    'distribution': { heading: 'Pharmacokinetics', subheading: 'Distribution' },
    'volumeofdistribution': { heading: 'Pharmacokinetics', subheading: 'Distribution' },
    'metabolism': { heading: 'Pharmacokinetics', subheading: 'Metabolism' },
    'metabolite': { heading: 'Pharmacokinetics', subheading: 'Metabolism' },
    'excretion': { heading: 'Pharmacokinetics', subheading: 'Excretion' },
    'elimination': { heading: 'Pharmacokinetics', subheading: 'Excretion' },
    'clearance': { heading: 'Pharmacokinetics', subheading: 'Excretion' },
    'specialpopulations': { heading: 'Pharmacokinetics', subheading: 'Pharmacokinetics in Special Populations' },
    'elderly': { heading: 'Pharmacokinetics', subheading: 'Pharmacokinetics in Special Populations' },
    'pediatric': { heading: 'Pharmacokinetics', subheading: 'Pharmacokinetics in Special Populations' },
    'renalimpairment': { heading: 'Pharmacokinetics', subheading: 'Pharmacokinetics in Special Populations' },
    'hepaticimpairment': { heading: 'Pharmacokinetics', subheading: 'Pharmacokinetics in Special Populations' },
    'pkdruginteraction': { heading: 'Pharmacokinetics', subheading: 'Pharmacokinetic Drug Interaction' },
    'drugdruginteraction': { heading: 'Pharmacokinetics', subheading: 'Pharmacokinetic Drug Interaction' },
    'cyp': { heading: 'Pharmacokinetics', subheading: 'Pharmacokinetic Drug Interaction' },
    
    // Pharmacodynamics (Human)
    'proposedindications': { heading: 'Pharmacodynamics', subheading: 'Related to Proposed Indications' },
    'indication': { heading: 'Pharmacodynamics', subheading: 'Related to Proposed Indications' },
    'mechanismofaction': { heading: 'Pharmacodynamics', subheading: 'Related to Proposed Indications' },
    'pharmacology': { heading: 'Pharmacodynamics', subheading: 'Related to Proposed Indications' },
    'pddruginteraction': { heading: 'Pharmacodynamics', subheading: 'Pharmacodynamic Drug Interaction' },
    'pharmacodynamicinteraction': { heading: 'Pharmacodynamics', subheading: 'Pharmacodynamic Drug Interaction' },
    
    // Efficacy (Human)
    'placebocontrolled': { heading: 'Efficacy', subheading: 'Placebo-Controlled Studies' },
    'placebo': { heading: 'Efficacy', subheading: 'Placebo-Controlled Studies' },
    'activecontrolled': { heading: 'Efficacy', subheading: 'Active-Controlled Studies' },
    'comparator': { heading: 'Efficacy', subheading: 'Active-Controlled Studies' },
    'uncontrolled': { heading: 'Efficacy', subheading: 'Uncontrolled Studies' },
    'openlabel': { heading: 'Efficacy', subheading: 'Uncontrolled Studies' },
    'paediatrics': { heading: 'Efficacy', subheading: 'Efficacy in Paediatrics' },
    'pediatrics': { heading: 'Efficacy', subheading: 'Efficacy in Paediatrics' },
    'children': { heading: 'Efficacy', subheading: 'Efficacy in Paediatrics' },
    'dosage': { heading: 'Efficacy', subheading: 'Dosage' },
    'dose': { heading: 'Efficacy', subheading: 'Dosage' },
    'doseresponse': { heading: 'Efficacy', subheading: 'Dosage' },
    'efficacy': { heading: 'Efficacy', subheading: 'Placebo-Controlled Studies' },
    'clinical': { heading: 'Efficacy', subheading: 'Placebo-Controlled Studies' },
    'trial': { heading: 'Efficacy', subheading: 'Placebo-Controlled Studies' },
    
    // Safety (Human)
    'adversedrugreactions': { heading: 'Safety', subheading: 'Adverse Drug Reactions (ADR)' },
    'adr': { heading: 'Safety', subheading: 'Adverse Drug Reactions (ADR)' },
    'adverseevents': { heading: 'Safety', subheading: 'Adverse Drug Reactions (ADR)' },
    'sideeffects': { heading: 'Safety', subheading: 'Adverse Drug Reactions (ADR)' },
    'tolerability': { heading: 'Safety', subheading: 'Adverse Drug Reactions (ADR)' },
    'pregnancy': { heading: 'Safety', subheading: 'Pregnancy and Lactation' },
    'lactation': { heading: 'Safety', subheading: 'Pregnancy and Lactation' },
    'breastfeeding': { heading: 'Safety', subheading: 'Pregnancy and Lactation' },
    'overdose': { heading: 'Safety', subheading: 'Overdose' },
    'toxicity': { heading: 'Safety', subheading: 'Overdose' },
    'postmarketing': { heading: 'Safety', subheading: 'Post-marketing Surveillance' },
    'surveillance': { heading: 'Safety', subheading: 'Post-marketing Surveillance' },
    'postmarket': { heading: 'Safety', subheading: 'Post-marketing Surveillance' }
  };
  
  // Main heading mappings (without specific subheading - will be distributed to all subsections)
  const mainHeadingMappings = {
    'pharmacokinetics': { heading: 'Pharmacokinetics', subheading: null },
    'pharmacodynamics': { heading: 'Pharmacodynamics', subheading: null },
    'toxicology': { heading: 'Toxicology', subheading: null },
    'safetypharmacology': { heading: 'Safety Pharmacology', subheading: null },
    'safety': studyType === 'human' ? { heading: 'Safety', subheading: null } : { heading: 'Safety Pharmacology', subheading: null },
    'efficacy': { heading: 'Efficacy', subheading: null }
  };
  
  // Select appropriate mapping based on study type
  const sectionMappings = studyType === 'animal' ? animalMappings : humanMappings;
  
  // Remove all non-alphanumeric characters for matching
  const cleanPath = pathLower.replace(/[^a-z]/g, '');
  const pathParts = pathLower.split(/[.\s_-]+/).filter(p => p);
  
  // Check if it's ONLY a main heading (single word in path, no subcategories)
  if (pathParts.length === 1 && mainHeadingMappings[cleanPath]) {
    return mainHeadingMappings[cleanPath];
  }
  
  // Try exact match on cleaned path first
  if (sectionMappings[cleanPath]) {
    return sectionMappings[cleanPath];
  }
  
  // Try matching individual path parts (from most specific to least specific)
  for (let i = pathParts.length - 1; i >= 0; i--) {
    const cleanPart = pathParts[i].replace(/[^a-z]/g, '');
    if (sectionMappings[cleanPart]) {
      return sectionMappings[cleanPart];
    }
  }
  
  // Check if first part is a main heading
  if (pathParts.length > 0) {
    const firstPart = pathParts[0].replace(/[^a-z]/g, '');
    if (mainHeadingMappings[firstPart]) {
      return mainHeadingMappings[firstPart];
    }
  }
  
  // Try keyword matching in combined text (title + abstract)
  for (const [keyword, mapping] of Object.entries(sectionMappings)) {
    if (combinedText.includes(keyword.replace(/([A-Z])/g, ' $1').toLowerCase())) {
      return mapping;
    }
  }
  
  // Default to first section of the appropriate template
  if (studyType === 'animal') {
    return { heading: 'Pharmacodynamics', subheading: 'Primary Pharmacodynamics' };
  } else {
    return { heading: 'Pharmacokinetics', subheading: 'Method of Analysis' };
  }
}

/**
 * Generate Detail Document
 */
router.post('/generate-detail-document', async (req, res) => {
  try {
    const { cartItems, studyType } = req.body;

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: 'No articles provided' });
    }

    // Filter articles by study type
    const filteredItems = cartItems.filter(item => item.studyType === studyType);

    if (filteredItems.length === 0) {
      return res.status(400).json({ error: `No ${studyType} studies found in cart` });
    }

    // Get the appropriate template
    const template = studyType === 'animal' ? getAnimalStudiesTemplate() : getHumanStudiesTemplate();

    // Organize articles into template structure
    const organizedArticles = {};
    const mainHeadingArticles = {}; // Articles with only main heading, no subheading
    
    template.forEach(section => {
      organizedArticles[section.heading] = {};
      mainHeadingArticles[section.heading] = []; // Initialize array for main heading articles
      section.subheadings.forEach(subheading => {
        organizedArticles[section.heading][subheading] = [];
      });
    });

    // Match each article to appropriate section
    for (const item of filteredItems) {
      const match = matchArticleToSection(item.article, item.categoryPath, studyType);
      
      if (match.heading && organizedArticles[match.heading]) {
        if (match.subheading && organizedArticles[match.heading][match.subheading]) {
          // Specific subheading match
          organizedArticles[match.heading][match.subheading].push(item);
        } else if (!match.subheading) {
          // Main heading only - store separately to appear under main heading
          mainHeadingArticles[match.heading].push(item);
        } else {
          // Subheading not found, add to first subheading
          const firstSubheading = Object.keys(organizedArticles[match.heading])[0];
          if (firstSubheading) {
            organizedArticles[match.heading][firstSubheading].push(item);
          }
        }
      }
    }

    // Extract abbreviations
    const abbreviations = extractAbbreviations(filteredItems.map(i => i.article));

    // Generate document sections
    const sections = [];

    // Title
    sections.push(
      new Paragraph({
        text: `Detail Document - ${studyType.charAt(0).toUpperCase() + studyType.slice(1)} Studies`,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );

    // Abbreviations Table
    sections.push(
      new Paragraph({
        text: 'ABBREVIATIONS',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 }
      })
    );

    const abbrevRows = [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              text: 'Abbreviation', 
              bold: true,
              size: 24,
              font: 'Times New Roman'
            })],
            width: { size: 30, type: 'pct' }
          }),
          new TableCell({
            children: [new Paragraph({ 
              text: 'Full Form', 
              bold: true,
              size: 24,
              font: 'Times New Roman'
            })],
            width: { size: 70, type: 'pct' }
          })
        ]
      }),
      ...Object.entries(abbreviations).map(([abbrev, full]) =>
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ 
                text: abbrev,
                size: 24,
                font: 'Times New Roman'
              })]
            }),
            new TableCell({
              children: [new Paragraph({ 
                text: full,
                size: 24,
                font: 'Times New Roman'
              })]
            })
          ]
        })
      )
    ];

    sections.push(
      new Table({
        rows: abbrevRows,
        width: { size: 100, type: 'pct' },
        margins: {
          top: convertInchesToTwip(0.05),
          bottom: convertInchesToTwip(0.05),
          left: convertInchesToTwip(0.08),
          right: convertInchesToTwip(0.08)
        }
      })
    );

    sections.push(new Paragraph({ text: '', spacing: { after: 400 } }));

    // Generate content following the fixed template
    let mainCounter = 1;
    for (const templateSection of template) {
      // Main heading (a, b, c, d)
      const mainLabel = String.fromCharCode(96 + mainCounter); // 'a', 'b', 'c', etc.
      
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${mainLabel}. ${templateSection.heading}`,
              bold: true,
              size: 28,
              font: 'Times New Roman'
            })
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 200 }
        })
      );

      // Add articles that belong to main heading only (before subsections)
      const mainArticles = mainHeadingArticles[templateSection.heading] || [];
      if (mainArticles.length > 0) {
        for (const item of mainArticles) {
          const summary = await generateDetailedSummary(item.article, templateSection.heading);
          const textRuns = createFormattedTextRuns(summary, 24);
          
          sections.push(
            new Paragraph({
              children: textRuns,
              spacing: { after: 100 },
              alignment: AlignmentType.JUSTIFIED
            })
          );

          // Add PubMed link below the paragraph
          const pmidUrl = item.article.url || `https://pubmed.ncbi.nlm.nih.gov/${item.article.pmid}/`;
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Link: ',
                  size: 20,
                  font: 'Times New Roman',
                  color: '666666'
                }),
                new TextRun({
                  text: pmidUrl,
                  size: 20,
                  font: 'Times New Roman',
                  color: '0563C1',
                  underline: {}
                })
              ],
              spacing: { after: 300 },
              alignment: AlignmentType.LEFT
            })
          );
        }
      }

      // Subheadings (1, 2, 3, etc.)
      let subCounter = 1;
      for (const subheading of templateSection.subheadings) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${subCounter}. ${subheading}`,
                bold: true,
                size: 28,
                font: 'Times New Roman'
              })
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 150 }
          })
        );

        // Get articles for this subheading
        const articlesForSection = organizedArticles[templateSection.heading][subheading] || [];

        if (articlesForSection.length > 0) {
          // Generate summaries for articles in this section
          for (const item of articlesForSection) {
            const summary = await generateDetailedSummary(item.article, subheading);
            const textRuns = createFormattedTextRuns(summary, 24);
            
            sections.push(
              new Paragraph({
                children: textRuns,
                spacing: { after: 100 },
                alignment: AlignmentType.JUSTIFIED
              })
            );

            // Add PubMed link below the paragraph
            const pmidUrl = item.article.url || `https://pubmed.ncbi.nlm.nih.gov/${item.article.pmid}/`;
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Link: ',
                    size: 20,
                    font: 'Times New Roman',
                    color: '666666'
                  }),
                  new TextRun({
                    text: pmidUrl,
                    size: 20,
                    font: 'Times New Roman',
                    color: '0563C1',
                    underline: {}
                  })
                ],
                spacing: { after: 300 },
                alignment: AlignmentType.LEFT
              })
            );
          }
        } else {
          // No articles for this section - leave it empty (template structure remains)
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: '',
                  size: 24,
                  font: 'Times New Roman'
                })
              ],
              spacing: { after: 200 }
            })
          );
        }

        subCounter++;
      }

      mainCounter++;
    }

    // References section
    sections.push(
      new Paragraph({
        text: '',
        spacing: { before: 400 }
      })
    );

    sections.push(
      new Paragraph({
        text: 'REFERENCES',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 }
      })
    );

    let refCounter = 1;
    for (const item of filteredItems) {
      const article = item.article;
      const authors = article.authors && article.authors.length > 0
        ? article.authors.slice(0, 6).join(', ') + (article.authors.length > 6 ? ', et al.' : '')
        : 'Unknown authors';
      const year = article.publicationDate ? article.publicationDate.split(' ')[0] : 'n.d.';
      const title = article.title || 'Untitled';
      const journal = article.journal || 'Unknown journal';
      const pmid = article.pmid;
      const doi = article.doi || '';
      const url = article.url || `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`;

      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${refCounter}. `,
              size: 24,
              font: 'Times New Roman'
            }),
            new TextRun({
              text: `${authors} `,
              size: 24,
              font: 'Times New Roman'
            }),
            new TextRun({
              text: `(${year}). `,
              size: 24,
              font: 'Times New Roman'
            }),
            new TextRun({
              text: `${title}. `,
              size: 24,
              font: 'Times New Roman'
            }),
            new TextRun({
              text: `${journal}. `,
              size: 24,
              font: 'Times New Roman',
              italics: true
            }),
            new TextRun({
              text: `PMID: ${pmid}. `,
              size: 24,
              font: 'Times New Roman'
            }),
            ...(doi ? [
              new TextRun({
                text: `DOI: ${doi}. `,
                size: 24,
                font: 'Times New Roman'
              })
            ] : []),
            new TextRun({
              text: url,
              size: 24,
              font: 'Times New Roman',
              color: '0563C1',
              underline: {}
            })
          ],
          spacing: { after: 200 },
          indent: {
            left: convertInchesToTwip(0),
            hanging: convertInchesToTwip(0.5)
          },
          alignment: AlignmentType.LEFT
        })
      );

      refCounter++;
    }

    // Create document
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1)
            }
          }
        },
        children: sections
      }]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=Detail_Document_${studyType}_Studies_${new Date().toISOString().split('T')[0]}.docx`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);

  } catch (error) {
    console.error('Error generating detail document:', error);
    res.status(500).json({ 
      error: 'Failed to generate detail document',
      details: error.message 
    });
  }
});

// Export both router and helper function
module.exports = router;
module.exports.matchArticleToSection = matchArticleToSection;
