
import { SourceDocument, Chunk, Granularity, CsvSegmentationConfig } from "../types";
import { runPrompt } from "./llm_core";
import { parseCSVStructure } from "../utils/textProcessing";

const generateId = () => Math.random().toString(36).substr(2, 9);

export const analyzeMarkdownLevels = (docs: SourceDocument[]): Record<number, string[]> => {
    const levels: Record<number, string[]> = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[]};
    docs.forEach(doc => {
        if (doc.type === 'markdown' || doc.type === 'text') {
             const lines = doc.content.split(/\r?\n/);
             lines.forEach(line => {
                 // Use strict regex on trimmed line to handle indentation while satisfying strict pattern requirement
                 const match = line.trim().match(/^(#{1,6})\s+(.+)$/);
                 if (match) {
                     const level = match[1].length;
                     const text = match[2].trim();
                     if (levels[level]) {
                        levels[level].push(text);
                     }
                 }
             });
        }
    });
    return levels;
};

export const suggestSegmentation = async (docs: SourceDocument[]): Promise<{ recommended: Granularity, isHierarchical: boolean, reasoning: string }> => {
  // 1. Check for CSV
  const hasCsv = docs.some(d => d.type === 'csv');
  if (hasCsv) {
      return { 
          recommended: Granularity.ROW_COMBINED, 
          isHierarchical: true, 
          reasoning: "Structured Data detected. You can analyze by Row or treat Columns as separate text sources." 
      };
  }

  // 2. Check for Multiple Files - suggest File level if no internal structure
  if (docs.length > 1) {
      // Check structure
      const levels = analyzeMarkdownLevels(docs);
      const totalHeaders = Object.values(levels).reduce((acc, list) => acc + list.length, 0);
      
      if (totalHeaders === 0) {
          return {
              recommended: Granularity.FILE,
              isHierarchical: false,
              reasoning: "Multiple documents detected with no internal Markdown structure. Analyzing file-by-file is recommended."
          };
      }
  }

  // 3. Check for Markdown Headers
  const levels = analyzeMarkdownLevels(docs);
  const totalHeaders = Object.values(levels).reduce((acc, list) => acc + list.length, 0);
  
  if (totalHeaders > 0) {
      // Find the most relevant level (e.g. the first level with > 1 item, or just level 1)
      let bestLevel = 1;
      for (let i = 1; i <= 6; i++) {
          if (levels[i].length > 1) {
              bestLevel = i;
              break;
          }
      }
      // If Level 1 has only 1 item (Title) and Level 2 has many, suggest 2.
      if (levels[1].length === 1 && levels[2].length > 1) bestLevel = 2;

      return {
          recommended: Granularity.PARAGRAPH,
          isHierarchical: true,
          reasoning: `Document structure detected (${totalHeaders} Headings). Recommended to treat Level ${bestLevel} headers as distinct sections.`
      };
  }

  // 4. Fallback to LLM for plain text
  const sample = docs[0]?.content.substring(0, 2000) || "";
  try {
    const result = await runPrompt("segmentation_suggestion", { TEXT_SAMPLE: sample });
    return {
      recommended: result.recommendedGranularity as Granularity,
      isHierarchical: false,
      reasoning: result.reasoning
    };
  } catch (e) {
    return { recommended: Granularity.PARAGRAPH, isHierarchical: false, reasoning: "Fallback due to error." };
  }
};

/**
 * Splits a single text block based on the basic strategy (Paragraph, Sentence, etc)
 * Does NOT handle Hierarchy/CSV logic, just raw text splitting.
 */
const splitRawText = (text: string, strategy: Granularity): string[] => {
    switch (strategy) {
        case Granularity.PARAGRAPH:
            return text.split(/\n\s*\n/).filter(t => t.trim());
        case Granularity.SENTENCE:
            return text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text];
        case Granularity.LINE:
            return text.split('\n').filter(t => t.trim());
        case Granularity.SECTION:
             // If granularity IS section, we just return the sections (used if hierarchy is OFF but user wants big chunks)
             // Allow leading whitespace for robustness
             return text.split(/(?=^\s*#+\s)/gm).filter(t => t.trim());
        case Granularity.TURN:
            return text.split(/\n(?=[A-Z0-9][\w\s]*:)/g).filter(t => t.trim());
        default:
            return [text];
    }
};

export const performSegmentation = (
    docs: SourceDocument[], 
    strategy: Granularity, 
    csvConfig: CsvSegmentationConfig,
    isHierarchical: boolean,
    splitLevel: number = 1
): Chunk[] => {
  let chunks: Chunk[] = [];

  docs.forEach(doc => {
    let docChunks: Chunk[] = [];

    // --- CASE 1: Whole File (Explicit) ---
    if (strategy === Granularity.FILE) {
        docChunks.push({
            id: generateId(),
            text: doc.content,
            type: strategy,
            sourceId: doc.id,
            sourceName: doc.name,
            tags: []
        });
    }
    // --- CASE 2: CSV Handling ---
    else if (doc.type === 'csv') {
        const effectiveStrategy = isHierarchical ? Granularity.ROW_DISTINCT_COLUMNS : Granularity.ROW_COMBINED;
        const structure = parseCSVStructure(doc.content);
        const headers = structure.headers;
        const targetCols = csvConfig?.targetColumns || headers;
        const contextCols = csvConfig?.contextColumns || [];
        const sentimentCols = csvConfig?.sentimentContextColumns || [];

        structure.rows.forEach((row, rowIdx) => {
            let contextStr = contextCols.map(c => {
                const idx = headers.indexOf(c);
                const val = row[idx] ? row[idx].replace(/^"|"$/g, '').trim() : '';
                if (sentimentCols.includes(c)) return val ? `[Sentiment Context] ${c}: ${val}` : '';
                return val ? `${c}: ${val}` : '';
            }).filter(s => s).join(' | ');

            if (effectiveStrategy === Granularity.ROW_COMBINED) {
                let mainStr = targetCols.map(c => {
                    const idx = headers.indexOf(c);
                    const val = row[idx] ? row[idx].replace(/^"|"$/g, '').trim() : '';
                    return val ? (targetCols.length > 1 ? `${c}: ${val}` : val) : '';
                }).filter(s => s).join('\n');

                if (mainStr.trim()) {
                    docChunks.push({
                        id: generateId(),
                        text: (contextStr ? `[Meta: ${contextStr}]\n` : '') + mainStr,
                        type: strategy,
                        sourceId: doc.id,
                        sourceName: doc.name,
                        tags: []
                    });
                }
            } else {
                targetCols.forEach(colName => {
                    const colIdx = headers.indexOf(colName);
                    const val = row[colIdx] ? row[colIdx].replace(/^"|"$/g, '').trim() : '';
                    
                    if (colIdx > -1 && val) {
                        docChunks.push({
                            id: generateId(),
                            text: (contextStr ? `[Meta: ${contextStr}]\n` : '') + `[Column: ${colName}]\n` + val,
                            type: strategy,
                            sourceId: doc.id,
                            sourceName: `${doc.name} > ${colName}`,
                            tags: []
                        });
                    }
                });
            }
        });
    } 
    // --- CASE 3: Text/Markdown with Hierarchy ---
    else if (isHierarchical) {
        // Handle Subsection strategy (Go one level deeper than selected)
        let effectiveLevel = splitLevel;
        if (strategy === Granularity.SUBSECTION) {
            effectiveLevel = Math.min(6, splitLevel + 1);
        }

        // Split by Markdown Headers of specific level
        const sectionRegex = new RegExp(`(^\\s*#{${effectiveLevel}}\\s+.+$)`, 'gm');
        const sections = doc.content.split(sectionRegex);
        
        let currentHeader = "Intro / Untitled";
        
        sections.forEach(section => {
            if (!section.trim()) return;

            // Check if this section is actually a header (matches the split pattern)
            if (new RegExp(`^\\s*#{${effectiveLevel}}\\s`).test(section)) {
                currentHeader = section.trim().replace(/^[#\s]+/, '').trim();
                return; 
            }

            // It's content, so split it according to inner strategy
            // If the strategy IS Subsection, we treat the content under the header as the chunk
            if (strategy === Granularity.SUBSECTION) {
                 if (section.trim()) {
                     docChunks.push({
                        id: generateId(),
                        text: section.trim(),
                        type: strategy,
                        sourceId: doc.id,
                        sourceName: `${doc.name} > ${currentHeader}`,
                        tags: []
                     });
                 }
            } else {
                // Otherwise split the content by Paragraph/Sentence etc
                const innerSegments = splitRawText(section, strategy);
                
                innerSegments.forEach(segment => {
                     docChunks.push({
                        id: generateId(),
                        text: segment,
                        type: strategy,
                        sourceId: doc.id,
                        sourceName: `${doc.name} > ${currentHeader}`,
                        tags: []
                     });
                });
            }
        });
    } 
    // --- CASE 4: Standard Flat Text ---
    else {
        const splitText = splitRawText(doc.content, strategy);
        docChunks = splitText.map(text => ({
            id: generateId(),
            text: text.trim(),
            type: strategy,
            sourceId: doc.id,
            sourceName: doc.name,
            tags: []
        }));
    }

    chunks = [...chunks, ...docChunks];
  });

  return chunks;
};