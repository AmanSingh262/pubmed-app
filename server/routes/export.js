const express = require('express');
const router = express.Router();
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  convertInchesToTwip
} = require('docx');

/**
 * Helper function to format citations
 */
function formatCitation(article, style) {
  const authors = article.authors || [];
  const title = article.title || 'Untitled';
  const journal = article.journal || '';
  const year = article.publicationDate ? article.publicationDate.split(' ')[0] : 'n.d.';
  const pmid = article.pmid || '';
  const url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

  // Format authors based on style
  let authorString = '';
  
  if (style === 'APA') {
    // APA: Last, F. M., Last, F. M., & Last, F. M.
    if (authors.length === 0) {
      authorString = 'Unknown Author';
    } else if (authors.length === 1) {
      authorString = authors[0];
    } else if (authors.length === 2) {
      authorString = `${authors[0]} & ${authors[1]}`;
    } else {
      authorString = authors.slice(0, -1).join(', ') + ', & ' + authors[authors.length - 1];
    }
    return `${authorString}. (${year}). ${title}. ${journal}. ${url}`;
    
  } else if (style === 'MLA') {
    // MLA: Last, First M. "Title." Journal (Year): n. pag. Web.
    authorString = authors.length > 0 ? authors[0] : 'Unknown Author';
    if (authors.length > 1) {
      authorString += ', et al';
    }
    return `${authorString}. "${title}." ${journal} (${year}): n. pag. Web. ${url}`;
    
  } else if (style === 'Chicago') {
    // Chicago: Last, First M. "Title." Journal (Year): pages.
    authorString = authors.length > 0 ? authors[0] : 'Unknown Author';
    if (authors.length > 1) {
      authorString += ', et al';
    }
    return `${authorString}. "${title}." ${journal} (${year}). ${url}`;
    
  } else if (style === 'Vancouver') {
    // Vancouver: Authors. Title. Journal. Year;PMID.
    if (authors.length === 0) {
      authorString = 'Unknown Author';
    } else if (authors.length <= 6) {
      authorString = authors.join(', ');
    } else {
      authorString = authors.slice(0, 6).join(', ') + ', et al';
    }
    return `${authorString}. ${title}. ${journal}. ${year}; PMID: ${pmid}. Available from: ${url}`;
  }
  
  // Default fallback
  return `${authors.join(', ')}. ${title}. ${journal}. ${year}. ${url}`;
}

/**
 * POST /api/export/unified-word
 * Export articles from cart (grouped by category) to Microsoft Word format
 */
router.post('/unified-word', async (req, res) => {
  try {
    const { groupedArticles, formatting } = req.body;

    if (!groupedArticles || typeof groupedArticles !== 'object' || Object.keys(groupedArticles).length === 0) {
      return res.status(400).json({ error: 'No grouped articles provided' });
    }

    // Convert alignment string to docx enum
    const alignmentMap = {
      'left': AlignmentType.LEFT,
      'center': AlignmentType.CENTER,
      'right': AlignmentType.RIGHT,
      'justify': AlignmentType.JUSTIFIED
    };

    const alignment = alignmentMap[formatting.alignment] || AlignmentType.JUSTIFIED;
    const citationStyle = formatting.citationStyle || 'APA';

    // Create document sections
    const sections = [];
    
    // Collect all articles for references section
    const allArticles = [];

    // Add main heading
    sections.push(
      new Paragraph({
        text: 'PubMed Research Export',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: {
          after: convertInchesToTwip(0.3)
        }
      }),
      new Paragraph({ text: '' })
    );

    // Process each category group
    const categoryGroups = Object.values(groupedArticles);
    
    categoryGroups.forEach((group, groupIndex) => {
      const { studyType, categoryPath, articles } = group;
      
      // Add category heading
      sections.push(
        new Paragraph({
          text: `${studyType} - ${categoryPath}`,
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.LEFT,
          spacing: {
            before: convertInchesToTwip(0.2),
            after: convertInchesToTwip(0.15)
          }
        })
      );
      
      // Add category description
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `A Study was conducted to evaluate the ${categoryPath}`,
              italics: true,
              font: formatting.font,
              size: formatting.fontSize * 2,
              color: '666666'
            })
          ],
          alignment,
          spacing: {
            after: convertInchesToTwip(0.15)
          }
        }),
        new Paragraph({ text: '' })
      );

      // Add articles in this category
      articles.forEach((article, articleIndex) => {
        allArticles.push(article);
        const globalIndex = allArticles.length;

        // Article number and title
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${globalIndex}. `,
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              }),
              new TextRun({
                text: article.title || 'No title available',
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              })
            ],
            alignment,
            spacing: {
              before: convertInchesToTwip(formatting.spacingBefore / 72),
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240),
              lineRule: 'auto'
            }
          })
        );

        // PMID
        if (article.pmid) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'PMID: ',
                  bold: true,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                }),
                new TextRun({
                  text: article.pmid.toString(),
                  font: formatting.font,
                  size: formatting.fontSize * 2
                })
              ],
              alignment,
              spacing: {
                after: convertInchesToTwip(formatting.spacingAfter / 72),
                line: Math.round(formatting.lineSpacing * 240)
              }
            })
          );
        }

        // Authors
        if (article.authors && Array.isArray(article.authors) && article.authors.length > 0) {
          const authorsText = article.authors.join(', ');
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Authors: ',
                  bold: true,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                }),
                new TextRun({
                  text: authorsText,
                  italics: true,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                })
              ],
              alignment,
              spacing: {
                after: convertInchesToTwip(formatting.spacingAfter / 72),
                line: Math.round(formatting.lineSpacing * 240)
              }
            })
          );
        }

        // Journal and date
        if (article.journal || article.publicationDate) {
          const journalText = [
            article.journal,
            article.publicationDate
          ].filter(Boolean).join(', ');

          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Publication: ',
                  bold: true,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                }),
                new TextRun({
                  text: journalText,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                })
              ],
              alignment,
              spacing: {
                after: convertInchesToTwip(formatting.spacingAfter / 72),
                line: Math.round(formatting.lineSpacing * 240)
              }
            })
          );
        }

        // Abstract
        if (article.abstract) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Abstract: ',
                  bold: true,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                })
              ],
              alignment,
              spacing: {
                after: convertInchesToTwip(formatting.spacingAfter / 72),
                line: Math.round(formatting.lineSpacing * 240)
              }
            }),
            new Paragraph({
              text: article.abstract,
              alignment,
              spacing: {
                after: convertInchesToTwip(formatting.spacingAfter / 72),
                line: Math.round(formatting.lineSpacing * 240)
              },
              font: formatting.font,
              size: formatting.fontSize * 2
            })
          );
        }

        // MeSH Terms
        if (article.meshTerms && Array.isArray(article.meshTerms) && article.meshTerms.length > 0) {
          const meshText = article.meshTerms.join('; ');
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'MeSH Terms: ',
                  bold: true,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                }),
                new TextRun({
                  text: meshText,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                })
              ],
              alignment,
              spacing: {
                after: convertInchesToTwip(formatting.spacingAfter / 72),
                line: Math.round(formatting.lineSpacing * 240)
              }
            })
          );
        }

        // Keywords (if available)
        if (article.keywords && Array.isArray(article.keywords) && article.keywords.length > 0) {
          const keywordsText = article.keywords.join('; ');
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Keywords: ',
                  bold: true,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                }),
                new TextRun({
                  text: keywordsText,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                })
              ],
              alignment,
              spacing: {
                after: convertInchesToTwip(formatting.spacingAfter / 72),
                line: Math.round(formatting.lineSpacing * 240)
              }
            })
          );
        }

        // Relevance Score
        if (article.relevanceScore !== undefined) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Relevance Score: ',
                  bold: true,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                }),
                new TextRun({
                  text: article.relevanceScore.toString(),
                  font: formatting.font,
                  size: formatting.fontSize * 2,
                  color: article.relevanceScore >= 30 ? '10b981' : article.relevanceScore >= 15 ? 'f59e0b' : '6b7280'
                })
              ],
              alignment,
              spacing: {
                after: convertInchesToTwip(formatting.spacingAfter / 72),
                line: Math.round(formatting.lineSpacing * 240)
              }
            })
          );
        }

        // URL
        if (article.url) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'URL: ',
                  bold: true,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                }),
                new TextRun({
                  text: article.url,
                  font: formatting.font,
                  size: formatting.fontSize * 2,
                  color: '0000FF',
                  underline: {}
                })
              ],
              alignment,
              spacing: {
                after: convertInchesToTwip(formatting.spacingAfter / 72),
                line: Math.round(formatting.lineSpacing * 240)
              }
            })
          );
        }

        // DOI (if available)
        if (article.doi) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'DOI: ',
                  bold: true,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                }),
                new TextRun({
                  text: article.doi,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                })
              ],
              alignment,
              spacing: {
                after: convertInchesToTwip(formatting.spacingAfter / 72),
                line: Math.round(formatting.lineSpacing * 240)
              }
            })
          );
        }

        // Matched Keywords (if available)
        if (article.matches) {
          let matchesText = [];
          if (article.matches.meshMatches && article.matches.meshMatches.length > 0) {
            matchesText.push(`MeSH: ${article.matches.meshMatches.join(', ')}`);
          }
          if (article.matches.titleMatches && article.matches.titleMatches.length > 0) {
            matchesText.push(`Title: ${article.matches.titleMatches.join(', ')}`);
          }
          if (article.matches.abstractMatches && article.matches.abstractMatches.length > 0) {
            matchesText.push(`Abstract: ${article.matches.abstractMatches.join(', ')}`);
          }
          
          if (matchesText.length > 0) {
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Matched Keywords: ',
                    bold: true,
                    font: formatting.font,
                    size: formatting.fontSize * 2
                  }),
                  new TextRun({
                    text: matchesText.join(' | '),
                    font: formatting.font,
                    size: formatting.fontSize * 2
                  })
                ],
                alignment,
                spacing: {
                  after: convertInchesToTwip(formatting.spacingAfter / 72),
                  line: Math.round(formatting.lineSpacing * 240)
                }
              })
            );
          }
        }

        // Add spacing between articles
        if (articleIndex < articles.length - 1) {
          sections.push(new Paragraph({ text: '' }));
        }
      });

      // Add horizontal divider between categories (except after last one)
      if (groupIndex < categoryGroups.length - 1) {
        sections.push(
          new Paragraph({ text: '' }),
          new Paragraph({
            text: '',
            spacing: {
              before: convertInchesToTwip(0.2),
              after: convertInchesToTwip(0.2)
            },
            border: {
              bottom: {
                color: '999999',
                space: 1,
                value: 'single',
                size: 12
              }
            }
          }),
          new Paragraph({ text: '' })
        );
      }
    });

    // Add References section
    sections.push(
      new Paragraph({ text: '' }),
      new Paragraph({ text: '' }),
      new Paragraph({
        text: 'References',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.LEFT,
        spacing: {
          before: convertInchesToTwip(0.3),
          after: convertInchesToTwip(0.2)
        }
      }),
      new Paragraph({ text: '' })
    );

    // Add formatted citations
    allArticles.forEach((article, index) => {
      const citation = formatCitation(article, citationStyle);
      
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${index + 1}. `,
              font: formatting.font,
              size: formatting.fontSize * 2
            }),
            new TextRun({
              text: citation,
              font: formatting.font,
              size: formatting.fontSize * 2
            })
          ],
          alignment: AlignmentType.LEFT,
          spacing: {
            after: convertInchesToTwip(0.1),
            line: Math.round(formatting.lineSpacing * 240)
          }
        })
      );
    });

    // Create the document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: sections
        }
      ]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=pubmed_unified_export_${Date.now()}.docx`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    console.error('Unified Word export error:', error);
    res.status(500).json({ error: 'Failed to generate unified Word document', details: error.message });
  }
});

/**
 * POST /api/export/word
 * Export selected articles to Microsoft Word format
 */
router.post('/word', async (req, res) => {
  try {
    const { articles, formatting } = req.body;

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: 'No articles provided' });
    }

    // Convert alignment string to docx enum
    const alignmentMap = {
      'left': AlignmentType.LEFT,
      'center': AlignmentType.CENTER,
      'right': AlignmentType.RIGHT,
      'justify': AlignmentType.JUSTIFIED
    };

    const alignment = alignmentMap[formatting.alignment] || AlignmentType.JUSTIFIED;

    // Create document sections
    const sections = [];

    // Add heading
    sections.push(
      new Paragraph({
        text: formatting.heading || 'Research Articles',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: {
          after: convertInchesToTwip(0.2)
        }
      }),
      new Paragraph({ text: '' }) // Empty paragraph for spacing
    );

    // Add each article
    articles.forEach((article, index) => {
      // Article number and title
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${index + 1}. `,
              bold: true,
              font: formatting.font,
              size: formatting.fontSize * 2
            }),
            new TextRun({
              text: article.title || 'No title available',
              bold: true,
              font: formatting.font,
              size: formatting.fontSize * 2
            })
          ],
          alignment,
          spacing: {
            before: convertInchesToTwip(formatting.spacingBefore / 72),
            after: convertInchesToTwip(formatting.spacingAfter / 72),
            line: Math.round(formatting.lineSpacing * 240),
            lineRule: 'auto'
          }
        })
      );

      // PMID
      if (article.pmid) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'PMID: ',
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              }),
              new TextRun({
                text: article.pmid.toString(),
                font: formatting.font,
                size: formatting.fontSize * 2
              })
            ],
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            }
          })
        );
      }

      // Authors
      if (article.authors && Array.isArray(article.authors) && article.authors.length > 0) {
        const authorsText = article.authors.join(', ');
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Authors: ',
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              }),
              new TextRun({
                text: authorsText,
                italics: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              })
            ],
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            }
          })
        );
      }

      // Journal and date
      if (article.journal || article.publicationDate) {
        const journalText = [
          article.journal,
          article.publicationDate
        ].filter(Boolean).join(', ');

        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Publication: ',
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              }),
              new TextRun({
                text: journalText,
                font: formatting.font,
                size: formatting.fontSize * 2
              })
            ],
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            }
          })
        );
      }

      // Abstract
      if (article.abstract) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Abstract: ',
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              })
            ],
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            }
          }),
          new Paragraph({
            text: article.abstract,
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            },
            font: formatting.font,
            size: formatting.fontSize * 2
          })
        );
      }

      // MeSH Terms
      if (article.meshTerms && Array.isArray(article.meshTerms) && article.meshTerms.length > 0) {
        const meshText = article.meshTerms.join('; ');
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'MeSH Terms: ',
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              }),
              new TextRun({
                text: meshText,
                font: formatting.font,
                size: formatting.fontSize * 2
              })
            ],
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            }
          })
        );
      }

      // Keywords
      if (article.keywords && Array.isArray(article.keywords) && article.keywords.length > 0) {
        const keywordsText = article.keywords.join('; ');
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Keywords: ',
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              }),
              new TextRun({
                text: keywordsText,
                font: formatting.font,
                size: formatting.fontSize * 2
              })
            ],
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            }
          })
        );
      }

      // Relevance Score
      if (article.relevanceScore !== undefined) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Relevance Score: ',
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              }),
              new TextRun({
                text: article.relevanceScore.toString(),
                font: formatting.font,
                size: formatting.fontSize * 2,
                color: article.relevanceScore >= 30 ? '10b981' : article.relevanceScore >= 15 ? 'f59e0b' : '6b7280'
              })
            ],
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            }
          })
        );
      }

      // URL
      if (article.url) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'URL: ',
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              }),
              new TextRun({
                text: article.url,
                font: formatting.font,
                size: formatting.fontSize * 2,
                color: '0000FF',
                underline: {}
              })
            ],
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            }
          })
        );
      }

      // DOI
      if (article.doi) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'DOI: ',
                bold: true,
                font: formatting.font,
                size: formatting.fontSize * 2
              }),
              new TextRun({
                text: article.doi,
                font: formatting.font,
                size: formatting.fontSize * 2
              })
            ],
            alignment,
            spacing: {
              after: convertInchesToTwip(formatting.spacingAfter / 72),
              line: Math.round(formatting.lineSpacing * 240)
            }
          })
        );
      }

      // Matched Keywords
      if (article.matches) {
        let matchesText = [];
        if (article.matches.meshMatches && article.matches.meshMatches.length > 0) {
          matchesText.push(`MeSH: ${article.matches.meshMatches.join(', ')}`);
        }
        if (article.matches.titleMatches && article.matches.titleMatches.length > 0) {
          matchesText.push(`Title: ${article.matches.titleMatches.join(', ')}`);
        }
        if (article.matches.abstractMatches && article.matches.abstractMatches.length > 0) {
          matchesText.push(`Abstract: ${article.matches.abstractMatches.join(', ')}`);
        }
        
        if (matchesText.length > 0) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Matched Keywords: ',
                  bold: true,
                  font: formatting.font,
                  size: formatting.fontSize * 2
                }),
                new TextRun({
                  text: matchesText.join(' | '),
                  font: formatting.font,
                  size: formatting.fontSize * 2
                })
              ],
              alignment,
              spacing: {
                after: convertInchesToTwip(formatting.spacingAfter / 72),
                line: Math.round(formatting.lineSpacing * 240)
              }
            })
          );
        }
      }

      // Add separator between articles (except after last one)
      if (index < articles.length - 1) {
        sections.push(
          new Paragraph({
            text: '',
            spacing: {
              after: convertInchesToTwip(0.3)
            },
            border: {
              bottom: {
                color: 'CCCCCC',
                space: 1,
                value: 'single',
                size: 6
              }
            }
          }),
          new Paragraph({ text: '' })
        );
      }
    });

    // Create the document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: sections
        }
      ]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=pubmed_export_${Date.now()}.docx`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    console.error('Word export error:', error);
    res.status(500).json({ error: 'Failed to generate Word document', details: error.message });
  }
});

/**
 * POST /api/export/csv
 * Export search results to CSV format
 */
router.post('/csv', (req, res) => {
  try {
    const { articles, query, categoryPath } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({
        error: 'No articles to export'
      });
    }

    // Create CSV header
    const csvHeader = 'PMID,Title,Authors,Journal,Publication Date,Relevance Score,MeSH Terms,URL\n';

    // Create CSV rows
    const csvRows = articles.map(article => {
      const pmid = article.pmid || '';
      const title = `"${(article.title || '').replace(/"/g, '""')}"`;
      const authors = `"${(article.authors || []).join('; ').replace(/"/g, '""')}"`;
      const journal = `"${(article.journal || '').replace(/"/g, '""')}"`;
      const pubDate = article.publicationDate || '';
      const score = article.relevanceScore || 0;
      const meshTerms = `"${(article.meshTerms || []).join('; ').replace(/"/g, '""')}"`;
      const url = article.url || '';

      return `${pmid},${title},${authors},${journal},${pubDate},${score},${meshTerms},${url}`;
    }).join('\n');

    const csv = csvHeader + csvRows;

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="pubmed_results_${query}_${Date.now()}.csv"`);
    
    res.send(csv);

  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({
      error: 'Failed to export CSV',
      message: error.message
    });
  }
});

/**
 * POST /api/export/bibtex
 * Export search results to BibTeX format
 */
router.post('/bibtex', (req, res) => {
  try {
    const { articles } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({
        error: 'No articles to export'
      });
    }

    // Generate BibTeX entries
    const bibtexEntries = articles.map((article, index) => {
      const pmid = article.pmid || `unknown${index}`;
      const title = article.title || 'Unknown Title';
      const authors = (article.authors || []).join(' and ');
      const journal = article.journal || 'Unknown Journal';
      const year = article.publicationDate ? article.publicationDate.split(' ')[0] : 'Unknown';

      return `@article{PMID${pmid},
  author = {${authors}},
  title = {${title}},
  journal = {${journal}},
  year = {${year}},
  pmid = {${pmid}},
  url = {https://pubmed.ncbi.nlm.nih.gov/${pmid}/}
}`;
    }).join('\n\n');

    res.setHeader('Content-Type', 'application/x-bibtex');
    res.setHeader('Content-Disposition', `attachment; filename="pubmed_results_${Date.now()}.bib"`);
    
    res.send(bibtexEntries);

  } catch (error) {
    console.error('BibTeX export error:', error);
    res.status(500).json({
      error: 'Failed to export BibTeX',
      message: error.message
    });
  }
});

/**
 * POST /api/export/ris
 * Export search results to RIS format
 */
router.post('/ris', (req, res) => {
  try {
    const { articles } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({
        error: 'No articles to export'
      });
    }

    // Generate RIS entries
    const risEntries = articles.map(article => {
      const pmid = article.pmid || '';
      const title = article.title || 'Unknown Title';
      const authors = (article.authors || []).map(author => `AU  - ${author}`).join('\n');
      const journal = article.journal || 'Unknown Journal';
      const year = article.publicationDate ? article.publicationDate.split(' ')[0] : '';

      return `TY  - JOUR
${authors}
TI  - ${title}
JO  - ${journal}
PY  - ${year}
UR  - https://pubmed.ncbi.nlm.nih.gov/${pmid}/
ID  - ${pmid}
ER  -`;
    }).join('\n\n');

    res.setHeader('Content-Type', 'application/x-research-info-systems');
    res.setHeader('Content-Disposition', `attachment; filename="pubmed_results_${Date.now()}.ris"`);
    
    res.send(risEntries);

  } catch (error) {
    console.error('RIS export error:', error);
    res.status(500).json({
      error: 'Failed to export RIS',
      message: error.message
    });
  }
});

/**
 * POST /api/export/json
 * Export search results to JSON format
 */
router.post('/json', (req, res) => {
  try {
    const { articles, query, studyType, categoryPath } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({
        error: 'No articles to export'
      });
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      query,
      studyType,
      categoryPath,
      totalArticles: articles.length,
      articles
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="pubmed_results_${query}_${Date.now()}.json"`);
    
    res.send(JSON.stringify(exportData, null, 2));

  } catch (error) {
    console.error('JSON export error:', error);
    res.status(500).json({
      error: 'Failed to export JSON',
      message: error.message
    });
  }
});

module.exports = router;
