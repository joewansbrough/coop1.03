import React, { useState } from 'react';
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
import { MOCK_ANNOUNCEMENTS, MOCK_DOCS, MOCK_UNITS, MOCK_TENANTS, MOCK_REQUESTS, MOCK_EVENTS, MOCK_COMMITTEES } from './constants';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  
  // React Query hooks replace manual fetch/useEffect
  const { data: user, isLoading: isUserLoading, refetch: fetchUser } = useUser();
  const { data: units = MOCK_UNITS } = useUnits();
  const { data: tenants = MOCK_TENANTS } = useTenants();
  const { data: requests = MOCK_REQUESTS } = useMaintenance();
  const { data: announcements = MOCK_ANNOUNCEMENTS } = useAnnouncements();
  const { data: documents = MOCK_DOCS } = useDocuments();
  const { data: committees = MOCK_COMMITTEES } = useCommittees();
  const { data: events = MOCK_EVENTS } = useEvents();

  // Placeholder setters for backward compatibility during transition
  const setUnits = () => {};
  const setTenants = () => {};
  const setRequests = () => {};
  const setAnnouncements = () => {};
  const setDocuments = () => {};
  const setCommittees = () => {};
  const setEvents = () => {};

  if (isUserLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
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
        isGuest={isGuest}
        onToggleAdminView={() => setIsAdminOverride(!isAdminOverride)}
        user={user} 
        coopName={coopName}
      >
        <Routes>
          <Route path="/" element={<Dashboard isAdmin={effectiveIsAdmin} isGuest={isGuest} user={user} announcements={announcements} units={units} tenants={tenants} requests={requests} events={events} />} />
          <Route path="/calendar" element={<Calendar isAdmin={effectiveIsAdmin} isGuest={isGuest} events={events} setEvents={setEvents} />} />
          <Route path="/calendar/:eventId" element={<EventDetail isAdmin={effectiveIsAdmin} isGuest={isGuest} user={user} events={events} setEvents={setEvents} />} />
          <Route path="/announcements/:annId" element={<AnnouncementDetail announcements={announcements} />} />
          <Route path="/committees" element={<Committees isAdmin={effectiveIsAdmin} isGuest={isGuest} committees={committees} setCommittees={setCommittees} tenants={tenants} documents={documents} />} />
          <Route path="/maintenance" element={<Maintenance isAdmin={effectiveIsAdmin} isGuest={isGuest} requests={requests} setRequests={setRequests} units={units} />} />
          <Route path="/maintenance/:requestId" element={<MaintenanceDetail isAdmin={effectiveIsAdmin} isGuest={isGuest} requests={requests} setRequests={setRequests} units={units} tenants={tenants} />} />
          <Route path="/documents" element={<ResourceLibrary isAdmin={effectiveIsAdmin} isGuest={isGuest} documents={documents} setDocuments={setDocuments} committees={committees} />} />
          <Route path="/policy-assistant" element={<PolicyAssistant documents={documents} />} />
          <Route path="/communications" element={<Communications isAdmin={effectiveIsAdmin} isGuest={isGuest} announcements={announcements} setAnnouncements={setAnnouncements} />} />
          <Route path="/directory" element={<Tenants isAdmin={effectiveIsAdmin} isGuest={isGuest} tenants={tenants} setTenants={setTenants} units={units} />} />
          <Route path="/admin/units/:unitId" element={<UnitDetail isAdmin={effectiveIsAdmin} units={units} setUnits={setUnits} tenants={tenants} setTenants={setTenants} requests={requests} setRequests={setRequests} />} />
          
          {/* Admin Routes */}
          {effectiveIsAdmin && (
            <>
              <Route path="/admin/units" element={<AdminUnits units={units} setUnits={setUnits} tenants={tenants} />} />
              <Route path="/admin/tenants" element={<Tenants isAdmin={effectiveIsAdmin} isGuest={isGuest} tenants={tenants} setTenants={setTenants} units={units} />} />
              <Route path="/admin/tenants/:tenantId" element={<TenantDetail tenants={tenants} units={units} requests={requests} />} />
              <Route path="/admin/waitlist" element={<Waitlist tenants={tenants} setTenants={setTenants} />} />
              <Route path="/admin/reports" element={<Reports />} />
              <Route path="/admin/maintenance/:requestId" element={<MaintenanceDetail isAdmin={effectiveIsAdmin} isGuest={isGuest} requests={requests} setRequests={setRequests} units={units} tenants={tenants} />} />
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
