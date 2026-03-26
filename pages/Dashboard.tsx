
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StatCard from '../components/StatCard';
import { RequestStatus, Announcement, Unit, Tenant, MaintenanceRequest, CoopEvent } from '../types';

interface DashboardProps {
  isAdmin: boolean;
  isGuest?: boolean;
  user: {
    name: string;
    [key: string]: any;
  };
  announcements: Announcement[];
  units: Unit[];
  tenants: Tenant[];
  requests: MaintenanceRequest[];
  events: CoopEvent[];
}

const Dashboard: React.FC<DashboardProps> = ({ isAdmin, isGuest, user, announcements, units, tenants, requests, events }) => {
  const navigate = useNavigate();

  const firstName = user?.name ? user.name.split(' ')[0] : '';

  // For members, only show stats for their unit (if they have one)
  const userUnitId = units.length > 0 ? units[0].id : null;
  
  const userOpenRequests = (userUnitId && Array.isArray(requests)) 
    ? requests.filter(r => r.unitId === userUnitId && r.status !== RequestStatus.COMPLETED && r.status !== RequestStatus.CANCELLED)
    : [];

  // Admin KPI Calculations
  const pendingRequestsAll = Array.isArray(requests) ? requests.filter(r => r.status === RequestStatus.PENDING).length : 0;
  const pendingRequestsUser = (userUnitId && Array.isArray(requests)) ? requests.filter(r => r.unitId === userUnitId && r.status === RequestStatus.PENDING).length : 0;
  const pendingRequests = isAdmin ? pendingRequestsAll : pendingRequestsUser;
  
  // Find closest upcoming meeting
  const now = new Date();
  const nextMeeting = events
    .filter(e => (e.category === 'Meeting' || e.category === 'Board') && new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const unitChartData = [
    { name: '1BR', count: units.filter(u => u.type === '1BR').length },
    { name: '2BR', count: units.filter(u => u.type === '2BR').length },
    { name: '3BR', count: units.filter(u => u.type === '3BR').length },
    { name: '4BR', count: units.filter(u => u.type === '4BR').length },
  ];
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

  const upcomingEvents = events.slice(0, 3);
  const recentAnnouncements = announcements.slice(0, 2);

  // Group units by floor for the map
  const unitsByFloor = units.reduce((acc, unit) => {
    const floor = unit.floor || 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(unit);
    return acc;
  }, {} as Record<number, Unit[]>);

  const sortedFloors = Object.keys(unitsByFloor)
    .map(Number)
    .sort((a, b) => a - b);

  if (isAdmin) {
    return (
      <div className="space-y-6 lg:space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 transition-colors duration-200">
        {/* Admin Welcome Header */}
        <div className="relative overflow-hidden bg-slate-900 dark:bg-slate-950 rounded-[2.5rem] p-8 lg:p-12 text-white border border-white/5">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full -mr-40 -mt-40 blur-[100px] pointer-events-none"></div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-emerald-500/20">
                <i className="fa-solid fa-shield-halved"></i> Co-Operative Housing Association Admin Hub
              </div>
              <h1 className="text-4xl lg:text-6xl font-black mb-6 leading-tight">Welcome home, {firstName}.</h1>
              <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-md mx-auto lg:mx-0">
                Manage units, residents, and maintenance across your co-op community.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link to="/maintenance" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-emerald-500/20">
                  <i className="fa-solid fa-wrench"></i> Service Queue
                </Link>
                <Link to="/admin/reports" className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all backdrop-blur-xl border border-white/10 flex items-center justify-center gap-3">
                  <i className="fa-solid fa-chart-line"></i> Financial Reports
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid grid-rows-2 gap-4">
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/5 backdrop-blur-md flex flex-col justify-center">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Managed Units</p>
                    <p className="text-2xl font-black">{units.length}</p>
                  </div>
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/5 backdrop-blur-md flex flex-col justify-center">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Residents</p>
                    <p className="text-2xl font-black">{tenants.filter(t => t.status === 'Current').length}</p>
                  </div>
              </div>
              <div className="flex h-full">
                  {nextMeeting ? (
                    <Link to={`/calendar/${nextMeeting.id}`} className="w-full bg-white/5 p-8 rounded-3xl border border-white/5 backdrop-blur-md hover:bg-white/10 transition-all hover:scale-[1.02] active:scale-95 flex flex-col justify-center items-center text-center">
                      <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-4">Next Meeting</p>
                      <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 mb-4">
                        <i className="fa-solid fa-calendar-day text-2xl"></i>
                      </div>
                      <p className="text-3xl font-black mb-1">{new Date(nextMeeting.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-tight line-clamp-2">{nextMeeting.title}</p>
                    </Link>
                  ) : (
                    <div className="w-full bg-white/5 p-8 rounded-3xl border border-white/5 backdrop-blur-md flex flex-col justify-center items-center text-center">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Next Meeting</p>
                      <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-slate-600 mb-4">
                        <i className="fa-solid fa-calendar-xmark text-2xl"></i>
                      </div>
                      <p className="text-xl font-black">TBD</p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <Link to="/admin/units" className="block hover:scale-[1.02] active:scale-95 transition-all group">
            <StatCard label="Unit Inventory" value={units.length} icon="fa-building" color="bg-emerald-500" />
            <div className="mt-2 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center opacity-0 group-hover:opacity-100 transition-opacity">Manage All <i className="fa-solid fa-arrow-right ml-1"></i></div>
          </Link>
          <Link to="/admin/tenants" className="block hover:scale-[1.02] active:scale-95 transition-all group">
            <StatCard label="Total Residents" value={tenants.filter(t => t.status === 'Current').length} icon="fa-users" color="bg-blue-500" />
            <div className="mt-2 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center opacity-0 group-hover:opacity-100 transition-opacity">Directory <i className="fa-solid fa-arrow-right ml-1"></i></div>
          </Link>
          <Link to="/maintenance" className="block hover:scale-[1.02] active:scale-95 transition-all group">
            <StatCard label="Active Requests" value={pendingRequests} icon="fa-wrench" color="bg-amber-500" />
            <div className="mt-2 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center opacity-0 group-hover:opacity-100 transition-opacity">Dispatch <i className="fa-solid fa-arrow-right ml-1"></i></div>
          </Link>
          <Link to="/admin/waitlist" className="block hover:scale-[1.02] active:scale-95 transition-all group">
            <StatCard label="Waitlist Size" value={tenants.filter(t => t.status === 'Waitlist').length} icon="fa-clock-rotate-left" color="bg-purple-500" />
            <div className="mt-2 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center opacity-0 group-hover:opacity-100 transition-opacity">View Queue <i className="fa-solid fa-arrow-right ml-1"></i></div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 lg:p-8 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Interactive Association Map</h3>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> Occupied</span>
                <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"></div> Vacant</span>
              </div>
            </div>
            {units.length > 0 ? (
              <div className="space-y-10">
                {sortedFloors.map(floor => (
                  <div key={floor} className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Floor {floor}
                      </div>
                      <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1"></div>
                    </div>
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3 lg:gap-5">
                      {unitsByFloor[floor].sort((a, b) => a.number.localeCompare(b.number)).map(unit => (
                        <button
                          key={unit.id}
                          onClick={() => navigate(`/admin/units/${unit.id}`)}
                          className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all hover:scale-110 active:scale-95 group relative shadow-sm ${
                            unit.status === 'Occupied' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500 text-emerald-700 dark:text-emerald-400' :
                            'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600'
                          }`}
                        >
                          <span className="text-xs lg:text-sm font-black">{unit.number}</span>
                          <i className="fa-solid fa-house text-[8px] lg:text-[10px] mt-1 opacity-20 group-hover:opacity-100 transition-opacity"></i>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-3xl">
                <i className="fa-solid fa-building-circle-exclamation text-4xl text-slate-200 dark:text-slate-800 mb-4"></i>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No units registered in system</p>
                <Link to="/admin/units" className="mt-4 inline-flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:underline">
                  <i className="fa-solid fa-plus"></i> Add First Unit
                </Link>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight flex items-center gap-2">
              <i className="fa-solid fa-bolt text-amber-500"></i>
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button 
                onClick={() => navigate('/documents')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 hover:border-emerald-500 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <i className="fa-solid fa-file-arrow-up"></i>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">Upload Document</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase">Archive new policy</p>
                </div>
              </button>
              <button 
                onClick={() => navigate('/communications')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 hover:border-blue-500 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <i className="fa-solid fa-bullhorn"></i>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">New Announcement</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase">Blast to community</p>
                </div>
              </button>
              <button 
                onClick={() => navigate('/calendar')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 hover:border-amber-500 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all">
                  <i className="fa-solid fa-calendar-plus"></i>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">Schedule Event</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase">Add to calendar</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-12 transition-colors duration-200">
      <div className="relative overflow-hidden bg-slate-900 dark:bg-slate-950 rounded-[2.5rem] p-8 lg:p-12 text-white border border-white/5">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full -mr-40 -mt-40 blur-[100px] pointer-events-none"></div>
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-emerald-500/20">
              <i className="fa-solid fa-house-circle-check"></i> Co-Operative Housing Association Member Hub
            </div>
            <h1 className="text-4xl lg:text-6xl font-black mb-6 leading-tight">Welcome home, {firstName}.</h1>
            <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-md mx-auto lg:mx-0">
              Streamline your co-op experience: report issues, review policies, and join community meetings.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link to="/maintenance" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95">
                <i className="fa-solid fa-wrench"></i> Report Issue
              </Link>
              <Link to="/documents" className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all backdrop-blur-xl border border-white/10 flex items-center justify-center gap-3">
                <i className="fa-solid fa-book-open"></i> Rules & Bylaws
              </Link>
            </div>
          </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex h-full">
                {userUnitId ? (
                  <Link to={`/admin/units/${userUnitId}`} className="w-full bg-white/5 p-8 rounded-3xl border border-white/5 backdrop-blur-md hover:bg-white/10 transition-all hover:scale-[1.02] active:scale-95 flex flex-col justify-center items-center text-center group">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">My Residency</p>
                    <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                      <i className="fa-solid fa-house-user text-2xl"></i>
                    </div>
                    <p className="text-3xl font-black mb-1">Unit {units.find(u => u.id === userUnitId)?.number}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tight line-clamp-2">
                      {units.find(u => u.id === userUnitId)?.type} • Floor {units.find(u => u.id === userUnitId)?.floor}
                    </p>
                    <div className="mt-6 pt-6 border-t border-white/5 w-full">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {userOpenRequests.length > 0 ? (
                          <span className="text-amber-400">{userOpenRequests.length} Pending Requests</span>
                        ) : (
                          <span className="text-emerald-400">Residency Active</span>
                        )}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="w-full bg-white/5 p-8 rounded-3xl border border-white/5 backdrop-blur-md flex flex-col justify-center items-center text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">My Residency</p>
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-slate-600 mb-4">
                      <i className="fa-solid fa-house-slash text-2xl"></i>
                    </div>
                    <p className="text-xl font-black mb-1">No Unit</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Contact administration</p>
                    <div className="mt-6 pt-6 border-t border-white/5 w-full">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TBD</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex h-full">
                {nextMeeting ? (
                  <Link to={`/calendar/${nextMeeting.id}`} className="w-full bg-white/5 p-8 rounded-3xl border border-white/5 backdrop-blur-md hover:bg-white/10 transition-all hover:scale-[1.02] active:scale-95 flex flex-col justify-center items-center text-center group">
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-4">Next Meeting</p>
                    <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                      <i className="fa-solid fa-calendar-day text-2xl"></i>
                    </div>
                    <p className="text-3xl font-black mb-1">{new Date(nextMeeting.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tight line-clamp-2">{nextMeeting.title}</p>
                    <div className="mt-6 pt-6 border-t border-white/5 w-full">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{nextMeeting.time} • {nextMeeting.location}</p>
                    </div>
                  </Link>
                ) : (
                  <div className="w-full bg-white/5 p-8 rounded-3xl border border-white/5 backdrop-blur-md flex flex-col justify-center items-center text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Next Meeting</p>
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-slate-600 mb-4">
                      <i className="fa-solid fa-calendar-xmark text-2xl"></i>
                    </div>
                    <p className="text-xl font-black mb-1">TBD</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">No upcoming events</p>
                    <div className="mt-6 pt-6 border-t border-white/5 w-full">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TBD</p>
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {!isAdmin && userOpenRequests.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 p-8 shadow-sm">
              <div className="flex justify-between items-center mb-8 border-b border-slate-50 dark:border-white/5 pb-6">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tight">
                  <i className="fa-solid fa-wrench text-emerald-500"></i>
                  My Service Requests
                </h2>
                <Link to="/maintenance" className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest hover:underline">View All</Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userOpenRequests.map(req => (
                  <Link 
                    to={`/maintenance/${req.id}`} 
                    key={req.id} 
                    className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-emerald-500 transition-all group flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest ${
                        req.urgency === 'Emergency' ? 'bg-rose-100 text-rose-700' :
                        req.urgency === 'High' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {req.urgency}
                      </span>
                      <span className="text-[9px] font-black text-slate-400 uppercase">{req.status}</span>
                    </div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white mb-2 group-hover:text-emerald-600 transition-colors line-clamp-1">{req.description}</h3>
                    <div className="mt-auto pt-3 border-t border-slate-200/50 dark:border-white/5 flex justify-between items-center">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">Filed {new Date(req.createdAt).toLocaleDateString()}</span>
                      <i className="fa-solid fa-arrow-right text-[10px] text-slate-300 group-hover:text-emerald-500 transition-colors"></i>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 p-8 shadow-sm">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tight mb-8 border-b border-slate-50 dark:border-white/5 pb-6">
              <i className="fa-solid fa-bullhorn text-emerald-500"></i>
              Community Updates
            </h2>
            {recentAnnouncements.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {recentAnnouncements.map(ann => (
                  <Link to={`/announcements/${ann.id}`} key={ann.id} className="group flex flex-col h-full bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-3xl border border-slate-100 dark:border-white/5 hover:bg-white dark:hover:bg-slate-800 hover:border-emerald-200 dark:hover:border-emerald-500/30 transition-all">
                    <div className="flex justify-between items-start mb-6">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest ${ann.priority === 'Urgent' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                        {ann.priority}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{ann.date}</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white mb-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-tight">{ann.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8 flex-1 line-clamp-3">{ann.content}</p>
                    <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-[10px] font-black uppercase text-slate-500 dark:text-slate-300">{ann.author[0]}</div>
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{ann.author}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center bg-slate-50 dark:bg-slate-950/50 rounded-3xl border border-dashed border-slate-200 dark:border-white/5">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No recent announcements</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 p-8 shadow-sm flex-1">
            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-[10px] mb-8 flex justify-between items-center">
              <span>Community Calendar</span>
              <Link to="/calendar" className="text-emerald-600 dark:text-emerald-400 hover:underline">View Full</Link>
            </h3>
            
            {/* Mini Calendar View */}
            <div className="mb-8 bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-100 dark:border-white/5">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-tight">
                  {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <span key={`${d}-${i}`} className="text-[8px] font-black text-slate-400 uppercase">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square"></div>
                ))}
                {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() }).map((_, i) => {
                  const day = i + 1;
                  const isToday = day === new Date().getDate();
                  const hasEvent = events.some(e => {
                    const d = new Date(e.date);
                    return d.getDate() === day && d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
                  });
                  return (
                    <div 
                      key={day} 
                      className={`aspect-square flex items-center justify-center text-[10px] font-black rounded-lg relative ${
                        isToday ? 'bg-emerald-600 text-white' : 
                        hasEvent ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 
                        'text-slate-400'
                      }`}
                    >
                      {day}
                      {hasEvent && !isToday && (
                        <span className="absolute bottom-1 w-1 h-1 bg-emerald-500 rounded-full"></span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Upcoming Events</h4>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-6">
                {upcomingEvents.map(event => (
                  <div 
                    key={event.id} 
                    onClick={() => navigate(`/calendar/${event.id}`)}
                    className="flex gap-4 group cursor-pointer items-center"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center shrink-0 border border-slate-50 dark:border-white/5 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 transition-all">
                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">{new Date(event.date).toLocaleDateString('en-CA', { month: 'short' })}</span>
                      <span className="text-sm font-black text-slate-800 dark:text-white">{new Date(event.date).getDate()}</span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="text-sm font-black text-slate-800 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-none mb-1">{event.title}</h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tight">{event.time} • {event.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-white/5">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">No upcoming events</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
