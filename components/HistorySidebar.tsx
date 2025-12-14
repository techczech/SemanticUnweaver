
import React, { useEffect, useState } from 'react';
import { SavedVersion, AppState } from '../types';
import { getSavedVersions, saveVersion, deleteVersion } from '../services/storageService';

interface HistorySidebarProps {
  currentState: AppState;
  onLoadVersion: (state: AppState) => void;
  onClose: () => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ currentState, onLoadVersion, onClose }) => {
  const [versions, setVersions] = useState<SavedVersion[]>([]);
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    setVersions(getSavedVersions());
  }, []);

  const handleSave = () => {
    const newVer = saveVersion(currentState, saveName);
    setVersions([newVer, ...versions.filter(v => v.id !== newVer.id)]);
    setSaveName("");
  };

  const handleDelete = (id: string) => {
    const updated = deleteVersion(id);
    setVersions(updated);
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString(undefined, { 
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
    });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 bg-white shadow-2xl border-l border-slate-200 transform transition-transform animate-slide-in-right flex flex-col">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h2 className="font-bold text-slate-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-500">history</span>
          Time Travel
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="p-4 border-b border-slate-100 bg-white">
        <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Save Current State</h3>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Optional name..."
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-200 outline-none"
          />
          <button 
            onClick={handleSave}
            className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-all text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {versions.length === 0 && (
          <div className="text-center text-slate-400 text-sm py-8">
            No saved versions yet.
          </div>
        )}
        {versions.map((v) => (
          <div key={v.id} className="bg-slate-50 rounded-xl border border-slate-200 p-3 hover:border-indigo-200 transition-colors group relative">
            <div className="flex justify-between items-start mb-2">
              <div className="font-medium text-slate-700 text-sm truncate pr-6" title={v.name}>{v.name}</div>
              <button 
                onClick={() => handleDelete(v.id)}
                className="text-slate-300 hover:text-red-500 absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
              <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold">Step {v.step}</span>
              <span>{formatTime(v.timestamp)}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-200 pt-2 mt-2">
               <span>{v.state.documents.length} Docs, {v.state.chunks.length} Chunks</span>
               <button 
                 onClick={() => onLoadVersion(v.state)}
                 className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 uppercase tracking-wider"
               >
                 Restore <span className="material-symbols-outlined text-sm">restore</span>
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
