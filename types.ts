
export enum Granularity {
  WHOLE = 'WHOLE',
  PARAGRAPH = 'PARAGRAPH',
  SENTENCE = 'SENTENCE',
  LINE = 'LINE',
  TURN = 'TURN',
  SECTION = 'SECTION',
  HEADING = 'HEADING',
  SUBSECTION = 'SUBSECTION',
  FILE = 'FILE',
  RESPONSE = 'RESPONSE',
  PHRASE = 'PHRASE',
  // CSV Specifics
  ROW_COMBINED = 'ROW_COMBINED',
  ROW_DISTINCT_COLUMNS = 'ROW_DISTINCT_COLUMNS'
}

export enum AnalysisView {
  TEXT = 'TEXT',
  DASHBOARD = 'DASHBOARD',
  CONCEPT_MAP = 'CONCEPT_MAP',
  THEMES = 'THEMES'
}

export enum AnalysisLens {
  THEMATIC = 'THEMATIC',
  SENTIMENT = 'SENTIMENT',
  ARGUMENT = 'ARGUMENT',
  SOCIOLOGICAL = 'SOCIOLOGICAL',
  CUSTOM = 'CUSTOM'
}

export interface AnalysisProvenance {
  prompt: string;
  model: string;
  timestamp: string;
  lens: string;
}

export interface SourceDocument {
  id: string;
  name: string;
  content: string;
  type: 'text' | 'csv' | 'markdown';
  csvHeaders?: string[]; // If CSV, we store headers here
}

export interface CsvSegmentationConfig {
  targetColumns: string[]; // Columns to analyze
  contextColumns: string[]; // Columns to keep as context (for combined view)
  sentimentContextColumns?: string[]; // Context columns that should specifically impact sentiment
  strategy: 'COMBINE' | 'DISTINCT';
}

export interface Chunk {
  id: string;
  text: string;
  type: Granularity;
  sourceId?: string;
  sourceName?: string;
  startTime?: string;
  endTime?: string;
  tags: string[];
  sentiment?: number;
  analysis?: string;
  provenance?: AnalysisProvenance;
  isAnalyzed?: boolean;
}

export interface SemanticNode {
  id: string;
  label: string;
  type: 'concept' | 'entity' | 'event';
  value: number;
}

export interface SemanticLink {
  source: string;
  target: string;
  label: string;
  strength: number;
}

export interface ConceptMapData {
  nodes: SemanticNode[];
  links: SemanticLink[];
}

export interface TimelineEvent {
  time: string;
  description: string;
  significance: string;
}

export interface ThemeDefinition {
  name: string;
  description: string;
  quotes: string[]; // Evidence/Exemplars
}

export interface GlobalAnalysisResult {
  genre: string;
  summary: string;
  suggestedGranularity: Granularity; 
  suggestedLens: string; 
  reasoning: string;
  themes: ThemeDefinition[]; // Structured themes with evidence
  // potentialThemes is deprecated but kept for compatibility if needed, though we should prefer themes
  potentialThemes: string[]; 
}

// New Pipeline State
export interface AppState {
  currentStep: number; // 1 to 5
  documents: SourceDocument[];
  chunks: Chunk[];
  
  // Segmentation Config
  segmentationStrategy: Granularity;
  isHierarchical: boolean; // Treat Sections/Columns as distinct sources?
  markdownSplitLevel: number; // Which header level (1-6) to split by
  csvConfig: CsvSegmentationConfig; 
  segmentationReasoning: string;
  
  globalAnalysis: GlobalAnalysisResult | null;
  conceptMapData: ConceptMapData | null;
  
  // Selection States
  selectedChunkId: string | null;
  selectedTerm: string | null; // For visualization filtering
  viewMode: AnalysisView;
  
  // Loading States
  isProcessing: boolean;
}

export interface SavedVersion {
  id: string;
  timestamp: number;
  name: string;
  step: number;
  state: AppState;
}
