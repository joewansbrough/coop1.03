import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import Dashboard from './pages/Dashboard';
import Maintenance from './pages/Maintenance';
import MaintenanceDetail from './pages/MaintenanceDetail';
import ResourceLibrary from './pages/ResourceLibrary';
import AdminUnits from './pages/AdminUnits';
import UnitDetail from './pages/UnitDetail';
import Communications from './pages/Communications';
import Calendar from './pages/Calendar';
import EventDetail from './pages/EventDetail';
import AnnouncementDetail from './pages/AnnouncementDetail';
import Committees from './pages/Committees';
import Reports from './pages/Reports';
import Tenants from './pages/Tenants';
import TenantDetail from './pages/TenantDetail';
import Waitlist from './pages/Waitlist';
import PolicyAssistant from './pages/PolicyAssistant';
import Login from './pages/Login';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useUser, useUnits, useTenants, useMaintenance, useAnnouncements, useDocuments, useCommittees, useEvents } from './hooks/useCoopData';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
    },
  },
});

const AppContent: React.FC = () => {
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [coopName] = useState('Your Housing Co-op');
  const queryClient = useQueryClient();

  const { data: user, isLoading: isUserLoading, refetch: fetchUser } = useUser();
  
  // Clean & Efficient Gating: Only fetch system data once authentication is confirmed
  const isEnabled = !!user;

  const { 
    data: units = [], 
    isLoading: isUnitsLoading,
    isError: isUnitsError,
    error: unitsError 
  } = useUnits({ enabled: isEnabled });
  
  const { 
    data: tenants = [], 
    isLoading: isTenantsLoading,
    isError: isTenantsError,
    error: tenantsError 
  } = useTenants({ enabled: isEnabled });
  
  const { 
    data: requests = [],
    isError: isRequestsError,
    error: requestsError 
  } = useMaintenance({ enabled: isEnabled });
  
  const { 
    data: announcements = [],
    isError: isAnnouncementsError,
    error: announcementsError 
  } = useAnnouncements({ enabled: isEnabled });
  
  const { 
    data: documents = [],
    isError: isDocumentsError,
    error: documentsError 
  } = useDocuments({ enabled: isEnabled });
  
  const { 
    data: committees = [],
    isError: isCommitteesError,
    error: committeesError 
  } = useCommittees({ enabled: isEnabled });
  
  const { 
    data: events = [],
    isError: isEventsError,
    error: eventsError 
  } = useEvents({ enabled: isEnabled });

  const createQueryArraySetter = <T,>(queryKey: string[]) =>
    (value: React.SetStateAction<T[]>) => {
      queryClient.setQueryData<T[]>(queryKey, (previous = []) =>
        typeof value === 'function'
          ? (value as (current: T[]) => T[])(previous)
          : value
      );
    };

  const setUnits = createQueryArraySetter<typeof units[number]>(['units']);
  const setTenants = createQueryArraySetter<typeof tenants[number]>(['tenants']);
  const setRequests = createQueryArraySetter<typeof requests[number]>(['maintenance']);
  const setAnnouncements = createQueryArraySetter<typeof announcements[number]>(['announcements']);
  const setDocuments = createQueryArraySetter<typeof documents[number]>(['documents']);
  const setCommittees = createQueryArraySetter<typeof committees[number]>(['committees']);
  const setEvents = createQueryArraySetter<typeof events[number]>(['events']);

  // Error logging for debugging
  useEffect(() => {
    const errors = [
      { name: 'Units', error: unitsError },
      { name: 'Tenants', error: tenantsError },
      { name: 'Maintenance', error: requestsError },
      { name: 'Announcements', error: announcementsError },
      { name: 'Documents', error: documentsError },
      { name: 'Committees', error: committeesError },
      { name: 'Events', error: eventsError },
    ].filter(e => e.error);

    if (errors.length > 0) {
      console.error('Data loading errors:', errors);
    }
  }, [unitsError, tenantsError, requestsError, announcementsError, documentsError, committeesError, eventsError]);

  if (isUserLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Authenticating Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={() => fetchUser()} />;
  }

  const effectiveIsAdmin = user.isAdmin && !isAdminOverride;
  const isGuest = !!user.isGuest;

  return (
    <HashRouter>
      <ScrollToTop />
      <Layout 
        isAdmin={effectiveIsAdmin}
        isActualAdmin={user.isAdmin}
        onToggleAdminView={() => setIsAdminOverride(!isAdminOverride)}
        user={user} 
        coopName={coopName}
      >
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                isAdmin={effectiveIsAdmin}
                user={user}
                units={units}
                tenants={tenants}
                requests={requests}
                announcements={announcements}
                events={events}
              />
            }
          />
          <Route path="/calendar" element={<Calendar isAdmin={effectiveIsAdmin} isGuest={isGuest} events={events} setEvents={setEvents} />} />
          <Route path="/calendar/:eventId" element={<EventDetail isAdmin={effectiveIsAdmin} isGuest={isGuest} user={user} events={events} setEvents={setEvents} />} />
          <Route path="/announcements/:annId" element={<AnnouncementDetail announcements={announcements} />} />
          <Route path="/committees" element={<Committees isAdmin={effectiveIsAdmin} isGuest={isGuest} user={user} committees={committees} setCommittees={setCommittees} tenants={tenants} documents={documents} />} />
          <Route path="/maintenance" element={<Maintenance isAdmin={effectiveIsAdmin} requests={requests} setRequests={setRequests} units={units} />} />
          <Route path="/maintenance/:requestId" element={<MaintenanceDetail isAdmin={effectiveIsAdmin} requests={requests} setRequests={setRequests} units={units} tenants={tenants} />} />
          <Route path="/documents" element={<ResourceLibrary isAdmin={effectiveIsAdmin} isGuest={isGuest} documents={documents} setDocuments={setDocuments} committees={committees} />} />
          <Route path="/policy-assistant" element={<PolicyAssistant documents={documents} announcements={announcements} />} />
          <Route path="/communications" element={<Communications isAdmin={effectiveIsAdmin} announcements={announcements} setAnnouncements={setAnnouncements} />} />
          <Route path="/directory" element={<Tenants isAdmin={effectiveIsAdmin} isLoading={isUnitsLoading || isTenantsLoading} tenants={tenants} setTenants={setTenants} units={units} />} />
          <Route path="/admin/units/:unitId" element={<UnitDetail isAdmin={effectiveIsAdmin} units={units} setUnits={setUnits} tenants={tenants} setTenants={setTenants} requests={requests} setRequests={setRequests} documents={documents} />} />
          
          {/* Admin Routes */}
          {effectiveIsAdmin && (
            <>
              <Route path="/admin/units" element={<AdminUnits units={units} setUnits={setUnits} tenants={tenants} />} />
              <Route path="/admin/tenants" element={<Tenants isAdmin={effectiveIsAdmin} isLoading={isUnitsLoading || isTenantsLoading} tenants={tenants} setTenants={setTenants} units={units} />} />
              <Route path="/admin/tenants/:tenantId" element={<TenantDetail tenants={tenants} units={units} requests={requests} />} />
              <Route path="/admin/waitlist" element={<Waitlist tenants={tenants} setTenants={setTenants} />} />
              <Route
                path="/admin/reports"
                element={
                  <Reports
                    units={units}
                    tenants={tenants}
                    requests={requests}
                  />
                }
              />
              <Route path="/admin/maintenance/:requestId" element={<MaintenanceDetail isAdmin={effectiveIsAdmin} requests={requests} setRequests={setRequests} units={units} tenants={tenants} />} />
            </>
          )}
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
  </QueryClientProvider>
);

export default App;
