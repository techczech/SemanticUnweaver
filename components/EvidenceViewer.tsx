
import React from 'react';
import { Chunk } from '../types';

interface EvidenceViewerProps {
  term: string;
  chunks: Chunk[];
  allThemes: string[];
  onClose: () => void;
  onRealign: (chunkId: string, oldTerm: string, newTerm: string) => void;
  onRemove: (chunkId: string, term: string) => void;
}

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({ 
  term, 
  chunks, 
  allThemes, 
  onClose, 
  onRealign, 
  onRemove 
}) => {
  // Filter chunks that actually contain this term/tag
  const relevantChunks = chunks.filter(c => c.tags.includes(term));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-sm animate-fade-in">
       <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
             <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                   <span className="material-symbols-outlined text-indigo-500">format_quote</span>
                   {term}
                </h2>
                <p className="text-sm text-slate-500">{relevantChunks.length} supporting segments</p>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <span className="material-symbols-outlined">close</span>
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
             {relevantChunks.length === 0 ? (
                <div className="text-center text-slate-400 py-12">
                   <p>No evidence found for this concept.</p>
                </div>
             ) : (
                relevantChunks.map(chunk => (
                   <div key={chunk.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 group hover:border-indigo-300 transition-all">
                      {/* Source Header */}
                      <div className="flex justify-between items-center mb-2">
                         <span className="text-xs font-bold uppercase text-slate-400">{chunk.sourceName}</span>
                         <span className="text-xs font-mono text-slate-300">#{chunk.id.substring(0,4)}</span>
                      </div>

                      {/* Text */}
                      <div className="text-slate-700 font-serif mb-4 text-sm leading-relaxed whitespace-pre-wrap">
                         {chunk.text}
                      </div>

                      {/* Analysis Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                         <div className="text-xs text-indigo-600 italic">
                            "{chunk.analysis}"
                         </div>
                      </div>

                      {/* Action Bar */}
                      <div className="mt-3 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity justify-end">
                         <div className="relative group/menu">
                            <button className="text-xs font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                               Realign <span className="material-symbols-outlined text-[10px]">expand_more</span>
                            </button>
                            {/* Dropdown for Realign */}
                            <div className="absolute right-0 bottom-full mb-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 hidden group-hover/menu:block z-10 max-h-48 overflow-y-auto">
                               {allThemes.filter(t => t !== term).map(t => (
                                  <button 
                                    key={t}
                                    onClick={() => onRealign(chunk.id, term, t)}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 text-slate-700 truncate"
                                  >
                                     Move to "{t}"
                                  </button>
                               ))}
                            </div>
                         </div>

                         <button 
                            onClick={() => onRemove(chunk.id, term)}
                            className="text-xs font-medium text-slate-500 hover:text-red-600 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-200"
                         >
                            Remove <span className="material-symbols-outlined text-[10px]">close</span>
                         </button>
                      </div>
                   </div>
                ))
             )}
          </div>
       </div>
    </div>
  );
};
