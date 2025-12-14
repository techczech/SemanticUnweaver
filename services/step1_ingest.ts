
import { SourceDocument } from "../types";
import { parseCSVStructure } from "../utils/textProcessing";

const generateId = () => Math.random().toString(36).substr(2, 9);

export const ingestFile = async (file: File): Promise<SourceDocument> => {
  const text = await file.text();
  
  let type: 'text' | 'csv' | 'markdown' = 'text';
  let csvHeaders: string[] = [];

  const extension = file.name.split('.').pop()?.toLowerCase();

  // 1. Explicit Extensions (Trust these first)
  if (extension === 'csv' || file.type === 'text/csv') {
      type = 'csv';
  } else if (extension === 'md' || extension === 'markdown') {
      type = 'markdown';
  } else {
      // 2. Content Heuristics for ambiguous files (e.g. .txt)
      
      // Strict CSV Check: Must have header + rows with consistent column counts
      // "Psmith, Journalist" has 2 cols in line 1, but 1 col in line 3. This check prevents it being CSV.
      const csvAttempt = parseCSVStructure(text);
      const colCount = csvAttempt.headers.length;
      
      // Heuristic: At least 2 columns, at least 1 row, and first few rows must have same col count
      if (colCount >= 2 && csvAttempt.rows.length > 0) {
          const sampleRows = csvAttempt.rows.slice(0, 5);
          const consistentRows = sampleRows.every(r => r.length === colCount);
          // Also check that it's not just a single line of text with commas
          if (consistentRows && csvAttempt.totalRows > 0) {
              type = 'csv';
          }
      }

      // If not CSV, check for Markdown (Headers)
      // "Psmith" has # and ## headers, so it will fall into this bucket
      if (type !== 'csv') {
          const hasMarkdownHeaders = /^#{1,6}\s+.+$/m.test(text);
          if (hasMarkdownHeaders) {
              type = 'markdown';
          }
      }
  }

  // Final Setup based on determined type
  if (type === 'csv') {
      const structure = parseCSVStructure(text);
      csvHeaders = structure.headers;
  }

  return {
    id: generateId(),
    name: file.name,
    content: text,
    type: type,
    csvHeaders: csvHeaders.length > 0 ? csvHeaders : undefined
  };
};

export const ingestManualText = (text: string): SourceDocument => {
    // Basic detection for manual paste
    let type: 'text' | 'csv' | 'markdown' = 'text';
    
    // Check Markdown first
    if (/^#{1,6}\s+.+$/m.test(text)) {
        type = 'markdown';
    }
    
    // Check CSV (Strict) - Overrides Markdown if strong signal (e.g. pasting a CSV content)
    const csvAttempt = parseCSVStructure(text);
    if (csvAttempt.headers.length >= 2 && csvAttempt.rows.length > 0) {
         const consistent = csvAttempt.rows.slice(0, 5).every(r => r.length === csvAttempt.headers.length);
         if (consistent) type = 'csv';
    }

    return {
        id: generateId(),
        name: "Manual Input",
        content: text,
        type: type,
        csvHeaders: type === 'csv' ? parseCSVStructure(text).headers : undefined
    };
};
