import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { isDemoMode, useTenants, useCommittees, useEvents, useUser, useRefreshData } from '../hooks/useCoopData';
import { Tenant, Committee, CoopEvent, Document as CoopDocument } from '../types';
import RichTextEditor from './RichTextEditor';
import { generateMinutesWord } from '../services/export/wordGenerator';
import { MinutesPDF } from '../services/export/pdfGenerator';
import { demoStorage } from '../utils/demoStorage';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { ChevronDown, FileText, FileCode, Printer, Download } from 'lucide-react';

interface MinutesBuilderProps {
  meetingId: string;
  initialData?: any;
  documents?: CoopDocument[];
  setDocuments?: React.Dispatch<React.SetStateAction<CoopDocument[]>>;
  onSave?: (data: any) => void;
}

type MeetingType = 'quick' | 'regular' | 'agm' | 'special';

interface MotionItem {
  id: string;
  description: string;
  mover: string;
  seconder: string;
  result: 'carried' | 'defeated' | 'tabled' | 'withdrawn' | '';
}

interface AttendeeItem {
  id: string;
  name: string;
  position: string;
}

interface ActionItem {
  id: string;
  description: string;
  responsible: string[];
  dueDate: string;
}

const MinutesBuilder: React.FC<MinutesBuilderProps> = ({ meetingId, initialData, documents = [], setDocuments, onSave }) => {
  const [step, setStep] = useState<'select' | 'build'>('select');
  const [meetingType, setMeetingType] = useState<MeetingType>('regular');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
  const [isScriptsReady, setIsScriptsReady] = useState(false);
  const [isLinkingDriveDocument, setIsLinkingDriveDocument] = useState(false);
  const [config, setConfig] = useState<{ googleClientId: string; googleApiKey: string } | null>(null);

  const { data: user } = useUser();
  const refreshData = useRefreshData();
  const { data: tenants = [] } = useTenants();
  const { data: committees = [] } = useCommittees();
  const { data: events = [] } = useEvents();

  const currentEvent = events.find(e => e.id === meetingId);
  const committeeMembers = React.useMemo(() => {
    if (!currentEvent?.committeeId) return tenants;
    const committee = committees.find(c => c.id === currentEvent.committeeId);
    if (!committee) return tenants;
    // Assuming committee.members is an array of tenant IDs or objects
    // If it's a list of IDs, we filter tenants.
    // Based on types.ts, it's any[]. Let's try to match by firstName/lastName if needed, 
    // but usually it's better to just use all tenants as options if committee info is sparse.
    return tenants; 
  }, [currentEvent, committees, tenants]);

  // Form state
  const [formData, setFormData] = useState({
    meetingDate: '',
    startTime: '',
    endTime: '',
    location: '',
    chair: '',
    territorialAck: '',
    quorumRequired: '',
    quorumPresent: '',
    noticeConfirmed: false,
    quorumConfirmed: false,
    minuteTaker: '',
    agendaChanges: '',
    agendaApproved: false,
    previousMinutesDate: '',
    minutesCorrections: '',
    minutesApproved: false,
    businessArising: '',
    boardReport: '',
    financeReport: '',
    committeeReports: '',
    auditorReport: '',
    managementReport: '',
    newBusiness: '',
    actionItems: '',
    approvedBy: '',
    approvalDate: '',
    additionalNotes: '',
    actionItemsList: [] as ActionItem[],
    // Quick meeting specific
    keyDecisions: '',
    nextSteps: '',
    // AGM specific
    totalSeats: '',
    vacancies: '',
    candidates: '',
    nominations: '',
    electionResults: '',
    scrutineers: [] as string[],
    ballotsDisposed: false,
    // Multi-name fields
    directorsAbsent: [] as string[],
    guests: [] as string[],
    linkedDocument: null as { id: string; title: string; url: string; fileType: string } | null,
  });

  const [attendees, setAttendees] = useState<AttendeeItem[]>([
    { id: '1', name: '', position: '' }
  ]);
  const [motions, setMotions] = useState<MotionItem[]>([]);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.ok ? res.json() : null)
      .then(data => setConfig(data))
      .catch(err => console.error('Failed to load Google config:', err));

    const checkScripts = setInterval(() => {
      if ((window as any).google?.accounts?.oauth2 && (window as any).gapi) {
        setIsScriptsReady(true);
        clearInterval(checkScripts);
      }
    }, 500);

    return () => clearInterval(checkScripts);
  }, []);

  useEffect(() => {
    if (initialData) {
      const data = initialData.formData || initialData.data || formData;
      // Ensure array fields are actually arrays (migration from old string format)
      if (typeof data.directorsAbsent === 'string') data.directorsAbsent = data.directorsAbsent ? data.directorsAbsent.split(',').map((s: string) => s.trim()) : [];
      if (typeof data.guests === 'string') data.guests = data.guests ? data.guests.split(',').map((s: string) => s.trim()) : [];
      if (typeof data.scrutineers === 'string') data.scrutineers = data.scrutineers ? data.scrutineers.split(',').map((s: string) => s.trim()) : [];
      if (!Array.isArray(data.actionItemsList)) data.actionItemsList = [];
      
      setFormData(prev => ({ ...prev, ...data }));
      setAttendees(initialData.attendees || attendees);
      setMotions(initialData.motions || motions);
      setMeetingType(initialData.meetingType || 'regular');
      setStep('build');
    } else {
      // Load from localStorage if available
      const saved = localStorage.getItem(`minutes-${meetingId}`);
      if (saved) {
        const data = JSON.parse(saved);
        const fData = data.formData || formData;
        // Migration check
        if (typeof fData.directorsAbsent === 'string') fData.directorsAbsent = fData.directorsAbsent ? fData.directorsAbsent.split(',').map((s: string) => s.trim()) : [];
        if (typeof fData.guests === 'string') fData.guests = fData.guests ? fData.guests.split(',').map((s: string) => s.trim()) : [];
        if (typeof fData.scrutineers === 'string') fData.scrutineers = fData.scrutineers ? fData.scrutineers.split(',').map((s: string) => s.trim()) : [];
        if (!Array.isArray(fData.actionItemsList)) fData.actionItemsList = [];
        
        setFormData(prev => ({ ...prev, ...fData }));
        setAttendees(data.attendees || attendees);
        setMotions(data.motions || motions);
        setMeetingType(data.meetingType || 'regular');
        if (data.meetingType) {
          setStep('build');
        }
      }
    }
  }, [meetingId, initialData]);

  const sanitizeFormData = (data: typeof formData) => {
    const richTextFields = [
      'boardReport', 'financeReport', 'committeeReports', 'actionItems', 
      'newBusiness', 'keyDecisions', 'nextSteps', 'auditorReport', 
      'nominations', 'electionResults'
    ];
    
    const sanitized = { ...data };
    richTextFields.forEach(field => {
      if ((sanitized as any)[field]) {
        (sanitized as any)[field] = DOMPurify.sanitize((sanitized as any)[field]);
      }
    });
    return sanitized;
  };

  const autoSave = () => {
    const data = {
      formData: sanitizeFormData(formData),
      attendees,
      motions,
      meetingType,
      lastSaved: new Date().toISOString(),
    };
    localStorage.setItem(`minutes-${meetingId}`, JSON.stringify(data));
    setLastSaved(new Date());
  };

  useEffect(() => {
    if (step === 'build') {
      const interval = setInterval(autoSave, 30000);
      return () => clearInterval(interval);
    }
  }, [formData, attendees, motions, step]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSaveStatus('idle');
  };

  const handleLinkedDocumentChange = (documentId: string) => {
    const doc = documents.find(d => d.id === documentId);
    handleInputChange('linkedDocument', doc ? {
      id: doc.id,
      title: doc.title,
      url: doc.url,
      fileType: doc.fileType,
    } : null);
  };

  const linkDocumentToMinutes = (doc: CoopDocument) => {
    handleInputChange('linkedDocument', {
      id: doc.id,
      title: doc.title,
      url: doc.url,
      fileType: doc.fileType,
    });
  };

  const handleOpenPicker = () => {
    if (!isScriptsReady) {
      window.alert('Google Picker is still loading. Please try again in a moment.');
      return;
    }

    if (!config?.googleClientId || !config?.googleApiKey) {
      window.alert('Missing Google configuration. Please check your environment variables.');
      return;
    }

    if ((user as any)?.accessToken) {
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
      window.alert('Unable to open Google Picker. Please try again.');
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
          if (data.action !== (window as any).google.picker.Action.PICKED) return;

          const driveDoc = data.docs[0];
          const newDoc: CoopDocument = {
            id: `drive-${driveDoc.id}`,
            title: driveDoc.name,
            category: 'Minutes',
            url: driveDoc.url,
            fileType: driveDoc.type || driveDoc.mimeType || 'gdoc',
            author: 'Google Drive',
            date: new Date().toISOString(),
            tags: ['Google Drive', 'Linked', 'Minutes'],
            content: '',
          };

          setIsLinkingDriveDocument(true);
          try {
            if (isDemoMode()) {
              setDocuments?.(prev => prev.some(doc => doc.id === newDoc.id) ? prev : [newDoc, ...prev]);
              linkDocumentToMinutes(newDoc);
              return;
            }

            const res = await fetch('/api/documents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newDoc),
            });
            const saved = await res.json();
            if (!res.ok) {
              throw new Error(saved.error || saved.details || `Failed to save document: ${res.status}`);
            }

            setDocuments?.(prev => [saved, ...prev]);
            refreshData();
            linkDocumentToMinutes(saved);
          } catch (err: any) {
            console.error('Failed to save drive doc:', err);
            window.alert(err.message || 'Failed to link document. Please try again.');
          } finally {
            setIsLinkingDriveDocument(false);
          }
        })
        .build();
      picker.setVisible(true);
    });
  };

  const addActionItem = () => {
    handleInputChange('actionItemsList', [
      ...(formData.actionItemsList || []),
      { id: Date.now().toString(), description: '', responsible: [], dueDate: '' },
    ]);
  };

  const removeActionItem = (id: string) => {
    handleInputChange('actionItemsList', (formData.actionItemsList || []).filter(item => item.id !== id));
  };

  const updateActionItem = (id: string, field: keyof ActionItem, value: any) => {
    handleInputChange(
      'actionItemsList',
      (formData.actionItemsList || []).map(item => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  const addAttendee = () => {
    setAttendees([...attendees, { id: Date.now().toString(), name: '', position: '' }]);
    setIsDirty(true);
    setSaveStatus('idle');
  };

  const removeAttendee = (id: string) => {
    if (attendees.length > 1) {
      setAttendees(attendees.filter(a => a.id !== id));
      setIsDirty(true);
      setSaveStatus('idle');
    }
  };

  const updateAttendee = (id: string, field: 'name' | 'position', value: string) => {
    setAttendees(attendees.map(a => a.id === id ? { ...a, [field]: value } : a));
    setIsDirty(true);
    setSaveStatus('idle');
  };

  const addMotion = () => {
    setMotions([...motions, {
      id: Date.now().toString(),
      description: '',
      mover: '',
      seconder: '',
      result: ''
    }]);
    setIsDirty(true);
    setSaveStatus('idle');
  };

  const removeMotion = (id: string) => {
    setMotions(motions.filter(m => m.id !== id));
    setIsDirty(true);
    setSaveStatus('idle');
  };

  const updateMotion = (id: string, field: keyof MotionItem, value: any) => {
    setMotions(motions.map(m => m.id === id ? { ...m, [field]: value } : m));
    setIsDirty(true);
    setSaveStatus('idle');
  };

// In your MinutesBuilder component

const handleSave = async () => {
  setSaveStatus('saving'); // Indicate saving process has started

  if (!formData.chair?.trim() || !formData.minuteTaker?.trim()) {
    alert('Chairperson and Minutes Recorded By are required before saving minutes.');
    setSaveStatus('idle');
    return;
  }

  const payload = {
    meetingType,
    formData: sanitizeFormData(formData),
    attendees,
    motions,
  };

  try {
    if (isDemoMode()) {
      const existingMinutes = demoStorage.getMinutes().find((minutes: any) => minutes.meetingId === meetingId);
      const now = new Date().toISOString();
      const savedMinutes = {
        ...existingMinutes,
        id: existingMinutes?.id || `minutes-${meetingId}`,
        meetingId,
        ...payload,
        data: payload.formData,
        createdAt: existingMinutes?.createdAt || now,
        updatedAt: now,
        createdBy: existingMinutes?.createdBy || 'demo@coophub.bc.ca',
      };

      if (existingMinutes) {
        demoStorage.updateMinutes(savedMinutes);
      } else {
        demoStorage.addMinutes(savedMinutes);
      }

      setSaveStatus('success');
      setIsDirty(false);
      localStorage.removeItem(`minutes-${meetingId}`);
      onSave?.(savedMinutes);
      return;
    }

    const response = await fetch(`/api/minutes/${meetingId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Save Error Response:', error); // Log response body for debugging
      throw new Error(error.details || error.error || 'Failed to save minutes. Please check console for details.');
    }

    const savedMinutes = await response.json();
    
    console.log('✅ Minutes saved:', savedMinutes);
    
    setSaveStatus('success'); // Set success state
    setIsDirty(false); // Mark as not dirty
    localStorage.removeItem(`minutes-${meetingId}`);
    onSave?.(savedMinutes);

  } catch (error: any) { // Explicitly type error for message property
    console.error('❌ Error saving minutes:', error);
    alert(`Failed to save: ${error.message}`);
    setSaveStatus('idle'); // Reset to idle on error
    // isDirty remains true as the save failed
  }
};


  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const blob = await pdf(<MinutesPDF data={{ formData, attendees, motions, meetingType }} event={currentEvent} />).toBlob();
      saveAs(blob, `Minutes_${formData.meetingDate || currentEvent?.date?.split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleExportWord = async () => {
    setIsExporting(true);
    try {
      await generateMinutesWord({ formData, attendees, motions, meetingType }, currentEvent);
    } catch (err) {
      console.error('Word Export Error:', err);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleExport = () => {
    window.print();
    setShowExportMenu(false);
  };

  const selectMeetingType = (type: MeetingType) => {
    setMeetingType(type);
    setStep('build');
  };

  if (step === 'select') {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-top-2">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
            Select Meeting Type
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            Choose the meeting format to get the appropriate template and guidance. 
            You can always add or remove sections as needed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Quick Meeting */}
          <button
            onClick={() => selectMeetingType('quick')}
            className="group relative bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-slate-200 dark:border-white/5 hover:border-brand-500 dark:hover:border-brand-500 transition-all hover:scale-[1.02] active:scale-100 text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <i className="fa-solid fa-bolt text-8xl"></i>
            </div>
            <div className="relative">
              <div className="w-14 h-14 bg-brand-100 dark:bg-brand-900/30 rounded-2xl flex items-center justify-center mb-4">
                <i className="fa-solid fa-bolt text-2xl text-brand-600 dark:text-brand-400"></i>
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">
                Quick Meeting
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                For informal check-ins, brief updates, or quick decision-making sessions.
              </p>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-brand-500"></i>
                  <span>Basic attendance & decisions</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-brand-500"></i>
                  <span>Key points & action items</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-brand-500"></i>
                  <span>~5 minute setup</span>
                </div>
              </div>
            </div>
          </button>

          {/* Regular Board Meeting */}
          <button
            onClick={() => selectMeetingType('regular')}
            className="group relative bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-slate-200 dark:border-white/5 hover:border-brand-500 dark:hover:border-brand-500 transition-all hover:scale-[1.02] active:scale-100 text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <i className="fa-solid fa-clipboard-list text-8xl"></i>
            </div>
            <div className="relative">
              <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4">
                <i className="fa-solid fa-clipboard-list text-2xl text-blue-600 dark:text-blue-400"></i>
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">
                Regular Board Meeting
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Standard monthly or bi-weekly board meetings with full agenda and reporting.
              </p>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-blue-500"></i>
                  <span>Complete attendance tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-blue-500"></i>
                  <span>Reports, motions & discussions</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-blue-500"></i>
                  <span>~10-15 minute setup</span>
                </div>
              </div>
            </div>
          </button>

          {/* Annual General Meeting */}
          <button
            onClick={() => selectMeetingType('agm')}
            className="group relative bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-slate-200 dark:border-white/5 hover:border-brand-500 dark:hover:border-brand-500 transition-all hover:scale-[1.02] active:scale-100 text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <i className="fa-solid fa-award text-8xl"></i>
            </div>
            <div className="relative">
              <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-4">
                <i className="fa-solid fa-award text-2xl text-purple-600 dark:text-purple-400"></i>
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">
                Annual General Meeting
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Comprehensive AGM template with elections, auditor report, and full compliance.
              </p>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-purple-500"></i>
                  <span>Director elections & voting</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-purple-500"></i>
                  <span>Auditor report & financials</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-purple-500"></i>
                  <span>Full legal compliance</span>
                </div>
              </div>
            </div>
          </button>

          {/* Special Meeting */}
          <button
            onClick={() => selectMeetingType('special')}
            className="group relative bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-slate-200 dark:border-white/5 hover:border-brand-500 dark:hover:border-brand-500 transition-all hover:scale-[1.02] active:scale-100 text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <i className="fa-solid fa-exclamation-triangle text-8xl"></i>
            </div>
            <div className="relative">
              <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-4">
                <i className="fa-solid fa-exclamation-triangle text-2xl text-amber-600 dark:text-amber-400"></i>
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">
                Special Meeting
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                For urgent matters, special resolutions, or extraordinary business items.
              </p>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-amber-500"></i>
                  <span>Focused agenda items</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-amber-500"></i>
                  <span>Special resolutions tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-amber-500"></i>
                  <span>Notice compliance checks</span>
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="text-center">
          <p className="text-xs text-slate-400">
            <i className="fa-solid fa-info-circle mr-2"></i>
            Your progress auto-saves every 30 seconds
          </p>
        </div>
      </div>
    );
  }

  // Render the appropriate template based on meeting type
  return (
    <div className="space-y-6">
      {/* Header with meeting type badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setStep('select')}
            className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
              Meeting Minutes
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                meetingType === 'quick' ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400' :
                meetingType === 'regular' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                meetingType === 'agm' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              }`}>
                {meetingType === 'quick' ? 'Quick Meeting' :
                 meetingType === 'regular' ? 'Regular Board Meeting' :
                 meetingType === 'agm' ? 'Annual General Meeting' :
                 'Special Meeting'}
              </span>
              {lastSaved && (
                <span className="text-[10px] text-slate-400">
                  Last saved: {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 relative">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
            >
              {isExporting ? (
                <i className="fa-solid fa-spinner fa-spin"></i>
              ) : (
                <Download size={14} />
              )}
              Export
              <ChevronDown size={14} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowExportMenu(false)}
                ></div>
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-white/5 py-2 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                  <button
                    onClick={handleExportPDF}
                    className="w-full px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors"
                  >
                    <FileCode size={16} className="text-red-500" />
                    Download PDF
                  </button>
                  <button
                    onClick={handleExportWord}
                    className="w-full px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors"
                  >
                    <FileText size={16} className="text-blue-500" />
                    Download Word
                  </button>
                  <div className="h-px bg-slate-100 dark:bg-white/5 my-1 mx-2"></div>
                  <button
                    onClick={handleExport}
                    className="w-full px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors"
                  >
                    <Printer size={16} className="text-slate-400" />
                    Browser Print
                  </button>
                </div>
              </>
            )}
          </div>
          
          <button
            onClick={handleSave}
            disabled={!isDirty || saveStatus === 'saving'}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 shadow-lg ${
              !isDirty 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                : saveStatus === 'success'
                ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                : 'bg-brand-600 text-white hover:bg-brand-700 shadow-brand-500/20 active:scale-95'
            }`}
          >
            {saveStatus === 'saving' ? (
              <i className="fa-solid fa-spinner fa-spin"></i>
            ) : saveStatus === 'success' ? (
              <i className="fa-solid fa-check-circle"></i>
            ) : (
              <i className="fa-solid fa-save"></i>
            )}
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-8">
        {meetingType === 'quick' && <QuickMeetingTemplate formData={formData} handleInputChange={handleInputChange} members={committeeMembers} actionItems={formData.actionItemsList || []} addActionItem={addActionItem} removeActionItem={removeActionItem} updateActionItem={updateActionItem} />}
        {meetingType === 'regular' && <RegularMeetingTemplate formData={formData} handleInputChange={handleInputChange} attendees={attendees} addAttendee={addAttendee} removeAttendee={removeAttendee} updateAttendee={updateAttendee} motions={motions} addMotion={addMotion} removeMotion={removeMotion} updateMotion={updateMotion} members={committeeMembers} actionItems={formData.actionItemsList || []} addActionItem={addActionItem} removeActionItem={removeActionItem} updateActionItem={updateActionItem} />}
        {meetingType === 'agm' && <AGMMeetingTemplate formData={formData} handleInputChange={handleInputChange} attendees={attendees} addAttendee={addAttendee} removeAttendee={removeAttendee} updateAttendee={updateAttendee} motions={motions} addMotion={addMotion} removeMotion={removeMotion} updateMotion={updateMotion} members={committeeMembers} actionItems={formData.actionItemsList || []} addActionItem={addActionItem} removeActionItem={removeActionItem} updateActionItem={updateActionItem} />}
        {meetingType === 'special' && <SpecialMeetingTemplate formData={formData} handleInputChange={handleInputChange} attendees={attendees} addAttendee={addAttendee} removeAttendee={removeAttendee} updateAttendee={updateAttendee} motions={motions} addMotion={addMotion} removeMotion={removeMotion} updateMotion={updateMotion} members={committeeMembers} actionItems={formData.actionItemsList || []} addActionItem={addActionItem} removeActionItem={removeActionItem} updateActionItem={updateActionItem} />}

        <LinkDocumentSection
          documents={documents}
          linkedDocument={formData.linkedDocument}
          isScriptsReady={isScriptsReady}
          isLinkingDriveDocument={isLinkingDriveDocument}
          onOpenPicker={handleOpenPicker}
          onExistingDocumentChange={handleLinkedDocumentChange}
        />
        
        <div className="mt-12 pt-8 border-t border-slate-100 dark:border-white/5 flex flex-col items-end gap-4">
           {saveStatus === 'success' && (
             <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
               <i className="fa-solid fa-circle-check"></i>
               Minutes successfully saved to the community records.
             </span>
           )}
           <button
            onClick={handleSave}
            disabled={!isDirty || saveStatus === 'saving'}
            className={`px-8 py-4 rounded-2xl text-sm font-black uppercase transition-all flex items-center gap-2 shadow-lg ${
              !isDirty 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                : saveStatus === 'success'
                ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                : 'bg-brand-600 text-white hover:bg-brand-700 shadow-brand-500/20 active:scale-95'
            }`}
          >
            <i className={`fa-solid ${saveStatus === 'saving' ? 'fa-spinner fa-spin' : saveStatus === 'success' ? 'fa-check-double' : 'fa-save'}`}></i>
            {saveStatus === 'saving' ? 'Saving Changes...' : saveStatus === 'success' ? 'Minutes Saved' : 'Finalize & Save Minutes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Name Dropdown Component
const NameSelector: React.FC<{ 
  value: string, 
  onChange: (val: string) => void, 
  members: Tenant[],
  placeholder?: string 
}> = ({ value, onChange, members, placeholder = "Select member..." }) => {
  const [isManual, setIsManual] = useState(false);

  if (isManual) {
    return (
      <div className="flex gap-2">
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          placeholder="Enter name manually" 
          className="form-input flex-1"
          autoFocus
        />
        <button 
          type="button"
          onClick={() => setIsManual(false)}
          className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl hover:bg-slate-200"
          title="Back to list"
        >
          <i className="fa-solid fa-list"></i>
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select 
        value={value} 
        onChange={(e) => {
          if (e.target.value === '__add__') {
            setIsManual(true);
            onChange('');
          } else {
            onChange(e.target.value);
          }
        }}
        className="form-input flex-1"
      >
        <option value="">{placeholder}</option>
        {members.sort((a,b) => a.firstName.localeCompare(b.firstName)).map(m => (
          <option key={m.id} value={`${m.firstName} ${m.lastName}`}>
            {m.firstName} {m.lastName}
          </option>
        ))}
        <option value="__add__">+ Add person manually...</option>
      </select>
    </div>
  );
};

// Reusable Name List Component
const NameListField: React.FC<{
  names: string[],
  onChange: (names: string[]) => void,
  members: Tenant[],
  addButtonLabel: string,
  placeholder?: string
}> = ({ names, onChange, members, addButtonLabel, placeholder }) => {
  const addName = () => onChange([...names, '']);
  const removeName = (index: number) => onChange(names.filter((_, i) => i !== index));
  const updateName = (index: number, val: string) => {
    const newNames = [...names];
    newNames[index] = val;
    onChange(newNames);
  };

  return (
    <div className="space-y-3">
      {names.map((name, index) => (
        <div key={index} className="flex gap-2">
          <div className="flex-1">
            <NameSelector 
              value={name} 
              onChange={(val) => updateName(index, val)} 
              members={members} 
              placeholder={placeholder}
            />
          </div>
          <button 
            type="button"
            onClick={() => removeName(index)}
            className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200"
          >
            <i className="fa-solid fa-trash"></i>
          </button>
        </div>
      ))}
      <button 
        type="button"
        onClick={addName}
        className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700"
      >
        <i className="fa-solid fa-plus mr-1"></i> {addButtonLabel}
      </button>
    </div>
  );
};

const ActionItemsEditor: React.FC<{
  actionItems: ActionItem[];
  members: Tenant[];
  addActionItem: () => void;
  removeActionItem: (id: string) => void;
  updateActionItem: (id: string, field: keyof ActionItem, value: any) => void;
}> = ({ actionItems, members, addActionItem, removeActionItem, updateActionItem }) => (
  <FormSection title="Action Items" icon="fa-tasks">
    <div className="space-y-4">
      {actionItems.map((item, index) => (
        <div key={item.id} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">
              Action Item {index + 1}
            </h4>
            <button
              type="button"
              onClick={() => removeActionItem(item.id)}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              <i className="fa-solid fa-trash"></i>
            </button>
          </div>
          <div className="space-y-4">
            <FormField label="Action To Be Taken">
              <textarea
                value={item.description}
                onChange={(e) => updateActionItem(item.id, 'description', e.target.value)}
                placeholder="Describe the follow-up action..."
                className="form-textarea"
                rows={3}
              />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Responsible Member(s)">
                <NameListField
                  names={item.responsible || []}
                  onChange={(names) => updateActionItem(item.id, 'responsible', names)}
                  members={members}
                  addButtonLabel="Add Responsible Member"
                  placeholder="Select member..."
                />
              </FormField>
              <FormField label="Complete By">
                <input
                  type="date"
                  value={item.dueDate}
                  onChange={(e) => updateActionItem(item.id, 'dueDate', e.target.value)}
                  className="form-input"
                />
              </FormField>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addActionItem}
        className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
      >
        <i className="fa-solid fa-plus mr-2"></i>Add Action Item
      </button>
    </div>
  </FormSection>
);

const LinkDocumentSection: React.FC<{
  documents: CoopDocument[];
  linkedDocument: { id: string; title: string; url: string; fileType: string } | null;
  isScriptsReady: boolean;
  isLinkingDriveDocument: boolean;
  onOpenPicker: () => void;
  onExistingDocumentChange: (documentId: string) => void;
}> = ({ documents, linkedDocument, isScriptsReady, isLinkingDriveDocument, onOpenPicker, onExistingDocumentChange }) => (
  <FormSection title="Link a Document" icon="fa-link">
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Link a new Google Drive document to this minutes record, or choose an existing document from the library.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenPicker}
          disabled={!isScriptsReady || isLinkingDriveDocument}
          className="w-full lg:w-auto px-5 py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <i className={`fa-brands ${isLinkingDriveDocument ? 'fa-google fa-spin' : 'fa-google-drive'}`}></i>
          {isLinkingDriveDocument ? 'Linking...' : 'Link New from Drive'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-center">
        <select
          value={linkedDocument?.id || ''}
          onChange={(e) => onExistingDocumentChange(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">No linked document</option>
          {documents.map(doc => (
            <option key={doc.id} value={doc.id}>{doc.title}</option>
          ))}
        </select>
      </div>

      {linkedDocument && (
        <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5">
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Link</p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{linkedDocument.title}</p>
          </div>
          {linkedDocument.url && linkedDocument.url !== '#' && (
            <button
              type="button"
              onClick={() => window.open(linkedDocument.url, '_blank', 'noopener,noreferrer')}
              className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
            >
              Open
            </button>
          )}
        </div>
      )}
    </div>
  </FormSection>
);

// Quick Meeting Template
const QuickMeetingTemplate: React.FC<any> = ({ formData, handleInputChange, members, actionItems, addActionItem, removeActionItem, updateActionItem }) => (
  <div className="space-y-8">
    <FormSection title="Meeting Info" icon="fa-info-circle">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Date" required>
          <input type="date" value={formData.meetingDate} onChange={(e) => handleInputChange('meetingDate', e.target.value)} className="form-input" required />
        </FormField>
        <FormField label="Start Time">
          <input type="time" value={formData.startTime} onChange={(e) => handleInputChange('startTime', e.target.value)} className="form-input" />
        </FormField>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Chairperson" required>
          <NameSelector
            value={formData.chair}
            onChange={(val) => handleInputChange('chair', val)}
            members={members}
            placeholder="Select chairperson..."
          />
        </FormField>
        <FormField label="Minutes Recorded By" required>
          <NameSelector
            value={formData.minuteTaker}
            onChange={(val) => handleInputChange('minuteTaker', val)}
            members={members}
            placeholder="Select recorder..."
          />
        </FormField>
      </div>
      <FormField label="Attendees">
        <NameListField 
          names={formData.guests || []} 
          onChange={(val) => handleInputChange('guests', val)} 
          members={members} 
          addButtonLabel="Add Attendee"
          placeholder="Select attendee..."
        />
      </FormField>
    </FormSection>

    <FormSection title="Key Points" icon="fa-list-check">
      <FormField label="Decisions Made">
        <RichTextEditor value={formData.keyDecisions} onChange={(val) => handleInputChange('keyDecisions', val)} placeholder="What was decided or discussed?" />
      </FormField>
    </FormSection>
    <ActionItemsEditor actionItems={actionItems} members={members} addActionItem={addActionItem} removeActionItem={removeActionItem} updateActionItem={updateActionItem} />
  </div>
);

// Regular Meeting Template (streamlined version)
const RegularMeetingTemplate: React.FC<any> = ({ formData, handleInputChange, attendees, addAttendee, removeAttendee, updateAttendee, motions, addMotion, removeMotion, updateMotion, members, actionItems, addActionItem, removeActionItem, updateActionItem }) => (
  <div className="space-y-8">
    <FormSection title="Meeting Information" icon="fa-calendar-check">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Date" required>
          <input type="date" value={formData.meetingDate} onChange={(e) => handleInputChange('meetingDate', e.target.value)} className="form-input" required />
        </FormField>
        <FormField label="Start Time" required>
          <input type="time" value={formData.startTime} onChange={(e) => handleInputChange('startTime', e.target.value)} className="form-input" required />
        </FormField>
        <FormField label="End Time">
          <input type="time" value={formData.endTime} onChange={(e) => handleInputChange('endTime', e.target.value)} className="form-input" />
        </FormField>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Location" required>
          <input type="text" value={formData.location} onChange={(e) => handleInputChange('location', e.target.value)} placeholder="e.g., Common Room" className="form-input" required />
        </FormField>
        <FormField label="Chairperson" required>
          <NameSelector 
            value={formData.chair} 
            onChange={(val) => handleInputChange('chair', val)} 
            members={members} 
            placeholder="Select chairperson..." 
          />
        </FormField>
      </div>
    </FormSection>

    <FormSection title="Attendance" icon="fa-users">
      <FormField label="Directors Present">
        <div className="space-y-3">
          {attendees.map(attendee => (
            <div key={attendee.id} className="flex gap-3">
              <div className="flex-1">
                <NameSelector 
                  value={attendee.name} 
                  onChange={(val) => updateAttendee(attendee.id, 'name', val)} 
                  members={members} 
                />
              </div>
              <input 
                type="text" 
                value={attendee.position}
                onChange={(e) => updateAttendee(attendee.id, 'position', e.target.value)}
                placeholder="Position (optional)" 
                className="form-input flex-1"
              />
              {attendees.length > 1 && (
                <button 
                  type="button"
                  onClick={() => removeAttendee(attendee.id)}
                  className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button 
            type="button"
            onClick={addAttendee}
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
          >
            <i className="fa-solid fa-plus mr-1"></i>Add Director
          </button>
        </div>
      </FormField>
      <FormField label="Directors Absent">
        <NameListField 
          names={formData.directorsAbsent || []} 
          onChange={(val) => handleInputChange('directorsAbsent', val)} 
          members={members} 
          addButtonLabel="Add Absent Director"
          placeholder="Select director..."
        />
      </FormField>
      <FormField label="Guests & Observers">
        <NameListField 
          names={formData.guests || []} 
          onChange={(val) => handleInputChange('guests', val)} 
          members={members} 
          addButtonLabel="Add Guest"
          placeholder="Select guest..."
        />
      </FormField>
      <FormField label="Minutes Recorded By" required>
        <NameSelector 
          value={formData.minuteTaker} 
          onChange={(val) => handleInputChange('minuteTaker', val)} 
          members={members} 
          placeholder="Select recorder..." 
        />
      </FormField>
    </FormSection>

    <FormSection title="Reports" icon="fa-file-lines">
      <FormField label="Board Report">
        <RichTextEditor 
          value={formData.boardReport} 
          onChange={(val) => handleInputChange('boardReport', val)} 
          placeholder="Overview of activities, challenges, and outcomes" 
        />
      </FormField>
      <FormField label="Financial Report">
        <RichTextEditor 
          value={formData.financeReport} 
          onChange={(val) => handleInputChange('financeReport', val)} 
          placeholder="Financial overview and budget status" 
        />
      </FormField>
      <FormField label="Committee Reports">
        <RichTextEditor 
          value={formData.committeeReports} 
          onChange={(val) => handleInputChange('committeeReports', val)} 
          placeholder="Reports from any committees" 
        />
      </FormField>
    </FormSection>

    <FormSection title="Motions & Decisions" icon="fa-gavel">
      <div className="space-y-4">
        {motions.map((motion, index) => (
          <div key={motion.id} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/5">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Motion {index + 1}</h4>
              <button 
                type="button"
                onClick={() => removeMotion(motion.id)}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
            <div className="space-y-3">
              <FormField label="Description">
                <textarea 
                  value={motion.description}
                  onChange={(e) => updateMotion(motion.id, 'description', e.target.value)}
                  placeholder="Describe the motion..."
                  className="form-textarea"
                  rows={3}
                />
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField label="Moved By">
                  <NameSelector 
                    value={motion.mover} 
                    onChange={(val) => updateMotion(motion.id, 'mover', val)} 
                    members={members} 
                  />
                </FormField>
                <FormField label="Seconded By">
                  <NameSelector 
                    value={motion.seconder} 
                    onChange={(val) => updateMotion(motion.id, 'seconder', val)} 
                    members={members} 
                  />
                </FormField>
                <FormField label="Result">
                  <select 
                    value={motion.result}
                    onChange={(e) => updateMotion(motion.id, 'result', e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select...</option>
                    <option value="carried">Carried</option>
                    <option value="defeated">Defeated</option>
                    <option value="tabled">Tabled</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </FormField>
              </div>
            </div>
          </div>
        ))}
        <button 
          type="button"
          onClick={addMotion}
          className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
        >
          <i className="fa-solid fa-plus mr-2"></i>Add Motion
        </button>
      </div>
    </FormSection>

    <ActionItemsEditor actionItems={actionItems} members={members} addActionItem={addActionItem} removeActionItem={removeActionItem} updateActionItem={updateActionItem} />
  </div>
);

// AGM Meeting Template (comprehensive)
const AGMMeetingTemplate: React.FC<any> = ({ formData, handleInputChange, attendees, addAttendee, removeAttendee, updateAttendee, motions, addMotion, removeMotion, updateMotion, members, actionItems, addActionItem, removeActionItem, updateActionItem }) => (
  <div className="space-y-8">
    <RegularMeetingTemplate 
      formData={formData} 
      handleInputChange={handleInputChange}
      attendees={attendees}
      addAttendee={addAttendee}
      removeAttendee={removeAttendee}
      updateAttendee={updateAttendee}
      motions={motions}
      addMotion={addMotion}
      removeMotion={removeMotion}
      updateMotion={updateMotion}
      members={members}
      actionItems={actionItems}
      addActionItem={addActionItem}
      removeActionItem={removeActionItem}
      updateActionItem={updateActionItem}
    />

    <FormSection title="Auditor's Report" icon="fa-file-invoice-dollar">
      <FormField label="Auditor's Report Summary">
        <RichTextEditor 
          value={formData.auditorReport} 
          onChange={(val) => handleInputChange('auditorReport', val)} 
          placeholder="Summary of auditor's report and year-end financial statements" 
        />
      </FormField>
    </FormSection>

    <FormSection title="Election of Directors" icon="fa-person-booth">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <FormField label="Total Seats">
          <input type="number" value={formData.totalSeats} onChange={(e) => handleInputChange('totalSeats', e.target.value)} className="form-input" />
        </FormField>
        <FormField label="Vacancies">
          <input type="number" value={formData.vacancies} onChange={(e) => handleInputChange('vacancies', e.target.value)} className="form-input" />
        </FormField>
        <FormField label="Candidates">
          <input type="number" value={formData.candidates} onChange={(e) => handleInputChange('candidates', e.target.value)} className="form-input" />
        </FormField>
      </div>
      <FormField label="Nominations Received">
        <RichTextEditor 
          value={formData.nominations} 
          onChange={(val) => handleInputChange('nominations', val)} 
          placeholder="List all candidates who accepted nomination" 
        />
      </FormField>
      <FormField label="Election Results">
        <RichTextEditor 
          value={formData.electionResults} 
          onChange={(val) => handleInputChange('electionResults', val)} 
          placeholder="Document elected directors, vote counts, and terms of office" 
        />
      </FormField>
      <FormField label="Scrutineers">
        <NameListField 
          names={formData.scrutineers || []} 
          onChange={(val) => handleInputChange('scrutineers', val)} 
          members={members} 
          addButtonLabel="Add Scrutineer"
          placeholder="Select scrutineer..."
        />
      </FormField>
      <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
        <input 
          type="checkbox" 
          id="ballotsDisposed"
          checked={formData.ballotsDisposed}
          onChange={(e) => handleInputChange('ballotsDisposed', e.target.checked)}
          className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <label htmlFor="ballotsDisposed" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Motion to dispose of ballots approved
        </label>
      </div>
    </FormSection>
  </div>
);

// Special Meeting Template
const SpecialMeetingTemplate: React.FC<any> = ({ formData, handleInputChange, attendees, addAttendee, removeAttendee, updateAttendee, motions, addMotion, removeMotion, updateMotion, members, actionItems, addActionItem, removeActionItem, updateActionItem }) => (
  <div className="space-y-8">
    <FormSection title="Meeting Information" icon="fa-calendar-check">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Date" required>
          <input type="date" value={formData.meetingDate} onChange={(e) => handleInputChange('meetingDate', e.target.value)} className="form-input" required />
        </FormField>
        <FormField label="Start Time" required>
          <input type="time" value={formData.startTime} onChange={(e) => handleInputChange('startTime', e.target.value)} className="form-input" required />
        </FormField>
        <FormField label="Location" required>
          <input type="text" value={formData.location} onChange={(e) => handleInputChange('location', e.target.value)} className="form-input" required />
        </FormField>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Chairperson" required>
          <NameSelector 
            value={formData.chair} 
            onChange={(val) => handleInputChange('chair', val)} 
            members={members} 
          />
        </FormField>
        <FormField label="Notice Period Confirmed">
          <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <input 
              type="checkbox" 
              id="noticeConfirmed"
              checked={formData.noticeConfirmed}
              onChange={(e) => handleInputChange('noticeConfirmed', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="noticeConfirmed" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Notice properly delivered (min. 14 days)
            </label>
          </div>
        </FormField>
      </div>
    </FormSection>

    <FormSection title="Attendance" icon="fa-users">
      <FormField label="Members Present">
        <div className="space-y-3">
          {attendees.map(attendee => (
            <div key={attendee.id} className="flex gap-3">
              <div className="flex-1">
                <NameSelector 
                  value={attendee.name} 
                  onChange={(val) => updateAttendee(attendee.id, 'name', val)} 
                  members={members} 
                />
              </div>
              {attendees.length > 1 && (
                <button 
                  type="button"
                  onClick={() => removeAttendee(attendee.id)}
                  className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button 
            type="button"
            onClick={addAttendee}
            className="text-sm font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
          >
            <i className="fa-solid fa-plus mr-2"></i>Add Member
          </button>
        </div>
      </FormField>
      <FormField label="Minutes Recorded By" required>
        <NameSelector 
          value={formData.minuteTaker} 
          onChange={(val) => handleInputChange('minuteTaker', val)} 
          members={members} 
        />
      </FormField>
    </FormSection>

    <FormSection title="Special Business" icon="fa-exclamation-triangle">
      <FormField label="Purpose of Special Meeting">
        <RichTextEditor 
          value={formData.newBusiness} 
          onChange={(val) => handleInputChange('newBusiness', val)} 
          placeholder="Document the specific reason for calling this special meeting" 
        />
      </FormField>
    </FormSection>

    <FormSection title="Motions & Resolutions" icon="fa-gavel">
      <div className="space-y-4">
        {motions.map((motion, index) => (
          <div key={motion.id} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/5">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Motion {index + 1}</h4>
              <button 
                type="button"
                onClick={() => removeMotion(motion.id)}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
            <div className="space-y-3">
              <FormField label="Description">
                <textarea 
                  value={motion.description}
                  onChange={(e) => updateMotion(motion.id, 'description', e.target.value)}
                  placeholder="Describe the motion..."
                  className="form-textarea"
                  rows={3}
                />
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField label="Moved By">
                  <NameSelector 
                    value={motion.mover} 
                    onChange={(val) => updateMotion(motion.id, 'mover', val)} 
                    members={members} 
                  />
                </FormField>
                <FormField label="Seconded By">
                  <NameSelector 
                    value={motion.seconder} 
                    onChange={(val) => updateMotion(motion.id, 'seconder', val)} 
                    members={members} 
                  />
                </FormField>
                <FormField label="Result">
                  <select 
                    value={motion.result}
                    onChange={(e) => updateMotion(motion.id, 'result', e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select...</option>
                    <option value="carried">Carried</option>
                    <option value="defeated">Defeated</option>
                    <option value="tabled">Tabled</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </FormField>
              </div>
            </div>
          </div>
        ))}
        <button 
          type="button"
          onClick={addMotion}
          className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
        >
          <i className="fa-solid fa-plus mr-2"></i>Add Motion
        </button>
      </div>
    </FormSection>

    <ActionItemsEditor actionItems={actionItems} members={members} addActionItem={addActionItem} removeActionItem={removeActionItem} updateActionItem={updateActionItem} />
  </div>
);

// Helper Components
const FormSection: React.FC<{ title: string; icon: string; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="space-y-6">
    <h3 className="flex items-center gap-3 text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight border-b border-slate-200 dark:border-white/5 pb-3">
      <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center">
        <i className={`fa-solid ${icon} text-brand-600 dark:text-brand-400 text-sm`}></i>
      </div>
      {title}
    </h3>
    <div className="space-y-6">
      {children}
    </div>
  </div>
);

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div className="space-y-2">
    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

export default MinutesBuilder;
