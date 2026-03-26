
import React, { useState, useRef } from 'react';
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
  const [newDocIsPrivate, setNewDocIsPrivate] = useState(false);
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
    const blob = new Blob([doc.content || ''], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${doc.title}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
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

    const context = Array.isArray(documents)
      ? documents
        .filter(d => d.category === 'Policy' || d.category === 'Bylaws')
        .map(d => `Document: ${d.title}\nContent: ${d.content || 'No content'}`)
        .join('\n\n')
      : '';

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

    // Read file as text to avoid multipart/form-data issues on Vercel
    const readFileAsText = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    };

    // Simulate progress for UX
    let prog = 0;
    const interval = setInterval(() => {
      prog = Math.min(prog + 10, 90);
      setUploadProgress(prog);
    }, 200);

    try {
      let fileContent = await readFileAsText(selectedFile);

      // Vercel has a 4.5MB request body limit. 
      // We truncate content to ~1MB to be safe and ensure the JSON payload succeeds.
      const MAX_CONTENT_LENGTH = 1024 * 1024;
      if (fileContent.length > MAX_CONTENT_LENGTH) {
        fileContent = fileContent.substring(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated for size...]";
      }

      const payload = {
        title: newDocTitle,
        category: newDocCategory,
        isPrivate: newDocIsPrivate,
        committee: newDocCommittee,
        content: fileContent,
        fileType: selectedFile.name.split('.').pop() || 'txt',
        date: new Date().toISOString().split('T')[0]
      };

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      clearInterval(interval);
      setUploadProgress(100);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || 'Upload failed');
      }

      setDocuments(prev => [data, ...prev]);
      setShowUpload(false);
      // Reset form
      setNewDocTitle('');
      setNewDocCategory('Policy');
      setNewDocCommittee('');
      setNewDocIsPrivate(false);
      setSelectedFile(null);

      setReviewingDoc(data);
    } catch (err: any) {
      console.error(err);
      alert(`File upload failed: ${err.message}`);
      clearInterval(interval);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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
          content: reviewingDoc.content,
          committee: reviewingDoc.committee ?? '',
          isPrivate: reviewingDoc.isPrivate ?? false,
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

  const handleAutoTag = async () => {
    if (isGuest || !reviewingDoc?.content) return;
    setIsAnalyzing(true);
    try {
      const result = await geminiService.summarizeAndTag(reviewingDoc.content);
      setReviewingDoc(prev => prev ? {
        ...prev,
        tags: result.tags || [],
        content: prev.content + (result.summary ? `\n\nSummary: ${result.summary}` : '')
      } : null);
    } catch (err) {
      console.error("Auto-tagging failed", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

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
                <h3 className="text-2xl font-black text-slate-800 dark:text-white">Resource Library</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Centralized association archives</p>
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
                    {doc.isPrivate && <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-500 dark:text-amber-400"><i className="fa-solid fa-lock text-[10px]"></i></div>}
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
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Extracted Content</label>
                        <textarea
                          value={reviewingDoc.content || ''}
                          onChange={(e) => isAdmin && !isGuest && setReviewingDoc({ ...reviewingDoc, content: e.target.value })}
                          readOnly={!isAdmin || isGuest}
                          className="w-full h-[400px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl p-6 text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                          placeholder="No content extracted..."
                        />
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <i className="fa-solid fa-wand-magic-sparkles"></i>
                            <h4 className="text-[10px] font-black uppercase tracking-widest">AI Intelligence</h4>
                          </div>
                          {isAdmin && !isGuest && (
                            <button
                              onClick={handleAutoTag}
                              disabled={isAnalyzing}
                              className="text-[9px] font-black bg-emerald-600 text-white px-3 py-1.5 rounded-lg uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
                            >
                              {isAnalyzing ? 'Analyzing...' : 'Auto-Tag & Summarize'}
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-emerald-800/70 dark:text-emerald-400/70 leading-relaxed font-medium">
                          {(isAdmin && !isGuest)
                            ? "Use Gemini to automatically categorize this document, extract key policies, and suggest relevant search tags."
                            : "This document has been indexed by Gemini to provide instant answers in the Resource Search."}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Document Metadata</label>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5">
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Title</p>
                              <input
                                type="text"
                                value={reviewingDoc.title}
                                readOnly={!isAdmin || isGuest}
                                onChange={(e) => isAdmin && !isGuest && setReviewingDoc({ ...reviewingDoc, title: e.target.value })}
                                className="w-full bg-transparent text-xs font-black text-slate-800 dark:text-white outline-none"
                              />
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5">
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Category</p>
                              <select
                                value={reviewingDoc.category}
                                disabled={!isAdmin || isGuest}
                                onChange={(e) => isAdmin && !isGuest && setReviewingDoc({ ...reviewingDoc, category: e.target.value as Document['category'] })}
                                className="w-full bg-transparent text-xs font-black text-slate-800 dark:text-white outline-none appearance-none"
                              >
                                {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Semantic Tags</label>
                          <div className="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5 min-h-[100px]">
                            {reviewingDoc.tags?.map((tag, i) => (
                              <div key={i} className="flex items-center gap-2 bg-white dark:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10">
                                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tight">#{tag}</span>
                                {isAdmin && !isGuest && (
                                  <button
                                    onClick={() => setReviewingDoc({ ...reviewingDoc, tags: reviewingDoc.tags?.filter((_, index) => index !== i) })}
                                    className="text-slate-400 hover:text-red-500"
                                  >
                                    <i className="fa-solid fa-xmark text-[10px]"></i>
                                  </button>
                                )}
                              </div>
                            ))}
                            {isAdmin && !isGuest && (
                              <input
                                type="text"
                                placeholder="+ Add tag..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = (e.target as HTMLInputElement).value.trim();
                                    if (val && !reviewingDoc.tags?.includes(val)) {
                                      setReviewingDoc({ ...reviewingDoc, tags: [...(reviewingDoc.tags || []), val] });
                                      (e.target as HTMLInputElement).value = '';
                                    }
                                  }
                                }}
                                className="flex-1 bg-transparent text-[10px] font-black uppercase outline-none min-w-[100px]"
                              />
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
