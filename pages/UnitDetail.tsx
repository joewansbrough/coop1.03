
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { RequestStatus, Unit, Tenant, MaintenanceRequest, Document, ScheduledMaintenance } from '../types';
import { useRefreshData, useUser } from '../hooks/useCoopData';
import { formatDate } from '../utils/dateUtils';
import AppAlert from '../components/AppAlert';

interface UnitDetailProps {
  isAdmin?: boolean;
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  tenants: Tenant[];
  setTenants: React.Dispatch<React.SetStateAction<Tenant[]>>;
  requests: MaintenanceRequest[];
  setRequests: React.Dispatch<React.SetStateAction<MaintenanceRequest[]>>;
  documents: Document[];
}

const UnitDetail: React.FC<UnitDetailProps> = ({ isAdmin = false, units, setUnits, tenants, setTenants, requests: allRequests, setRequests, documents = [] }) => {
  const { data: user } = useUser();
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const refreshData = useRefreshData();

  const unit = units.find(u => u.id === unitId);
  const currentResidents = tenants.filter(t => t.unitId === unitId && t.status === 'Current');
  const primaryResident = currentResidents.find(t => t.id === unit?.currentTenantId) || currentResidents[0];
  
  // Calculate full unit history, ensuring current residents are ALWAYS included at the top
  const historicalRecords = (unit?.occupancyHistory || [])
    .filter(rh => rh.endDate) // Past records only from history
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
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  
  // Google Drive integration states
  const [isScriptsReady, setIsScriptsReady] = useState(false);
  const [config, setConfig] = useState<{ googleClientId: string; googleApiKey: string } | null>(null);

  useEffect(() => {
    // Fetch Google Config
    fetch('/api/config')
      .then(res => res.ok ? res.json() : null)
      .then(data => setConfig(data))
      .catch(err => console.error('Failed to load Google config:', err));

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
    if (unitId) {
      fetch(`/api/units/${unitId}/scheduled-maintenance`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setScheduledTasks(data))
        .catch(err => console.error('Failed to load scheduled tasks:', err));
    }
  }, [unitId]);

  const handleOpenPicker = () => {
    if (!config?.googleClientId || !config?.googleApiKey) {
      showNotification('Missing Google configuration. Please check your environment variables.', 'error');
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
              date: new Date().toISOString(),
              tags: ['Google Drive', 'Linked', `Unit ${unit?.number}`]
            };

            try {
              const res = await fetch('/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDoc)
              });
              if (res.ok) {
                showNotification('Document linked successfully from Google Drive.', 'success');
                setShowUpload(false);
              } else {
                throw new Error('Failed to save document reference');
              }
            } catch (err) {
              console.error('Failed to save drive doc:', err);
              showNotification('Failed to link document.', 'error');
            }
          }
        })
        .build();
      picker.setVisible(true);
    });
  };
  
  // Turnover State
  const [showMoveInModal, setShowMoveInModal] = useState(false);
  const [showMoveOutModal, setShowMoveOutModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedNewTenantId, setSelectedNewTenantId] = useState('');
  const [selectedTargetUnitId, setSelectedTargetUnitId] = useState('');
  const [moveOutDate, setMoveOutDate] = useState(new Date().toISOString().split('T')[0]);
  const [moveOutReason, setMoveOutReason] = useState('Voluntary Household Departure');
  const [customReason, setCustomReason] = useState('');

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    window.setTimeout(() => setNotification(null), 5000);
  };

  const MOVE_OUT_REASONS = [
    'Voluntary Household Departure',
    'End of Lease',
    'Notice to End Tenancy (Non-Payment)',
    'Notice to End Tenancy (Cause)',
    'Notice to End Tenancy (Landlord Use)',
    'Mutual Agreement to End Tenancy',
    'Death of Sole Member',
    'Internal Transfer',
    'Other'
  ];

  const handleMoveOut = async () => {
    console.log("handleMoveOut triggered", { unit, primaryResident });
    if (!unit) return;

    const finalReason = moveOutReason === 'Other' ? customReason : moveOutReason;

    try {
      await fetch(`/api/units/${unit.id}/move-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          date: moveOutDate, 
          reason: finalReason || 'Voluntary Household Departure' 
        })
      });

      // Update local state for ALL residents of the unit
      const residentsToMoveOut = tenants.filter(t => t.unitId === unit.id);

      const updatedTenants = tenants.map(t => {
        if (residentsToMoveOut.some(r => r.id === t.id)) {
          return {
            ...t,
            status: 'Past' as const,
            endDate: moveOutDate,
            unitId: null,
            history: (t.history || []).map(rh =>
              rh.unitId === unit.id && !rh.endDate
                ? { ...rh, endDate: moveOutDate }
                : rh
            )
          };
        }
        return t;
      });

      const updatedUnits = units.map(u => {
        if (u.id === unit.id) {
          return {
            ...u,
            status: 'Vacant' as const,
            currentTenantId: undefined
          };
        }
        return u;
      });

      refreshData();
      setShowMoveOutModal(false);
      showNotification(`Move-out processed for entire household (${residentsToMoveOut.length} members).`, 'success');

      // Reset modal state
      setMoveOutReason('Voluntary Household Departure');
      setCustomReason('');
      setMoveOutDate(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error(err);
      showNotification('Failed to process move-out.', 'error');
    }
  };
  const handleMoveIn = async () => {
    console.log("handleMoveIn triggered", { unit, selectedNewTenantId });
    if (!unit || !selectedNewTenantId) return;
    const newTenant = tenants.find(t => t.id === selectedNewTenantId);
    if (!newTenant) return;

    const moveInDate = new Date().toISOString().split('T')[0];
    const isInternalMove = newTenant.status === 'Current';
    const previousUnitId = newTenant.unitId;

    try {
      await fetch(`/api/units/${unit.id}/move-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: selectedNewTenantId, date: moveInDate })
      });

      // Update local state
      const updatedTenants = tenants.map(t => {
        if (t.id === selectedNewTenantId) {
          let history = t.history || [];
          if (isInternalMove && previousUnitId) {
            history = history.map(rh => 
              rh.unitId === previousUnitId && !rh.endDate 
                ? { ...rh, endDate: moveInDate } 
                : rh
            );
          }
          const newHistory = [
            ...history,
            { 
              id: `h${Date.now()}`, 
              tenantId: t.id, 
              unitId: unit.id, 
              unit: { number: unit.number }, 
              startDate: moveInDate 
            }
          ];
          return {
            ...t,
            unitId: unit.id,
            status: 'Current' as const,
            startDate: moveInDate,
            endDate: undefined,
            history: newHistory
          };
        }
        return t;
      });

      const updatedUnits = units.map(u => {
        if (u.id === unit.id) {
          return {
            ...u,
            status: 'Occupied' as const,
            currentTenantId: selectedNewTenantId
          };
        }
        if (isInternalMove && u.id === previousUnitId) {
          return {
            ...u,
            status: 'Vacant' as const,
            currentTenantId: undefined
          };
        }
        return u;
      });

      refreshData();
      setShowMoveInModal(false);
      setSelectedNewTenantId('');
      
      const message = isInternalMove 
        ? `Internal transfer processed. ${newTenant.firstName} has moved from Unit ${units.find(u => u.id === previousUnitId)?.number} to Unit ${unit.number}.`
        : `Move-in processed. ${newTenant.firstName} ${newTenant.lastName} is now the primary resident of Unit ${unit.number}.`;
      
      showNotification(message, 'success');
    } catch (err) {
      console.error(err);
      showNotification('Failed to process move-in.', 'error');
    }
  };

  const handleSeedPreventative = async () => {
    try {
      const res = await fetch('/api/seed/preventative');
      if (res.ok) {
        showNotification('Preventative maintenance tasks seeded for all units.', 'success');
        // Reload tasks for current unit
        const tasksRes = await fetch(`/api/units/${unitId}/scheduled-maintenance`);
        if (tasksRes.ok) {
          const freshTasks = await tasksRes.json();
          setScheduledTasks(freshTasks);
        }
      } else {
        throw new Error('Failed to seed tasks');
      }
    } catch (err) {
      console.error(err);
      showNotification('Failed to seed preventative tasks.', 'error');
    }
  };

  const handleTransfer = async () => {
    console.log("handleTransfer triggered", { unit, primaryResident, selectedTargetUnitId });
    if (!unit || !selectedTargetUnitId) return;
    const targetUnit = units.find(u => u.id === selectedTargetUnitId);
    if (!targetUnit) return;

    const transferDate = new Date().toISOString().split('T')[0];

    try {
      await fetch(`/api/units/${unit.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUnitId: unit.id, toUnitId: targetUnit.id, date: transferDate })
      });

      // Update local state for ALL residents of the unit
      const residentsToMove = tenants.filter(t => t.unitId === unit.id);

      const updatedTenants = tenants.map(t => {
        if (residentsToMove.some(r => r.id === t.id)) {
          const archivedHistory = (t.history || []).map(rh => 
            rh.unitId === unit.id && !rh.endDate 
              ? { ...rh, endDate: transferDate } 
              : rh
          );
          const newHistory = [
            ...archivedHistory,
            { 
              id: `h${Date.now()}-${t.id}`, 
              tenantId: t.id, 
              unitId: targetUnit.id, 
              unit: { number: targetUnit.number }, 
              startDate: transferDate 
            }
          ];
          return {
            ...t,
            unitId: targetUnit.id,
            startDate: transferDate,
            history: newHistory
          };
        }
        return t;
      });

      const updatedUnits = units.map(u => {
        if (u.id === unit.id) {
          return { ...u, status: 'Vacant' as const, currentTenantId: undefined };
        }
        if (u.id === targetUnit.id) {
          return { ...u, status: 'Occupied' as const, currentTenantId: residentsToMove[0]?.id };
        }
        return u;
      });

      refreshData();
      setShowTransferModal(false);
      setSelectedTargetUnitId('');
      showNotification(`Internal transfer successful. Household (${residentsToMove.length} members) has moved to Unit ${targetUnit.number}.`, 'success');
      navigate(`/admin/units/${targetUnit.id}`);
    } catch (err) {
      console.error(err);
      showNotification('Failed to process transfer.', 'error');
    }
  };

  // Handle tab from URL query param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['overview', 'maintenance', 'schedule', 'occupancy', 'history', 'layout', 'documents'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [location]);

  if (!unit) return <div className="p-8 text-center text-slate-500">Unit not found.</div>;

  const renderRequestTable = (requestList: typeof requests, title: string) => (
    <div className="space-y-4">
      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2">{title}</h3>
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden">

        {/* Mobile: Cards */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/5">
          {requestList.length > 0 ? requestList.map(req => (
            <div
              key={req.id}
              className="p-4 active:bg-slate-50 dark:active:bg-white/5 transition-colors"
              onClick={() => navigate(`/admin/maintenance/${req.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 flex-1 line-clamp-2">{req.description}</p>
                <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase shrink-0 whitespace-nowrap ${
                  req.status === RequestStatus.COMPLETED ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' :
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
                <span className="text-[10px] font-bold text-slate-400">{formatDate(req.createdAt)}</span>
              </div>
            </div>
          )) : (
            <div className="px-6 py-12 text-center text-slate-400 text-xs italic font-medium">No records found in this section.</div>
          )}
        </div>

        {/* Desktop: Table */}
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
                onClick={() => navigate(`/admin/maintenance/${req.id}`)}
                className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer"
              >
                <td className="px-6 py-4 text-xs font-bold text-slate-500">{formatDate(req.createdAt)}</td>
                <td className="px-6 py-4">
                  <span className="text-[9px] font-black px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg uppercase whitespace-nowrap">
                    {req.category[0]}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  {req.description}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase whitespace-nowrap ${
                    req.status === RequestStatus.COMPLETED ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' :
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
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-xs italic font-medium">
                  No records found in this section.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 lg:space-y-8 max-w-7xl mx-auto pb-12 transition-all animate-in fade-in duration-500">
      <div className="flex items-center gap-4 text-slate-500 text-sm mb-2">
        {isAdmin ? (
          <Link to="/admin/units" className="hover:text-brand-600 transition-colors flex items-center gap-1 font-bold">
            <i className="fa-solid fa-arrow-left"></i> Back to Units
          </Link>
        ) : (
          <Link to="/" className="hover:text-brand-600 transition-colors flex items-center gap-1 font-bold">
            <i className="fa-solid fa-arrow-left"></i> Back to Dashboard
          </Link>
        )}
        <span>/</span>
        <span className="font-semibold text-slate-800 dark:text-slate-200">Unit {unit.number}</span>
      </div>

      <header className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-white/5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-64 h-64 opacity-[0.03] -mr-16 -mt-16 pointer-events-none dark:text-white`}>
           <i className="fa-solid fa-building text-[12rem]"></i>
        </div>

        <div className="flex items-center gap-4 md:gap-6 relative z-10 w-full lg:w-auto">
          <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex flex-col items-center justify-center text-white text-2xl md:text-3xl relative overflow-hidden group shrink-0 ${
            unit.status === 'Occupied' ? 'bg-brand-500' :
            unit.status === 'Vacant' ? 'bg-slate-300 dark:bg-slate-700' :
            'bg-amber-500'
          }`}>
            <i className="fa-solid fa-door-open relative z-10"></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white truncate">Unit {unit.number}</h1>
              <span className={`text-[9px] md:text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter border ${
                unit.status === 'Occupied' ? 'bg-brand-100 text-brand-700 border-brand-200 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-800' :
                unit.status === 'Vacant' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                'bg-amber-100 text-amber-700 border-amber-200'
              }`}>
                {unit.status}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 text-sm md:text-base">{unit.type} Residence • Floor {unit.floor} • Wing A</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3 w-full lg:w-auto relative z-20 justify-start lg:justify-end">
          {isAdmin && (
            <>
              {unit.status !== 'Occupied' && (
                <button 
                  onClick={() => setShowMoveInModal(true)}
                  className="flex-1 md:flex-none bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-user-plus"></i> <span>Process Move-In</span>
                </button>
              )}
              {unit.status === 'Occupied' && (
                <>
                  <button 
                    onClick={() => setShowTransferModal(true)}
                    className="flex-1 md:flex-none bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 px-6 py-2.5 rounded-xl font-bold hover:bg-brand-100 transition-all border border-brand-100 dark:border-brand-800 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-right-left"></i> <span>Internal Transfer</span>
                  </button>
                  <button 
                    onClick={() => setShowMoveOutModal(true)}
                    className="flex-1 md:flex-none bg-rose-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-user-minus"></i> <span>Process Move-Out</span>
                  </button>
                </>
              )}
            </>
          )}
          {isAdmin && (
            <button 
              onClick={() => setShowUpload(!showUpload)}
              className={`flex-1 md:flex-none ${showUpload ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300'} border px-4 py-2.5 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2`}
            >
              <i className="fa-brands fa-google-drive"></i> <span>Document</span>
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setShowSettings(true)}
              className="flex-1 md:flex-none bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-gear"></i> <span>Settings</span>
            </button>
          )}
        </div>
      </header>

        {/* In-App Notifications */}
        {notification && (
          <div className="fixed top-6 right-6 z-[200] w-full max-w-md px-4 sm:px-0">
            <AppAlert message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
          </div>
        )}

      {/* Unit Settings Modal - Fixed Z-index and visibility */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-10 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/5">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Unit {unit.number} Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Parking Stall</label>
                  <input type="text" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-2xl px-5 py-3 text-sm font-bold" placeholder="e.g. P1-02" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Storage Locker</label>
                  <input type="text" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-2xl px-5 py-3 text-sm font-bold" placeholder="e.g. L-101" />
                </div>
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button onClick={() => setShowSettings(false)} className="flex-1 py-4 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Discard Changes</button>
              <button onClick={() => setShowSettings(false)} className="flex-1 py-4 bg-brand-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-brand-700 active:scale-95 transition-all">Apply Configuration</button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-6 rounded-3xl animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-blue-800 dark:text-blue-400 flex items-center gap-2 text-sm uppercase tracking-widest">
              <i className="fa-brands fa-google-drive"></i> Link Document from Cloud
            </h4>
            <button onClick={() => setShowUpload(false)} className="text-blue-600 hover:text-blue-800 transition-colors">
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
          <div className="flex flex-col md:flex-row gap-6 items-center">
             <div className="flex-1">
               <p className="text-xs text-blue-700 dark:text-blue-400 font-bold mb-1">Select file for Unit {unit.number}</p>
               <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                 Choose a lease, inspection, or maintenance record from Google Drive. It will be tagged and searchable in the Resource Library.
               </p>
             </div>
             <button 
               onClick={handleOpenPicker}
               className="w-full md:w-auto bg-blue-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
             >
               <i className="fa-brands fa-google-drive text-sm"></i>
               Open Google Picker
             </button>
          </div>
        </div>
      )}

      <nav className="flex border-b border-slate-200 dark:border-white/5 shrink-0 overflow-x-auto scrollbar-hide">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'maintenance', label: 'Service History' },
          { id: 'schedule', label: 'Preventative' },
          { id: 'occupancy', label: 'Members' },
          { id: 'history', label: 'Tenant History' },
          { id: 'documents', label: 'Documents' },
          { id: 'layout', label: 'Layout' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              navigate(`/admin/units/${unitId}?tab=${tab.id}`, { replace: true });
            }}
            className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="animate-in fade-in duration-300">
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Linked Unit Documents</h3>
              {isAdmin && (
                <button 
                  onClick={() => setShowUpload(true)}
                  className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <i className="fa-brands fa-google-drive"></i> Add from Drive
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unitDocs.length > 0 ? unitDocs.map(doc => (
                <div key={doc.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-white/5 hover:border-blue-500/30 transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600">
                      <i className={`fa-solid ${doc.url.includes('drive.google.com') ? 'fa-file-lines' : 'fa-file-pdf'} text-lg`}></i>
                    </div>
                    <span className="text-[8px] font-black px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded uppercase">{doc.category}</span>
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1 line-clamp-1">{doc.title}</h4>
                  <p className="text-[10px] text-slate-400 mb-4">{formatDate(doc.date)} • {doc.author}</p>
                  <a 
                    href={doc.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-slate-50 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-external-link text-[8px]"></i> View Document
                  </a>
                </div>
              )) : (
                <div className="col-span-full py-20 bg-slate-50 dark:bg-slate-950/30 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center px-6">
                  <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-200 dark:text-slate-800 text-3xl mb-4">
                    <i className="fa-solid fa-folder-open"></i>
                  </div>
                  <h4 className="text-slate-400 font-bold mb-1">No documents linked yet</h4>
                  <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed uppercase tracking-tighter">Use the Google Drive button to link leases, inspections, or other unit-specific records.</p>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                  <i className="fa-solid fa-user-group text-brand-500"></i> Household Residents ({currentResidents.length})
                </h3>
                {currentResidents.length > 0 ? (
                  <div className="space-y-6">
                    {currentResidents.map(resident => (
                      <div key={resident.id} className="flex flex-col md:flex-row gap-6 items-start p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-transparent hover:border-brand-500/30 transition-all group">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-300 text-2xl shrink-0 border border-slate-200 dark:border-white/5">
                          {resident.id === unit.currentTenantId ? <i className="fa-solid fa-user-tie text-brand-500"></i> : <i className="fa-solid fa-user"></i>}
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Link to={`/admin/tenants/${resident.id}`} className="block">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {resident.id === unit.currentTenantId ? 'Primary Member' : 'Household Member'}
                              </p>
                              <p className="text-lg font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-600 transition-colors">
                                {resident.firstName} {resident.lastName} 
                                <i className="fa-solid fa-arrow-up-right-from-square text-xs ml-2 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                              </p>
                            </Link>
                          </div>
                          <div className="flex flex-col justify-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resident Since</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 font-bold">{formatDate(resident.startDate)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {isAdmin && (
                      <div className="flex gap-3 pt-4">
                        <button 
                          onClick={() => setShowTransferModal(true)}
                          className="bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-100 transition-all border border-brand-100 dark:border-brand-900/30 active:scale-95 flex items-center gap-2"
                        >
                          <i className="fa-solid fa-right-left"></i> Transfer Household
                        </button>
                        <button 
                          onClick={() => setShowMoveOutModal(true)}
                          className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100 dark:border-rose-900/30 active:scale-95 flex items-center gap-2"
                        >
                          <i className="fa-solid fa-user-minus"></i> Process Move-Out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50 dark:bg-slate-950/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600 mb-4">
                      <i className="fa-solid fa-door-open text-2xl"></i>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-bold mb-6">This unit is currently vacant.</p>
                    <button 
                      onClick={() => setShowMoveInModal(true)}
                      className="bg-brand-600 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-plus"></i> Process Move-In
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-white/5">
                  <h4 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><i className="fa-solid fa-toolbox text-brand-500"></i> Standard Features</h4>
                  <ul className="space-y-3">
                    {['Hardwood Flooring', 'High-speed Fiber', 'Smart Thermostat'].map(item => (
                      <li key={item} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                        <i className="fa-solid fa-circle-check text-brand-500"></i> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            {isAdmin && (
              <div className="space-y-6">
                 <div className="bg-slate-900 text-white p-8 rounded-3xl">
                    <h3 className="font-black uppercase text-[10px] tracking-widest text-brand-400 mb-6">Internal Notes</h3>
                    <p className="text-sm font-medium leading-relaxed opacity-70 italic border-l-2 border-brand-500 pl-4">"Floor joists inspected in 2022. No significant settling found. Member reported balcony door sticking in high humidity."</p>
                 </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="space-y-10">
            {renderRequestTable(activeRequests, 'Open Service Requests')}
            {renderRequestTable(historicalRequests, 'Service History Archive')}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden">

            {/* Mobile: Cards */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/5">
              {unitHistory.length > 0 ? unitHistory.map((record, idx) => (
                <div key={`${record.tenant.id}-${idx}`} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs uppercase shrink-0 ${record.isCurrent ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                        {record.tenant.firstName[0]}
                      </div>
                      <span className="text-sm font-black text-slate-800 dark:text-slate-200">{record.tenant.firstName} {record.tenant.lastName}</span>
                      {record.isCurrent && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 rounded uppercase">Current</span>
                      )}
                    </div>
                    {isAdmin && (
                      <Link
                        to={`/admin/tenants/${record.tenant.id}`}
                        className="text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        Profile <i className="fa-solid fa-arrow-right text-[8px]"></i>
                      </Link>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 pl-10">
                    {formatDate(record.startDate)} — {record.endDate ? formatDate(record.endDate) : 'Present'}
                  </p>
                  {record.moveReason && record.moveReason !== 'Current Residency' && (
                    <p className="text-xs text-slate-400 italic pl-10">{record.moveReason}</p>
                  )}
                </div>
              )) : (
                <div className="px-6 py-12 text-center text-slate-400 text-xs italic font-medium">No residency history found for this unit.</div>
              )}
            </div>

            {/* Desktop: Table */}
            <table className="hidden sm:table w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-950/30 border-b border-slate-100 dark:border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Term</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Resident Name</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Move-Out Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason for Moving</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {unitHistory.length > 0 ? unitHistory.map((record, idx) => (
                  <tr key={`${record.tenant.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">
                      {formatDate(record.startDate)} - {record.endDate ? formatDate(record.endDate) : 'Present'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs uppercase ${record.isCurrent ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                          {record.tenant.firstName[0]}
                        </div>
                        <span className="text-sm font-black text-slate-800 dark:text-slate-200">{record.tenant.firstName} {record.tenant.lastName}</span>
                        {record.isCurrent && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 rounded uppercase tracking-tighter">Current</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                      {record.endDate ? formatDate(record.endDate) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500 italic">
                      {record.moveReason || 'Not recorded'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isAdmin ? (
                        <Link to={`/admin/tenants/${record.tenant.id}`} className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-[10px] font-black uppercase tracking-widest flex items-center justify-end gap-1">
                          View Profile <i className="fa-solid fa-arrow-right text-[8px]"></i>
                        </Link>
                      ) : (
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Archived</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs italic font-medium">
                      No residency history found for this unit.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'layout' && (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-white/5 flex flex-col items-center">
             <div className="w-full max-w-lg aspect-video bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-slate-200 dark:border-slate-700 relative flex items-center justify-center p-8">
                {/* Visual Unit Representation */}
                <div className="w-full h-full border-4 border-slate-300 dark:border-slate-600 rounded-xl relative grid grid-cols-4 grid-rows-3 gap-2 p-4">
                   <div className="col-span-2 row-span-2 border-2 border-brand-500/30 rounded flex items-center justify-center text-[10px] font-black uppercase text-slate-400">Living Room</div>
                   <div className="col-span-2 border-2 border-blue-500/30 rounded flex items-center justify-center text-[10px] font-black uppercase text-slate-400">Bedroom 1</div>
                   <div className="col-span-1 row-span-2 border-2 border-amber-500/30 rounded flex items-center justify-center text-[10px] font-black uppercase text-slate-400">Kitchen</div>
                   <div className="col-span-1 border-2 border-rose-500/30 rounded flex items-center justify-center text-[10px] font-black uppercase text-slate-400">Bath</div>
                </div>
                <div className="absolute top-4 right-4 text-[10px] font-black text-brand-600 bg-brand-100 px-2 py-1 rounded">North Facing</div>
             </div>
             <p className="mt-8 text-sm text-slate-500 font-medium">Standard {unit.type} floorplan orientation within the building envelope.</p>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <div className="flex flex-col">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Scheduled Preventative Maintenance</h3>
                <p className="text-[10px] text-slate-500 font-medium">Routine system inspections and recurring unit safety checks.</p>
              </div>
              {isAdmin && (
                <button 
                  onClick={handleSeedPreventative}
                  className="bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-100 transition-all border border-brand-100 dark:border-brand-900/30 active:scale-95 flex items-center gap-2"
                >
                  <i className="fa-solid fa-seedling"></i> Seed Unit Tasks
                </button>
              )}
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-950/30 border-b border-slate-100 dark:border-white/5">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Due Date</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Maintenance Task</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Frequency</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {scheduledTasks.length > 0 ? scheduledTasks.map(task => (
                    <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 text-xs font-bold text-slate-500">
                        {new Date(task.dueDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-600 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400">
                            <i className={`fa-solid ${
                              task.category === 'HVAC' ? 'fa-wind' :
                              task.category === 'PLUMBING' ? 'fa-droplet' :
                              task.category === 'ELECTRICAL' ? 'fa-bolt' :
                              task.category === 'SAFETY' ? 'fa-shield-halved' :
                              'fa-toolbox'
                            } text-[10px]`}></i>
                          </div>
                          {task.task}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[9px] font-black px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg uppercase tracking-tight">
                          {task.frequency.charAt(0) + task.frequency.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${
                          task.isCompleted ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {task.isCompleted ? 'Completed' : 'Upcoming'}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-24 text-center">
                        <div className="flex flex-col items-center justify-center">
                           <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-slate-200 dark:text-slate-800 text-3xl mb-6">
                              <i className="fa-solid fa-calendar-check"></i>
                           </div>
                           <h4 className="text-slate-400 font-bold mb-2">No preventative tasks found for this unit</h4>
                           <p className="text-[10px] text-slate-400/60 uppercase tracking-widest max-w-[240px] leading-relaxed mx-auto">
                             Click the seed button above to generate a standard schedule based on building protocols.
                           </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'occupancy' && (
          <div className="space-y-8">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-50 dark:border-white/5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Household Members ({currentResidents.length})</h3>
                {unit.status === 'Occupied' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowTransferModal(true)}
                      className="flex-1 sm:flex-none bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-100 transition-all border border-brand-100 dark:border-brand-900/30 active:scale-95"
                    >
                      Internal Transfer
                    </button>
                    <button
                      onClick={() => setShowMoveOutModal(true)}
                      className="flex-1 sm:flex-none bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100 dark:border-rose-900/30 active:scale-95"
                    >
                      Process Move-Out
                    </button>
                  </div>
                )}
                {unit.status !== 'Occupied' && (
                  <button
                    onClick={() => setShowMoveInModal(true)}
                    className="bg-brand-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-plus"></i> Process Move-In
                  </button>
                )}
              </div>

              {/* Mobile: Cards */}
              <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/5">
                {currentResidents.length > 0 ? currentResidents.map(resident => (
                  <div key={resident.id} className="flex items-center justify-between p-4 gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs uppercase shrink-0 ${resident.id === unit.currentTenantId ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                        {resident.firstName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200">{resident.firstName} {resident.lastName}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase">
                          {resident.id === unit.currentTenantId ? 'Primary Member' : 'Household Member'}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <Link to={`/admin/tenants/${resident.id}`} className="text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase shrink-0">
                        View <i className="fa-solid fa-arrow-right text-[8px]"></i>
                      </Link>
                    )}
                  </div>
                )) : (
                  <div className="px-6 py-12 text-center text-slate-400 text-xs italic font-medium">No active residents assigned to this unit.</div>
                )}
              </div>

              {/* Desktop: Table */}
              <table className="hidden sm:table w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-950/30">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Member Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {currentResidents.length > 0 ? currentResidents.map(resident => (
                    <tr key={resident.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs uppercase ${resident.id === unit.currentTenantId ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400' : 'bg-slate-100 text-slate-500'}`}>
                          {resident.firstName[0]}
                        </div>
                        <span className="text-sm font-black text-slate-800 dark:text-slate-200">{resident.firstName} {resident.lastName}</span>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">
                        {resident.id === unit.currentTenantId ? 'Primary Member' : 'Household Member'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isAdmin ? (
                          <Link to={`/admin/tenants/${resident.id}`} className="text-brand-600 hover:underline text-[10px] font-black uppercase">View Details</Link>
                        ) : (
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Member</span>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-400 text-xs italic font-medium">
                        No active residents assigned to this unit.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Turnover Management Modals - Moved outside tab blocks */}
      {showMoveOutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-10 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Process Move-Out</h3>
              <button onClick={() => setShowMoveOutModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Resident Warning Card */}
              <div className="p-6 bg-rose-50 dark:bg-rose-900/10 rounded-3xl border border-rose-100 dark:border-rose-800/50 flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center text-rose-600 dark:text-rose-400 text-xl shrink-0">
                  <i className="fa-solid fa-user-minus"></i>
                </div>
                <div>
                  <p className="text-sm font-bold text-rose-900 dark:text-rose-300">Confirm Household Move-Out</p>
                  <p className="text-xs text-rose-600 dark:text-rose-500 font-medium leading-relaxed">
                    Moving out {primaryResident?.firstName} {primaryResident?.lastName} and all household members from Unit {unit.number}.
                  </p>
                </div>
              </div>

              {/* Form Controls */}
              <div className="space-y-5">
                {/* Date Picker */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Effective Date</label>
                  <div className="relative">
                    <i className="fa-solid fa-calendar-day absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input 
                      type="date"
                      value={moveOutDate}
                      onChange={(e) => setMoveOutDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-2xl pl-12 pr-5 py-3.5 text-sm font-bold shadow-inner outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 dark:text-slate-200 transition-all"
                    />
                  </div>
                </div>

                {/* Reason Dropdown */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Reason for Move-Out</label>
                  <div className="relative">
                    <i className="fa-solid fa-comment-dots absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <select 
                      value={moveOutReason}
                      onChange={(e) => setMoveOutReason(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-2xl pl-12 pr-5 py-3.5 text-sm font-bold shadow-inner outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 dark:text-slate-200 appearance-none transition-all"
                    >
                      {MOVE_OUT_REASONS.map(reason => (
                        <option key={reason} value={reason}>{reason}</option>
                      ))}
                    </select>
                    <i className="fa-solid fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
                  </div>
                </div>

                {/* Custom Reason Field */}
                {moveOutReason === 'Other' && (
                  <div className="animate-in slide-in-from-top-2 duration-200">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Specify Reason</label>
                    <textarea 
                      placeholder="Type custom reason (max 200 chars)..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value.substring(0, 200))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-2xl px-5 py-3 text-sm font-bold shadow-inner outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 dark:text-slate-200 min-h-[80px] resize-none transition-all"
                    />
                    <div className="flex justify-end mt-1">
                      <span className={`text-[9px] font-black uppercase ${customReason.length >= 190 ? 'text-rose-500' : 'text-slate-400'}`}>
                        {customReason.length}/200
                      </span>
                    </div>
                  </div>
                )}

                {/* Turnover Checklist */}
                <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-3xl border border-slate-100 dark:border-white/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-list-check text-rose-500"></i> Admin Checklist
                  </p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {[
                      'Keys & fobs returned',
                      'Share capital refund processed',
                      'Final inspection scheduled',
                      'Utilities notified'
                    ].map(item => (
                      <label key={item} className="flex items-center gap-3 cursor-pointer group">
                        <div className="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-slate-800 group-hover:border-rose-500 transition-colors flex items-center justify-center shrink-0 overflow-hidden">
                          <input type="checkbox" className="peer hidden" />
                          <i className="fa-solid fa-check text-[10px] text-white opacity-0 peer-checked:opacity-100 transition-opacity bg-rose-500 w-full h-full flex items-center justify-center"></i>
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Warning Footer */}
                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/50">
                  <p className="text-[9px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-tight mb-1 flex items-center gap-1">
                    <i className="fa-solid fa-triangle-exclamation"></i> Permanent Action
                  </p>
                  <p className="text-[9px] text-amber-600 dark:text-amber-500 font-medium leading-relaxed">
                    Confirming will archive the residency record and mark the unit as Vacant. This is non-reversible.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button 
                onClick={() => setShowMoveOutModal(false)} 
                className="flex-1 py-4 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleMoveOut}
                disabled={moveOutReason === 'Other' && !customReason.trim()}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-rose-700 active:scale-95 transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Move-Out
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-10 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/5">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Internal Transfer</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Transferring Resident</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{primaryResident?.firstName} {primaryResident?.lastName}</p>
                <p className="text-xs text-slate-500">Currently in Unit {unit.number}</p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Destination Unit</label>
                <select 
                  value={selectedTargetUnitId}
                  onChange={(e) => setSelectedTargetUnitId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-2xl px-5 py-3 text-sm font-bold shadow-inner outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 dark:text-slate-200"
                >
                  <option value="">-- Choose Vacant Unit --</option>
                  {units.filter(u => u.status === 'Vacant' && u.id !== unit.id).map(u => (
                    <option key={u.id} value={u.id}>Unit {u.number} ({u.type})</option>
                  ))}
                </select>
              </div>

              <div className="bg-brand-50 dark:bg-brand-900/10 p-5 rounded-2xl border border-brand-100 dark:border-brand-800/50">
                <p className="text-[10px] font-black text-brand-800 dark:text-brand-400 uppercase tracking-tight mb-1">
                  <i className="fa-solid fa-circle-info mr-1"></i> Transfer Logic
                </p>
                <p className="text-[10px] text-brand-600 dark:text-brand-500 font-medium leading-relaxed">
                  This will automatically make Unit {unit.number} vacant and move the resident into the selected unit. All residency history will be preserved.
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button onClick={() => setShowTransferModal(false)} className="flex-1 py-4 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Cancel</button>
              <button 
                onClick={handleTransfer}
                disabled={!selectedTargetUnitId}
                className="flex-1 py-4 bg-brand-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoveInModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-10 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/5">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Process Move-In</h3>
              <button onClick={() => setShowMoveInModal(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Member from Waitlist/Directory</label>
                <select 
                  value={selectedNewTenantId}
                  onChange={(e) => setSelectedNewTenantId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-2xl px-5 py-3 text-sm font-bold shadow-inner outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 dark:text-slate-200"
                >
                  <option value="">-- Choose Member --</option>
                  {tenants.filter(t => t.id !== unit.currentTenantId).map(t => {
                    const currentUnit = units.find(u => u.id === t.unitId);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} ({t.status}{currentUnit ? ` - Unit ${currentUnit.number}` : ''})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                <p className="text-[10px] font-black text-blue-800 dark:text-blue-400 uppercase tracking-tight mb-1">
                  <i className="fa-solid fa-circle-info mr-1"></i> Turnover Checklist
                </p>
                <ul className="text-[10px] text-blue-600 dark:text-blue-500 space-y-1 font-medium">
                  <li>• Occupancy agreement signed</li>
                  <li>• Move-in inspection completed</li>
                  <li>• Keys and fobs issued</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button onClick={() => setShowMoveInModal(false)} className="flex-1 py-4 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Cancel</button>
              <button 
                onClick={handleMoveIn}
                disabled={!selectedNewTenantId}
                className="flex-1 py-4 bg-brand-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Move-In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitDetail;
