
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import { geminiService } from '../services/geminiService';
import { Document, Committee, RagCitation } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import DriveExplorer from '../components/DriveExplorer';
import FilterBar from '../components/FilterBar';
import AppAlert from '../components/AppAlert';

import { isDemoMode, useUser, useRefreshData, useEvents, useMinutes } from '../hooks/useCoopData';
import { formatDate } from '../utils/dateUtils';
import { recordTutorialEvent } from '../utils/demoTutorial';
import { getDocumentFileUrl, getDocumentLibraryDestination, getDocumentLibraryOriginalUrl, getMinutesEventId } from '../utils/dashboardDocumentLinks';
import { demoStorage } from '../utils/demoStorage';
import { sortNewestFirst } from '../utils/contentOrdering';
import { readApiResponse } from '../utils/apiResponse';
import { MinutesPDF } from '../services/export/pdfGenerator';
import {
  createErroredRagAskSession,
  createPendingRagAskSession,
  createResolvedRagAskSession,
  parseRagAskSession,
  type RagAskSession,
} from '../utils/ragAskSession';

const RAG_ASK_SESSION_KEY = 'coophub_resource_library_rag_ask';
const RAG_ASK_SESSION_EVENT = 'coophub:resource-library-rag-ask';

const loadStoredRagAskSession = () => {
  if (typeof window === 'undefined') return null;
  return parseRagAskSession(window.sessionStorage.getItem(RAG_ASK_SESSION_KEY));
};

const saveStoredRagAskSession = (session: RagAskSession) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(RAG_ASK_SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent(RAG_ASK_SESSION_EVENT, { detail: session }));
};

const ResourceLibrary: React.FC<{
  isAdmin: boolean,
  isGuest?: boolean,
  documents: Document[],
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>,
  committees?: Committee[],
  isDocumentsLoading?: boolean,
  isDocumentsError?: boolean
}> = ({ isAdmin, isGuest = false, documents, setDocuments, committees = [] }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: user } = useUser();
  const { data: calendarEvents = [] } = useEvents();
  const { data: minutesList = [] } = useMinutes();
  const refreshData = useRefreshData();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [question, setQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [ragSession, setRagSession] = useState<RagAskSession | null>(() => loadStoredRagAskSession());
  const [ragQuestion, setRagQuestion] = useState(() => loadStoredRagAskSession()?.question || '');
  const ragAnswer = ragSession?.answer || '';
  const ragCitations = ragSession?.citations || [];
  const ragStoreNames = ragSession?.storeNames || [];
  const isRagAsking = ragSession?.status === 'pending';
  const [indexingDocumentId, setIndexingDocumentId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'drive' | null>(null);

  // Google Drive states
  const [isScriptsReady, setIsScriptsReady] = useState(false);
  const [config, setConfig] = useState<{ googleClientId: string; googleApiKey: string } | null>(null);

  // Review state
  const [reviewingDoc, setReviewingDoc] = useState<Document | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [accessSummary, setAccessSummary] = useState<{ summary: string; groups: { id: string; name: string; memberCount: number }[] } | null>(null);

  // New document form state
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<Document['category']>('Policy');
  const [newDocCommittee, setNewDocCommittee] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [alertMessage, setAlertMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const categories = ['All', 'Minutes', 'Policy', 'Financial', 'Bylaws', 'Newsletters', 'Cloud'];

  useEffect(() => {
    const syncRagSession = (event?: Event) => {
      const nextSession = event instanceof CustomEvent
        ? event.detail as RagAskSession | null
        : loadStoredRagAskSession();
      setRagSession(nextSession);
      if (nextSession?.question) setRagQuestion(nextSession.question);
    };

    window.addEventListener(RAG_ASK_SESSION_EVENT, syncRagSession);
    return () => window.removeEventListener(RAG_ASK_SESSION_EVENT, syncRagSession);
  }, []);

  const getDocumentWithInferredCommittee = (doc: Document) => {
    if (doc.committee) return doc;

    const matchingCommittee = committees.find((committee) =>
      doc.tags?.some((tag) => tag.toLowerCase() === committee.name.toLowerCase()) ||
      doc.title.toLowerCase().includes(committee.name.toLowerCase())
    );

    return matchingCommittee ? { ...doc, committee: matchingCommittee.name } : doc;
  };

  const getDocumentFileName = (doc: Document) => {
    const extension = doc.fileType?.replace(/^\./, '') || 'pdf';
    const safeTitle = doc.title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'document';
    return safeTitle.toLowerCase().endsWith(`.${extension.toLowerCase()}`) ? safeTitle : `${safeTitle}.${extension}`;
  };

  const getStorageLabel = (doc: Document) => {
    if (doc.storageProvider === 'GOOGLE_DRIVE') return 'Drive';
    if (doc.storageProvider === 'VERCEL_BLOB') return 'Blob';
    if (doc.storageProvider === 'LOCAL') return 'Local';
    if (doc.currentVersion?.storageUrl) return 'Blob';
    if (doc.url?.includes('drive.google.com')) return 'Drive';
    if (doc.url?.startsWith('data:')) return 'Legacy';
    return 'Link';
  };

  const getIngestionDisplay = (doc: Document) => {
    const status = doc.currentVersion?.ingestionStatus || (doc.currentVersion ? 'pending' : null);
    switch (status) {
      case 'processing':
        return { label: 'Processing', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
      case 'ready':
        return { label: 'Ready for AI', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
      case 'failed':
        return { label: 'Failed', className: 'bg-rose-500/10 text-rose-600 border-rose-500/20' };
      case 'pending':
        return { label: 'Pending', className: 'bg-sky-500/10 text-sky-600 border-sky-500/20' };
      default:
        return { label: 'Not indexed', className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-white/5' };
    }
  };

  const dataUrlToBlobUrl = (dataUrl: string) => {
    const [metadata, data] = dataUrl.split(',');
    const mimeType = metadata.match(/data:(.*?);base64/)?.[1] || 'application/octet-stream';
    const binary = window.atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  };

  const getLaunchUrl = (doc: Document, download = false) => {
    const fileUrl = getDocumentLibraryOriginalUrl(doc);
    if (fileUrl?.startsWith('data:')) return dataUrlToBlobUrl(fileUrl);
    if (download && fileUrl?.startsWith('/api/documents/')) {
      return `${fileUrl}${fileUrl.includes('?') ? '&' : '?'}download=1`;
    }
    return fileUrl;
  };

  const openDocument = (doc: Document) => {
    if (!getDocumentFileUrl(doc)) {
      showAlert('This document is stored in the secure association vault. Open it from the viewer instead.', 'info');
      return;
    }

    const launchUrl = getLaunchUrl(doc);
    if (!launchUrl) return;
    window.open(launchUrl, '_blank', 'noopener,noreferrer');
    if (launchUrl.startsWith('blob:')) {
      window.setTimeout(() => URL.revokeObjectURL(launchUrl), 30000);
    }
  };

  const getRagDisplay = (doc: Document) => {
    const status = doc.currentVersion?.ragStatus || 'not_indexed';
    switch (status) {
      case 'indexing':
        return { label: 'AI indexing', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
      case 'indexed':
        return { label: 'AI indexed', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
      case 'failed':
        return { label: 'AI failed', className: 'bg-rose-500/10 text-rose-600 border-rose-500/20' };
      case 'stale':
        return { label: 'AI stale', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' };
      case 'deleted':
        return { label: 'AI deleted', className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-white/5' };
      default:
        return { label: 'Not AI indexed', className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-white/5' };
    }
  };

  const hasDriveFileIdForIndexing = (doc: Document) =>
    Boolean(doc.sourceExternalId) ||
    Boolean((doc.currentVersion as any)?.sourceExternalId);

  const getMinutesPdfContext = (doc: Document) => {
    const eventId = getMinutesEventId(doc);
    const event = calendarEvents.find(item => item.id === eventId);
    const minutes = minutesList.find(item => item.meetingId === eventId) as any;

    if (!eventId || !event || !minutes) return null;

    return {
      event,
      minutesData: {
        ...minutes,
        formData: minutes.formData || minutes.data,
      },
    };
  };

  const createMinutesPdfUrl = async (doc: Document) => {
    const context = getMinutesPdfContext(doc);
    if (!context) return null;

    const blob = await pdf(<MinutesPDF data={context.minutesData} event={context.event} />).toBlob();
    return URL.createObjectURL(blob);
  };

  const handleViewOriginalFile = async (doc: Document, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const launchUrl = getLaunchUrl(doc);

    if (launchUrl) {
      window.open(launchUrl, '_blank', 'noopener,noreferrer');
      if (launchUrl.startsWith('blob:')) {
        window.setTimeout(() => URL.revokeObjectURL(launchUrl), 30000);
      }
      return;
    }

    try {
      const minutesPdfUrl = await createMinutesPdfUrl(doc);
      if (!minutesPdfUrl) {
        showAlert('No original file is attached to this document yet.', 'info');
        return;
      }
      window.open(minutesPdfUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(minutesPdfUrl), 30000);
    } catch (error) {
      console.error('Minutes PDF view error:', error);
      showAlert('Unable to generate the minutes PDF copy.', 'error');
    }
  };

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertMessage({ message, type });
    window.setTimeout(() => setAlertMessage(null), 5000);
  };

  useEffect(() => {
    // Fetch Google Config
    fetch('/api/config')
      .then(res => res.ok ? res.json() : null)
      .then(data => setConfig(data))
      .catch(err => console.error('Failed to load Google config:', err));

    // Load pdf.js if not already present
    if (!(window as any).pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      document.head.appendChild(script);
    }

    // Poll for Google Scripts
    const checkScripts = setInterval(() => {
      if ((window as any).google?.accounts?.oauth2 && (window as any).gapi) {
        setIsScriptsReady(true);
        clearInterval(checkScripts);
      }
    }, 500);

    return () => clearInterval(checkScripts);
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'upload' && isAdmin && !isGuest) {
      setShowUpload(true);
      setUploadMode('file');
    }
    
    const id = searchParams.get('id');
    if (id && Array.isArray(documents)) {
      const doc = documents.find(d => d.id === id);
      if (doc) {
        setReviewingDoc(doc);
        setSearch(''); // Clear search if viewing specific ID
      }
    }

    const searchQuery = searchParams.get('search');
    if (searchQuery) {
      setSearch(searchQuery);
    }
  }, [searchParams, isAdmin, isGuest, documents]);

  useEffect(() => {
    if (!reviewingDoc || !isAdmin || isGuest) {
      setAccessSummary(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/documents/${reviewingDoc.id}/access`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled) setAccessSummary(data);
      })
      .catch(() => {
        if (!cancelled) setAccessSummary(null);
      });

    return () => {
      cancelled = true;
    };
  }, [reviewingDoc?.id, isAdmin, isGuest]);

  const handleOpenPicker = () => {
    if (!config?.googleClientId || !config?.googleApiKey) {
      showAlert('Missing Google configuration. Please check your environment variables.', 'error');
      return;
    }

    // Reuse the access token from the login session if available
    if ((user as any)?.accessToken) {
      console.log('Reusing access token from session for Google Picker');
      createPicker((user as any).accessToken);
      return;
    }

    try {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: config.googleClientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response.error !== undefined) return;
          createPicker(response.access_token);
        },
      });
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      console.error('Picker error:', err);
    }
  };

  const createPicker = (accessToken: string) => {
    (window as any).gapi.load('picker', async () => {
      const view = new (window as any).google.picker.DocsView((window as any).google.picker.ViewId.DOCS);
      view.setIncludeFolders(true);

      const picker = new (window as any).google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(config?.googleApiKey)
        .setCallback(async (data: any) => {
          if (data.action === (window as any).google.picker.Action.PICKED) {
            const driveDoc = data.docs[0];
            const driveTitle = driveDoc.name || driveDoc.title || 'Google Drive document';
            const driveUrl = driveDoc.url || driveDoc.embedUrl || `https://drive.google.com/open?id=${driveDoc.id}`;
            const driveMimeType = driveDoc.mimeType || driveDoc.type || 'application/octet-stream';
            showAlert('Linking Google Drive document...', 'info');

            const newDoc = {
              title: driveTitle,
              category: reviewingDoc?.category || 'Cloud', // Favor user-selected category if available
              url: driveUrl,
              fileType: driveDoc.type || driveMimeType.split('/').pop() || 'gdoc',
              author: 'Google Drive',
              date: new Date().toISOString(),
              tags: ['Google Drive', 'Linked'],
              content: '',
              visibility: reviewingDoc?.visibility || 'MEMBERS',
              committeeAccess: reviewingDoc?.committeeAccess || reviewingDoc?.committee || null,
              storageProvider: 'GOOGLE_DRIVE',
              sourceExternalId: driveDoc.id,
              sourceWebUrl: driveUrl,
              sourceMimeType: driveMimeType,
            };

            try {
              const res = await fetch('/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newDoc)
              });

              const saved = await res.json();

              if (!res.ok) {
                throw new Error(saved.error || saved.details || `Failed to save document: ${res.status}`);
              }

              setDocuments(prev => [saved, ...prev]);
              refreshData();
              setShowUpload(false);
              setUploadMode(null);
              showAlert('Google Drive document linked.', 'success');
              startDriveAiIndexing(saved);

              let extractedContent = '';
              // Optional extraction runs after the document is visible in the library.
              if (driveMimeType === 'application/vnd.google-apps.document' || driveMimeType === 'application/pdf') {
                try {
                  const exportUrl = driveMimeType === 'application/vnd.google-apps.document'
                    ? `https://www.googleapis.com/drive/v3/files/${driveDoc.id}/export?mimeType=text/plain`
                    : `https://www.googleapis.com/drive/v3/files/${driveDoc.id}?alt=media`;

                  const response = await fetch(exportUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                  });

                  if (response.ok) {
                    if (driveMimeType === 'application/pdf') {
                      try {
                        const pdfBytes = await response.arrayBuffer();
                        const pdfjsLib = (window as any).pdfjsLib;
                        if (pdfjsLib) {
                          pdfjsLib.GlobalWorkerOptions.workerSrc =
                            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                          const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
                          const textPages: string[] = [];
                          for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
                            const page = await pdf.getPage(i);
                            const textContent = await page.getTextContent();
                            textPages.push(textContent.items.map((item: any) => item.str).join(' '));
                          }
                          extractedContent = textPages.join('\n\n');
                        }
                      } catch (pdfErr) {
                        console.warn('PDF text extraction failed:', pdfErr);
                      }
                    } else {
                      extractedContent = await response.text();
                    }
                  }
                } catch (err) {
                  console.warn('Could not extract content from Drive file:', err);
                }
              }

              // Auto-extract: if we have content, summarize + generate tags and persist them.
              if (extractedContent && extractedContent.trim().length > 0 &&
                !extractedContent.includes('[Content is in a Cloud PDF')) {
                try {
                  const aiResult = await geminiService.summarizeAndTag(extractedContent);
                  const aiTags = Array.isArray(aiResult.tags) ? aiResult.tags : [];
                  const mergedTags = Array.from(new Set([...(saved.tags || []), ...aiTags]));

                  await fetch(`/api/documents/${saved.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      title: saved.title,
                      category: saved.category,
                      tags: mergedTags,
                      content: extractedContent,
                    }),
                  });

                  const updatedDoc = { ...saved, tags: mergedTags, content: extractedContent };
                  setDocuments(prev => prev.map(d => d.id === saved.id ? updatedDoc : d));
                } catch (aiErr) {
                  console.warn('[AI Extract] Failed to auto-summarize document:', aiErr);
                }
              }
            } catch (err: any) {
              console.error('Failed to save drive doc:', err);
              showAlert(err.message || 'Failed to link document. Please try again.', 'error');
            }
          }
        })
        .build();
      picker.setVisible(true);
    });
  };

  // Filtering logic that supports categories, tags, and search
  const filteredDocs = sortNewestFirst(!Array.isArray(documents) ? [] : documents.filter(d => {
    const matchesFilter = filter === 'All' || d.category === filter || d.tags?.includes(filter);
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  }));

  const handleTagClick = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFilter(tag);
  };

  const handleCategoryClick = (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFilter(cat);
  };

  const handleDownload = async (doc: Document, e?: React.MouseEvent) => {
    e?.stopPropagation();

    let launchUrl = getLaunchUrl(doc, true);
    if (!launchUrl) {
      try {
        launchUrl = await createMinutesPdfUrl(doc);
      } catch (error) {
        console.error('Minutes PDF download error:', error);
        showAlert('Unable to generate the minutes PDF copy.', 'error');
        return;
      }
    }

    if (!launchUrl) {
      showAlert('No downloadable file is attached to this document yet.', 'info');
      return;
    }

    const link = window.document.createElement('a');
    link.href = launchUrl;
    link.download = getDocumentFileName(doc);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    if (launchUrl.startsWith('blob:')) {
      window.setTimeout(() => URL.revokeObjectURL(launchUrl), 30000);
    }
  };

  const handleViewDoc = (doc: Document) => {
    recordTutorialEvent('document_opened');
    const destination = getDocumentLibraryDestination(doc, { isAdmin: isAdmin && !isGuest });

    if (destination.type === 'review') {
      setReviewingDoc(getDocumentWithInferredCommittee(doc));
      return;
    }

    if (destination.type === 'route') {
      navigate(destination.href);
      return;
    }

    openDocument(doc);
  };

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question) return;
    setLoading(true);
    setAiResponse('');

    const docContext = documents.length > 0
      ? documents.map(d =>
        `[Document] Title: ${d.title} | Category: ${d.category}` +
        (d.tags?.length ? ` | Tags: ${d.tags.join(', ')}` : '') +
        (d.content?.trim() ? `\nContent: ${d.content.substring(0, 3000)}` : ' | (no extracted text)')
      ).join('\n\n')
      : 'No documents in the library.';
    const context = `DOCUMENT CONTEXT:\n${docContext}`;

    try {
      const answer = await geminiService.askPolicyQuestion(question, context);
      setAiResponse(answer || 'Sorry, I could not find an answer.');
    } catch (err) {
      setAiResponse('Error communicating with AI Assistant.');
    } finally {
      setLoading(false);
    }
  };

  const handleAskRag = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ragQuestion.trim()) return;

    const pendingSession = createPendingRagAskSession(ragQuestion);
    setRagSession(pendingSession);
    saveStoredRagAskSession(pendingSession);

    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question: ragQuestion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Failed to ask indexed documents');
      const resolvedSession = createResolvedRagAskSession(pendingSession, data);
      setRagSession(resolvedSession);
      saveStoredRagAskSession(resolvedSession);
    } catch (error: any) {
      const erroredSession = createErroredRagAskSession(pendingSession, error);
      setRagSession(erroredSession);
      saveStoredRagAskSession(erroredSession);
      showAlert(erroredSession.error, 'error');
    }
  };

  const handleIndexForAi = async (doc: Document, event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!isAdmin || isGuest || !hasDriveFileIdForIndexing(doc)) return;

    setIndexingDocumentId(doc.id);
    try {
      const res = await fetch(`/api/rag/documents/${doc.id}/index`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Failed to index document');
      showAlert('Document indexing started for AI.', 'success');
    } catch (error: any) {
      showAlert(error.message || 'Failed to index document for AI.', 'error');
    } finally {
      refreshData();
      setIndexingDocumentId(null);
    }
  };

  const startDriveAiIndexing = (doc: Document) => {
    if (!isAdmin || isGuest || !hasDriveFileIdForIndexing(doc)) return;

    setIndexingDocumentId(doc.id);
    fetch(`/api/rag/documents/${doc.id}/index`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        const data = await readApiResponse(res).catch(() => ({}));
        if (!res.ok) throw new Error(data.details || data.error || 'Failed to index document');
      })
      .catch((error: any) => {
        console.warn('[Drive AI Index] Background indexing did not start:', error);
      })
      .finally(() => {
        refreshData();
        setIndexingDocumentId(null);
      });
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

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });

  const readUploadResponse = async (res: Response) => {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return res.json();

    const text = await res.text();
    if (text.toLowerCase().includes('request entity too large')) {
      throw new Error('The file is too large for this upload path. Try a smaller file or link it from Google Drive.');
    }
    throw new Error(text.trim() || `Upload failed: ${res.status}`);
  };

  const handleSimulatedUpload = async () => {
    if (isGuest || !selectedFile) return;
    if (!newDocTitle) {
      showAlert('Please provide a document title.', 'error');
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
      if (isDemoMode()) {
        const dataUrl = await readFileAsDataUrl(selectedFile);
        const fileType = selectedFile.name.includes('.') ? selectedFile.name.split('.').pop()?.toLowerCase() || 'bin' : 'bin';
        const demoDocument: Document = {
          id: `upload-${Date.now()}`,
          title: newDocTitle,
          category: newDocCategory,
          committee: newDocCommittee || undefined,
          url: dataUrl,
          fileType,
          author: user?.name || user?.email || 'Demo User',
          date: new Date().toISOString(),
          tags: Array.from(new Set([
            new Date().getFullYear().toString(),
            newDocCategory,
            ...(newDocCommittee ? [newDocCommittee] : []),
            'Uploaded',
          ])),
          content: `Demo upload: ${selectedFile.name}`,
        };

        demoStorage.addDocument(demoDocument);
        setDocuments(prev => [demoDocument, ...prev]);
        clearInterval(interval);
        setUploadProgress(100);
        setShowUpload(false);
        setUploadMode(null);
        setNewDocTitle('');
        setNewDocCategory('Policy');
        setNewDocCommittee('');
        setSelectedFile(null);
        setReviewingDoc(demoDocument);
        return;
      }

      // Use FormData to send the file directly to the blob upload endpoint
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', newDocTitle);
      formData.append('category', newDocCategory);
      formData.append('committee', newDocCommittee);
      formData.append('visibility', newDocCommittee ? 'COMMITTEE' : 'MEMBERS');
      formData.append('committeeAccess', newDocCommittee);

      const res = await fetch('/api/upload-to-blob', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      clearInterval(interval);
      setUploadProgress(100);

      const data = await readUploadResponse(res);

      if (!res.ok) {
        throw new Error(data.details || data.error || `Upload failed: ${res.status}`);
      }

      setDocuments(prev => [data.document, ...prev]);
      setShowUpload(false);
      setUploadMode(null);
      setNewDocTitle('');
      setNewDocCategory('Policy');
      setNewDocCommittee('');
      setSelectedFile(null);

      setReviewingDoc(data.document);
    } catch (err: any) {
      console.error(err);
      showAlert(`File upload failed: ${err.message}`, 'error');
      clearInterval(interval);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSaveReview = async () => {
    if (isGuest || !reviewingDoc) return;
    if (isDemoMode()) {
      const savedDocument = {
        ...reviewingDoc,
        committee: reviewingDoc.committee || undefined,
        updatedAt: new Date().toISOString(),
      };
      demoStorage.updateDocument(savedDocument);
      setDocuments(prev => prev.map(d => d.id === savedDocument.id ? savedDocument : d));
      refreshData();
      setReviewingDoc(null);
      showAlert('Document saved.', 'success');
      return;
    }

    try {
      const res = await fetch(`/api/documents/${reviewingDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reviewingDoc.title,
          category: reviewingDoc.category,
          tags: reviewingDoc.tags,
          committee: reviewingDoc.committee ?? '',
          content: reviewingDoc.content ?? null,
          visibility: reviewingDoc.visibility || 'MEMBERS',
          committeeAccess: reviewingDoc.committeeAccess ?? reviewingDoc.committee ?? null,
        }),
      });

      const data = await readApiResponse(res);

      if (!res.ok) {
        throw new Error(data.details || data.error || `HTTP error! status: ${res.status}`);
      }

      setDocuments(prev => prev.map(d => d.id === data.id ? data : d));
      refreshData();
      setReviewingDoc(null);
      showAlert('Document saved.', 'success');

    } catch (err: any) {
      console.error("Failed to save document:", err);
      showAlert(`Failed to save document: ${err.message}`, 'error');
    }
  };

  const deleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGuest) return;
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      setDocuments(prev => prev.filter(d => d.id !== id));
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8 max-w-7xl mx-auto pb-12 transition-all animate-in fade-in duration-500" data-demo-target="governance-archive">
      {alertMessage && <AppAlert message={alertMessage.message} type={alertMessage.type} onClose={() => setAlertMessage(null)} />}
      <div className="space-y-2 lg:space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Documents
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Browse the co-op's shared document folder.
            </p>
          </div>
        </div>
        <DriveExplorer />
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-6 lg:space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Resource Library
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Centralized association archives and governance records.
            </p>
          </div>
          {isAdmin && !isGuest && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row" data-demo-target="document-upload-actions">
              <button
                onClick={() => {
                  setShowUpload(true);
                  setUploadMode('file');
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 bg-brand-600 text-white hover:bg-brand-700 active:scale-95 transition-all shadow-lg shadow-brand-500/20"
              >
                <i className="fa-solid fa-file-arrow-up"></i>
                Upload Document
              </button>
              <button
                onClick={handleOpenPicker}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
              >
                <i className="fa-brands fa-google-drive"></i>
                Link from Google Drive
              </button>
            </div>
          )}
        </div>

        {isAdmin && !isGuest && (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col gap-1 mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Ask coopHUB Docs</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Admin search across indexed co-op Drive documents and shared reference material.
              </p>
            </div>
            <form onSubmit={handleAskRag} className="flex flex-col sm:flex-row gap-3">
              <input
                value={ragQuestion}
                onChange={(event) => setRagQuestion(event.target.value)}
                placeholder="Ask about indexed documents..."
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={isRagAsking || !ragQuestion.trim()}
                className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-brand-600 disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-95"
              >
                {isRagAsking ? 'Asking...' : 'Ask'}
              </button>
            </form>
            {isRagAsking && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200">
                Still working on: {ragSession?.question}
              </div>
            )}
            {ragSession?.status === 'error' && ragSession.error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-200">
                {ragSession.error}
              </div>
            )}
            {ragAnswer && (
              <div className="mt-4 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-800 p-4">
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{ragAnswer}</p>
                {ragStoreNames.length > 0 && (
                  <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Stores: {ragStoreNames.join(', ')}
                  </p>
                )}
              </div>
            )}
            {ragCitations.length > 0 && (
              <div className="mt-4 grid gap-2">
                {ragCitations.map((citation, index) => (
                  <div key={`${citation.title}-${index}`} className="rounded-xl border border-slate-200 dark:border-white/5 p-3 text-sm">
                    <div className="font-black text-slate-800 dark:text-white">{citation.title}</div>
                    {citation.pageNumber != null && <div className="text-xs text-slate-500">Page {citation.pageNumber}</div>}
                    {citation.text && <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{citation.text}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
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
          {filteredDocs.map((doc, index) => {
            const fileUrl = getDocumentFileUrl(doc);
            const isCloud = fileUrl?.includes('drive.google.com');
            const ingestion = getIngestionDisplay(doc);
            const rag = getRagDisplay(doc);
            const canIndexForAi = isAdmin && !isGuest && hasDriveFileIdForIndexing(doc);
            return (
              <div
                key={doc.id}
                onClick={() => handleViewDoc(doc)}
                data-demo-target={index === 0 ? 'document-first-card' : undefined}
                className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-white/5 hover:border-brand-300 dark:hover:border-brand-600 transition-all group flex flex-col cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-14 h-14 ${isCloud ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-100 dark:bg-slate-800'} group-hover:bg-brand-50 dark:group-hover:bg-brand-900/20 rounded-2xl flex items-center justify-center ${isCloud ? 'text-blue-500' : 'text-slate-400'} group-hover:text-brand-600 transition-all shrink-0`}>
                    <i className={`fa-solid ${doc.fileType === 'pdf' ? 'fa-file-pdf' : isCloud ? 'fa-brands fa-google-drive' : 'fa-file-lines'} text-2xl`}></i>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-800 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors truncate">{doc.title}</h4>
                      {isCloud && (
                        <span className="flex items-center gap-1 text-[7px] font-black bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full uppercase tracking-tighter shrink-0 border border-blue-500/20">
                          Cloud Link
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{formatDate(doc.date)} • {doc.author}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-white/5">
                        {getStorageLabel(doc)}
                        {doc.currentVersion?.version ? ` v${doc.currentVersion.version}` : ''}
                      </span>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter border ${ingestion.className}`}>
                        {ingestion.label}
                      </span>
                      <span
                        className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter border ${rag.className}`}
                        title={doc.currentVersion?.ragIndexError || undefined}
                      >
                        {rag.label}
                      </span>
                    </div>
                  </div>
                </div>

                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {doc.tags.map(tag => (
                      <button
                        key={tag}
                        onClick={(e) => handleTagClick(tag, e)}
                        className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter transition-all ${filter === tag
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-brand-100 dark:hover:bg-brand-900/30 hover:text-brand-600'
                          }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-50 dark:border-white/5">
                  <button
                    onClick={(e) => handleCategoryClick(doc.category, e)}
                    className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest border transition-all ${filter === doc.category
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-white/5 hover:border-brand-300'
                      }`}
                  >
                    {doc.category}
                  </button>
                  <div className="flex flex-wrap justify-end gap-2">
                    {canIndexForAi && (
                      <button
                        onClick={(event) => handleIndexForAi(doc, event)}
                        disabled={indexingDocumentId === doc.id || doc.currentVersion?.ragStatus === 'indexing'}
                        className="px-3 py-2 rounded-xl bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest hover:bg-brand-600 disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-95"
                        title={doc.currentVersion?.ragIndexError || 'Index for AI search'}
                      >
                        {indexingDocumentId === doc.id || doc.currentVersion?.ragStatus === 'indexing'
                          ? 'Indexing...'
                          : doc.currentVersion?.ragStatus === 'failed'
                            ? 'Retry AI'
                            : 'Index AI'}
                      </button>
                    )}
                    {isAdmin && !isGuest && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReviewingDoc(getDocumentWithInferredCommittee(doc));
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
                      className={`w-10 h-10 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-white rounded-xl flex items-center justify-center ${isCloud ? 'hover:bg-blue-600' : 'hover:bg-brand-600'} transition-all active:scale-95`}
                      title={isCloud ? 'Open in Google Drive' : 'Download'}
                    >
                      <i className={`fa-solid ${isCloud ? 'fa-arrow-up-right-from-square' : 'fa-download'}`}></i>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {showUpload && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-white/5 shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Upload Document</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Add a file to the searchable archive</p>
                </div>
                <button
                  onClick={() => {
                    setShowUpload(false);
                    setUploadMode(null);
                  }}
                  className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="p-8 space-y-5">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/40 p-8 text-center hover:border-brand-400 transition-colors"
                >
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 text-brand-600 shadow-sm">
                    <i className="fa-solid fa-file-arrow-up text-xl"></i>
                  </div>
                  <p className="text-sm font-black text-slate-800 dark:text-white">{selectedFile ? selectedFile.name : 'Drop a file here or click to choose'}</p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">PDF, Word, spreadsheet, or image files</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Document Title</label>
                    <input
                      type="text"
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                      placeholder="Enter document title"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                    <select
                      value={newDocCategory}
                      onChange={(e) => setNewDocCategory(e.target.value as Document['category'])}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                    >
                      {categories.filter(category => category !== 'All').map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Committee</label>
                    <select
                      value={newDocCommittee}
                      onChange={(e) => setNewDocCommittee(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                    >
                      <option value="">None</option>
                      {committees.map(committee => (
                        <option key={committee.id} value={committee.name}>{committee.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {isUploading && (
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-brand-600 transition-all" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                )}
              </div>

              <div className="p-8 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowUpload(false);
                    setUploadMode(null);
                  }}
                  className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSimulatedUpload}
                  disabled={!selectedFile || isUploading}
                  className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-95"
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                    <div className={`w-20 h-20 ${getDocumentFileUrl(reviewingDoc)?.includes('drive.google.com') ? 'bg-blue-500/10 text-blue-500' : 'bg-brand-500/10 text-brand-500'} rounded-3xl flex items-center justify-center mb-6`}>
                      <i className={`fa-solid ${getDocumentFileUrl(reviewingDoc)?.includes('drive.google.com') ? 'fa-brands fa-google-drive' : 'fa-file-shield'} text-3xl`}></i>
                    </div>
                    <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">Streamlined Metadata View</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs">Association documents are now stored externally. Managing metadata below will update the searchable archive.</p>
                    <button
                      onClick={(e) => handleViewOriginalFile(reviewingDoc, e)}
                      className={`mt-8 ${getDocumentFileUrl(reviewingDoc)?.includes('drive.google.com') ? 'bg-blue-600 hover:bg-brand-600' : 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-brand-600 dark:hover:bg-brand-600'} px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all`}
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square"></i>
                      {getDocumentFileUrl(reviewingDoc)?.includes('drive.google.com') ? 'Open in Drive' : 'View Original File'}
                    </button>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Document Metadata
                        {isAdmin && !isGuest && (
                          <span className="ml-2 text-brand-500">
                            <i className="fa-solid fa-pencil text-[8px]"></i> Editable
                          </span>
                        )}
                      </label>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-4 bg-white dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 hover:border-brand-400 dark:hover:border-brand-500 transition-colors">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
                            <i className="fa-solid fa-file-lines text-brand-500"></i> Title
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
                        <div className="p-4 bg-white dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 hover:border-brand-400 dark:hover:border-brand-500 transition-colors">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
                            <i className="fa-solid fa-folder text-brand-500"></i> Category
                          </p>
                          <select
                            value={reviewingDoc.category}
                            disabled={!isAdmin || isGuest}
                            onChange={(e) => isAdmin && !isGuest && setReviewingDoc({ ...reviewingDoc, category: e.target.value as any })}
                            className="w-full bg-white dark:bg-slate-700 text-xs font-black text-slate-800 dark:text-white outline-none appearance-none cursor-pointer"
                          >
                            {categories.filter(c => c !== 'All').map(c => <option key={c} value={c} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="p-4 bg-white dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 hover:border-brand-400 dark:hover:border-brand-500 transition-colors">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
                          <i className="fa-solid fa-users text-brand-500"></i> Committee
                        </p>
                        <select
                          value={reviewingDoc.committee || ''}
                          disabled={!isAdmin || isGuest}
                          onChange={(e) => isAdmin && !isGuest && setReviewingDoc({ ...reviewingDoc, committee: e.target.value })}
                          className="w-full bg-white dark:bg-slate-700 text-xs font-black text-slate-800 dark:text-white outline-none appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">None</option>
                          {committees.map(c => <option key={c.id} value={c.name} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">{c.name}</option>)}
                        </select>
                      </div>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-white dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 hover:border-brand-400 dark:hover:border-brand-500 transition-colors">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
                            <i className="fa-solid fa-shield-halved text-brand-500"></i> Visibility
                          </p>
                          <select
                            value={reviewingDoc.visibility || 'MEMBERS'}
                            disabled={!isAdmin || isGuest}
                            onChange={(e) => isAdmin && !isGuest && setReviewingDoc({ ...reviewingDoc, visibility: e.target.value as Document['visibility'] })}
                            className="w-full bg-white dark:bg-slate-700 text-xs font-black text-slate-800 dark:text-white outline-none appearance-none cursor-pointer"
                          >
                            {['PUBLIC', 'MEMBERS', 'COMMITTEE', 'BOARD', 'ADMIN', 'CUSTOM', 'PRIVATE'].map(value => (
                              <option key={value} value={value} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">{value}</option>
                            ))}
                          </select>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
                            <i className="fa-solid fa-database text-brand-500"></i> Storage
                          </p>
                          <p className="text-xs font-black text-slate-800 dark:text-white">{reviewingDoc.storageProvider || getStorageLabel(reviewingDoc)}</p>
                        </div>
                      </div>
                      {isAdmin && !isGuest && accessSummary && (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/5 dark:bg-slate-800">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Who can see this?</p>
                          <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-200">{accessSummary.summary}</p>
                          {accessSummary.groups.length > 0 && (
                            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              {accessSummary.groups.slice(0, 3).map(group => `${group.name} (${group.memberCount})`).join(' / ')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Semantic Tags
                        {isAnalyzing && (
                          <span className="ml-2 text-brand-500">
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
                              className="w-full bg-white dark:bg-slate-700 border-2 border-brand-400 dark:border-brand-500 rounded-xl px-4 py-2 text-[10px] font-black text-slate-800 dark:text-white uppercase outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-400"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                              <i className="fa-solid fa-plus text-brand-500"></i>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-4">
                <button
                  onClick={() => setReviewingDoc(null)}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
                >
                  {(isAdmin && !isGuest) ? 'Discard Changes' : 'Close Viewer'}
                </button>
                {isAdmin && !isGuest && (
                  <button
                    onClick={handleSaveReview}
                    className="w-full sm:w-auto px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-brand-600 text-white hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20 active:scale-95"
                  >
                    Save
                  </button>
                )}
                <button
                  onClick={(e) => handleDownload(reviewingDoc, e)}
                  className={`w-full sm:w-auto px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest ${getDocumentFileUrl(reviewingDoc)?.includes('drive.google.com') ? 'bg-blue-600' : 'bg-slate-900'} text-white hover:bg-brand-600 transition-all active:scale-95 flex items-center justify-center gap-2`}
                >
                  <i className={`fa-solid ${getDocumentFileUrl(reviewingDoc)?.includes('drive.google.com') ? 'fa-arrow-up-right-from-square' : 'fa-download'}`}></i>
                  {getDocumentFileUrl(reviewingDoc)?.includes('drive.google.com') ? 'Open' : 'Download'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResourceLibrary;
