// src/components/DriveExplorer.tsx
import React, { useState, useEffect, useCallback } from 'react';

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime: string;
    size?: string;
    webViewLink?: string;
}

interface DriveFolderContents {
    folders: DriveFile[];
    files: DriveFile[];
}

interface RootDetail {
    id: string;
    name: string;
}

interface BreadcrumbItem {
    id: string;
    name: string;
}

const FILE_ICON: Record<string, string> = {
    'application/pdf': 'fa-file-pdf text-red-500',
    'application/vnd.google-apps.document': 'fa-file-word text-blue-500',
    'application/vnd.google-apps.spreadsheet': 'fa-file-excel text-green-500',
    'application/vnd.google-apps.presentation': 'fa-file-powerpoint text-orange-500',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fa-file-word text-blue-500',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'fa-file-excel text-green-500',
};

function getFileIcon(mimeType: string) {
    return FILE_ICON[mimeType] ?? 'fa-file text-slate-400';
}

function formatSize(bytes?: string) {
    if (!bytes) return '';
    const n = parseInt(bytes);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

const DriveExplorer: React.FC = () => {
    const [contents, setContents] = useState<DriveFolderContents | null>(null);
    const [rootDetails, setRootDetails] = useState<RootDetail[]>([]);
    const [isAtRootLevel, setIsAtRootLevel] = useState(false);
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState<DriveFile[] | null>(null);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        loadRoot();
    }, []);

    const loadRoot = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/drive/root');
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to load documents');
            }

            const data = await res.json();
            const roots: RootDetail[] = data.rootDetails ?? [];
            setRootDetails(roots);

            if (roots.length > 1) {
                // Multiple roots — show them as a top-level folder picker
                setIsAtRootLevel(true);
                setContents(null);
                setCurrentFolderId(null);
                setBreadcrumbs([{ id: 'all_roots', name: 'Documents' }]);
            } else {
                // Single root — go straight into its contents
                const singleRootId = data.rootIds?.[0] ?? null; // ✅ fixed: was data.rootId (undefined)
                setIsAtRootLevel(false);
                setContents({ folders: data.folders, files: data.files });
                setCurrentFolderId(singleRootId);
                setBreadcrumbs([{ id: singleRootId ?? 'all_roots', name: roots[0]?.name ?? 'Documents' }]);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // Navigate into a root folder (top-level blue folders)
    const loadRootFolder = async (root: RootDetail) => {
        setLoading(true);
        setError(null);
        setSearch('');
        setSearchResults(null);
        try {
            const res = await fetch(`/api/drive/folders/${root.id}/contents`);
            if (!res.ok) throw new Error('Failed to load folder');
            const data = await res.json();
            setIsAtRootLevel(false);
            setContents(data);
            setCurrentFolderId(root.id);
            setBreadcrumbs([{ id: 'all_roots', name: 'Documents' }, { id: root.id, name: root.name }]);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // Navigate into a subfolder
    const loadFolder = async (folder: DriveFile) => {
        setLoading(true);
        setError(null);
        setSearch('');
        setSearchResults(null);
        try {
            const res = await fetch(`/api/drive/folders/${folder.id}/contents`);
            if (!res.ok) throw new Error('Failed to load folder');
            const data = await res.json();
            setIsAtRootLevel(false);
            setContents(data);
            setCurrentFolderId(folder.id);
            setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const navigateToBreadcrumb = async (crumb: BreadcrumbItem, index: number) => {
        if (index === breadcrumbs.length - 1) return; // already here
        setLoading(true);
        setError(null);
        setSearch('');
        setSearchResults(null);
        try {
            if (crumb.id === 'all_roots') {
                // Restore root-folder picker view without re-fetching
                setIsAtRootLevel(true);
                setContents(null);
                setCurrentFolderId(null);
                setBreadcrumbs([{ id: 'all_roots', name: 'Documents' }]);
                setLoading(false);
                return;
            }
            const res = await fetch(`/api/drive/folders/${crumb.id}/contents`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to navigate');
            }
            const data = await res.json();
            setIsAtRootLevel(false);
            setContents(data);
            setCurrentFolderId(crumb.id);
            setBreadcrumbs(prev => prev.slice(0, index + 1));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = useCallback(async (term: string) => {
        setSearch(term);
        if (!term.trim()) { setSearchResults(null); return; }
        setSearching(true);
        try {
            const res = await fetch(`/api/drive/search?q=${encodeURIComponent(term)}`);
            if (!res.ok) throw new Error('Search failed');
            const data = await res.json();
            setSearchResults(data.files);
        } catch {
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => handleSearch(search), 350);
        return () => clearTimeout(t);
    }, [search, handleSearch]);

    const openFile = (file: DriveFile) => {
        if (file.webViewLink) {
            window.open(file.webViewLink, '_blank', 'noopener,noreferrer');
        }
    };

    const displayFolders = searchResults ? [] : (contents?.folders ?? []);
    const displayFiles = searchResults ?? (contents?.files ?? []);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden">

            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center shrink-0">
                        <i className="fa-brands fa-google-drive text-blue-500 text-sm"></i>
                    </div>
                    {/* Breadcrumbs */}
                    <nav className="flex items-center gap-1 min-w-0 flex-wrap">
                        {breadcrumbs.map((crumb, i) => (
                            <React.Fragment key={crumb.id}>
                                {i > 0 && <i className="fa-solid fa-chevron-right text-[8px] text-slate-300 dark:text-slate-600 shrink-0"></i>}
                                <button
                                    onClick={() => navigateToBreadcrumb(crumb, i)}
                                    className={`text-xs font-black uppercase tracking-tight truncate max-w-[120px] transition-colors ${i === breadcrumbs.length - 1
                                            ? 'text-slate-800 dark:text-white cursor-default'
                                            : 'text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                                        }`}
                                >
                                    {crumb.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </nav>
                </div>

                {/* Search */}
                <div className="relative shrink-0">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search documents…"
                        className="pl-8 pr-4 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-emerald-400 dark:focus:border-emerald-500 text-slate-800 dark:text-white placeholder-slate-400 w-48"
                    />
                    {searching && (
                        <i className="fa-solid fa-spinner animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="divide-y divide-slate-50 dark:divide-white/5 max-h-[364px] overflow-y-auto">
                {loading && (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                        <i className="fa-solid fa-spinner animate-spin mr-2"></i>
                        <span className="text-xs font-medium">Loading…</span>
                    </div>
                )}

                {error && !loading && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <i className="fa-solid fa-triangle-exclamation text-amber-400 text-2xl"></i>
                        <p className="text-xs text-slate-500 font-medium">{error}</p>
                        <button onClick={loadRoot} className="text-xs font-black text-emerald-600 hover:underline uppercase tracking-wide">
                            Retry
                        </button>
                    </div>
                )}

                {!loading && !error && (
                    <>
                        {/* Root folder picker — shown when multiple roots exist */}
                        {isAtRootLevel && rootDetails.map(root => (
                            <button
                                key={root.id}
                                onClick={() => loadRootFolder(root)}
                                className="w-full flex items-center gap-4 px-6 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group text-left"
                            >
                                <i className="fa-solid fa-folder-open text-blue-400 text-lg w-5 shrink-0"></i>
                                <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                                    {root.name}
                                </span>
                                <i className="fa-solid fa-chevron-right text-[10px] text-slate-300 dark:text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0"></i>
                            </button>
                        ))}

                        {/* Subfolders */}
                        {!isAtRootLevel && displayFolders.map(folder => (
                            <button
                                key={folder.id}
                                onClick={() => loadFolder(folder)}
                                className="w-full flex items-center gap-4 px-6 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group text-left"
                            >
                                <i className="fa-solid fa-folder text-amber-400 text-lg w-5 shrink-0"></i>
                                <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                                    {folder.name}
                                </span>
                                <i className="fa-solid fa-chevron-right text-[10px] text-slate-300 dark:text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0"></i>
                            </button>
                        ))}

                        {/* Files */}
                        {!isAtRootLevel && displayFiles.map(file => (
                            <button
                                key={file.id}
                                onClick={() => openFile(file)}
                                className="w-full flex items-center gap-4 px-6 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group text-left"
                            >
                                <i className={`fa-solid ${getFileIcon(file.mimeType)} text-lg w-5 shrink-0`}></i>
                                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                                    {file.name}
                                </span>
                                <div className="flex items-center gap-4 shrink-0">
                                    {file.size && (
                                        <span className="text-[10px] font-medium text-slate-400 hidden sm:block">
                                            {formatSize(file.size)}
                                        </span>
                                    )}
                                    <span className="text-[10px] font-medium text-slate-400 hidden sm:block">
                                        {formatDate(file.modifiedTime)}
                                    </span>
                                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-300 dark:text-slate-600 group-hover:text-emerald-400 transition-colors"></i>
                                </div>
                            </button>
                        ))}

                        {/* Empty state */}
                        {!isAtRootLevel && displayFolders.length === 0 && displayFiles.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                                <i className="fa-solid fa-folder-open text-2xl"></i>
                                <p className="text-xs font-medium">
                                    {search ? 'No results found' : 'This folder is empty'}
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default DriveExplorer;