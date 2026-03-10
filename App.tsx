
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
import Login from './pages/Login';
import { MOCK_ANNOUNCEMENTS, MOCK_DOCS, MOCK_UNITS, MOCK_TENANTS, MOCK_REQUESTS, MOCK_EVENTS, MOCK_COMMITTEES } from './constants';
import { Announcement, Document, Unit, Tenant, MaintenanceRequest, CoopEvent, Committee } from './types';

interface User {
  email: string;
  name: string;
  picture: string;
  isAdmin: boolean;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [coopName, setCoopName] = useState('Your Housing Co-op');
  
  // Shared state
  const [announcements, setAnnouncements] = useState<Announcement[]>(MOCK_ANNOUNCEMENTS);
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
      const [unitsRes, tenantsRes, requestsRes, announcementsRes, docsRes, committeesRes] = await Promise.all([
        fetch('/api/units'),
        fetch('/api/tenants'),
        fetch('/api/maintenance'),
        fetch('/api/announcements'),
        fetch('/api/documents'),
        fetch('/api/committees')
      ]);

      const [unitsData, tenantsData, requestsData, announcementsData, docsData, committeesData] = await Promise.all([
        unitsRes.json(),
        tenantsRes.json(),
        requestsRes.json(),
        announcementsRes.json(),
        docsRes.json(),
        committeesRes.json()
      ]);

      if (Array.isArray(unitsData)) setUnits(unitsData);
      if (Array.isArray(tenantsData)) setTenants(tenantsData);
      if (Array.isArray(requestsData)) setRequests(requestsData);
      if (Array.isArray(announcementsData)) setAnnouncements(announcementsData);
      if (Array.isArray(docsData)) setDocuments(docsData);
      if (Array.isArray(committeesData)) setCommittees(committeesData);
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

  const isAdmin = user.isAdmin;

  return (
    <HashRouter>
      <Layout isAdmin={isAdmin} user={user} coopName={coopName}>
        <Routes>
          <Route path="/" element={<Dashboard isAdmin={isAdmin} announcements={announcements} units={units} tenants={tenants} requests={requests} events={events} />} />
          <Route path="/calendar" element={<Calendar isAdmin={isAdmin} events={events} setEvents={setEvents} />} />
          <Route path="/calendar/:eventId" element={<EventDetail isAdmin={isAdmin} />} />
          <Route path="/announcements/:annId" element={<AnnouncementDetail announcements={announcements} />} />
          <Route path="/committees" element={<Committees isAdmin={isAdmin} committees={committees} setCommittees={setCommittees} tenants={tenants} />} />
          <Route path="/maintenance" element={<Maintenance isAdmin={isAdmin} requests={requests} setRequests={setRequests} units={units} />} />
          <Route path="/documents" element={<Documents isAdmin={isAdmin} documents={documents} setDocuments={setDocuments} />} />
          <Route path="/finances" element={<Finances isAdmin={isAdmin} />} />
          <Route path="/communications" element={<Communications isAdmin={isAdmin} announcements={announcements} setAnnouncements={setAnnouncements} />} />
          <Route path="/directory" element={<Tenants isAdmin={isAdmin} tenants={tenants} setTenants={setTenants} units={units} />} />
          
          {/* Admin Routes */}
          {isAdmin && (
            <>
              <Route path="/admin/units" element={<AdminUnits units={units} setUnits={setUnits} tenants={tenants} />} />
              <Route path="/admin/units/:unitId" element={<UnitDetail units={units} setUnits={setUnits} tenants={tenants} setTenants={setTenants} requests={requests} />} />
              <Route path="/admin/tenants" element={<Tenants isAdmin={isAdmin} tenants={tenants} setTenants={setTenants} units={units} />} />
              <Route path="/admin/tenants/:tenantId" element={<TenantDetail tenants={tenants} units={units} requests={requests} />} />
              <Route path="/admin/waitlist" element={<Waitlist tenants={tenants} setTenants={setTenants} />} />
              <Route path="/admin/reports" element={<Reports />} />
              <Route path="/admin/maintenance/:requestId" element={<MaintenanceDetail isAdmin={isAdmin} />} />
            </>
          )}

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;
