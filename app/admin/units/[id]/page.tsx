'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RequestStatus, Unit, Tenant, MaintenanceRequest, Document, ScheduledMaintenance } from '../../../../types';
import { useUser, useUnits, useTenants, useMaintenance, useDocuments } from '../../../../hooks/useCoopData';

export default function AdminUnitDetailPage() {
  const params = useParams();
  const unitId = params.id as string;
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: user } = useUser();
  const { data: units = [], refetch: fetchUnits } = useUnits();
  const { data: tenants = [], refetch: fetchTenants } = useTenants();
  const { data: allRequests = [], refetch: fetchRequests } = useMaintenance();
  const { data: documents = [] } = useDocuments();

  const unit = units.find(u => u.id === unitId);
  const currentResidents = tenants.filter(t => t.unitId === unitId && t.status === 'Current');
  const primaryResident = currentResidents.find(t => t.id === unit?.currentTenantId) || currentResidents[0];
  
  const historicalRecords = (unit?.occupancyHistory || [])
    .filter(rh => rh.endDate)
    .map(rh => ({
      tenant: rh.tenant || tenants.find(t => t.id === rh.tenantId),
      startDate: rh.startDate,
      endDate: rh.endDate,
      moveReason: rh.moveReason,
      isCurrent: false
    }));

  const activeRecords = currentResidents.map(resident => ({
    tenant: resident,
    startDate: resident.startDate,
    endDate: undefined,
    moveReason: 'Current Residency',
    isCurrent: true
  }));

  const unitHistory = [...activeRecords, ...historicalRecords].sort((a, b) => 
    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  const requests = allRequests.filter(r => r.unitId === unitId);
  const activeRequests = requests.filter(r => r.status === RequestStatus.PENDING || r.status === RequestStatus.IN_PROGRESS);
  const historicalRequests = requests.filter(r => r.status === RequestStatus.COMPLETED || r.status === RequestStatus.CANCELLED);
  
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledMaintenance[]>([]);
  const unitDocs = documents.filter(doc => doc.tags?.includes(`Unit ${unit?.number}`));
  
  const [activeTab, setActiveTab] = useState<'overview' | 'maintenance' | 'schedule' | 'occupancy' | 'history' | 'layout' | 'documents'>('overview');
  const [showUpload, setShowUpload] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  const [isScriptsReady, setIsScriptsReady] = useState(false);
  const [config, setConfig] = useState<{ googleClientId: string; googleApiKey: string } | null>(null);
  const [showMoveInModal, setShowMoveInModal] = useState(false);
  const [showMoveOutModal, setShowMoveOutModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedNewTenantId, setSelectedNewTenantId] = useState('');
  const [selectedTargetUnitId, setSelectedTargetUnitId] = useState('');

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.ok ? res.json() : null)
      .then(data => setConfig(data))
      .catch(err => console.error('Failed to load Google config:', err));

    const checkScripts = setInterval(() => {
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2 && (window as any).gapi) {
        setIsScriptsReady(true);
        clearInterval(checkScripts);
      }
    }, 500);

    return () => clearInterval(checkScripts);
  }, []);

  useEffect(() => {
    if (unitId) {
      fetch(`/api/units/${unitId}/scheduled-maintenance`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setScheduledTasks(data))
        .catch(err => console.error('Failed to load scheduled tasks:', err));
    }
  }, [unitId]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['overview', 'maintenance', 'schedule', 'occupancy', 'history', 'layout', 'documents'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  if (!user || !unit) return null;

  const isAdmin = !!user.isAdmin;
  const isGuest = !!user.isGuest;

  const handleOpenPicker = () => {
    if (!config?.googleClientId || !config?.googleApiKey) {
      alert(`Missing Google Configuration.`);
      return;
    }

    try {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: config.googleClientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
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
    (window as any).gapi.load('picker', () => {
      const view = new (window as any).google.picker.DocsView((window as any).google.picker.ViewId.DOCS);
      view.setIncludeFolders(true);
      
      const picker = new (window as any).google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(config?.googleApiKey)
        .setCallback(async (data: any) => {
          if (data.action === (window as any).google.picker.Action.PICKED) {
            const driveDoc = data.docs[0];
            const newDoc = {
              title: driveDoc.name,
              category: 'Unit' as any,
              url: driveDoc.url,
              fileType: driveDoc.type || 'gdoc',
              author: 'Google Drive',
              date: new Date().toISOString().split('T')[0],
              tags: ['Google Drive', 'Linked', `Unit ${unit?.number}`]
            };

            try {
              const res = await fetch('/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDoc)
              });
              if (res.ok) {
                setNotification({ message: 'Document linked successfully.', type: 'success' });
                setShowUpload(false);
                setTimeout(() => setNotification(null), 5000);
              }
            } catch (err) {
              console.error('Failed to save drive doc:', err);
            }
          }
        })
        .build();
      picker.setVisible(true);
    });
  };
  
  const handleMoveOut = async () => {
    if (!unit || isGuest) return;
    const moveOutDate = new Date().toISOString().split('T')[0];
    try {
      await fetch(`/api/units/${unit.id}/move-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: moveOutDate, reason: 'Voluntary Household Departure' })
      });
      fetchUnits();
      fetchTenants();
      setShowMoveOutModal(false);
      setNotification({ message: `Move-out processed.`, type: 'success' });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveIn = async () => {
    if (!unit || !selectedNewTenantId || isGuest) return;
    const moveInDate = new Date().toISOString().split('T')[0];
    try {
      await fetch(`/api/units/${unit.id}/move-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: selectedNewTenantId, date: moveInDate })
      });
      fetchUnits();
      fetchTenants();
      setShowMoveInModal(false);
      setSelectedNewTenantId('');
      setNotification({ message: `Move-in processed.`, type: 'success' });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransfer = async () => {
    if (!unit || !selectedTargetUnitId || isGuest) return;
    const transferDate = new Date().toISOString().split('T')[0];
    try {
      await fetch(`/api/units/${unit.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUnitId: unit.id, toUnitId: selectedTargetUnitId, date: transferDate })
      });
      fetchUnits();
      fetchTenants();
      setShowTransferModal(false);
      setSelectedTargetUnitId('');
      setNotification({ message: `Transfer processed.`, type: 'success' });
      setTimeout(() => setNotification(null), 5000);
      router.push(`/admin/units/${selectedTargetUnitId}`);
    } catch (err) {
      console.error(err);
    }
  };

  const renderRequestTable = (requestList: typeof requests, title: string) => (
    <div className="space-y-4">
      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2">{title}</h3>
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm transition-colors duration-200">
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/5">
          {requestList.length > 0 ? requestList.map(req => (
            <div
              key={req.id}
              className="p-4 active:bg-slate-50 dark:active:bg-white/5 transition-colors"
              onClick={() => router.push(isAdmin ? `/admin/maintenance/${req.id}` : `/maintenance/${req.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 flex-1 line-clamp-2">{req.description}</p>
                <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase shrink-0 whitespace-nowrap ${
                  req.status === RequestStatus.COMPLETED ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  req.status === RequestStatus.PENDING ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  req.status === RequestStatus.CANCELLED ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {req.status}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded uppercase">{req.category[0]}</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="text-[10px] font-bold text-slate-400">{new Date(req.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          )) : (
            <div className="px-6 py-12 text-center text-slate-400 text-xs italic font-medium">No records found.</div>
          )}
        </div>

        <table className="hidden sm:table w-full text-left">
          <thead>
            <tr className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/5">
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-32">Date</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-32">Category</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Description</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-white/5">
            {requestList.length > 0 ? requestList.map(req => (
              <tr
                key={req.id}
                onClick={() => router.push(isAdmin ? `/admin/maintenance/${req.id}` : `/maintenance/${req.id}`)}
                className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer"
              >
                <td className="px-6 py-4 text-xs font-bold text-slate-500">{new Date(req.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <span className="text-[9px] font-black px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg uppercase whitespace-nowrap">
                    {req.category[0]}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {req.description}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase whitespace-nowrap ${
                    req.status === RequestStatus.COMPLETED ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    req.status === RequestStatus.PENDING ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    req.status === RequestStatus.CANCELLED ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {req.status}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-xs italic font-medium">No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors duration-200 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 text-slate-500 text-sm mb-2">
        <Link href={isAdmin ? "/admin/units" : "/"} className="hover:text-emerald-600 transition-colors flex items-center gap-1 font-bold uppercase tracking-widest text-[10px]">
          <i className="fa-solid fa-arrow-left"></i> {isAdmin ? 'Back to Units' : 'Dashboard'}
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-black text-slate-800 dark:text-slate-200 text-[10px] uppercase tracking-widest">Unit {unit.number}</span>
      </div>

      <header className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-white/5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative overflow-hidden transition-colors shadow-sm">
        <div className={`absolute top-0 right-0 w-64 h-64 opacity-[0.03] -mr-16 -mt-16 pointer-events-none dark:text-white`}>
           <i className="fa-solid fa-building text-[12rem]"></i>
        </div>

        <div className="flex items-center gap-4 md:gap-6 relative z-10 w-full lg:w-auto">
          <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex flex-col items-center justify-center text-white text-2xl md:text-3xl relative overflow-hidden group shrink-0 ${
            unit.status === 'Occupied' ? 'bg-emerald-500' :
            unit.status === 'Vacant' ? 'bg-slate-300 dark:bg-slate-700' :
            'bg-amber-500'
          }`}>
            <i className="fa-solid fa-door-open relative z-10"></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">Unit {unit.number}</h1>
              <span className={`text-[9px] md:text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter border ${
                unit.status === 'Occupied' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                unit.status === 'Vacant' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                'bg-amber-100 text-amber-700 border-amber-200'
              }`}>
                {unit.status}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 text-sm md:text-base">{unit.type} Residence • Floor {unit.floor}</p>
          </div>
        </div>
        
        {isAdmin && (
          <div className="flex flex-wrap gap-2 md:gap-3 w-full lg:w-auto relative z-20 justify-start lg:justify-end">
            {!isGuest && (
              <>
                {unit.status !== 'Occupied' && (
                  <button onClick={() => setShowMoveInModal(true)} className="flex-1 md:flex-none bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                    <i className="fa-solid fa-user-plus"></i> Process Move-In
                  </button>
                )}
                {unit.status === 'Occupied' && (
                  <>
                    <button onClick={() => setShowTransferModal(true)} className="flex-1 md:flex-none bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 dark:border-emerald-800 active:scale-95 flex items-center justify-center gap-2">
                      <i className="fa-solid fa-right-left"></i> Transfer
                    </button>
                    <button onClick={() => setShowMoveOutModal(true)} className="flex-1 md:flex-none bg-rose-600 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                      <i className="fa-solid fa-user-minus"></i> Move-Out
                    </button>
                  </>
                )}
                <button onClick={() => setShowUpload(!showUpload)} className={`flex-1 md:flex-none ${showUpload ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300'} border px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2`}>
                  <i className="fa-brands fa-google-drive"></i> Document
                </button>
                <button onClick={() => setShowSettings(true)} className="flex-1 md:flex-none bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-gear"></i> Settings
                </button>
              </>
            )}
          </div>
        )}
      </header>

      {notification && (
        <div className={`fixed top-6 right-6 z-[200] animate-in slide-in-from-right-8 duration-300 p-4 rounded-2xl border flex items-center gap-4 max-w-md ${
          notification.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-rose-600 border-rose-500 text-white'
        } shadow-2xl`}>
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <i className={`fa-solid ${notification.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-0.5">{notification.type}</p>
            <p className="text-sm font-bold leading-tight">{notification.message}</p>
          </div>
          <button onClick={() => setNotification(null)} className="text-white/60 hover:text-white transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      <nav className="flex border-b border-slate-200 dark:border-white/5 shrink-0 overflow-x-auto scrollbar-hide">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'maintenance', label: 'Service History' },
          { id: 'schedule', label: 'Preventative' },
          { id: 'occupancy', label: 'Members' },
          { id: 'history', label: 'History' },
          { id: 'documents', label: 'Documents' },
          { id: 'layout', label: 'Layout' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              router.replace(`/admin/units/${unitId}?tab=${tab.id}`);
            }}
            className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="animate-in fade-in duration-300">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm transition-colors">
                <h3 className="text-lg font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2 uppercase tracking-tight">
                  <i className="fa-solid fa-user-group text-emerald-500"></i> Household Members ({currentResidents.length})
                </h3>
                {currentResidents.length > 0 ? (
                  <div className="space-y-6">
                    {currentResidents.map(resident => (
                      <div key={resident.id} className="flex flex-col md:flex-row gap-6 items-start p-5 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-emerald-500/30 transition-all group">
                        <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-300 text-2xl shrink-0 border border-slate-100 dark:border-white/10">
                          {resident.id === unit.currentTenantId ? <i className="fa-solid fa-user-tie text-emerald-500"></i> : <i className="fa-solid fa-user"></i>}
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Link href={isAdmin ? `/admin/tenants/${resident.id}` : '#'} className="block">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {resident.id === unit.currentTenantId ? 'Primary Member' : 'Household Member'}
                              </p>
                              <p className="text-lg font-black text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">
                                {resident.firstName} {resident.lastName} 
                              </p>
                            </Link>
                          </div>
                          <div className="flex flex-col justify-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resident Since</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 font-bold">{new Date(resident.startDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-slate-50/50 dark:bg-slate-950/50 rounded-3xl border border-dashed border-slate-200 dark:border-white/5">
                    <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Unit Vacant</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Remaining tabs handled by similar structure as UnitDetail.tsx */}
        {activeTab === 'maintenance' && renderRequestTable(activeRequests, 'Open Service Requests')}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden transition-colors shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-950/30">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Term</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Member Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">End Date</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {unitHistory.map((record, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-slate-500">{new Date(record.startDate).toLocaleDateString()} - {record.endDate ? new Date(record.endDate).toLocaleDateString() : 'Present'}</td>
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{record.tenant?.firstName} {record.tenant?.lastName}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{record.endDate ? new Date(record.endDate).toLocaleDateString() : '—'}</td>
                      <td className="px-6 py-4 text-right">
                        {record.tenant && <Link href={`/admin/tenants/${record.tenant.id}`} className="text-emerald-600 text-[10px] font-black uppercase hover:underline">View</Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showMoveOutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-10 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/5">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight">Process Move-Out</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">Confirm move-out for {primaryResident?.firstName} {primaryResident?.lastName}.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowMoveOutModal(false)} className="flex-1 py-4 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Cancel</button>
              <button onClick={handleMoveOut} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-rose-700 active:scale-95 transition-all">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-10 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/5">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight">Transfer Household</h3>
            <div className="space-y-6">
              <select 
                value={selectedTargetUnitId}
                onChange={(e) => setSelectedTargetUnitId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-3 text-sm font-bold outline-none text-slate-900 dark:text-white"
              >
                <option value="">Select Destination Unit</option>
                {units.filter(u => u.status === 'Vacant' && u.id !== unit.id).map(u => (
                  <option key={u.id} value={u.id}>Unit {u.number} ({u.type})</option>
                ))}
              </select>
              <div className="flex gap-4">
                <button onClick={() => setShowTransferModal(false)} className="flex-1 py-4 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Cancel</button>
                <button onClick={handleTransfer} disabled={!selectedTargetUnitId} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50">Transfer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMoveInModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-10 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/5">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight">Process Move-In</h3>
            <div className="space-y-6">
              <select 
                value={selectedNewTenantId}
                onChange={(e) => setSelectedNewTenantId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-3 text-sm font-bold outline-none text-slate-900 dark:text-white"
              >
                <option value="">Select Member</option>
                {tenants.filter(t => t.id !== unit.currentTenantId).map(t => (
                  <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.status})</option>
                ))}
              </select>
              <div className="flex gap-4">
                <button onClick={() => setShowMoveInModal(false)} className="flex-1 py-4 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Cancel</button>
                <button onClick={handleMoveIn} disabled={!selectedNewTenantId} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
