
import React from 'react';
import { Chunk, Granularity } from '../types';

interface ChunkViewerProps {
  chunks: Chunk[];
  selectedChunkId: string | null;
  onChunkSelect: (id: string) => void;
}

export const ChunkViewer: React.FC<ChunkViewerProps> = ({ chunks, selectedChunkId, onChunkSelect }) => {
  return (
    <div className="h-full overflow-y-auto p-8 bg-white scroll-smooth">
      <div className="max-w-4xl mx-auto">
        {chunks.map((chunk, idx) => {
          const isSelected = chunk.id === selectedChunkId;
          const hasAnalysis = !!chunk.analysis;
          
          // Determine sentiment color border
          let sentimentClass = "border-l-4 border-transparent";
          if (chunk.sentiment) {
              if (chunk.sentiment > 0.3) sentimentClass = "border-l-4 border-green-400";
              else if (chunk.sentiment < -0.3) sentimentClass = "border-l-4 border-red-400";
              else sentimentClass = "border-l-4 border-slate-300";
          }

          // Check if source changed from previous chunk to render a header
          const prevChunk = chunks[idx - 1];
          const showSourceHeader = chunk.sourceName && (!prevChunk || prevChunk.sourceName !== chunk.sourceName);

          // Special handling for Header chunks or text starting with #
          const isHeading = chunk.type === Granularity.HEADING || chunk.text.trim().startsWith('#');
          const firstLine = chunk.text.split('\n')[0];
          const restOfText = chunk.text.substring(firstLine.length).trim();

          return (
            <React.Fragment key={chunk.id}>
                {showSourceHeader && (
                    <div className="mt-8 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2 text-slate-400">
                        <span className="material-symbols-outlined text-sm">description</span>
                        <span className="text-xs font-bold uppercase tracking-wider">{chunk.sourceName}</span>
                    </div>
                )}
                
                <div
                    onClick={() => onChunkSelect(chunk.id)}
                    className={`
                    group relative mb-6 rounded-xl transition-all duration-200 cursor-pointer overflow-hidden border border-slate-100
                    ${isSelected ? 'bg-indigo-50 shadow-md ring-1 ring-indigo-200' : 'bg-white hover:shadow-md hover:border-indigo-100'}
                    ${!isHeading && sentimentClass}
                    `}
                >
                    {/* Transcript timestamp if available */}
                    {(chunk.startTime || chunk.endTime) && (
                        <div className="absolute top-4 right-4 text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                            {chunk.startTime}
                        </div>
                    )}

                    {/* Render Text with special Heading treatment if applicable */}
                    {isHeading ? (
                        <div className="flex flex-col">
                            {/* Sticky-ish Header for the Section */}
                            <div className="bg-slate-800 text-white p-4 flex items-center justify-between">
                                <h3 className="font-bold text-lg md:text-xl tracking-tight">
                                    {firstLine.replace(/^#+\s*/, '')}
                                </h3>
                                <span className="text-xs uppercase tracking-wider opacity-50 bg-white/10 px-2 py-0.5 rounded">Section</span>
                            </div>
                            <div className="p-6 font-serif text-lg text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {restOfText}
                                {!restOfText && <span className="text-slate-400 italic text-base">(Section Break)</span>}
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 font-serif text-lg text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {chunk.text}
                        </div>
                    )}
                    
                    {/* Inline Tags */}
                    {chunk.tags && chunk.tags.length > 0 && (
                    <div className="px-6 pb-4 flex flex-wrap gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        {chunk.tags.map((tag, i) => (
                        <span key={i} className="text-[10px] uppercase tracking-wider text-indigo-600 font-sans font-bold bg-indigo-50 px-2 py-0.5 rounded-md">#{tag}</span>
                        ))}
                    </div>
                    )}

                    {/* Quick visual indicator if analyzed */}
                    {hasAnalysis && !isHeading && (
                        <div className="absolute top-3 right-3 text-indigo-400" title="Has AI Analysis">
                            <span className="material-symbols-outlined text-[10px] font-bold">star</span>
                        </div>
                    )}
                </div>
            </React.Fragment>
          );
        })}
        
        {chunks.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-slate-300 font-sans">
               <span className="material-symbols-outlined text-4xl mb-2">text_fields</span>
               <p>No text loaded. Go back to Input mode.</p>
            </div>
        )}
      </div>
    </div>
  );
};
