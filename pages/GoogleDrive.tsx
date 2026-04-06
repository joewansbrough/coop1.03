
import React, { useState, useEffect } from 'react';
import { HardDrive, ExternalLink, FileText, FolderOpen, ShieldAlert, Loader2, Trash2, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Document, Committee } from '../types';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface GoogleDriveProps {
  isAdmin: boolean;
  isGuest?: boolean;
}

const GoogleDrive: React.FC<GoogleDriveProps> = ({ isAdmin, isGuest = false }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isScriptsReady, setIsScriptsReady] = useState(false);
  const [files, setFiles] = useState<Document[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [config, setConfig] = useState<{ googleClientId: string; googleApiKey: string } | null>(null);
  
  // Review state
  const [reviewingDoc, setReviewingDoc] = useState<Document | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const categories = ['Minutes', 'Policy', 'Financial', 'Bylaws', 'Newsletters', 'Cloud'];

  useEffect(() => {
    console.log('GoogleDrive: Fetching config and data...');
    
    // 1. Fetch configuration from server
    const fetchConfig = fetch('/api/config')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        setConfig(data);
      });

    // 2. Fetch existing documents from database
    const fetchDocs = fetch('/api/documents')
      .then(res => res.json())
      .then(data => {
        // Only show documents that appear to be Google Drive links (have 'drive.google.com' in URL)
        const driveFiles = data.filter((doc: any) => doc.url && doc.url.includes('drive.google.com'));
        setFiles(driveFiles);
      });

    // 3. Fetch committees for the modal
    const fetchCommittees = fetch('/api/committees')
      .then(res => res.json())
      .then(data => setCommittees(data));

    Promise.all([fetchConfig, fetchDocs, fetchCommittees])
      .finally(() => setIsInitializing(false));

    // 4. Poll for Google Scripts readiness
    const checkScripts = setInterval(() => {
      if (window.google?.accounts?.oauth2 && window.gapi) {
        setIsScriptsReady(true);
        clearInterval(checkScripts);
      }
    }, 500);

    return () => clearInterval(checkScripts);
  }, []);

  const handleOpenPicker = () => {
    if (!config?.googleClientId || !config?.googleApiKey) {
      alert(`Missing Google Configuration. Please check your environment variables.`);
      return;
    }

    if (!isScriptsReady) {
      alert('Google API scripts are still loading. Please wait a few seconds.');
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: config.googleClientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (response: any) => {
          if (response.error !== undefined) {
            console.error('GoogleDrive: GIS Error:', response);
            return;
          }
          createPicker(response.access_token);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      console.error('GoogleDrive: Token client initialization failed:', err);
    }
  };

  const createPicker = (accessToken: string) => {
    window.gapi.load('picker', () => {
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
      view.setIncludeFolders(true);
      
      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(config?.googleApiKey)
        .setCallback(pickerCallback)
        .build();
      picker.setVisible(true);
    });
  };

  const pickerCallback = async (data: any) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const doc = data.docs[0];
      
      const newDoc = {
        title: doc.name,
        category: 'Cloud',
        url: doc.url,
        fileType: doc.type || 'gdoc',
        author: 'Google Drive',
        date: new Date().toISOString().split('T')[0],
        tags: ['Google Drive', 'Linked']
      };

      try {
        const response = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newDoc)
        });

        if (!response.ok) throw new Error('Failed to save document to database');
        
        const savedDoc = await response.json();
        setFiles(prev => [savedDoc, ...prev]);
      } catch (err) {
        console.error('GoogleDrive: Error saving document:', err);
      }
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGuest) return;
    if (!window.confirm('Are you sure you want to un-link this document?')) return;

    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setFiles(prev => prev.filter(f => f.id !== id));
      }
    } catch (err) {
      console.error('GoogleDrive: Error deleting:', err);
    }
  };

  const handleSaveReview = async () => {
    if (isGuest || !reviewingDoc) return;
    try {
      const res = await fetch(`/api/documents/${reviewingDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reviewingDoc.title,
          category: reviewingDoc.category,
          tags: reviewingDoc.tags,
          committee: reviewingDoc.committee ?? '',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      setFiles(prev => prev.map(d => d.id === data.id ? data : d));
      setReviewingDoc(null);
      alert("Document saved.");
    } catch (err: any) {
      alert(`Failed to save document: ${err.message}`);
    }
  };

  const handleDownload = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    if (doc.url && doc.url !== '#') {
      window.open(doc.url, '_blank');
    }
  };

  const handleViewDoc = (doc: Document) => {
    if (doc.url && doc.url !== '#') {
      window.open(doc.url, '_blank');
    } else {
      setReviewingDoc(doc);
    }
  };

  if (isInitializing) {
    return (
      <div className="h-96 w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <HardDrive className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Cloud Storage</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Securely browse and link co-op documents from Google Drive.</p>
          </div>
        </div>
        
        {isAdmin && !isGuest && (
          <button 
            onClick={handleOpenPicker}
            disabled={!isScriptsReady}
            className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 shadow-lg active:scale-95 ${
              isScriptsReady 
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isScriptsReady ? (
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4 brightness-0 invert" alt="" />
            ) : (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {isScriptsReady ? (files.length > 0 ? 'Select More Files' : 'Browse Google Drive') : 'Initializing Google API...'}
          </button>
        )}
      </header>

      {files.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[3rem] p-16 text-center">
          <div className="max-w-md mx-auto">
            <ShieldAlert className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-6" />
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-4 uppercase">No Files Linked</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
              Link existing Google Drive documents to this portal for easy access. We use the <strong>Google Picker API</strong> to ensure you only share specific files with the association.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {files.map(file => (
            <div 
              key={file.id} 
              onClick={() => handleViewDoc(file)}
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-white/5 hover:border-blue-500 transition-all group cursor-pointer shadow-sm hover:shadow-xl active:scale-[0.98]"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                  <FileText className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-white" />
                </div>
                <div className="flex gap-2">
                  {isAdmin && !isGuest && (
                    <>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setReviewingDoc(file);
                        }}
                        className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-white hover:bg-amber-500 flex items-center justify-center transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(file.id, e)}
                        className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-white hover:bg-red-500 flex items-center justify-center transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-500 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
              <h4 className="font-black text-slate-800 dark:text-white truncate uppercase tracking-tight text-sm mb-1 group-hover:text-blue-600 transition-colors">{file.title}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{file.date} • {file.author}</p>
              
              {file.tags && file.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-4">
                  {file.tags.map(tag => (
                    <span key={tag} className="text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-400 uppercase tracking-tighter">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          
          {isAdmin && !isGuest && (
            <button 
              onClick={handleOpenPicker}
              className="bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-white/5 p-6 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-blue-500 hover:bg-white dark:hover:bg-slate-900 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <FolderOpen className="w-6 h-6 text-slate-400" />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-600 transition-colors">Link Another File</span>
            </button>
          )}
        </div>
      )}

      {/* Review & Tagging Modal */}
      <AnimatePresence>
        {reviewingDoc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {(isAdmin && !isGuest) ? 'Document Review Portal' : 'Document Viewer'}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                    {(isAdmin && !isGuest) ? 'Verify content & apply semantic tags' : 'View association archives & AI summaries'}
                  </p>
                </div>
                <button onClick={() => setReviewingDoc(null)} className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
                   <Trash2 className="w-4 h-4" /> {/* Using Trash2 as a close icon replacement if X is not available, but let's use a div with X */}
                   <span className="font-bold text-xl">×</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="h-[400px] bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-white/10 rounded-[2rem] flex flex-col items-center justify-center text-center p-12">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-500 mb-6">
                       <HardDrive className="w-10 h-10" />
                    </div>
                    <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">Cloud Storage View</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs">This document is linked from Google Drive. Managing metadata below will update the searchable archive.</p>
                    <button 
                      onClick={() => handleViewDoc(reviewingDoc)}
                      className="mt-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Launch Original File
                    </button>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Document Metadata
                        {isAdmin && !isGuest && (
                          <span className="ml-2 text-emerald-500">
                            <Pencil className="w-2 h-2 inline mr-1" /> Editable
                          </span>
                        )}
                      </label>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-4 bg-white dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
                            <FileText className="w-3 h-3 text-emerald-500" /> Title
                          </p>
                          <input
                            type="text"
                            value={reviewingDoc.title}
                            readOnly={!isAdmin || isGuest}
                            onChange={(e) => isAdmin && !isGuest && setReviewingDoc({ ...reviewingDoc, title: e.target.value })}
                            className="w-full bg-transparent text-xs font-black text-slate-800 dark:text-white outline-none placeholder-slate-300"
                            placeholder={isAdmin && !isGuest ? "Click to edit title..." : ""}
                          />
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
                            <FolderOpen className="w-3 h-3 text-emerald-500" /> Category
                          </p>
                          <select
                            value={reviewingDoc.category}
                            disabled={!isAdmin || isGuest}
                            onChange={(e) => isAdmin && !isGuest && setReviewingDoc({ ...reviewingDoc, category: e.target.value as any })}
                            className="w-full bg-transparent text-xs font-black text-slate-800 dark:text-white outline-none appearance-none cursor-pointer"
                          >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="p-4 bg-white dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
                          <HardDrive className="w-3 h-3 text-emerald-500" /> Committee
                        </p>
                        <select
                          value={reviewingDoc.committee || ''}
                          disabled={!isAdmin || isGuest}
                          onChange={(e) => isAdmin && !isGuest && setReviewingDoc({ ...reviewingDoc, committee: e.target.value })}
                          className="w-full bg-transparent text-xs font-black text-slate-800 dark:text-white outline-none appearance-none cursor-pointer"
                        >
                          <option value="">None</option>
                          {committees.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Semantic Tags
                        {isAnalyzing && (
                          <span className="ml-2 text-emerald-500">
                            <Loader2 className="w-2 h-2 animate-spin inline mr-1" /> Generating...
                          </span>
                        )}
                      </label>
                      <div className="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5 min-h-[100px]">
                        {reviewingDoc.tags?.map((tag, i) => (
                          <div key={i} className="flex items-center gap-2 bg-white dark:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10">
                            <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tight">#{tag}</span>
                            {isAdmin && !isGuest && (
                              <button
                                onClick={() => setReviewingDoc({ ...reviewingDoc, tags: reviewingDoc.tags?.filter((_, index) => index !== i) })}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                        {isAdmin && !isGuest && (
                          <div className="relative flex-1 min-w-[150px]">
                            <input
                              type="text"
                              placeholder="Add tag..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = (e.target as HTMLInputElement).value.trim();
                                  if (val && !reviewingDoc.tags?.includes(val)) {
                                    setReviewingDoc({ ...reviewingDoc, tags: [...(reviewingDoc.tags || []), val] });
                                    (e.target as HTMLInputElement).value = '';
                                  }
                                }
                              }}
                              className="w-full bg-white dark:bg-slate-700 border-2 border-emerald-400 dark:border-emerald-500 rounded-xl px-4 py-1 text-[10px] font-black text-slate-800 dark:text-white uppercase outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-white/5 flex justify-end gap-4">
                <button
                  onClick={() => setReviewingDoc(null)}
                  className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
                >
                  {(isAdmin && !isGuest) ? 'Discard' : 'Close'}
                </button>
                {isAdmin && !isGuest && (
                  <button
                    onClick={handleSaveReview}
                    className="px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-all active:scale-95"
                  >
                    Save Changes
                  </button>
                )}
                <button
                  onClick={(e) => handleDownload(reviewingDoc, e as any)}
                  className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-black transition-all active:scale-95 flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GoogleDrive;
