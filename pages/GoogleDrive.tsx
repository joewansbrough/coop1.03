
import React, { useState, useEffect } from 'react';
import { HardDrive, ExternalLink, FileText, FolderOpen, ShieldAlert, Loader2, Trash2 } from 'lucide-react';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const GoogleDrive: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isScriptsReady, setIsScriptsReady] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [config, setConfig] = useState<{ googleClientId: string; googleApiKey: string } | null>(null);

  useEffect(() => {
    console.log('GoogleDrive: Fetching config and existing docs...');
    
    // 1. Fetch configuration from server
    const fetchConfig = fetch('/api/config')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('GoogleDrive: Config received:', { 
          hasClientId: !!data.googleClientId, 
          hasApiKey: !!data.googleApiKey 
        });
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

    Promise.all([fetchConfig, fetchDocs])
      .finally(() => setIsInitializing(false));

    // 3. Poll for Google Scripts readiness
    const checkScripts = setInterval(() => {
      if (window.google?.accounts?.oauth2 && window.gapi) {
        console.log('GoogleDrive: Google scripts ready.');
        setIsScriptsReady(true);
        clearInterval(checkScripts);
      }
    }, 500);

    return () => clearInterval(checkScripts);
  }, []);

  const handleOpenPicker = () => {
    if (!config?.googleClientId || !config?.googleApiKey) {
      console.error('GoogleDrive: Missing credentials in config:', config);
      alert(`Missing Google Configuration.\n\nRequired:\n- PICKER_API_KEY: ${config?.googleApiKey ? 'OK' : 'MISSING'}\n- GOOGLE_CLIENT_ID: ${config?.googleClientId ? 'OK' : 'MISSING'}\n\nPlease check your .env file.`);
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
          console.log('GoogleDrive: Access token received, creating picker...');
          createPicker(response.access_token);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      console.error('GoogleDrive: Token client initialization failed:', err);
      alert('Failed to initialize Google authorization. Check your Client ID in .env.');
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
      console.log('GoogleDrive: File picked, saving to database:', doc.name);
      
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
        alert('Failed to save the linked file. Please try again.');
      }
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to un-link this document?')) return;

    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setFiles(prev => prev.filter(f => f.id !== id));
      } else {
        throw new Error('Failed to delete');
      }
    } catch (err) {
      console.error('GoogleDrive: Error deleting:', err);
      alert('Failed to un-link the document.');
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
      </header>

      {files.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[3rem] p-16 text-center">
          <div className="max-w-md mx-auto">
            <ShieldAlert className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-6" />
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-4 uppercase">No Files Linked</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
              Link existing Google Drive documents to this portal for easy access. We use the <strong>Google Picker API</strong> to ensure you only share specific files with the association.
            </p>
            <div className="flex justify-center gap-4 grayscale opacity-40">
              <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" className="h-8" alt="Drive" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/a/ad/Google_Docs_logo_%282014-2020%29.svg" className="h-8" alt="Docs" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/3/30/Google_Sheets_logo_%282014-2020%29.svg" className="h-8" alt="Sheets" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {files.map(file => (
            <div key={file.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-white/5 hover:border-blue-500 transition-all group cursor-pointer shadow-sm hover:shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                  <FileText className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-white" />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => handleDelete(file.id, e)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-blue-500" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
              <h4 className="font-black text-slate-800 dark:text-white truncate uppercase tracking-tight text-sm mb-1">{file.title}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{file.date} • {file.author}</p>
            </div>
          ))}
          
          <button 
            onClick={handleOpenPicker}
            className="bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-white/5 p-6 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-blue-500 hover:bg-white dark:hover:hover:bg-slate-900 transition-all group group"
          >
            <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <FolderOpen className="w-6 h-6 text-slate-400" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-600 transition-colors">Link Another File</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default GoogleDrive;
