
import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
import { Document, Committee } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import FilterBar from '../components/FilterBar';

const Documents: React.FC<{
  isAdmin: boolean,
  isGuest?: boolean,
  documents: Document[],
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>,
  committees?: Committee[]
}> = ({ isAdmin, isGuest = false, documents, setDocuments, committees = [] }) => {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [question, setQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Review state
  const [reviewingDoc, setReviewingDoc] = useState<Document | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // New document form state
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<Document['category']>('Policy');
  const [newDocCommittee, setNewDocCommittee] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['All', 'Minutes', 'Policy', 'Financial', 'Bylaws', 'Newsletters'];

  // Filtering logic that supports categories, tags, and search
  const filteredDocs = !Array.isArray(documents) ? [] : documents.filter(d => {
    const matchesFilter = filter === 'All' || d.category === filter || d.tags?.includes(filter);
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const handleTagClick = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFilter(tag);
  };

  const handleCategoryClick = (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFilter(cat);
  };

  const handleDownload = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    if (doc.url && doc.url !== '#') {
      window.open(doc.url, '_blank');
    } else {
      alert("This document is stored in the secure association vault. Please click to view.");
    }
  };

  const handleViewDoc = (doc: Document) => {
    if (doc.url && doc.url !== '#') {
      window.open(doc.url, '_blank');
    } else {
      setReviewingDoc(doc);
    }
  };

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question) return;
    setLoading(true);
    setAiResponse('');

    const context = "Association policies and bylaws are stored in the secure archive.";

    try {
      const answer = await geminiService.askPolicyQuestion(question, context);
      setAiResponse(answer || 'Sorry, I could not find an answer.');
    } catch (err) {
      setAiResponse('Error communicating with AI Assistant.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!newDocTitle) {
        setNewDocTitle(file.name.split('.')[0]);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (!newDocTitle) {
        setNewDocTitle(file.name.split('.')[0]);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSimulatedUpload = async () => {
    if (isGuest || !selectedFile) return;
    if (!newDocTitle) {
      alert("Please provide a document title.");
      return;
    }

    setIsUploading(true);

    // Simulate progress for UX
    let prog = 0;
    const interval = setInterval(() => {
      prog = Math.min(prog + 10, 90);
      setUploadProgress(prog);
    }, 200);

    try {
      // Use FormData to send the file directly to the blob upload endpoint
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', newDocTitle);
      formData.append('category', newDocCategory);
      formData.append('committee', newDocCommittee);

      const res = await fetch('/api/upload-to-blob', { // Call the dedicated blob upload endpoint
        method: 'POST',
        body: formData, // Send FormData directly
      });

      clearInterval(interval);
      setUploadProgress(100);

      const data = await res.json(); // Expected response: { url, name, size, document }

      if (!res.ok) {
        throw new Error(data.details || data.error || `Upload failed: ${res.status}`);
      }

      // Update documents list and reset form state
      setDocuments(prev => [data.document, ...prev]); // Use the document object returned from backend
      setShowUpload(false);
      setNewDocTitle('');
      setNewDocCategory('Policy');
      setNewDocCommittee('');
      setSelectedFile(null);

      setReviewingDoc(data.document); // Set the newly created document for review
    } catch (err: any) {
      console.error(err);
      alert(`File upload failed: ${err.message}`);
      clearInterval(interval);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };  const handleSaveReview = async () => {
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

      if (!res.ok) {
        throw new Error(data.details || data.error || `HTTP error! status: ${res.status}`);
      }

      setDocuments(prev => prev.map(d => d.id === data.id ? data : d));
      setReviewingDoc(null);
      alert("Document saved.");

    } catch (err: any) {
      console.error("Failed to save document:", err);
      alert(`Failed to save document: ${err.message}`);
    }
  };

  const deleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGuest) return;
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-analysis temporarily disabled during Blob migration
  useEffect(() => {
    if (reviewingDoc && !isGuest && !isAnalyzing) {
      // Future: Trigger Blob analysis
    }
  }, [reviewingDoc?.id]); // Run when a new document is opened

  return (
        <div className="space-y-6 lg:space-y-8 max-w-7xl mx-auto pb-12">
          <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 text-[15rem] pointer-events-none group-hover:opacity-10 transition-opacity">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center">
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 pr-32 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-medium"
                  placeholder="e.g., How many days notice for a general meeting?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="absolute right-2 top-2 bottom-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 active:scale-95"
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
              <div className="flex flex-col">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Resource Library</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Centralized association archives and governance records.</p>
              </div>
              {isAdmin && !isGuest && (
                <button
                  onClick={() => setShowUpload(!showUpload)}
                  className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 active:scale-95 transition-all ${showUpload ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                >
                  <i className={`fa-solid ${showUpload ? 'fa-xmark' : 'fa-plus'}`}></i>
                  {showUpload ? 'Close Portal' : 'Add Document'}
                </button>
              )}
            </div>

            {showUpload && isAdmin && !isGuest && (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">Association Upload Portal</h4>
                  <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
                </div>

                {isUploading ? (
                  <div className="space-y-4 py-8">
                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                      <span>{isAnalyzing ? 'Analyzing content...' : 'Encrypting & Archiving...'}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                      className={`bg-slate-50 dark:bg-slate-950/50 border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center group transition-all cursor-pointer ${selectedFile ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-200 dark:border-white/10 hover:border-emerald-400'
                        }`}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.txt"
                      />
                      <i className={`fa-solid ${selectedFile ? 'fa-file-circle-check text-emerald-500' : 'fa-file-pdf text-slate-300 group-hover:text-emerald-500'} text-4xl mb-4 transition-colors`}></i>
                      {selectedFile ? (
                        <div>
                          <p className="text-xs font-black text-emerald-600 uppercase tracking-tight">{selectedFile.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-1">{(selectedFile.size / 1024).toFixed(1)} KB • Click to change</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs font-black text-slate-400 uppercase">Drop associations files here</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-1">or click to browse</p>
                        </>
                      )}
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
                      {isAdmin && committees.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Link to Committee (Optional)</label>
                          <select
                            value={newDocCommittee}
                            onChange={(e) => setNewDocCommittee(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">None (General Document)</option>
                            {committees.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                        <p className="text-[10px] text-amber-800 dark:text-amber-500 font-bold leading-relaxed">
                          <i className="fa-solid fa-shield-halved mr-1"></i>
                          By uploading, you certify this document complies with BC PIPA standards and does not expose unauthorized personal information.
                        </p>
                      </div>
                      <button
                        onClick={handleSimulatedUpload}
                        className="w-full bg-slate-900 dark:bg-emerald-600 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black dark:hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-plus"></i>
                        Add Document
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by title or tags..."
              filter={filter}
              onFilterChange={setFilter}
              filterOptions={categories}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocs.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => handleViewDoc(doc)}
                  className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-white/5 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all group flex flex-col cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-all shrink-0">
                      <i className={`fa-solid ${doc.fileType === 'pdf' ? 'fa-file-pdf' : 'fa-file-lines'} text-2xl`}></i>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-800 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">{doc.title}</h4>
                        {doc.tags && doc.tags.length > 0 && (
                          <span className="flex items-center gap-1 text-[7px] font-black bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-full uppercase tracking-tighter shrink-0 border border-emerald-500/20">
                            <i className="fa-solid fa-sparkles text-[6px]"></i>
                            AI Indexed
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{doc.date} • {doc.author}</p>
                    </div>
                  </div>

                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {doc.tags.map(tag => (
                        <button
                          key={tag}
                          onClick={(e) => handleTagClick(tag, e)}
                          className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter transition-all ${filter === tag
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600'
                            }`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-50 dark:border-white/5">
                    <button
                      onClick={(e) => handleCategoryClick(doc.category, e)}
                      className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest border transition-all ${filter === doc.category
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-white/5 hover:border-emerald-300'
                        }`}
                    >
                      {doc.category}
                    </button>
                    <div className="flex gap-2">
                      {isAdmin && !isGuest && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewingDoc(doc);
                            }}
                            className="w-10 h-10 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-white rounded-xl flex items-center justify-center hover:bg-amber-500 transition-all active:scale-95"
                            title="Edit"
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                          <button
                            onClick={(e) => deleteDoc(doc.id, e)}
                            className="w-10 h-10 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-white rounded-xl flex items-center justify-center hover:bg-rose-500 transition-all active:scale-95"
                            title="Delete"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => handleDownload(doc, e)}
                        className="w-10 h-10 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-all active:scale-95"
                      >
                        <i className="fa-solid fa-download"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="h-[400px] bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-white/10 rounded-[2rem] flex flex-col items-center justify-center text-center p-12">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-500 mb-6">
                           <i className="fa-solid fa-file-shield text-3xl"></i>
                        </div>
                        <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">Streamlined Metadata View</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs">Association documents are now stored externally. Managing metadata below will update the searchable archive.</p>
                        <button 
                          onClick={() => handleViewDoc(reviewingDoc)}
                          className="mt-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all"
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square"></i>
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
                                <i className="fa-solid fa-pencil text-[8px]"></i> Editable
                              </span>
                            )}
                          </label>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="p-4 bg-white dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors">
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
                                <i className="fa-solid fa-file-lines text-emerald-500"></i> Title
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
                                <i className="fa-solid fa-folder text-emerald-500"></i> Category
                              </p>
                              <select
                                value={reviewingDoc.category}
                                disabled={!isAdmin || isGuest}
                                onChange={(e) => isAdmin && !isGuest && setReviewingDoc({ ...reviewingDoc, category: e.target.value as Document['category'] })}
                                className="w-full bg-transparent text-xs font-black text-slate-800 dark:text-white outline-none appearance-none cursor-pointer"
                              >
                                {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="p-4 bg-white dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
                              <i className="fa-solid fa-users text-emerald-500"></i> Committee
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
                                <i className="fa-solid fa-spinner animate-spin text-[8px]"></i> Generating tags...
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
                                    <i className="fa-solid fa-xmark text-[10px]"></i>
                                  </button>
                                )}
                              </div>
                            ))}
                            {isAdmin && !isGuest && (
                              <div className="relative flex-1 min-w-[200px]">
                                <input
                                  type="text"
                                  id="tag-input"
                                  placeholder="Type tag name and press Enter"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = (e.target as HTMLInputElement).value.trim();
                                      if (val && !reviewingDoc.tags?.includes(val)) {
                                        setReviewingDoc({ ...reviewingDoc, tags: [...(reviewingDoc.tags || []), val] });
                                        (e.target as HTMLInputElement).value = '';
                                      }
                                    }
                                  }}
                                  className="w-full bg-white dark:bg-slate-700 border-2 border-emerald-400 dark:border-emerald-500 rounded-xl px-4 py-2 text-[10px] font-black text-slate-800 dark:text-white uppercase outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                  <i className="fa-solid fa-plus text-emerald-500"></i>
                                </div>
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
                      {(isAdmin && !isGuest) ? 'Discard Changes' : 'Close Viewer'}
                    </button>
                    {isAdmin && !isGuest && (
                      <button
                        onClick={handleSaveReview}
                        className="px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                      >
                        Save
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDownload(reviewingDoc, e as any)}
                      className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-black transition-all active:scale-95 flex items-center gap-2"
                    >
                      <i className="fa-solid fa-download"></i>
                      Download
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      );
    };

    export default Documents;
