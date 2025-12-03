const express = require('express');
const router = express.Router();
const { 
  Document, 
  Paragraph, 
  Table, 
  TableRow, 
  TableCell, 
  TextRun, 
  HeadingLevel, 
  AlignmentType,
  WidthType,
  BorderStyle,
  VerticalAlign,
  Packer,
  convertInchesToTwip
} = require('docx');
const OpenAI = require('openai');

// Initialize OpenAI
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

// Import the matching function from detailDocument
const detailDocModule = require('./detailDocument');
const matchArticleToSection = detailDocModule.matchArticleToSection;

/**
 * Generate short summary using ChatGPT
 */
async function generateShortSummary(fullAbstract, sectionType) {
  if (!openai) {
    // Fallback: extract first 2-3 sentences
    const sentences = fullAbstract.match(/[^.!?]+[.!?]+/g) || [];
    return sentences.slice(0, 3).join(' ').trim();
  }

  try {
    const prompt = `You are a medical research summarizer. Given the following detailed abstract from a ${sectionType} study, provide a concise SHORT SUMMARY (2-3 sentences) that captures:
1. The main objective
2. Key methodology
3. Primary results with specific data/numbers

Keep it professional, scientific, and under 150 words.

ABSTRACT:
${fullAbstract}

SHORT SUMMARY:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('ChatGPT summary error:', error.message);
    // Fallback
    const sentences = fullAbstract.match(/[^.!?]+[.!?]+/g) || [];
    return sentences.slice(0, 3).join(' ').trim();
  }
}

/**
 * Extract table data from articles for a specific heading
 */
async function extractTableDataForHeading(articles, headingName, studyType) {
  const tableData = [];
  
  for (const item of articles) {
    const article = item.article;
    
    // Generate short summary from the full abstract
    const shortSummary = await generateShortSummary(article.abstract || '', headingName);
    
    // Extract study details based on study type
    let rowData = {};
    
    if (studyType === 'animal') {
      // Animal study table format
      rowData = {
        typeOfStudy: item.categoryPath || headingName,
        speciesStrain: extractSpeciesStrain(article),
        methodOfAdmin: extractMethodOfAdmin(article),
        durationDosing: extractDurationDosing(article),
        doses: extractDoses(article),
        glpCompliance: extractGLPCompliance(article),
        testingFacility: extractTestingFacility(article),
        studyNumber: article.pmid || '',
        location: extractLocation(article),
        shortSummary: shortSummary,
        reference: formatReference(article)
      };
    } else {
      // Human study table format
      rowData = {
        typeOfStudy: item.categoryPath || headingName,
        testSystem: extractTestSystem(article),
        methodOfAdmin: extractMethodOfAdmin(article),
        doses: extractDoses(article),
        genderNo: extractGenderNumber(article),
        noteworthyFindings: extractNoteworthyFindings(article),
        glpCompliance: extractGLPCompliance(article),
        studyNumber: article.pmid || '',
        shortSummary: shortSummary,
        reference: formatReference(article)
      };
    }
    
    tableData.push(rowData);
  }
  
  return tableData;
}

// Helper functions to extract information from articles
function extractSpeciesStrain(article) {
  const text = (article.abstract || '') + ' ' + (article.title || '');
  const speciesPatterns = /\b(mice|rats|rabbits|dogs|monkeys|guinea pigs?|hamsters|C57BL\/6|Sprague-Dawley|Wistar)\b/gi;
  const matches = text.match(speciesPatterns);
  return matches ? [...new Set(matches.map(m => m.toLowerCase()))].join(', ') : '(2)';
}

function extractMethodOfAdmin(article) {
  const text = (article.abstract || '').toLowerCase();
  const methods = ['oral', 'intravenous', 'subcutaneous', 'intramuscular', 'topical', 'inhalation', 'i.v.', 'p.o.', 's.c.', 'i.m.'];
  for (const method of methods) {
    if (text.includes(method)) {
      return method.toUpperCase();
    }
  }
  return '';
}

function extractDurationDosing(article) {
  const text = article.abstract || '';
  const durationPattern = /(\d+)\s*(day|week|month|hour)s?/gi;
  const match = text.match(durationPattern);
  return match ? match[0] : '';
}

function extractDoses(article) {
  const text = article.abstract || '';
  const dosePattern = /(\d+\.?\d*)\s*(mg\/kg|g\/kg|µg\/kg|mg|g)/gi;
  const matches = text.match(dosePattern);
  return matches ? matches.slice(0, 3).join(', ') : '';
}

function extractGLPCompliance(article) {
  const text = (article.abstract || '').toLowerCase();
  if (text.includes('glp') || text.includes('good laboratory practice')) {
    return 'Yes';
  }
  return '';
}

function extractTestingFacility(article) {
  const authors = article.authors || [];
  return authors.length > 0 ? authors[0] : '';
}

function extractLocation(article) {
  // Try to extract location from affiliation or journal
  return '(3)';
}

function extractTestSystem(article) {
  const text = article.abstract || '';
  if (text.toLowerCase().includes('human') || text.toLowerCase().includes('patient')) {
    return 'Human';
  }
  return '';
}

function extractGenderNumber(article) {
  const text = article.abstract || '';
  const genderPattern = /(\d+)\s*(male|female|men|women|subjects|participants|patients)/gi;
  const matches = text.match(genderPattern);
  return matches ? matches[0] : '';
}

function extractNoteworthyFindings(article) {
  // Extract key findings - first sentence of results
  const text = article.abstract || '';
  const resultsMatch = text.match(/results?:?\s*([^.]+\.)/i);
  return resultsMatch ? resultsMatch[1] : '';
}

function formatReference(article) {
  const authors = article.authors && article.authors.length > 0
    ? article.authors.slice(0, 3).join(', ') + (article.authors.length > 3 ? ', et al.' : '')
    : 'Unknown authors';
  const year = article.publicationDate ? article.publicationDate.split(' ')[0] : 'n.d.';
  return `${authors} (${year})`;
}

/**
 * Create table for Animal Studies (based on template images)
 */
function createAnimalStudyTable(tableData, headingName) {
  const rows = [];
  
  // Header row
  rows.push(
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ text: 'Type of Study', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: 'D3D3D3' }
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Species and Strain', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: 'D3D3D3' }
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Method of Administration', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: 'D3D3D3' }
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Duration of Dosing', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: 'D3D3D3' }
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Doses (mg/kg)', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: 'D3D3D3' }
        }),
        new TableCell({
          children: [new Paragraph({ text: 'GLP Compliance', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: 'D3D3D3' }
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Testing Facility', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: 'D3D3D3' }
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Study Number(3)', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: 'D3D3D3' }
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Location Vol. Section', bold: true, size: 20 })],
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: 'D3D3D3' }
        })
      ]
    })
  );
  
  // Data rows
  for (const data of tableData) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: data.typeOfStudy, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.speciesStrain, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.methodOfAdmin, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.durationDosing, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.doses, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.glpCompliance, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.testingFacility, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.studyNumber, size: 18 })] }),
          new TableCell({ children: [new Paragraph({ text: data.location, size: 18 })] })
        ]
      })
    );
  }
  
  return new Table({
    rows: rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 }
    }
  });
}

/**
 * Create table for Human Studies
 */
function createHumanStudyTable(tableData, headingName) {
  const rows = [];
  
  // Header row - adjusted based on the section type
  if (headingName === 'Safety Pharmacology') {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Organ Systems Evaluated', bold: true, size: 20 })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: 'D3D3D3' }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Species/Strain', bold: true, size: 20 })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: 'D3D3D3' }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Method of Admin.', bold: true, size: 20 })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: 'D3D3D3' }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Doses (mg/kg)', bold: true, size: 20 })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: 'D3D3D3' }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Gender and No. per Group', bold: true, size: 20 })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: 'D3D3D3' }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Noteworthy Findings', bold: true, size: 20 })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: 'D3D3D3' }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'GLP Compliance', bold: true, size: 20 })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: 'D3D3D3' }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Study Number(3)', bold: true, size: 20 })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: 'D3D3D3' }
          })
        ]
      })
    );
  } else {
    // Standard header for other sections
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Type of Study', bold: true, size: 20 })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: 'D3D3D3' }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Test System', bold: true, size: 20 })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: 'D3D3D3' }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Method of Administration', bold: true, size: 20 })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: 'D3D3D3' }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Testing Facility', bold: true, size: 20 })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: 'D3D3D3' }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Study Number', bold: true, size: 20 })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: 'D3D3D3' }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Location Vol. Section', bold: true, size: 20 })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: 'D3D3D3' }
          })
        ]
      })
    );
  }
  
  // Data rows
  for (const data of tableData) {
    if (headingName === 'Safety Pharmacology') {
      rows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: data.typeOfStudy, size: 18 })] }),
            new TableCell({ children: [new Paragraph({ text: data.speciesStrain, size: 18 })] }),
            new TableCell({ children: [new Paragraph({ text: data.methodOfAdmin, size: 18 })] }),
            new TableCell({ children: [new Paragraph({ text: data.doses, size: 18 })] }),
            new TableCell({ children: [new Paragraph({ text: data.genderNo, size: 18 })] }),
            new TableCell({ children: [new Paragraph({ text: data.noteworthyFindings, size: 18 })] }),
            new TableCell({ children: [new Paragraph({ text: data.glpCompliance, size: 18 })] }),
            new TableCell({ children: [new Paragraph({ text: data.studyNumber, size: 18 })] })
          ]
        })
      );
    } else {
      rows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: data.typeOfStudy, size: 18 })] }),
            new TableCell({ children: [new Paragraph({ text: data.testSystem, size: 18 })] }),
            new TableCell({ children: [new Paragraph({ text: data.methodOfAdmin, size: 18 })] }),
            new TableCell({ children: [new Paragraph({ text: data.testingFacility, size: 18 })] }),
            new TableCell({ children: [new Paragraph({ text: data.studyNumber, size: 18 })] }),
            new TableCell({ children: [new Paragraph({ text: data.location, size: 18 })] })
          ]
        })
      );
    }
  }
  
  return new Table({
    rows: rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 }
    }
  });
}

/**
 * Get template structure (same as detail document)
 */
function getAnimalStudiesTemplate() {
  return [
    { heading: 'Pharmacodynamics', subheadings: ['Primary Pharmacodynamics', 'Secondary Pharmacodynamics'] },
    { heading: 'Safety Pharmacology', subheadings: ['Effect on Central Nervous System (CNS)', 'Effect on Cardiovascular System (CVS)', 'Other Effects'] },
    { heading: 'Pharmacokinetics', subheadings: ['Method of Analysis', 'Absorption', 'Distribution', 'Metabolism', 'Excretion', 'Other Pharmacokinetic Studies'] },
    { heading: 'Toxicology', subheadings: ['Single Dose Toxicity', 'Repeat Dose Toxicity', 'Genotoxicity', 'Carcinogenicity', 'Reproductive and Developmental Toxicity', 'Local Tolerance', 'Other Toxicity Studies'] }
  ];
}

function getHumanStudiesTemplate() {
  return [
    { heading: 'Pharmacokinetics', subheadings: ['Method of Analysis', 'Absorption', 'Distribution', 'Metabolism', 'Excretion', 'Pharmacokinetics in Special Populations', 'Pharmacokinetic Drug Interaction'] },
    { heading: 'Pharmacodynamics', subheadings: ['Related to Proposed Indications', 'Pharmacodynamic Drug Interaction'] },
    { heading: 'Efficacy', subheadings: ['Placebo-Controlled Studies', 'Active-Controlled Studies', 'Uncontrolled Studies', 'Efficacy in Paediatrics', 'Dosage'] },
    { heading: 'Safety', subheadings: ['Adverse Drug Reactions (ADR)', 'Pregnancy and Lactation', 'Overdose', 'Post-marketing Surveillance'] }
  ];
}

/**
 * Generate Short Summary Document
 */
router.post('/generate-short-summary', async (req, res) => {
  try {
    const { cartItems, studyType } = req.body;

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: 'No articles provided' });
    }

    const filteredItems = cartItems.filter(item => item.studyType === studyType);
    if (filteredItems.length === 0) {
      return res.status(400).json({ error: `No ${studyType} studies found in cart` });
    }

    const template = studyType === 'animal' ? getAnimalStudiesTemplate() : getHumanStudiesTemplate();
    
    // Organize articles by heading and subheading
    const organizedArticles = {};
    template.forEach(section => {
      organizedArticles[section.heading] = {};
      section.subheadings.forEach(subheading => {
        organizedArticles[section.heading][subheading] = [];
      });
    });

    // Match each article to appropriate section
    for (const item of filteredItems) {
      const match = matchArticleToSection(item.article, item.categoryPath, studyType);
      
      if (match.heading && organizedArticles[match.heading]) {
        if (match.subheading && organizedArticles[match.heading][match.subheading]) {
          organizedArticles[match.heading][match.subheading].push(item);
        } else if (!match.subheading) {
          // Add to first subheading if no specific match
          const firstSubheading = Object.keys(organizedArticles[match.heading])[0];
          if (firstSubheading) {
            organizedArticles[match.heading][firstSubheading].push(item);
          }
        }
      }
    }

    const sections = [];

    // Title
    sections.push(
      new Paragraph({
        text: `Short Summary Document - ${studyType.charAt(0).toUpperCase() + studyType.slice(1)} Studies`,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );

    // Generate content for each main heading
    let mainCounter = 1;
    for (const templateSection of template) {
      const mainLabel = String.fromCharCode(96 + mainCounter); // 'a', 'b', 'c', etc.
      
      // 1. Main heading (e.g., "1. a. Pharmacodynamics")
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${mainCounter}. ${mainLabel}. ${templateSection.heading}`,
              bold: true,
              size: 28,
              font: 'Times New Roman'
            })
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 200 }
        })
      );

      // Collect all articles for this main heading
      const allHeadingArticles = [];
      Object.values(organizedArticles[templateSection.heading]).forEach(articles => {
        allHeadingArticles.push(...articles);
      });

      if (allHeadingArticles.length > 0) {
        // 1.1 Table heading
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${mainCounter}.1 Table with all articles`,
                bold: true,
                size: 24,
                font: 'Times New Roman'
              })
            ],
            spacing: { before: 150, after: 100 }
          })
        );

        // Generate table data for all articles in this heading
        const tableData = await extractTableDataForHeading(allHeadingArticles, templateSection.heading, studyType);
        
        // Create table
        const table = studyType === 'animal' 
          ? createAnimalStudyTable(tableData, templateSection.heading)
          : createHumanStudyTable(tableData, templateSection.heading);
        
        sections.push(table);
        sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));

        // 1.2 Short summaries heading
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${mainCounter}.2 Short summaries with references`,
                bold: true,
                size: 24,
                font: 'Times New Roman'
              })
            ],
            spacing: { before: 200, after: 150 }
          })
        );

        // 1.2.1, 1.2.2, etc. - Subsection summaries
        let subCounter = 1;
        for (const subheading of templateSection.subheadings) {
          const subheadingArticles = organizedArticles[templateSection.heading][subheading] || [];
          
          if (subheadingArticles.length > 0) {
            // Subsection heading (e.g., "1.2.1 Primary Pharmacodynamics")
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${mainCounter}.2.${subCounter} ${subheading}`,
                    bold: true,
                    size: 22,
                    font: 'Times New Roman'
                  })
                ],
                spacing: { before: 150, after: 100 }
              })
            );

            // Generate short summaries for each article in this subsection
            for (const item of subheadingArticles) {
              const shortSummary = await generateShortSummary(item.article.abstract || '', subheading);
              const reference = formatReference(item.article);
              
              sections.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: shortSummary + ' ',
                      size: 22,
                      font: 'Times New Roman'
                    }),
                    new TextRun({
                      text: reference,
                      size: 22,
                      font: 'Times New Roman',
                      italics: true
                    })
                  ],
                  spacing: { after: 100 },
                  alignment: AlignmentType.JUSTIFIED
                })
              );

              // Add PubMed link below each summary
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
                  spacing: { after: 250 },
                  alignment: AlignmentType.LEFT
                })
              );
            }
          }
          
          subCounter++;
        }
      }

      mainCounter++;
    }

    // 5. References section
    sections.push(
      new Paragraph({
        text: '',
        spacing: { before: 400 }
      })
    );

    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${mainCounter}. REFERENCES`,
            bold: true,
            size: 28,
            font: 'Times New Roman'
          })
        ],
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
    res.setHeader('Content-Disposition', `attachment; filename=Short_Summary_${studyType}_Studies_${new Date().toISOString().split('T')[0]}.docx`);
    
    res.send(buffer);

  } catch (error) {
    console.error('Error generating short summary document:', error);
    res.status(500).json({ 
      error: 'Failed to generate short summary document',
      details: error.message 
    });
  }
});

module.exports = router;
