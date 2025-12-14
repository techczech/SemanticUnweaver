
import React, { useState } from 'react';
import { CsvSegmentationConfig } from '../types';

interface CsvConfigModalProps {
  headers: string[];
  initialConfig: CsvSegmentationConfig;
  onSave: (config: CsvSegmentationConfig) => void;
  onClose: () => void;
}

export const CsvConfigModal: React.FC<CsvConfigModalProps> = ({ headers, initialConfig, onSave, onClose }) => {
  const [targetColumns, setTargetColumns] = useState<string[]>(initialConfig.targetColumns);
  const [contextColumns, setContextColumns] = useState<string[]>(initialConfig.contextColumns);
  const [sentimentContextColumns, setSentimentContextColumns] = useState<string[]>(initialConfig.sentimentContextColumns || []);
  const [combineMode, setCombineMode] = useState<boolean>(initialConfig.strategy === 'COMBINE');

  const handleToggle = (col: string, type: 'target' | 'context' | 'sentiment') => {
    if (type === 'target') {
      if (targetColumns.includes(col)) {
        setTargetColumns(targetColumns.filter(c => c !== col));
      } else {
        setTargetColumns([...targetColumns, col]);
        // Remove from context if adding to target
        setContextColumns(contextColumns.filter(c => c !== col));
        setSentimentContextColumns(sentimentContextColumns.filter(c => c !== col));
      }
    } else if (type === 'context') {
      if (contextColumns.includes(col)) {
        setContextColumns(contextColumns.filter(c => c !== col));
        // Also remove from sentiment if it's no longer context
        setSentimentContextColumns(sentimentContextColumns.filter(c => c !== col));
      } else {
        setContextColumns([...contextColumns, col]);
        // Remove from target if adding to context
        setTargetColumns(targetColumns.filter(c => c !== col));
      }
    } else if (type === 'sentiment') {
      // Can only toggle sentiment if it is already a context column
      if (sentimentContextColumns.includes(col)) {
        setSentimentContextColumns(sentimentContextColumns.filter(c => c !== col));
      } else {
        setSentimentContextColumns([...sentimentContextColumns, col]);
      }
    }
  };

  const handleSave = () => {
    onSave({
      targetColumns,
      contextColumns,
      sentimentContextColumns,
      strategy: combineMode ? 'COMBINE' : 'DISTINCT'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-fade-in">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Configure CSV Structure</h2>
            <p className="text-sm text-slate-500">Map columns to semantic text or metadata context.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">Column Mapping</h3>
            <div className="grid grid-cols-[1fr_90px_90px_90px] gap-2 mb-2 px-4 py-2 bg-slate-50 rounded-lg text-xs font-semibold text-slate-500 uppercase">
              <div>Column Name</div>
              <div className="text-center" title="The main text to analyze">Analyze</div>
              <div className="text-center" title="Included as metadata/context">Context</div>
              <div className="text-center" title="Apply sentiment analysis to this context">Sentiment</div>
            </div>
            <div className="space-y-1">
              {headers.map(header => {
                const isContext = contextColumns.includes(header);
                return (
                <div key={header} className="grid grid-cols-[1fr_90px_90px_90px] gap-2 items-center px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="font-medium text-slate-700 truncate" title={header}>{header}</div>
                  
                  {/* Analyze Checkbox */}
                  <div className="flex justify-center">
                    <input 
                      type="checkbox" 
                      checked={targetColumns.includes(header)}
                      onChange={() => handleToggle(header, 'target')}
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Context Checkbox */}
                  <div className="flex justify-center">
                    <input 
                      type="checkbox" 
                      checked={isContext}
                      onChange={() => handleToggle(header, 'context')}
                      className="w-5 h-5 rounded border-slate-300 text-slate-500 focus:ring-slate-400 cursor-pointer"
                    />
                  </div>

                  {/* Sentiment Context Checkbox (Only valid if Context is checked) */}
                  <div className="flex justify-center">
                    <input 
                      type="checkbox" 
                      disabled={!isContext}
                      checked={sentimentContextColumns.includes(header)}
                      onChange={() => handleToggle(header, 'sentiment')}
                      className={`w-5 h-5 rounded border-slate-300 focus:ring-pink-500 cursor-pointer ${!isContext ? 'opacity-20 cursor-not-allowed' : 'text-pink-500'}`}
                    />
                  </div>
                </div>
              )})}
            </div>
          </div>

          <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
             <h3 className="text-sm font-bold text-indigo-800 mb-4">Processing Strategy</h3>
             <div className="flex gap-4">
                <label className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all ${combineMode ? 'bg-white border-indigo-500 shadow-sm' : 'bg-transparent border-transparent hover:bg-white/50'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <input type="radio" name="strategy" checked={combineMode} onChange={() => setCombineMode(true)} className="text-indigo-600" />
                        <span className="font-semibold text-slate-800">Treat All Text as One Text</span>
                    </div>
                    <p className="text-xs text-slate-600 ml-7">Combines all selected columns in a row into a single analyzed segment.</p>
                </label>
                <label className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all ${!combineMode ? 'bg-white border-indigo-500 shadow-sm' : 'bg-transparent border-transparent hover:bg-white/50'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <input type="radio" name="strategy" checked={!combineMode} onChange={() => setCombineMode(false)} className="text-indigo-600" />
                        <span className="font-semibold text-slate-800">Treat Columns as Separate Texts</span>
                    </div>
                    <p className="text-xs text-slate-600 ml-7">Analyzes each selected column independently, creating distinct text sources.</p>
                </label>
             </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Cancel</button>
          <button 
            onClick={handleSave} 
            disabled={targetColumns.length === 0}
            className="px-8 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
          >
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  );
};