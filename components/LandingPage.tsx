
import React from 'react';

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 animate-fade-in relative overflow-hidden">
      
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-[20%] left-[-10%] w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] right-[20%] w-96 h-96 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-4xl w-full bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 p-12 z-10 flex flex-col items-center text-center">
        
        {/* Header Section */}
        <div className="mb-2">
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wider border border-amber-200">
                Proof of Concept &bull; Alpha
            </span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-light text-slate-800 mb-4 tracking-tight">
          Semantic Text <span className="font-semibold text-indigo-600">Unweaver</span>
        </h1>
        
        <p className="text-lg text-slate-500 max-w-2xl mb-8 leading-relaxed">
          An experimental interface for rich semantic text analysis assisted by Large Language Models.
        </p>

        <div className="text-sm font-medium text-slate-400 mb-12 flex flex-col sm:flex-row items-center gap-2 justify-center">
            <span>Developed by</span>
            <a 
                href="https://dominiklukes.net" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-slate-700 font-bold bg-slate-100 px-3 py-1 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all cursor-pointer"
            >
                Dominik Lukeš
            </a>
            <span className="text-xs opacity-70">(using Google AI Studio)</span>
        </div>

        {/* Process Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-12 text-left">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-4">
                    <span className="material-symbols-outlined">splitscreen</span>
                </div>
                <h3 className="font-bold text-slate-800 mb-2">1. Segment</h3>
                <p className="text-sm text-slate-500">
                    Raw text or CSV data is ingested and intelligently split into semantic chunks based on structure or context.
                </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 mb-4">
                    <span className="material-symbols-outlined">psychology</span>
                </div>
                <h3 className="font-bold text-slate-800 mb-2">2. Analyze</h3>
                <p className="text-sm text-slate-500">
                    The AI acts as a researcher, applying specific lenses (Sentiment, Thematic, Sociological) to unweave meaning.
                </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                    <span className="material-symbols-outlined">hub</span>
                </div>
                <h3 className="font-bold text-slate-800 mb-2">3. Synthesize</h3>
                <p className="text-sm text-slate-500">
                    Results are aggregated into a Knowledge Graph and Dashboard, allowing you to trace evidence back to the source.
                </p>
            </div>
        </div>

        {/* Technical Disclaimer */}
        <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 mb-10 flex flex-col md:flex-row items-center gap-4 text-left">
            <span className="material-symbols-outlined text-slate-400 text-3xl">info</span>
            <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-700 uppercase">Model Configuration</h4>
                <p className="text-xs text-slate-500 mt-1">
                    This demo runs on the <strong>Gemini 2.5 Flash</strong> model for high speed and low latency and low cost. 
                    While impressive as is, more powerful models such as Gemini 2.5 Pro or Gemini 3 Pro would be more suitable for complex tasks.
                </p>
            </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4">
            <button 
                onClick={onStart}
                className="bg-indigo-600 text-white text-lg font-medium px-10 py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all flex items-center gap-3"
            >
                Try the Unweaver
                <span className="material-symbols-outlined">arrow_forward</span>
            </button>
            <p className="text-xs text-slate-400 font-medium">
                Upload your own documents or use the built-in sample Novel & CSV data.
            </p>
        </div>

      </div>
    </div>
  );
};
