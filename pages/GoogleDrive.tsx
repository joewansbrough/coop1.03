
import React, { useState, useEffect } from 'react';
import { HardDrive, ExternalLink, FileText, FolderOpen, ShieldAlert, Loader2 } from 'lucide-react';

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
    // 1. Fetch configuration from server
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setIsInitializing(false);
      })
      .catch(err => {
        console.error('Failed to load config:', err);
        setIsInitializing(false);
      });

    // 2. Poll for Google Scripts readiness
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
      alert('Missing Google Configuration. Check your .env file for PICKER_API_KEY and GOOGLE_CLIENT_ID.');
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
            console.error('GIS Error:', response);
            return;
          }
          createPicker(response.access_token);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      console.error('Token client initialization failed:', err);
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

  const pickerCallback = (data: any) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const doc = data.docs[0];
      setFiles(prev => [
        { 
          id: doc.id, 
          name: doc.name, 
          size: doc.sizeBytes ? `${(doc.sizeBytes / 1024).toFixed(0)} KB` : 'N/A', 
          modified: 'Recently Selected',
          url: doc.url
        },
        ...prev
      ]);
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
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-blue-500">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <h4 className="font-black text-slate-800 dark:text-white truncate uppercase tracking-tight text-sm mb-1">{file.name}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{file.size} • {file.modified}</p>
            </div>
          ))}
          
          <button 
            onClick={handleOpenPicker}
            className="bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-white/5 p-6 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-blue-500 hover:bg-white dark:hover:bg-slate-900 transition-all group group"
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
