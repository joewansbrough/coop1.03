
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Maintenance from './pages/Maintenance';
import MaintenanceDetail from './pages/MaintenanceDetail';
import Documents from './pages/Documents';
import AdminUnits from './pages/AdminUnits';
import UnitDetail from './pages/UnitDetail';
import Finances from './pages/Finances';
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
import { Announcement, Document, Unit, Tenant, MaintenanceRequest, CoopEvent, Committee } from './types';

interface User {
  email: string;
  name: string;
  picture: string;
  isAdmin: boolean;
  isGuest?: boolean;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [coopName, setCoopName] = useState('Your Housing Co-op');
  
  // Shared state
  const [announcements, setAnnouncements] = useState<Announcement[]>(MOCK_ANNOUNCEMENTS);
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [documents, setDocuments] = useState<Document[]>(MOCK_DOCS);
  const [units, setUnits] = useState<Unit[]>(MOCK_UNITS);
  const [tenants, setTenants] = useState<Tenant[]>(MOCK_TENANTS);
  const [requests, setRequests] = useState<MaintenanceRequest[]>(MOCK_REQUESTS);
  const [events, setEvents] = useState<CoopEvent[]>(MOCK_EVENTS);
  const [committees, setCommittees] = useState<Committee[]>(MOCK_COMMITTEES);

  const fetchUser = async () => {
    console.log('Fetching user session...');
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      console.log('User session data:', data.user);
      setUser(data.user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllData = async () => {
    try {
      const [unitsRes, tenantsRes, requestsRes, announcementsRes, docsRes, committeesRes, eventsRes] = await Promise.all([
        fetch('/api/units'),
        fetch('/api/tenants'),
        fetch('/api/maintenance'),
        fetch('/api/announcements'),
        fetch('/api/documents'),
        fetch('/api/committees'),
        fetch('/api/events')
      ]);

      const [unitsData, tenantsData, requestsData, announcementsData, docsData, committeesData, eventsData] = await Promise.all([
        unitsRes.json(),
        tenantsRes.json(),
        requestsRes.json(),
        announcementsRes.json(),
        docsRes.json(),
        committeesRes.json(),
        eventsRes.json()
      ]);

      setUnits(Array.isArray(unitsData) ? unitsData : []);
      setTenants(Array.isArray(tenantsData) ? tenantsData : []);
      setRequests(Array.isArray(requestsData) ? requestsData : []);
      setAnnouncements(Array.isArray(announcementsData) ? announcementsData : []);
      setDocuments(Array.isArray(docsData) ? docsData : []);
      setCommittees(Array.isArray(committeesData) ? committeesData : []);
      setEvents(Array.isArray(eventsData) ? eventsData : []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user]);

  useEffect(() => {
    fetchUser();
  }, []);

  if (isLoading) {
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
    return <Login onLoginSuccess={fetchUser} />;
  }

  const effectiveIsAdmin = user.isAdmin && !isAdminOverride;
  const isGuest = !!user.isGuest;

  return (
    <HashRouter>
      <Layout 
        isAdmin={effectiveIsAdmin} 
        isActualAdmin={user.isAdmin}
        isGuest={isGuest}
        onToggleAdminView={() => setIsAdminOverride(!isAdminOverride)}
        user={user} 
        coopName={coopName}
      >
        <Routes>
          <Route path="/" element={<Dashboard isAdmin={effectiveIsAdmin} isGuest={isGuest} announcements={announcements} units={units} tenants={tenants} requests={requests} events={events} />} />
          <Route path="/calendar" element={<Calendar isAdmin={effectiveIsAdmin} isGuest={isGuest} events={events} setEvents={setEvents} />} />
          <Route path="/calendar/:eventId" element={<EventDetail isAdmin={effectiveIsAdmin} isGuest={isGuest} events={events} setEvents={setEvents} />} />
          <Route path="/announcements/:annId" element={<AnnouncementDetail announcements={announcements} />} />
          <Route path="/committees" element={<Committees isAdmin={effectiveIsAdmin} isGuest={isGuest} committees={committees} setCommittees={setCommittees} tenants={tenants} />} />
          <Route path="/maintenance" element={<Maintenance isAdmin={effectiveIsAdmin} isGuest={isGuest} requests={requests} setRequests={setRequests} units={units} />} />
          <Route path="/maintenance/:requestId" element={<MaintenanceDetail isAdmin={effectiveIsAdmin} isGuest={isGuest} requests={requests} setRequests={setRequests} units={units} tenants={tenants} />} />
          <Route path="/documents" element={<Documents isAdmin={effectiveIsAdmin} isGuest={isGuest} documents={documents} setDocuments={setDocuments} />} />
          <Route path="/policy-assistant" element={<PolicyAssistant documents={documents} />} />
          <Route path="/finances" element={<Finances isAdmin={effectiveIsAdmin} isGuest={isGuest} />} />
          <Route path="/communications" element={<Communications isAdmin={effectiveIsAdmin} isGuest={isGuest} announcements={announcements} setAnnouncements={setAnnouncements} />} />
          <Route path="/directory" element={<Tenants isAdmin={effectiveIsAdmin} isGuest={isGuest} tenants={tenants} setTenants={setTenants} units={units} />} />
          
          {/* Admin Routes */}
          {effectiveIsAdmin && (
            <>
              <Route path="/admin/units" element={<AdminUnits units={units} setUnits={setUnits} tenants={tenants} />} />
              <Route path="/admin/units/:unitId" element={<UnitDetail units={units} setUnits={setUnits} tenants={tenants} setTenants={setTenants} requests={requests} />} />
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

export default App;
