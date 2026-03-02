
import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestartTour?: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, onRestartTour }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Help & Support</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Get assistance with CoopConnect BC</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center transition-colors">
            <i className="fa-solid fa-xmark text-slate-500"></i>
          </button>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button className="p-6 bg-slate-50 dark:bg-slate-950/30 rounded-3xl border border-slate-100 dark:border-white/5 hover:border-emerald-200 dark:hover:border-emerald-400 transition-all group text-left">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-book"></i>
              </div>
              <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight mb-1">Knowledge Base</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Read co-op guides</p>
            </button>
            <button 
              onClick={() => { onRestartTour?.(); onClose(); }}
              className="p-6 bg-slate-50 dark:bg-slate-950/30 rounded-3xl border border-slate-100 dark:border-white/5 hover:border-emerald-200 dark:hover:border-emerald-400 transition-all group text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-map"></i>
              </div>
              <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight mb-1">Restart Tour</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Re-run onboarding</p>
            </button>
          </div>

          <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                <i className="fa-solid fa-robot"></i>
              </div>
              <div>
                <h4 className="text-sm font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">AI Assistant</h4>
                <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60 font-bold uppercase tracking-widest">Powered by Gemini</p>
              </div>
            </div>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed font-medium">
              Need help with co-op policies or maintenance? Use our AI assistant to get instant answers from your association's bylaws.
            </p>
            <button className="mt-4 w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-500/20">
              Launch Assistant
            </button>
          </div>

          <div className="pt-4">
            <button onClick={onClose} className="w-full py-4 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all">Dismiss</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
