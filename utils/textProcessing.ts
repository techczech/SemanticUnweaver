
import { Chunk, Granularity, SourceDocument } from "../types";

const generateId = () => Math.random().toString(36).substr(2, 9);

// Unique separator for CSV rows to preserve structure during chunking
const CSV_ROW_DELIMITER = '<<<ROW_BREAK>>>';

// Basic stop words list for N-gram filtering
const STOP_WORDS = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'a', 'an', 'is', 'are', 'was', 'were', 
    'of', 'for', 'it', 'this', 'that', 'with', 'as', 'by', 'from', 'be', 'have', 'has', 'had',
    'not', 'are', 'will', 'can', 'would', 'should', 'could', 'i', 'you', 'he', 'she', 'we', 'they'
]);

export interface CSVStructure {
    headers: string[];
    rows: string[][];
    totalRows: number;
}

export interface CSVColumnConfig {
    analyzeCols: number[];
    contextCols: number[];
}

export const generateNgrams = (chunks: Chunk[]): { bigrams: any[], trigrams: any[] } => {
    const bigramCounts = new Map<string, number>();
    const trigramCounts = new Map<string, number>();

    chunks.forEach(chunk => {
        // Simple tokenization: lowercase, remove punctuation, split by space
        const tokens = chunk.text.toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .split(/\s+/)
            .filter(t => t.length > 0);
        
        // Bigrams
        for(let i=0; i < tokens.length - 1; i++) {
            if (!STOP_WORDS.has(tokens[i]) && !STOP_WORDS.has(tokens[i+1])) {
                const bigram = `${tokens[i]} ${tokens[i+1]}`;
                bigramCounts.set(bigram, (bigramCounts.get(bigram) || 0) + 1);
            }
        }

        // Trigrams
        for(let i=0; i < tokens.length - 2; i++) {
            if (!STOP_WORDS.has(tokens[i]) && !STOP_WORDS.has(tokens[i+1]) && !STOP_WORDS.has(tokens[i+2])) {
                const trigram = `${tokens[i]} ${tokens[i+1]} ${tokens[i+2]}`;
                trigramCounts.set(trigram, (trigramCounts.get(trigram) || 0) + 1);
            }
        }
    });

    const format = (map: Map<string, number>, type: 'bigram' | 'trigram') => 
        Array.from(map.entries())
            .map(([text, value]) => ({ text, value, type }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 50); // Return top 50

    return {
        bigrams: format(bigramCounts, 'bigram'),
        trigrams: format(trigramCounts, 'trigram')
    };
};

export const generateKWIC = (chunks: Chunk[], keyword: string, windowChars: number = 40): { left: string, keyword: string, right: string, sourceName?: string, chunkId: string }[] => {
    const results: any[] = [];
    const normalizedKeyword = keyword.toLowerCase();
    
    chunks.forEach(chunk => {
        const text = chunk.text;
        const normalizedText = text.toLowerCase();
        let startIndex = 0;
        
        // Find all occurrences
        while ((startIndex = normalizedText.indexOf(normalizedKeyword, startIndex)) > -1) {
            const end = startIndex + keyword.length;
            
            // Extract context
            const leftStart = Math.max(0, startIndex - windowChars);
            const left = text.substring(leftStart, startIndex);
            
            // Get the actual keyword from text (preserving case)
            const actualKeyword = text.substring(startIndex, startIndex + keyword.length);
            
            const rightEnd = Math.min(text.length, startIndex + keyword.length + windowChars);
            const right = text.substring(startIndex + keyword.length, rightEnd);
            
            results.push({
                left: (leftStart > 0 ? '...' : '') + left,
                keyword: actualKeyword,
                right: right + (rightEnd < text.length ? '...' : ''),
                sourceName: chunk.sourceName,
                chunkId: chunk.id
            });

            startIndex = startIndex + 1; // Move forward
        }
    });
    
    return results;
};

// --- CSV Parsing Utilities ---

// Internal helper to split a single CSV line handling quotes
const splitCSVLine = (line: string): string[] => {
    const matches: string[] = [];
    let inQuote = false;
    let current = '';
    
    for(let i=0; i<line.length; i++) {
        const char = line[i];
        if (char === '"' && (i === 0 || line[i-1] !== '\\')) { // Basic quote toggle
             inQuote = !inQuote;
        }
        
        if (char === ',' && !inQuote) {
            matches.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            current = '';
        } else {
            current += char;
        }
    }
    // Push last token
    matches.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    return matches;
};

export const parseCSVStructure = (content: string): CSVStructure => {
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [], totalRows: 0 };

    const headers = splitCSVLine(lines[0]);
    const rows = lines.slice(1).map(splitCSVLine);

    return { headers, rows, totalRows: rows.length };
};

export const generateFormattedCSV = (structure: CSVStructure, config: CSVColumnConfig): string => {
    const { headers, rows } = structure;
    const { analyzeCols, contextCols } = config;

    const formattedRows = rows.map(row => {
        // Build Context String
        const contextParts = contextCols.map(idx => {
            const val = row[idx];
            if (!val || val.trim() === '') return null;
            return `[${headers[idx]}]: ${val}`;
        }).filter(Boolean);

        const contextStr = contextParts.length > 0 ? contextParts.join(' | ') + '\n' : '';

        // Build Analysis String
        const analyzeParts = analyzeCols.map(idx => {
            const val = row[idx];
            if (!val || val.trim() === '') return null;
            // If multiple text columns, prefix with header for clarity, unless it's just one
            if (analyzeCols.length > 1) {
                return `${headers[idx]}: ${val}`;
            }
            return val;
        }).filter(Boolean);

        const analyzeStr = analyzeParts.join('\n');

        if (!analyzeStr.trim()) return null; // Skip empty rows

        return `${contextStr}${analyzeStr}`;
    }).filter(Boolean);

    return formattedRows.join(`\n\n${CSV_ROW_DELIMITER}\n\n`);
};

// Smart heuristic to guess default configuration
export const guessCSVConfig = (structure: CSVStructure): CSVColumnConfig => {
    const { headers, rows } = structure;
    const analyzeCols: number[] = [];
    const contextCols: number[] = [];

    headers.forEach((h, i) => {
      let nonNumeric = 0;
      let totalLen = 0;
      let validCount = 0;
      
      const sample = rows.slice(0, 30); 
      sample.forEach(row => {
          if (row[i]) {
              validCount++;
              totalLen += row[i].length;
              if (isNaN(Number(row[i]))) nonNumeric++;
          }
      });

      if (validCount > 0) {
          const avgLen = totalLen / validCount;
          const nonNumRatio = nonNumeric / validCount;
          const name = h.toLowerCase();
          
          // Heuristic for "Text to Analyze"
          const isExplicitText = name.includes('text') || name.includes('comment') || name.includes('desc') || name.includes('content') || name.includes('feedback') || name.includes('improve') || name.includes('work') || name.includes('response') || name.includes('valuable');
          const isLongText = nonNumRatio > 0.6 && avgLen > 30; // High text content, decently long

          // Heuristic for "Context"
          const isId = name.includes('id') || name.includes('code') || name === 'no';
          const isCategory = avgLen < 20 && nonNumRatio > 0.1 && !isExplicitText; // Short text labels
          const isMetric = nonNumRatio < 0.1; // Mostly numbers

          if (isExplicitText || isLongText) {
              analyzeCols.push(i);
          } else if (isCategory || isId || isMetric) {
              contextCols.push(i);
          }
      }
    });
    
    // Fallback: If no analyze columns found, take the longest one
    if (analyzeCols.length === 0 && headers.length > 0) {
        analyzeCols.push(headers.length - 1); // Default to last column
    }

    return { analyzeCols, contextCols };
};

export const processFile = async (file: File): Promise<SourceDocument> => {
  const text = await file.text();
  let content = text;
  let type: 'text' | 'csv' | 'markdown' = 'text';

  // Check extension OR content signature (header row + commas)
  const isCSV = file.name.toLowerCase().endsWith('.csv') || 
                (file.type === 'text/csv') || 
                (text.includes(',') && text.split('\n')[0].split(',').length > 2);

  if (isCSV) {
    type = 'csv';
    // Return raw text for CSV, App.tsx will handle the parsing/configuration flow
    content = text; 
  } else if (file.name.toLowerCase().endsWith('.md')) {
    type = 'markdown';
  }

  return {
    id: generateId(),
    name: file.name,
    content: content,
    type: type
  };
};

export const splitDocuments = (documents: SourceDocument[], granularity: Granularity): Chunk[] => {
  let allChunks: Chunk[] = [];

  documents.forEach(doc => {
     const docChunks = splitSingleText(doc.content, granularity).map(c => ({
         ...c,
         sourceId: doc.id,
         sourceName: doc.name
     }));
     allChunks = [...allChunks, ...docChunks];
  });

  return allChunks;
};

const splitSingleText = (text: string, granularity: Granularity): Chunk[] => {
  let chunks: Chunk[] = [];
  
  if (granularity === Granularity.WHOLE) {
    chunks = [{
      id: generateId(),
      text: text.replace(new RegExp(CSV_ROW_DELIMITER, 'g'), '\n\n'),
      type: Granularity.WHOLE,
      tags: []
    }];
  } else if (granularity === Granularity.RESPONSE) {
      // 1. Try explicit delimiter from our CSV parser
      if (text.includes(CSV_ROW_DELIMITER)) {
        chunks = text.split(CSV_ROW_DELIMITER)
            .map(t => t.trim()).filter(t => t)
            .map(t => ({
                id: generateId(),
                text: t,
                type: Granularity.RESPONSE,
                tags: []
            }));
      } else {
        // 2. Fallback: Split by lines (handling lists where items are single lines)
        const doubleNewlineCount = (text.match(/\n\n/g) || []).length;
        const singleNewlineCount = (text.match(/\n/g) || []).length;
        
        const splitPattern = (doubleNewlineCount > 1 && doubleNewlineCount > singleNewlineCount * 0.1) 
            ? /\n\n+/   // Split by paragraph
            : /\n+/;    // Split by single line (likely list)

        chunks = text.split(splitPattern)
            .map(t => t.trim()).filter(t => t)
            .map(t => ({
                id: generateId(),
                text: t,
                type: Granularity.RESPONSE,
                tags: []
            }));
      }
  } else if (granularity === Granularity.TURN) {
      const speakerRegex = /\n(?=[A-Z0-9][\w\s]*:)/g;
      
      if (!speakerRegex.test(text) && !text.includes(':')) {
           return splitSingleText(text, Granularity.PARAGRAPH);
      }

      const rawTurns = text.split(speakerRegex);
      chunks = rawTurns
        .filter(t => t.trim().length > 0)
        .map(t => ({
            id: generateId(),
            text: t.trim(),
            type: Granularity.TURN,
            tags: []
        }));
  } else if (granularity === Granularity.HEADING) {
      const rawSections = text.split(/(?=^#+\s)/gm);
      chunks = rawSections
        .filter(s => s.trim().length > 0)
        .map(s => ({
            id: generateId(),
            text: s.trim(),
            type: Granularity.HEADING,
            tags: []
        }));
  } else if (granularity === Granularity.PARAGRAPH) {
    const cleanText = text.replace(new RegExp(CSV_ROW_DELIMITER, 'g'), '\n\n');
    const rawParagraphs = cleanText.split(/\n\s*\n/);
    chunks = rawParagraphs
      .filter(p => p.trim().length > 0)
      .map(p => ({
        id: generateId(),
        text: p.trim(),
        type: Granularity.PARAGRAPH,
        tags: []
      }));
  } else if (granularity === Granularity.SENTENCE) {
    const cleanText = text.replace(new RegExp(CSV_ROW_DELIMITER, 'g'), ' ');
    const rawSentences = cleanText.match( /[^.!?]+[.!?]+["']?|[^.!?]+$/g ) || [cleanText];
    chunks = rawSentences
      .filter(s => s.trim().length > 0)
      .map(s => ({
        id: generateId(),
        text: s.trim(),
        type: Granularity.SENTENCE,
        tags: []
      }));
  } else if (granularity === Granularity.PHRASE) {
      const cleanText = text.replace(new RegExp(CSV_ROW_DELIMITER, 'g'), ' ');
      const rawPhrases = cleanText.split(/[,;]\s+/);
      chunks = rawPhrases
        .filter(p => p.trim().length > 0)
        .map(p => ({
            id: generateId(),
            text: p.trim(),
            type: Granularity.PHRASE,
            tags: []
        }));
  }

  return chunks;
};
