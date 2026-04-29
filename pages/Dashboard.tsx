import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardTileCatalog from '../components/dashboard/DashboardTileCatalog';
import DashboardTileGrid from '../components/dashboard/DashboardTileGrid';
import { useDashboardPreferences } from '../hooks/useDashboardPreferences';
import {
  DASHBOARD_TILE_REGISTRY,
  createDefaultDashboardLayout,
  normalizeDashboardPreference,
  type DashboardPreference,
  type DashboardRole,
  type DashboardTileId,
} from '../utils/dashboardPreferences';
import { formatDate, formatShortDate } from '../utils/dateUtils';
import {
  Announcement,
  Committee,
  CoopEvent,
  Document,
  MaintenancePriority,
  MaintenanceRequest,
  RequestStatus,
  ScheduledMaintenance,
  Tenant,
  Unit,
} from '../types';

interface DashboardProps {
  isAdmin: boolean;
  user: {
    name: string;
    tenantId?: string | null;
    [key: string]: any;
  };
  units: Unit[];
  isUnitsLoading?: boolean;
  isUnitsError?: boolean;
  tenants: Tenant[];
  isTenantsLoading?: boolean;
  isTenantsError?: boolean;
  requests: MaintenanceRequest[];
  isRequestsLoading?: boolean;
  isRequestsError?: boolean;
  announcements: Announcement[];
  isAnnouncementsLoading?: boolean;
  isAnnouncementsError?: boolean;
  events: CoopEvent[];
  isEventsLoading?: boolean;
  isEventsError?: boolean;
  documents?: Document[];
  committees?: Committee[];
  scheduledMaintenance?: ScheduledMaintenance[];
}

const openStatuses = new Set<string>([
  RequestStatus.PENDING,
  RequestStatus.IN_PROGRESS,
]);

const asDate = (value?: string) => {
  const date = value ? new Date(value) : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
};

const getNextEvent = (events: CoopEvent[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return [...events]
    .filter(event => {
      const eventDate = asDate(event.date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate >= today;
    })
    .sort((a, b) => asDate(a.date).getTime() - asDate(b.date).getTime())[0];
};

const TileHeading: React.FC<{ tileId: DashboardTileId; icon: string; action?: React.ReactNode }> = ({ tileId, icon, action }) => (
  <div className="mb-5 flex items-start justify-between gap-3">
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-300">
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Dashboard tile</p>
        <h2 className="mt-1 text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">{DASHBOARD_TILE_REGISTRY[tileId].title}</h2>
      </div>
    </div>
    {action}
  </div>
);

const EmptyTile: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-white/10 dark:bg-slate-950/40">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({
  isAdmin,
  user,
  units,
  tenants,
  requests,
  announcements,
  events,
  documents = [],
  committees = [],
  scheduledMaintenance = [],
}) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const role: DashboardRole = isAdmin ? 'admin' : 'resident';
  const {
    preference,
    isSaving,
    savePreference,
  } = useDashboardPreferences(role);

  const firstName = user?.name ? user.name.split(' ')[0] : '';
  const userTenantId = user?.tenantId ?? null;
  const userUnit = units.find(unit => unit.currentTenantId === userTenantId);
  const userUnitId = userUnit?.id ?? null;
  const currentResidents = tenants.filter(tenant => tenant.status === 'Current');
  const waitlistCount = tenants.filter(tenant => tenant.status === 'Waitlist').length;
  const openRequests = requests.filter(request => openStatuses.has(request.status));
  const userOpenRequests = userUnitId ? openRequests.filter(request => request.unitId === userUnitId) : [];
  const nextEvent = getNextEvent(events);
  const recentAnnouncements = [...announcements].sort((a, b) => asDate(b.date).getTime() - asDate(a.date).getTime()).slice(0, 3);
  const recentDocuments = [...documents].sort((a, b) => asDate(b.date).getTime() - asDate(a.date).getTime()).slice(0, 4);
  const upcomingScheduled = [...scheduledMaintenance]
    .filter(task => !task.isCompleted)
    .sort((a, b) => asDate(a.dueDate).getTime() - asDate(b.dueDate).getTime())
    .slice(0, 4);

  const unitsByFloor = useMemo(() => {
    return units.reduce((acc, unit) => {
      const floor = unit.floor || 0;
      acc[floor] = [...(acc[floor] || []), unit];
      return acc;
    }, {} as Record<number, Unit[]>);
  }, [units]);

  const updatePreference = (nextPreference: DashboardPreference) => {
    savePreference(normalizeDashboardPreference(nextPreference, role));
  };

  const renderRequestBadge = (request: MaintenanceRequest) => (
    <span className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
      request.priority === MaintenancePriority.EMERGENCY ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' :
      request.priority === MaintenancePriority.HIGH ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
      'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
    }`}>
      {request.priority}
    </span>
  );

  const renderTile = (tileId: DashboardTileId) => {
    switch (tileId) {
      case 'maintenance-pulse': {
        const emergency = openRequests.filter(request => request.priority === MaintenancePriority.EMERGENCY).length;
        const high = openRequests.filter(request => request.priority === MaintenancePriority.HIGH).length;
        return (
          <div className="flex h-full flex-col">
            <TileHeading tileId={tileId} icon="fa-wrench" action={<Link to="/maintenance" className="text-[10px] font-black uppercase tracking-widest text-teal-600">Open queue</Link>} />
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/40"><p className="text-2xl font-black text-slate-900 dark:text-white">{openRequests.length}</p><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Open</p></div>
              <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/20"><p className="text-2xl font-black text-amber-600">{high}</p><p className="text-[9px] font-black uppercase tracking-widest text-amber-700/70">High</p></div>
              <div className="rounded-2xl bg-rose-50 p-4 dark:bg-rose-950/20"><p className="text-2xl font-black text-rose-600">{emergency}</p><p className="text-[9px] font-black uppercase tracking-widest text-rose-700/70">Emergency</p></div>
            </div>
            <div className="mt-4 space-y-2">
              {openRequests.slice(0, 3).map(request => (
                <button key={request.id} onClick={() => navigate(`/maintenance/${request.id}`)} className="w-full rounded-2xl border border-slate-100 p-3 text-left transition-colors hover:border-teal-300 dark:border-white/5">
                  <div className="flex items-center justify-between gap-3">{renderRequestBadge(request)}<span className="text-[9px] font-black uppercase text-slate-400">{request.status}</span></div>
                  <p className="mt-2 line-clamp-1 text-xs font-black text-slate-900 dark:text-white">{request.title || request.description}</p>
                </button>
              ))}
            </div>
          </div>
        );
      }
      case 'building-map': {
        const floors = Object.keys(unitsByFloor).map(Number).sort((a, b) => a - b);
        return (
          <div>
            <TileHeading tileId={tileId} icon="fa-building" action={<Link to="/admin/units" className="text-[10px] font-black uppercase tracking-widest text-teal-600">Units</Link>} />
            <div className="space-y-4">
              {floors.slice(0, 5).map(floor => (
                <div key={floor} className="flex items-center gap-3">
                  <span className="w-12 text-[10px] font-black uppercase text-slate-400">Floor {floor}</span>
                  <div className="grid flex-1 grid-cols-8 gap-1">
                    {unitsByFloor[floor].slice(0, 16).map(unit => (
                      <button key={unit.id} onClick={() => navigate(`/admin/units/${unit.id}`)} className={`aspect-square rounded-lg text-[8px] font-black ${
                        unit.status === 'Occupied' ? 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300' :
                        unit.status === 'Maintenance' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                        'bg-slate-100 text-slate-400 dark:bg-slate-800'
                      }`}>
                        {unit.number}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }
      case 'next-meeting':
      case 'next-community-event':
        return nextEvent ? (
          <button onClick={() => navigate(`/calendar/${nextEvent.id}`)} className="flex h-full min-h-0 w-full flex-col text-left">
            <TileHeading tileId={tileId} icon="fa-calendar-day" />
            <div className="mt-auto min-h-0 overflow-hidden rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/20">
              <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{formatShortDate(nextEvent.date)}</p>
              <p className="mt-2 line-clamp-2 text-xs font-black leading-snug text-slate-900 dark:text-white">{nextEvent.title}</p>
              <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wider text-slate-500">{nextEvent.time} - {nextEvent.location}</p>
            </div>
          </button>
        ) : <><TileHeading tileId={tileId} icon="fa-calendar-xmark" /><EmptyTile label="No upcoming events" /></>;
      case 'announcement-digest':
      case 'community-updates':
        return (
          <div>
            <TileHeading tileId={tileId} icon="fa-bullhorn" action={<Link to="/communications" className="text-[10px] font-black uppercase tracking-widest text-teal-600">Updates</Link>} />
            <div className="space-y-3">
              {recentAnnouncements.map(announcement => (
                <Link key={announcement.id} to={`/announcements/${announcement.id}`} className="block rounded-2xl border border-slate-100 p-4 hover:border-teal-300 dark:border-white/5">
                  <div className="flex items-center justify-between gap-2"><span className={`rounded-lg px-2 py-1 text-[8px] font-black uppercase tracking-widest ${announcement.priority === 'Urgent' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>{announcement.priority}</span><span className="text-[9px] font-bold uppercase text-slate-400">{formatDate(announcement.date)}</span></div>
                  <p className="mt-2 line-clamp-2 text-sm font-black text-slate-900 dark:text-white">{announcement.title}</p>
                </Link>
              ))}
              {recentAnnouncements.length === 0 && <EmptyTile label="No recent announcements" />}
            </div>
          </div>
        );
      case 'document-watch':
      case 'useful-documents':
        return (
          <div>
            <TileHeading tileId={tileId} icon="fa-file-lines" action={<Link to="/documents" className="text-[10px] font-black uppercase tracking-widest text-teal-600">Library</Link>} />
            <div className="space-y-2">
              {recentDocuments.map(document => (
                <Link key={document.id} to="/documents" className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                  <div><p className="line-clamp-1 text-xs font-black text-slate-900 dark:text-white">{document.title}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">{document.category}</p></div>
                  <span className="rounded-lg bg-white px-2 py-1 text-[9px] font-black uppercase text-slate-400 dark:bg-slate-900">{document.fileType}</span>
                </Link>
              ))}
              {recentDocuments.length === 0 && <EmptyTile label="No documents yet" />}
            </div>
          </div>
        );
      case 'waitlist-snapshot':
        return (
          <button onClick={() => navigate('/admin/waitlist')} className="flex h-full min-h-0 w-full flex-col text-left">
            <TileHeading tileId={tileId} icon="fa-clock-rotate-left" />
            <div className="mt-auto min-h-0 overflow-hidden rounded-2xl bg-teal-50 p-4 dark:bg-teal-950/30">
              <p className="text-3xl font-black text-teal-700 dark:text-teal-300">{waitlistCount}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-teal-700/70 dark:text-teal-300/70">Applicants waiting</p>
            </div>
          </button>
        );
      case 'scheduled-maintenance':
        return (
          <div>
            <TileHeading tileId={tileId} icon="fa-screwdriver-wrench" />
            <div className="space-y-2">
              {upcomingScheduled.map(task => (
                <div key={task.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                  <p className="text-xs font-black text-slate-900 dark:text-white">{task.task}</p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Due {formatDate(task.dueDate)} - {task.assignedTo}</p>
                </div>
              ))}
              {upcomingScheduled.length === 0 && <EmptyTile label="No scheduled tasks due" />}
            </div>
          </div>
        );
      case 'my-home':
        return (
          <button onClick={() => userUnitId && navigate(`/admin/units/${userUnitId}`)} className="flex h-full min-h-0 w-full flex-col text-left">
            <TileHeading tileId={tileId} icon="fa-house-user" />
            <div className="mt-auto min-h-0 overflow-hidden rounded-2xl bg-teal-50 p-4 dark:bg-teal-950/30">
              <p className="truncate text-2xl font-black text-teal-700 dark:text-teal-300">{userUnit ? `Unit ${userUnit.number}` : 'No unit'}</p>
              <p className="mt-2 truncate text-[10px] font-black uppercase tracking-widest text-teal-700/70 dark:text-teal-300/70">{userUnit ? `${userUnit.type} - Floor ${userUnit.floor}` : 'Contact administration'}</p>
              <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-500">{userOpenRequests.length} active requests</p>
            </div>
          </button>
        );
      case 'my-requests':
        return (
          <div>
            <TileHeading tileId={tileId} icon="fa-list-check" action={<Link to="/maintenance" className="text-[10px] font-black uppercase tracking-widest text-teal-600">Report issue</Link>} />
            <div className="space-y-2">
              {userOpenRequests.slice(0, 4).map(request => (
                <button key={request.id} onClick={() => navigate(`/maintenance/${request.id}`)} className="w-full rounded-2xl border border-slate-100 p-3 text-left dark:border-white/5">
                  <div className="flex items-center justify-between gap-2">{renderRequestBadge(request)}<span className="text-[9px] font-black uppercase text-slate-400">{request.status}</span></div>
                  <p className="mt-2 line-clamp-1 text-xs font-black text-slate-900 dark:text-white">{request.title || request.description}</p>
                </button>
              ))}
              {userOpenRequests.length === 0 && <EmptyTile label="No active requests" />}
            </div>
          </div>
        );
      case 'participation-prompts':
        return (
          <div>
            <TileHeading tileId={tileId} icon="fa-people-group" action={<Link to="/committees" className="text-[10px] font-black uppercase tracking-widest text-teal-600">Committees</Link>} />
            <div className="space-y-3">
              {committees.slice(0, 3).map(committee => (
                <Link key={committee.id} to="/committees" className="block rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/40">
                  <p className="text-xs font-black text-slate-900 dark:text-white">{committee.name}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-slate-500">{committee.description}</p>
                </Link>
              ))}
              {committees.length === 0 && <EmptyTile label="No committee prompts yet" />}
            </div>
          </div>
        );
      case 'quick-actions': {
        const actions = isAdmin
          ? [
            { label: 'Service Queue', path: '/maintenance', icon: 'fa-wrench' },
            { label: 'New Announcement', path: '/communications', icon: 'fa-bullhorn' },
            { label: 'Schedule Event', path: '/calendar', icon: 'fa-calendar-plus' },
            { label: 'Upload Document', path: '/documents', icon: 'fa-file-arrow-up' },
          ]
          : [
            { label: 'Report Issue', path: '/maintenance', icon: 'fa-wrench' },
            { label: 'Rules & Bylaws', path: '/documents', icon: 'fa-book-open' },
            { label: 'Calendar', path: '/calendar', icon: 'fa-calendar-days' },
            { label: 'Committees', path: '/committees', icon: 'fa-people-group' },
          ];
        return (
          <div>
            <TileHeading tileId={tileId} icon="fa-bolt" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {actions.map(action => (
                <button key={action.path} onClick={() => navigate(action.path)} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-left transition-colors hover:bg-teal-50 dark:bg-slate-950/40 dark:hover:bg-teal-950/30">
                  <i className={`fa-solid ${action.icon} text-teal-600 dark:text-teal-300`}></i>
                  <span className="text-xs font-black text-slate-900 dark:text-white">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-[20px] border border-white/5 bg-slate-900 p-6 text-white shadow-2xl shadow-teal-accent/10 dark:bg-slate-950 lg:p-10">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 -translate-y-24 translate-x-24 rounded-full bg-teal-500/20 blur-[100px]"></div>
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-teal-300">{isAdmin ? 'Board command dashboard' : 'Member home dashboard'}</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight lg:text-5xl">Welcome home, {firstName}.</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-400">
              Choose the tiles that keep the most relevant co-op information in view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-950 active:scale-95"
            >
              <i className={`fa-solid ${isEditing ? 'fa-check' : 'fa-sliders'}`}></i>
              {isEditing ? 'Done' : 'Customize'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={() => updatePreference(createDefaultDashboardLayout(role))}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
              >
                <i className="fa-solid fa-rotate-left"></i>
                Restore defaults
              </button>
            )}
          </div>
        </div>
      </div>

      {isEditing && (
        <DashboardTileCatalog
          role={role}
          preference={preference}
          onPreferenceChange={updatePreference}
        />
      )}

      <DashboardTileGrid
        role={role}
        preference={preference}
        isEditing={isEditing}
        onPreferenceChange={updatePreference}
        renderTile={renderTile}
      />

      <div className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
        {isSaving ? 'Saving dashboard...' : 'Dashboard preferences saved per user'}
      </div>
    </div>
  );
};

export default Dashboard;
