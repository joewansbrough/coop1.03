
import React, { useState } from 'react';
import { geminiService } from '../services/geminiService';
import { Document } from '../types';

const Documents: React.FC<{ 
  isAdmin: boolean, 
  documents: Document[], 
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>> 
}> = ({ isAdmin, documents, setDocuments }) => {
  const [filter, setFilter] = useState('All');
  const [question, setQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // New document form state
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<Document['category']>('Policy');
  const [newDocIsPrivate, setNewDocIsPrivate] = useState(false);

  const categories = ['All', 'Minutes', 'Policy', 'Financial', 'Bylaws', 'Newsletters'];
  const filteredDocs = filter === 'All' ? documents : documents.filter(d => d.category === filter);

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question) return;
    setLoading(true);
    setAiResponse('');
    
    const context = documents.filter(d => d.category === 'Policy').map(d => d.title).join(', ');
    
    try {
      const answer = await geminiService.askPolicyQuestion(question, context);
      setAiResponse(answer || 'Sorry, I could not find an answer.');
    } catch (err) {
      setAiResponse('Error communicating with AI Assistant.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatedUpload = () => {
    if (!newDocTitle) {
      alert("Please provide a document title.");
      return;
    }
    
    setIsUploading(true);
    let prog = 0;
    const interval = setInterval(() => {
      prog += 10;
      setUploadProgress(prog);
      if (prog >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          const newDoc: Document = {
            id: `d${Date.now()}`,
            title: newDocTitle,
            category: newDocCategory,
            date: new Date().toISOString().split('T')[0],
            author: isAdmin ? 'Administrator' : 'Member',
            isPrivate: newDocIsPrivate
          };
          
          setDocuments([newDoc, ...documents]);
          setIsUploading(false);
          setUploadProgress(0);
          setShowUpload(false);
          setNewDocTitle('');
          setNewDocIsPrivate(false);
          alert("Document uploaded and archived in association library.");
        }, 500);
      }
    }, 100);
  };

  return (
    <div className="space-y-6 lg:space-y-8 max-w-7xl mx-auto pb-12">
      <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 text-[15rem] pointer-events-none group-hover:opacity-10 transition-opacity">
          <i className="fa-solid fa-wand-magic-sparkles"></i>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/10 dark:shadow-none">
              <i className="fa-solid fa-robot text-xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">Resource Search</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Instant association rule lookup</p>
            </div>
          </div>
          <form onSubmit={handleAskAI} className="relative">
            <input
              type="text"
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 pr-32 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-medium shadow-inner"
              placeholder="e.g., How many days notice for a general meeting?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button 
              type="submit"
              disabled={loading}
              className="absolute right-2 top-2 bottom-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-emerald-500/10 dark:shadow-none"
            >
              {loading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-bolt"></i>}
              Query
            </button>
          </form>
          {aiResponse && (
            <div className="mt-6 p-6 bg-white/5 border border-white/10 rounded-2xl text-sm leading-relaxed animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest border border-emerald-500/30 px-2 py-0.5 rounded">Search Result</span>
              </div>
              <p className="text-slate-200 font-medium leading-relaxed">{aiResponse}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-2xl font-black text-slate-800 dark:text-white">Resource Library</h3>
          {isAdmin && (
            <button 
              onClick={() => setShowUpload(!showUpload)}
              className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 dark:shadow-none active:scale-95 transition-all"
            >
              <i className="fa-solid fa-plus"></i>
              Add Document
            </button>
          )}
        </div>

        {showUpload && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5 shadow-xl animate-in slide-in-from-top-4">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">Association Upload Portal</h4>
              <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
            </div>
            
            {isUploading ? (
              <div className="space-y-4 py-8">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                  <span>Encrypting & Archiving...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-50 dark:bg-slate-950/50 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl p-10 flex flex-col items-center justify-center text-center group hover:border-emerald-400 transition-colors">
                  <i className="fa-solid fa-file-pdf text-4xl text-slate-300 group-hover:text-emerald-500 mb-4 transition-colors"></i>
                  <p className="text-xs font-black text-slate-400 uppercase">Drop associations files here</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Document Title</label>
                    <input 
                      type="text" 
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                      placeholder="e.g. AGM Minutes 2026"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</label>
                    <select 
                      value={newDocCategory}
                      onChange={(e) => setNewDocCategory(e.target.value as Document['category'])}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-3 py-2">
                    <input 
                      type="checkbox" 
                      id="isPrivate"
                      checked={newDocIsPrivate}
                      onChange={(e) => setNewDocIsPrivate(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    <label htmlFor="isPrivate" className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">Private (Admin Only)</label>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    <p className="text-[10px] text-amber-800 dark:text-amber-500 font-bold leading-relaxed">
                      <i className="fa-solid fa-shield-halved mr-1"></i> 
                      By uploading, you certify this document complies with BC PIPA standards and does not expose unauthorized personal information.
                    </p>
                  </div>
                  <button 
                    onClick={handleSimulatedUpload}
                    className="w-full bg-slate-900 dark:bg-emerald-600 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black dark:hover:bg-emerald-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-plus"></i>
                    Add Document
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex overflow-x-auto gap-2 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`whitespace-nowrap px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                filter === cat 
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white border-slate-900 dark:border-emerald-600 shadow-xl' 
                  : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-white/5 hover:border-emerald-300 hover:text-emerald-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map(doc => (
            <div key={doc.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-white/5 hover:shadow-2xl hover:border-emerald-300 dark:hover:border-emerald-600 transition-all group flex flex-col">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-all shrink-0 shadow-inner">
                  <i className="fa-solid fa-file-pdf text-2xl"></i>
                </div>
                <div className="flex-1 overflow-hidden">
                  <h4 className="text-sm font-black text-slate-800 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">{doc.title}</h4>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{doc.date} • {doc.author}</p>
                </div>
                {doc.isPrivate && <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-500 dark:text-amber-400"><i className="fa-solid fa-lock text-[10px]"></i></div>}
              </div>
              <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-50 dark:border-white/5">
                <span className="text-[9px] font-black px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-widest border border-slate-100 dark:border-white/5">{doc.category}</span>
                <button className="w-10 h-10 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-all active:scale-95">
                  <i className="fa-solid fa-download"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Documents;
