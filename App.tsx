
import React, { useState, useRef, useMemo } from 'react';
import { ingestFile, ingestManualText } from './services/step1_ingest';
import { suggestSegmentation, performSegmentation, analyzeMarkdownLevels } from './services/step2_segment';
import { performGlobalAnalysis } from './services/step3_global';
import { performLocalAnalysis } from './services/step4_local';
import { buildGraph } from './services/step5_graph';
import { AppState, Granularity, AnalysisView, Chunk, CsvSegmentationConfig, ThemeDefinition } from './types';
import { Visualizer } from './components/Visualizer';
import { ChunkViewer } from './components/ChunkViewer';
import { CsvConfigModal } from './components/CsvConfigModal';
import { EvidenceViewer } from './components/EvidenceViewer';
import { HistorySidebar } from './components/HistorySidebar';
import { LandingPage } from './components/LandingPage';
import { SAMPLE_NOVEL, SAMPLE_CSV } from './services/sampleData';

const App: React.FC = () => {
  const [showLanding, setShowLanding] = useState(true);
  
  const [state, setState] = useState<AppState>({
    currentStep: 1,
    documents: [],
    chunks: [],
    segmentationStrategy: Granularity.PARAGRAPH,
    isHierarchical: false,
    markdownSplitLevel: 1,
    csvConfig: { targetColumns: [], contextColumns: [], sentimentContextColumns: [], strategy: 'DISTINCT' },
    segmentationReasoning: "",
    globalAnalysis: null,
    conceptMapData: null,
    selectedChunkId: null,
    selectedTerm: null,
    viewMode: AnalysisView.DASHBOARD,
    isProcessing: false
  });

  // Local State for Edit Modes
  const [editThemeInput, setEditThemeInput] = useState("");
  const [editingChunk, setEditingChunk] = useState<Chunk | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [viewEvidenceTerm, setViewEvidenceTerm] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  // Filter State
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manualInput, setManualInput] = useState("");

  // Memoized filter lists
  const uniqueSources = useMemo(() => {
    const sources = new Set(state.chunks.map(c => c.sourceName || "Unknown"));
    return Array.from(sources).sort();
  }, [state.chunks]);

  const filteredChunks = useMemo(() => {
    if (sourceFilter === "ALL") return state.chunks;
    return state.chunks.filter(c => c.sourceName === sourceFilter);
  }, [state.chunks, sourceFilter]);

  const allActiveThemes = useMemo(() => {
     if (!state.globalAnalysis) return [];
     return state.globalAnalysis.themes.map(t => t.name);
  }, [state.globalAnalysis]);

  // Markdown Stats
  const markdownLevels = useMemo(() => {
      return analyzeMarkdownLevels(state.documents);
  }, [state.documents]);

  const handleLoadVersion = (newState: AppState) => {
      setState(newState);
      setShowHistory(false);
  };

  // --- Step 1: Ingestion ---
  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    setState(prev => ({ ...prev, isProcessing: true }));
    const newDocs = [];
    for (let i = 0; i < files.length; i++) {
      newDocs.push(await ingestFile(files[i]));
    }
    setState(prev => ({ 
      ...prev, 
      documents: [...prev.documents, ...newDocs],
      isProcessing: false 
    }));
  };

  const removeDocument = (id: string) => {
      setState(prev => ({
          ...prev,
          documents: prev.documents.filter(d => d.id !== id)
      }));
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const addManualDoc = () => {
    if (!manualInput.trim()) return;
    const doc = ingestManualText(manualInput);
    setState(prev => ({ 
      ...prev, 
      documents: [...prev.documents, doc],
      isProcessing: false 
    }));
    setManualInput("");
  };

  const loadSample = (type: 'novel' | 'csv') => {
      const content = type === 'novel' ? SAMPLE_NOVEL : SAMPLE_CSV;
      const name = type === 'novel' ? "Psmith, Journalist (Sample)" : "Conference_Feedback.csv";
      // We simulate a manual ingestion but with a specific name/content
      const doc = ingestManualText(content);
      // Override name for clarity
      const finalDoc = { ...doc, name: name };
      
      setState(prev => ({ 
          ...prev, 
          documents: [...prev.documents, finalDoc],
          isProcessing: false 
      }));
  };

  // --- Step 2: Segmentation ---
  const initStep2 = async () => {
    setState(prev => ({ ...prev, isProcessing: true }));
    const suggestion = await suggestSegmentation(state.documents);
    
    // Determine default Split Level if headers exist
    const levels = analyzeMarkdownLevels(state.documents);
    let defaultLevel = 1;
    
    // Auto-select: If H1 is only 1 (title), prefer H2.
    if (levels[1].length <= 1 && levels[2].length > 1) defaultLevel = 2;
    // Or just pick first with count > 0
    else {
        for(let i=1; i<=6; i++) { if (levels[i].length > 0) { defaultLevel = i; break; } }
    }

    // Default CSV columns if CSV
    const csvDoc = state.documents.find(d => d.type === 'csv');
    let initialCsvConfig = state.csvConfig;
    if (csvDoc && csvDoc.csvHeaders) {
        initialCsvConfig = {
            targetColumns: [csvDoc.csvHeaders[0]],
            contextColumns: [],
            sentimentContextColumns: [],
            strategy: 'DISTINCT'
        };
    }

    // Apply suggestion to state
    setState(prev => ({
      ...prev,
      currentStep: 2,
      segmentationStrategy: suggestion.recommended,
      isHierarchical: suggestion.isHierarchical,
      segmentationReasoning: suggestion.reasoning,
      markdownSplitLevel: defaultLevel,
      csvConfig: initialCsvConfig,
      isProcessing: false
    }));
    
    // Generate initial chunks based on suggestion
    const chunks = performSegmentation(
        state.documents, 
        suggestion.recommended, 
        initialCsvConfig, 
        suggestion.isHierarchical, 
        defaultLevel
    );
    setState(prev => ({ ...prev, chunks }));
    setSourceFilter("ALL");
    
    // Automatically open modal if it is a CSV recommendation
    if (csvDoc && suggestion.recommended === Granularity.ROW_COMBINED) {
       setShowCsvModal(true);
    }
  };

  const updateSegmentation = (strat: Granularity, hierarchical: boolean, level: number) => {
    const chunks = performSegmentation(state.documents, strat, state.csvConfig, hierarchical, level);
    // Note: This updates chunks, effectively resetting any future analysis if the user proceeds
    setState(prev => ({ ...prev, segmentationStrategy: strat, isHierarchical: hierarchical, markdownSplitLevel: level, chunks }));
    setSourceFilter("ALL");
  };

  const handleCsvConfigSave = (newConfig: CsvSegmentationConfig) => {
      // Map config strategy to Hierarchical Flag
      // COMBINE = Flat (not hierarchical columns), DISTINCT = Hierarchical (columns are sub-docs)
      const isHierarchical = newConfig.strategy === 'DISTINCT';
      const strat = isHierarchical ? Granularity.ROW_DISTINCT_COLUMNS : Granularity.ROW_COMBINED;
      
      const chunks = performSegmentation(state.documents, strat, newConfig, isHierarchical, state.markdownSplitLevel);
      
      setState(prev => ({ 
          ...prev, 
          csvConfig: newConfig, 
          segmentationStrategy: strat,
          isHierarchical,
          chunks 
      }));
      setShowCsvModal(false);
      setSourceFilter("ALL");
  };

  // --- Step 3: Global Analysis ---
  const initStep3 = async () => {
    setState(prev => ({ ...prev, isProcessing: true }));
    const analysis = await performGlobalAnalysis(state.chunks);
    setState(prev => ({
      ...prev,
      currentStep: 3,
      globalAnalysis: analysis,
      isProcessing: false
    }));
  };

  const addTheme = () => {
      if (editThemeInput && state.globalAnalysis) {
          const newTheme: ThemeDefinition = { name: editThemeInput, description: "User added theme", quotes: [] };
          const newThemes = [...state.globalAnalysis.themes, newTheme];
          const newPotentialThemes = [...state.globalAnalysis.potentialThemes, editThemeInput];
          
          setState(prev => ({ 
              ...prev, 
              globalAnalysis: { 
                  ...prev.globalAnalysis!, 
                  themes: newThemes,
                  potentialThemes: newPotentialThemes
              } 
          }));
          setEditThemeInput("");
      }
  };

  const removeTheme = (themeName: string) => {
      if (state.globalAnalysis) {
          const newThemes = state.globalAnalysis.themes.filter(t => t.name !== themeName);
          const newPotentialThemes = state.globalAnalysis.potentialThemes.filter(t => t !== themeName);
          setState(prev => ({ ...prev, globalAnalysis: { ...prev.globalAnalysis!, themes: newThemes, potentialThemes: newPotentialThemes } }));
      }
  };

  const removeQuote = (themeName: string, quoteIdx: number) => {
      if (!state.globalAnalysis) return;
      
      const newThemes = state.globalAnalysis.themes.map(t => {
          if (t.name === themeName) {
              return { ...t, quotes: t.quotes.filter((_, i) => i !== quoteIdx) };
          }
          return t;
      });
      
      setState(prev => ({ ...prev, globalAnalysis: { ...prev.globalAnalysis!, themes: newThemes } }));
  };

  // --- Step 4: Segment Analysis ---
  const initStep4 = async () => {
    setState(prev => ({ ...prev, isProcessing: true }));
    if (!state.globalAnalysis) return;
    const analyzedChunks = await performLocalAnalysis(state.chunks, state.globalAnalysis.potentialThemes);
    setState(prev => ({
      ...prev,
      currentStep: 4,
      chunks: analyzedChunks,
      isProcessing: false
    }));
  };

  const saveChunkEdit = () => {
      if (editingChunk) {
          setState(prev => ({
              ...prev,
              chunks: prev.chunks.map(c => c.id === editingChunk.id ? editingChunk : c),
              selectedChunkId: null // close modal
          }));
          setEditingChunk(null);
      }
  };

  // --- Step 5: Dashboard ---
  const initStep5 = async () => {
    setState(prev => ({ ...prev, isProcessing: true }));
    if (!state.globalAnalysis) return;
    const graph = await buildGraph(state.chunks, state.globalAnalysis);
    setState(prev => ({
      ...prev,
      currentStep: 5,
      conceptMapData: graph,
      viewMode: AnalysisView.DASHBOARD,
      isProcessing: false
    }));
  };

  // --- Evidence Management ---
  const handleRealignChunk = (chunkId: string, oldTerm: string, newTerm: string) => {
      const chunk = state.chunks.find(c => c.id === chunkId);
      if (!chunk) return;
      
      const newTags = chunk.tags.filter(t => t !== oldTerm);
      if (!newTags.includes(newTerm)) newTags.push(newTerm);
      
      const updatedChunk = { ...chunk, tags: newTags };
      
      setState(prev => ({
          ...prev,
          chunks: prev.chunks.map(c => c.id === chunkId ? updatedChunk : c)
      }));
  };

  const handleRemoveTag = (chunkId: string, term: string) => {
      const chunk = state.chunks.find(c => c.id === chunkId);
      if (!chunk) return;
      
      const updatedChunk = { ...chunk, tags: chunk.tags.filter(t => t !== term) };
      
       setState(prev => ({
          ...prev,
          chunks: prev.chunks.map(c => c.id === chunkId ? updatedChunk : c)
      }));
  };

  const downloadProject = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "semantic_unweaver_project.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const jumpToStep = (step: number) => {
      // Allow moving backwards. 
      // If the user moves backwards and then triggers an action (like InitStepX), 
      // the subsequent data in State will naturally be overwritten by the new data.
      if (step < state.currentStep) {
          setState(prev => ({ ...prev, currentStep: step }));
      }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between px-20 py-6 border-b border-slate-200 bg-white">
      {[
        { step: 1, label: "Ingest", icon: "upload_file" },
        { step: 2, label: "Segment", icon: "splitscreen" },
        { step: 3, label: "Global", icon: "public" },
        { step: 4, label: "Local", icon: "content_cut" },
        { step: 5, label: "Synthesis", icon: "hub" },
      ].map((s) => {
        const isActive = state.currentStep === s.step;
        const isPast = state.currentStep > s.step;
        
        return (
        <button 
            key={s.step} 
            onClick={() => isPast ? jumpToStep(s.step) : null}
            disabled={!isPast && !isActive}
            className={`flex flex-col items-center gap-2 group ${isActive || isPast ? 'text-indigo-600' : 'text-slate-300'} ${isPast ? 'cursor-pointer hover:scale-105 transition-transform' : 'cursor-default'}`}
        >
           <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all 
                ${isActive ? 'border-indigo-600 bg-indigo-50 shadow-md ring-2 ring-indigo-100 ring-offset-2' : ''}
                ${isPast ? 'border-indigo-600 bg-white hover:bg-indigo-50' : ''}
                ${!isActive && !isPast ? 'border-slate-200' : ''}
           `}>
              <span className="material-symbols-outlined">{s.icon}</span>
           </div>
           <span className="text-xs font-bold uppercase tracking-wider">{s.label}</span>
        </button>
      )})}
    </div>
  );
  
  const hasCsv = state.documents.some(d => d.type === 'csv');
  const hasMarkdown = state.documents.some(d => d.type === 'markdown' || d.type === 'text');
  const multipleFiles = state.documents.length > 1;

  if (showLanding) {
      return <LandingPage onStart={() => setShowLanding(false)} />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      <header className="flex-none bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-20 relative">
         <div className="flex items-center gap-4 cursor-pointer" onClick={() => setShowLanding(true)}>
            <h1 className="text-xl font-light tracking-tight text-slate-800">Semantic Text <span className="font-semibold text-indigo-600">Unweaver</span></h1>
            <div className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md font-medium">Alpha</div>
         </div>
         <div className="flex items-center gap-4">
             <button 
                onClick={() => setShowHistory(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors border ${showHistory ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'}`}
             >
                <span className="material-symbols-outlined text-sm">history</span>
                <span className="text-xs font-bold uppercase tracking-wider">History</span>
             </button>
             <div className="h-6 w-px bg-slate-200 mx-2"></div>
             <button onClick={downloadProject} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Export Project JSON">
                <span className="material-symbols-outlined">download</span>
             </button>
         </div>
      </header>

      {renderStepIndicator()}

      <main className="flex-1 overflow-hidden relative flex">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
          
          {/* STEP 1: INGESTION */}
          {state.currentStep === 1 && (
            <div className="w-full max-w-4xl space-y-8 animate-fade-in">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold text-slate-800 mb-2">Upload Source Material</h2>
                  <p className="text-slate-500">Upload documents or paste text to begin the analysis pipeline.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div 
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                            isDragging 
                                ? 'border-indigo-500 bg-indigo-50' 
                                : 'border-slate-300 bg-white hover:border-indigo-500 hover:bg-indigo-50'
                        }`}
                    >
                        <input type="file" multiple ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
                        <span className="material-symbols-outlined text-5xl text-indigo-300 mb-4">cloud_upload</span>
                        <p className="font-medium text-slate-700">
                             {isDragging ? "Drop files here" : "Click or Drag to upload Text, CSV, or MD"}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                        <textarea
                            value={manualInput}
                            onChange={(e) => setManualInput(e.target.value)}
                            placeholder="Paste raw text content here..."
                            className="flex-1 w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 outline-none resize-none mb-4"
                        ></textarea>
                        <button onClick={addManualDoc} disabled={!manualInput} className="self-end px-4 py-2 text-indigo-600 font-medium hover:bg-indigo-50 rounded-lg">Add Text</button>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-200 w-full">
                    <p className="text-center text-xs font-bold text-slate-400 uppercase mb-4">Or try with sample data</p>
                    <div className="flex justify-center gap-4">
                        <button 
                            onClick={() => loadSample('novel')}
                            className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-indigo-500">book</span>
                            Load Narrative (Novel)
                        </button>
                        <button 
                            onClick={() => loadSample('csv')}
                            className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-emerald-500">table_chart</span>
                            Load Feedback (CSV)
                        </button>
                    </div>
                </div>

                {state.documents.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-8">
                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Ingested Files ({state.documents.length})</h3>
                    <div className="space-y-2">
                        {state.documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-slate-400">
                                    {doc.type === 'csv' ? 'table_chart' : (doc.type === 'markdown' ? 'article' : 'description')}
                                </span>
                                <div>
                                    <div className="font-medium text-slate-700">{doc.name}</div>
                                    <div className="text-xs text-slate-400 uppercase">{doc.type} &bull; {Math.round(doc.content.length / 1024)} KB</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-emerald-500 text-xs font-bold uppercase flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">check_circle</span> Ready
                                </span>
                                <button 
                                    onClick={() => removeDocument(doc.id)}
                                    className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50"
                                    title="Remove file"
                                >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                            </div>
                        </div>
                        ))}
                    </div>
                    <div className="flex justify-end mt-8">
                       <button 
                        onClick={initStep2} 
                        className="bg-indigo-600 text-white px-8 py-3 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2"
                       >
                         Next: Segmentation
                         <span className="material-symbols-outlined">arrow_forward</span>
                       </button>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* STEP 2: SEGMENTATION */}
          {state.currentStep === 2 && (
             <div className="w-full max-w-6xl h-full flex gap-8">
                <div className="w-1/3 flex flex-col gap-6">
                   <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h3 className="font-semibold text-slate-800 mb-4">Structure Strategy</h3>
                      
                      {/* Hierarchical Toggle */}
                      {!hasCsv && (
                        <div className="mb-6 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <div className="relative flex items-center pt-1">
                                    <input 
                                        type="checkbox" 
                                        checked={state.isHierarchical}
                                        onChange={(e) => updateSegmentation(state.segmentationStrategy, e.target.checked, state.markdownSplitLevel)}
                                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300"
                                    />
                                </div>
                                <div>
                                    <span className="block text-sm font-medium text-slate-700">Treat Sections as Separate Documents</span>
                                    <span className="block text-xs text-slate-500 mt-1">
                                        Split by Headers (Markdown #) to analyze chapters/sections individually.
                                    </span>
                                </div>
                            </label>

                            {/* Markdown Level Selection */}
                            {state.isHierarchical && hasMarkdown && (
                                <div className="mt-3 pl-8 space-y-2 border-l-2 border-indigo-100">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Split at Header Level:</span>
                                    {[1,2,3,4,5,6].map(level => {
                                        const headers = markdownLevels[level] || [];
                                        const count = headers.length;
                                        const hashes = "#".repeat(level);
                                        
                                        if (count === 0) return null;

                                        return (
                                            <div key={level} className="mb-2">
                                                <label className="flex items-center gap-2 text-xs cursor-pointer hover:text-indigo-600">
                                                    <input 
                                                        type="radio" 
                                                        name="mdLevel" 
                                                        checked={state.markdownSplitLevel === level} 
                                                        onChange={() => updateSegmentation(state.segmentationStrategy, true, level)}
                                                        className="text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="font-mono text-slate-500 font-bold">{hashes}</span>
                                                    <span className="font-medium">Heading {level}</span>
                                                    <span className="text-slate-400">({count} found)</span>
                                                </label>
                                                {/* Header Preview List */}
                                                {state.markdownSplitLevel === level && (
                                                    <div className="ml-6 mt-1 pl-2 border-l border-slate-200 text-[10px] text-slate-500 font-serif max-h-24 overflow-y-auto">
                                                        {headers.map((h, i) => (
                                                            <div key={i} className="truncate">• {h}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                      )}

                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                          {state.isHierarchical ? "Analyze Content Within Sections By" : "Split Entire Text By"}
                      </label>
                      <select 
                        value={state.segmentationStrategy}
                        onChange={(e) => updateSegmentation(e.target.value as Granularity, state.isHierarchical, state.markdownSplitLevel)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm mb-4"
                      >
                         {/* File Level - Only relevant if multiple docs */}
                         {multipleFiles && (
                             <option value={Granularity.FILE}>Individual File / Document</option>
                         )}

                         <option value={Granularity.PARAGRAPH}>Paragraph (Prose)</option>
                         <option value={Granularity.SENTENCE}>Sentence (Detailed)</option>
                         {!state.isHierarchical && <option value={Granularity.SECTION}>Markdown Section (Raw)</option>}
                         
                         {/* Subsection Option - Only relevant if Hierarchical is on and deeper levels exist */}
                         {state.isHierarchical && hasMarkdown && state.markdownSplitLevel < 6 && (
                             <option value={Granularity.SUBSECTION}>Subsections (Level {state.markdownSplitLevel + 1})</option>
                         )}

                         <option value={Granularity.TURN}>Speaker Turn (Chat)</option>
                         
                         {hasCsv && (
                             <>
                                <option value={Granularity.ROW_COMBINED}>CSV Row (All in One)</option>
                                <option value={Granularity.ROW_DISTINCT_COLUMNS}>CSV Row (Columns as Texts)</option>
                             </>
                         )}
                      </select>

                      {/* CSV Trigger Button */}
                      {hasCsv && (
                          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 animate-fade-in">
                              <h4 className="text-xs font-bold text-indigo-700 uppercase mb-2">CSV Structure</h4>
                              <p className="text-xs text-indigo-600 mb-3">
                                {state.csvConfig.targetColumns.length} text columns selected.<br/>
                                {state.csvConfig.contextColumns.length} context columns.
                              </p>
                              <button 
                                onClick={() => setShowCsvModal(true)}
                                className="w-full py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 flex items-center justify-center gap-2"
                              >
                                  <span className="material-symbols-outlined text-sm">tune</span> Configure Columns
                              </button>
                          </div>
                      )}

                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
                        <p className="text-xs text-slate-500 leading-relaxed italic">"{state.segmentationReasoning}"</p>
                      </div>
                   </div>
                   <button 
                      onClick={initStep3}
                      className="w-full bg-indigo-600 text-white py-4 rounded-xl font-medium shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                   >
                      Confirm Segments
                   </button>
                </div>
                
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                   <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 uppercase">{filteredChunks.length} Segments Preview</span>
                      
                      {/* Source Filter */}
                      {uniqueSources.length > 1 && (
                          <div className="flex items-center gap-2">
                             <span className="text-xs text-slate-400 uppercase font-bold">Compare:</span>
                             <select 
                                value={sourceFilter}
                                onChange={(e) => setSourceFilter(e.target.value)}
                                className="text-xs p-1 border border-slate-300 rounded bg-white text-slate-700 focus:outline-none focus:border-indigo-500 max-w-[200px]"
                             >
                                <option value="ALL">All Sources</option>
                                {uniqueSources.map(src => (
                                    <option key={src} value={src}>{src}</option>
                                ))}
                             </select>
                          </div>
                      )}
                   </div>
                   <div className="overflow-y-auto p-4 space-y-2">
                      {filteredChunks.slice(0, 100).map((c, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded border border-slate-100 text-sm font-serif">
                           <div className="flex justify-between items-center mb-1">
                               <span className="text-slate-400 text-xs font-sans">#{i+1}</span>
                               <span className="text-slate-300 text-[10px] uppercase font-sans truncate max-w-[200px]">{c.sourceName}</span>
                           </div>
                           <div className="whitespace-pre-wrap">{c.text}</div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          )}

          {/* STEP 3: GLOBAL ANALYSIS (ENHANCED EVIDENCE) */}
          {state.currentStep === 3 && state.globalAnalysis && (
            <div className="w-full max-w-5xl space-y-8 animate-fade-in">
               <div className="text-center">
                  <h2 className="text-2xl font-semibold text-slate-800">Global Context & Definitions</h2>
                  <p className="text-slate-500">Review the AI-generated themes and their supporting evidence. Add or remove examples to guide the next step.</p>
               </div>

               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                    <span className="text-xs font-bold text-slate-400 uppercase">Executive Summary</span>
                    <p className="text-slate-600 italic mt-2 leading-relaxed text-sm">"{state.globalAnalysis.summary}"</p>
               </div>

               <div className="space-y-6">
                  {state.globalAnalysis.themes.map((theme, idx) => (
                      <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
                          <div className="p-6 bg-slate-50 md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-between">
                              <div>
                                  <h3 className="font-bold text-lg text-slate-800 mb-2">{theme.name}</h3>
                                  <p className="text-sm text-slate-600 mb-4">{theme.description}</p>
                              </div>
                              <button 
                                onClick={() => removeTheme(theme.name)}
                                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 self-start"
                              >
                                  <span className="material-symbols-outlined text-sm">delete</span> Remove Theme
                              </button>
                          </div>
                          <div className="p-6 flex-1">
                              <span className="text-xs font-bold text-slate-400 uppercase mb-3 block">Supported By Evidence</span>
                              <div className="space-y-3">
                                  {theme.quotes.map((quote, qIdx) => (
                                      <div key={qIdx} className="bg-amber-50 p-3 rounded border border-amber-100 text-sm font-serif text-amber-900 relative group">
                                          "{quote}"
                                          <button 
                                            onClick={() => removeQuote(theme.name, qIdx)}
                                            className="absolute top-1 right-1 text-amber-300 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Remove this evidence"
                                          >
                                              <span className="material-symbols-outlined text-sm">close</span>
                                          </button>
                                      </div>
                                  ))}
                                  {theme.quotes.length === 0 && (
                                      <div className="text-slate-400 italic text-sm">No specific quotes attached.</div>
                                  )}
                              </div>
                          </div>
                      </div>
                  ))}
               </div>

               <div className="bg-slate-100 p-6 rounded-2xl flex items-center gap-4">
                    <span className="text-sm font-bold text-slate-500">Add New Theme:</span>
                    <input 
                        type="text" 
                        value={editThemeInput} 
                        onChange={(e) => setEditThemeInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTheme()}
                        placeholder="Theme Name..." 
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    />
                    <button onClick={addTheme} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                        Add
                    </button>
               </div>

               <div className="flex justify-center pt-8">
                  <button 
                     onClick={initStep4}
                     className="bg-indigo-600 text-white px-8 py-3 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2"
                  >
                     Run Segment Analysis
                     <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
               </div>
            </div>
          )}

          {/* STEP 4: SEGMENT ANALYSIS */}
          {state.currentStep === 4 && (
             <div className="w-full max-w-6xl h-full flex flex-col gap-4 relative">
                <div className="flex justify-between items-center">
                   <h2 className="text-xl font-semibold text-slate-800">Review & Correct Analysis</h2>
                   
                   <div className="flex items-center gap-4">
                        {uniqueSources.length > 1 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 uppercase font-bold">Compare:</span>
                                <select 
                                    value={sourceFilter}
                                    onChange={(e) => setSourceFilter(e.target.value)}
                                    className="text-sm p-1.5 border border-slate-300 rounded bg-white text-slate-700 focus:outline-none focus:border-indigo-500 max-w-[200px]"
                                >
                                    <option value="ALL">All Sources</option>
                                    {uniqueSources.map(src => (
                                        <option key={src} value={src}>{src}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <button onClick={initStep5} className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-900 transition-all flex items-center gap-2">
                            Generate Dashboard <span className="material-symbols-outlined">hub</span>
                        </button>
                   </div>
                </div>
                
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                   <ChunkViewer 
                      chunks={filteredChunks} 
                      selectedChunkId={state.selectedChunkId} 
                      onChunkSelect={(id) => {
                          const chunk = state.chunks.find(c => c.id === id);
                          if (chunk) setEditingChunk(chunk);
                          setState(prev => ({...prev, selectedChunkId: id}));
                      }} 
                   />
                </div>

                {/* Edit Modal / Overlay */}
                {editingChunk && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-slate-200 animate-fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-800">Edit Analysis</h3>
                                <button onClick={() => setEditingChunk(null)} className="text-slate-400 hover:text-slate-600">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">Analysis Text</label>
                                    <textarea 
                                        className="w-full p-3 border border-slate-200 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-200 outline-none"
                                        rows={3}
                                        value={editingChunk.analysis || ""}
                                        onChange={(e) => setEditingChunk({...editingChunk, analysis: e.target.value})}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">Sentiment (-1 to 1)</label>
                                        <input 
                                            type="number" step="0.1" min="-1" max="1"
                                            className="w-full p-3 border border-slate-200 rounded-lg text-sm mt-1"
                                            value={editingChunk.sentiment || 0}
                                            onChange={(e) => setEditingChunk({...editingChunk, sentiment: parseFloat(e.target.value)})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">Tags (comma sep)</label>
                                        <input 
                                            type="text"
                                            className="w-full p-3 border border-slate-200 rounded-lg text-sm mt-1"
                                            value={editingChunk.tags.join(", ")}
                                            onChange={(e) => setEditingChunk({...editingChunk, tags: e.target.value.split(',').map(s => s.trim()).filter(s => s)})}
                                        />
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-500 max-h-32 overflow-y-auto italic border border-slate-100">
                                    "{editingChunk.text}"
                                </div>
                                <button onClick={saveChunkEdit} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700">
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
             </div>
          )}

          {/* STEP 5: VISUALIZATION */}
          {state.currentStep === 5 && (
             <div className="w-full h-full flex flex-col">
                <div className="flex-none pb-4 flex justify-between items-center px-4">
                   <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                      {[
                          { id: AnalysisView.DASHBOARD, label: "Dashboard", icon: "dashboard" },
                          { id: AnalysisView.CONCEPT_MAP, label: "Network", icon: "hub" },
                      ].map(v => (
                         <button 
                           key={v.id}
                           onClick={() => setState(prev => ({...prev, viewMode: v.id}))}
                           className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${state.viewMode === v.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                         >
                           <span className="material-symbols-outlined text-sm">{v.icon}</span>
                           {v.label}
                         </button>
                      ))}
                   </div>
                   <button onClick={() => setState(prev => ({...prev, currentStep: 1, documents: [], chunks: [], globalAnalysis: null}))} className="text-slate-400 hover:text-red-500 text-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">restart_alt</span> New Project
                   </button>
                </div>
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
                    <Visualizer 
                        viewMode={state.viewMode}
                        conceptMapData={state.conceptMapData}
                        chunks={state.chunks}
                        onTermSelect={(t) => setViewEvidenceTerm(t)} 
                    />
                </div>
             </div>
          )}

        </div>

        {/* Global Loading Overlay */}
        {state.isProcessing && (
           <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="flex flex-col items-center">
                 <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                 <h3 className="text-xl font-light text-slate-800">Processing...</h3>
                 <p className="text-slate-400 text-sm">Consulting Gemini AI</p>
              </div>
           </div>
        )}

        {/* History Sidebar */}
        {showHistory && (
            <HistorySidebar 
                currentState={state}
                onLoadVersion={handleLoadVersion}
                onClose={() => setShowHistory(false)}
            />
        )}

        {/* CSV Config Modal */}
        {showCsvModal && state.documents.some(d => d.type === 'csv') && (
            <CsvConfigModal 
                headers={state.documents.find(d => d.type === 'csv')!.csvHeaders || []}
                initialConfig={state.csvConfig}
                onSave={handleCsvConfigSave}
                onClose={() => setShowCsvModal(false)}
            />
        )}
        
        {/* Evidence Viewer Modal */}
        {viewEvidenceTerm && (
            <EvidenceViewer
                term={viewEvidenceTerm}
                chunks={state.chunks}
                allThemes={allActiveThemes}
                onClose={() => setViewEvidenceTerm(null)}
                onRealign={handleRealignChunk}
                onRemove={handleRemoveTag}
            />
        )}
      </main>
    </div>
  );
};

export default App;
