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
  type DashboardTilePreference,
  type DashboardTileSize,
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
  coopName?: string;
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

const asDate = (value?: string | Date) => {
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

const getUpcomingEvents = (events: CoopEvent[], limit = 6) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return [...events]
    .filter(event => {
      const eventDate = asDate(event.date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate >= today;
    })
    .sort((a, b) => asDate(a.date).getTime() - asDate(b.date).getTime())
    .slice(0, limit);
};

const getCalendarDays = (anchor?: string | Date) => {
  const base = anchor ? asDate(anchor) : new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: firstDay.getDay() + daysInMonth }, (_, index) => {
    const day = index - firstDay.getDay() + 1;
    return day > 0 ? day : null;
  });
};

const getDateKey = (value?: string | Date) => {
  const date = asDate(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const TileHeading: React.FC<{ tileId: DashboardTileId; icon: string; action?: React.ReactNode }> = ({ tileId, icon, action }) => (
  <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-300 sm:h-11 sm:w-11">
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <div className="min-w-0">
        <h2 className="line-clamp-2 text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white sm:text-base">{DASHBOARD_TILE_REGISTRY[tileId].title}</h2>
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

const EmptyTile: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-white/10 dark:bg-slate-950/40">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
  </div>
);

const tileActionClass = 'transition-colors hover:bg-teal-50 dark:hover:bg-teal-950/30';

const isMinutesDocument = (document: Document) => {
  const searchable = [
    document.category,
    document.title,
    ...(document.tags ?? []),
  ].join(' ').toLowerCase();

  return searchable.includes('minute');
};

const getMinutesEventId = (document: Document) => {
  const taggedEvent = document.tags?.find(tag => tag.startsWith('minutes-meeting:'));
  return taggedEvent?.split(':')[1] || null;
};

const getDocumentFileUrl = (document: Document) => {
  if (document.currentVersion?.storageUrl) return document.currentVersion.storageUrl;
  if (document.url && document.url !== '#') return document.url;
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({
  isAdmin,
  coopName = 'your co-op',
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
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
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
  const upcomingEvents = getUpcomingEvents(events, 6);
  const recentAnnouncements = [...announcements].sort((a, b) => asDate(b.date).getTime() - asDate(a.date).getTime()).slice(0, 5);
  const recentDocuments = [...documents].sort((a, b) => asDate(b.date).getTime() - asDate(a.date).getTime()).slice(0, 6);
  const upcomingScheduled = [...scheduledMaintenance]
    .filter(task => !task.isCompleted)
    .sort((a, b) => asDate(a.dueDate).getTime() - asDate(b.dueDate).getTime())
    .slice(0, 6);

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

  const renderTile = (tile: DashboardTilePreference) => {
    const tileId = tile.id;
    const tileSize: DashboardTileSize = tile.size;

    const listLimit = tileSize === 'small' ? 1 : tileSize === 'large' ? 5 : 3;
    const documentLimit = listLimit;
    const actionLimit = 4;

    switch (tileId) {
      case 'maintenance-pulse': {
        const emergency = openRequests.filter(request => request.priority === MaintenancePriority.EMERGENCY).length;
        const high = openRequests.filter(request => request.priority === MaintenancePriority.HIGH).length;
        const pulseStats = [
          { label: 'Open', value: openRequests.length, path: '/maintenance?status=open', className: 'bg-slate-50 text-slate-900 dark:bg-slate-950/40 dark:text-white', labelClassName: 'text-slate-400' },
          { label: 'High', value: high, path: `/maintenance?status=open&priority=${MaintenancePriority.HIGH}`, className: 'bg-amber-50 text-amber-600 dark:bg-amber-950/20', labelClassName: 'text-amber-700/70' },
          { label: 'Emergency', value: emergency, path: `/maintenance?status=open&priority=${MaintenancePriority.EMERGENCY}`, className: 'bg-rose-50 text-rose-600 dark:bg-rose-950/20', labelClassName: 'text-rose-700/70' },
        ];
        return (
          <div className="flex h-full flex-col">
            <TileHeading tileId={tileId} icon="fa-wrench" action={<Link to="/maintenance" className="text-[10px] font-black uppercase tracking-widest text-teal-600">Open queue</Link>} />
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {pulseStats.map(stat => (
                <button
                  key={stat.label}
                  type="button"
                  onClick={() => navigate(stat.path)}
                  className={`flex min-h-[4.5rem] flex-col items-center justify-center rounded-2xl p-3 text-center transition-all hover:-translate-y-0.5 hover:ring-2 hover:ring-teal-500/20 active:scale-[0.98] sm:p-4 ${stat.className}`}
                >
                  <p className="text-xl font-black sm:text-2xl">{stat.value}</p>
                  <p className={`mt-1 text-center text-[9px] font-black uppercase tracking-widest ${stat.labelClassName}`}>{stat.label}</p>
                </button>
              ))}
            </div>
            {tileSize !== 'small' && (
              <div className="mt-4 space-y-2">
                {openRequests.slice(0, tileSize === 'large' ? 5 : 3).map(request => (
                  <button key={request.id} onClick={() => navigate(`/maintenance/${request.id}`)} className={`w-full rounded-2xl bg-slate-50 p-3 text-left dark:bg-slate-950/40 ${tileActionClass}`}>
                    <div className="flex items-center justify-between gap-3">{renderRequestBadge(request)}<span className="text-[9px] font-black uppercase text-slate-400">{request.status}</span></div>
                    <p className="mt-2 line-clamp-1 text-xs font-black text-slate-900 dark:text-white">{request.title || request.description}</p>
                  </button>
                ))}
              </div>
            )}
            {tileSize === 'large' && (
              <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                <div className="rounded-2xl bg-teal-50 p-3 dark:bg-teal-950/30">
                  <p className="text-xl font-black text-teal-700 dark:text-teal-300">{currentResidents.length}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-teal-700/70">Residents</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                  <p className="text-xl font-black text-slate-900 dark:text-white">{units.length}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Units tracked</p>
                </div>
              </div>
            )}
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
                  <div className="grid flex-1 grid-cols-4 gap-1 min-[420px]:grid-cols-6 sm:grid-cols-8">
                    {unitsByFloor[floor].slice(0, 16).map(unit => (
                      <button key={unit.id} onClick={() => navigate(`/admin/units/${unit.id}`)} className={`aspect-square rounded-lg text-[8px] font-black transition-transform hover:scale-105 ${
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
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                {[
                  { label: 'Occupied', className: 'bg-teal-100 dark:bg-teal-950' },
                  { label: 'Maintenance', className: 'bg-amber-100 dark:bg-amber-950' },
                  { label: 'Vacant', className: 'bg-slate-100 dark:bg-slate-800' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded ${item.className}`}></span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }
      case 'next-meeting':
        if (!nextEvent) {
          return (
            <>
              <TileHeading tileId={tileId} icon="fa-calendar-xmark" action={<Link to="/calendar" className="text-[10px] font-black uppercase tracking-widest text-teal-600">Calendar</Link>} />
              <EmptyTile label="No upcoming events" />
            </>
          );
        }

        if (tileSize === 'wide' || tileSize === 'large') {
          const anchorDate = asDate(nextEvent.date);
          const displayedMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + calendarMonthOffset, 1);
          const activeDateKey = getDateKey(nextEvent.date);
          const eventDateKeys = new Set(
            events
              .filter(event => {
                const eventDate = asDate(event.date);
                return eventDate.getFullYear() === displayedMonth.getFullYear() && eventDate.getMonth() === displayedMonth.getMonth();
              })
              .map(event => getDateKey(event.date)),
          );
          const renderCalendarControls = (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCalendarMonthOffset(value => value - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[10px] text-amber-700 transition-colors hover:bg-amber-100 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-800"
                aria-label="Previous calendar month"
                title="Previous month"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              <span className="px-1 text-[9px] font-black uppercase tracking-widest text-slate-500">{upcomingEvents.length} upcoming</span>
              <button
                type="button"
                onClick={() => setCalendarMonthOffset(value => value + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[10px] text-amber-700 transition-colors hover:bg-amber-100 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-800"
                aria-label="Next calendar month"
                title="Next month"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          );

          if (tileSize === 'large') {
            return (
              <div className="flex h-full min-h-0 flex-col">
                <TileHeading tileId={tileId} icon="fa-calendar-day" action={<Link to="/calendar" className="text-[10px] font-black uppercase tracking-widest text-teal-600">Calendar</Link>} />
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-amber-50 p-3 dark:bg-amber-950/20 sm:p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                        {displayedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                      </p>
                      {renderCalendarControls}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black uppercase text-slate-400">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
                    </div>
                    <div className="mt-1 grid min-h-0 flex-1 grid-cols-7 gap-1.5">
                      {getCalendarDays(displayedMonth).map((day, index) => {
                        const baseDate = displayedMonth;
                        const dayKey = day ? `${baseDate.getFullYear()}-${baseDate.getMonth()}-${day}` : '';
                        const hasEvent = day ? eventDateKeys.has(dayKey) : false;
                        const isActive = dayKey === activeDateKey;

                        return (
                          <button
                            key={`${day ?? 'blank'}-${index}`}
                            type="button"
                            disabled={!day}
                            onClick={() => navigate('/calendar')}
                            className={`relative flex min-h-[2rem] items-center justify-center rounded-xl text-xs font-black transition-colors sm:text-sm ${
                              isActive ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30' :
                              hasEvent ? 'bg-amber-200 text-amber-900 ring-1 ring-amber-500 dark:bg-amber-700 dark:text-white dark:ring-amber-400' :
                              day ? 'bg-white/70 text-slate-500 hover:bg-white dark:bg-slate-900/50 dark:text-slate-400 dark:hover:bg-slate-900' : 'bg-transparent'
                            }`}
                          >
                            {day}
                            {hasEvent && (
                              <span className={`absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${isActive ? 'bg-white' : 'bg-amber-600 dark:bg-white'}`}></span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {upcomingEvents.slice(0, 4).map(event => (
                      <button key={event.id} onClick={() => navigate(`/calendar/${event.id}`)} className={`min-w-0 rounded-2xl bg-amber-50 p-3 text-left dark:bg-amber-950/20 ${tileActionClass}`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-amber-700 dark:text-amber-300">{formatShortDate(event.date)}</p>
                          <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-amber-700 dark:bg-slate-900 dark:text-amber-300">{event.category}</span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs font-black leading-snug text-slate-900 dark:text-white">{event.title}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="flex h-full min-h-0 flex-col">
              <TileHeading tileId={tileId} icon="fa-calendar-day" action={<Link to="/calendar" className="text-[10px] font-black uppercase tracking-widest text-teal-600">Calendar</Link>} />
              <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-950/20">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                      {displayedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </p>
                    {renderCalendarControls}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black uppercase text-slate-400">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
                    {getCalendarDays(displayedMonth).map((day, index) => {
                      const baseDate = displayedMonth;
                      const dayKey = day ? `${baseDate.getFullYear()}-${baseDate.getMonth()}-${day}` : '';
                      const hasEvent = day ? eventDateKeys.has(dayKey) : false;
                      const isActive = dayKey === activeDateKey;

                      return (
                        <button
                          key={`${day ?? 'blank'}-${index}`}
                          type="button"
                          disabled={!day}
                          onClick={() => navigate('/calendar')}
                          className={`relative aspect-square rounded-lg text-[10px] font-black transition-colors ${
                            isActive ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30' :
                            hasEvent ? 'bg-amber-200 text-amber-900 ring-1 ring-amber-500 dark:bg-amber-700 dark:text-white dark:ring-amber-400' :
                            day ? 'bg-white/70 text-slate-500 dark:bg-slate-900/50 dark:text-slate-400' : 'bg-transparent'
                          }`}
                        >
                          {day}
                          {hasEvent && (
                            <span className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${isActive ? 'bg-white' : 'bg-amber-600 dark:bg-white'}`}></span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  {upcomingEvents.slice(0, 3).map(event => (
                    <button key={event.id} onClick={() => navigate(`/calendar/${event.id}`)} className={`w-full rounded-2xl bg-amber-50 p-3 text-left dark:bg-amber-950/20 ${tileActionClass}`}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-lg font-black text-amber-700 dark:text-amber-300">{formatShortDate(event.date)}</p>
                        <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-amber-700 dark:bg-slate-900 dark:text-amber-300">{event.category}</span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs font-black leading-snug text-slate-900 dark:text-white">{event.title}</p>
                      <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wider text-slate-500">{event.time} - {event.location}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="flex h-full min-h-0 flex-col">
            <TileHeading tileId={tileId} icon="fa-calendar-day" action={<Link to="/calendar" className="text-[10px] font-black uppercase tracking-widest text-teal-600">Calendar</Link>} />
            <button onClick={() => navigate(`/calendar/${nextEvent.id}`)} className={`flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl bg-amber-50 p-3 text-center dark:bg-amber-950/20 sm:p-4 ${tileActionClass}`}>
              <p className="text-3xl font-black text-amber-700 dark:text-amber-300">{formatShortDate(nextEvent.date)}</p>
              <p className="mt-2 line-clamp-2 text-sm font-black leading-snug text-slate-900 dark:text-white">{nextEvent.title}</p>
              <p className="mt-1 max-w-full truncate text-[9px] font-bold uppercase tracking-wider text-slate-500">{nextEvent.time} - {nextEvent.location}</p>
            </button>
          </div>
        );
      case 'announcement-digest':
      case 'community-updates':
        return (
          <div>
            <TileHeading tileId={tileId} icon="fa-bullhorn" action={<Link to="/communications" className="text-[10px] font-black uppercase tracking-widest text-teal-600">Updates</Link>} />
            <div className="space-y-3">
              {recentAnnouncements.slice(0, listLimit).map(announcement => (
                <Link key={announcement.id} to={`/announcements/${announcement.id}`} className={`block rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/40 ${tileActionClass}`}>
                  <div className="flex items-center justify-between gap-2"><span className={`rounded-lg px-2 py-1 text-[8px] font-black uppercase tracking-widest ${announcement.priority === 'Urgent' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>{announcement.priority}</span><span className="text-[9px] font-bold uppercase text-slate-400">{formatDate(announcement.date)}</span></div>
                  <p className="mt-2 line-clamp-2 text-sm font-black text-slate-900 dark:text-white">{announcement.title}</p>
                  {tileSize === 'large' && <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-slate-500">{announcement.content}</p>}
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
            <div className="space-y-3">
              {recentDocuments.slice(0, documentLimit).map(document => {
                const minutesEventId = !isAdmin && isMinutesDocument(document) ? getMinutesEventId(document) : null;
                const fileUrl = getDocumentFileUrl(document);
                const card = (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-lg bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900 dark:text-slate-400">{document.fileType}</span>
                      <span className="text-[9px] font-bold uppercase text-slate-400">{formatDate(document.date)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-black text-slate-900 dark:text-white">{document.title}</p>
                    {tileSize === 'large' && (
                      <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-slate-500">
                        {document.category}{document.author ? ` - ${document.author}` : ''}
                      </p>
                    )}
                  </>
                );

                if (minutesEventId) {
                  return (
                    <Link key={document.id} to={`/calendar/${minutesEventId}?tab=minutes`} className={`block rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/40 ${tileActionClass}`}>
                      {card}
                    </Link>
                  );
                }

                if (fileUrl) {
                  return (
                    <a key={document.id} href={fileUrl} target="_blank" rel="noopener noreferrer" className={`block rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/40 ${tileActionClass}`}>
                      {card}
                    </a>
                  );
                }

                return (
                  <Link key={document.id} to="/documents" className={`block rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/40 ${tileActionClass}`}>
                    {card}
                  </Link>
                );
              })}
              {recentDocuments.length === 0 && <EmptyTile label="No documents yet" />}
            </div>
          </div>
        );
      case 'waitlist-snapshot':
        return (
          <button onClick={() => navigate('/admin/waitlist')} className="group flex h-full min-h-0 w-full cursor-pointer flex-col text-left">
            <TileHeading tileId={tileId} icon="fa-clock-rotate-left" action={<span className="cursor-pointer rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest text-teal-600 transition-colors hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-950/30 dark:hover:text-teal-300">Waitlist</span>} />
            <div className={`flex min-h-0 flex-1 flex-col justify-center overflow-hidden rounded-2xl bg-teal-50 p-3 dark:bg-teal-950/30 sm:p-4 ${tileSize === 'small' ? 'items-center text-center' : ''} ${tileActionClass}`}>
              <p className="text-3xl font-black text-teal-700 dark:text-teal-300">{waitlistCount}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-teal-700/70 dark:text-teal-300/70">Applicants waiting</p>
              {tileSize === 'wide' && <p className="mt-3 line-clamp-2 text-xs font-semibold text-slate-500">Open the waitlist to review next applicant follow-ups and status changes.</p>}
            </div>
          </button>
        );
      case 'scheduled-maintenance':
        const scheduledLimit = tileSize === 'small' ? 2 : tileSize === 'wide' ? 3 : 6;
        const isCompactScheduled = tileSize === 'small';
        return (
          <div>
            <TileHeading tileId={tileId} icon="fa-screwdriver-wrench" />
            <div className={isCompactScheduled ? 'space-y-2' : 'space-y-3'}>
              {upcomingScheduled.slice(0, scheduledLimit).map(task => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => navigate('/maintenance')}
                  className={`block w-full rounded-2xl bg-slate-50 text-left dark:bg-slate-950/40 ${isCompactScheduled ? 'p-3' : 'p-4'} ${tileActionClass}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900 dark:text-slate-400">{task.category}</span>
                    <span className="text-[9px] font-bold uppercase text-slate-400">Due {formatDate(task.dueDate)}</span>
                  </div>
                  <p className={`mt-2 font-black text-slate-900 dark:text-white ${isCompactScheduled ? 'line-clamp-1 text-xs' : 'line-clamp-2 text-sm'}`}>{task.task}</p>
                  {tileSize !== 'small' && (
                    <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-slate-500">
                      {task.frequency} - {task.assignedTo}
                    </p>
                  )}
                </button>
              ))}
              {upcomingScheduled.length === 0 && <EmptyTile label="No scheduled tasks due" />}
            </div>
          </div>
        );
      case 'my-home':
        return (
          <button type="button" onClick={() => userUnitId && navigate(`/admin/units/${userUnitId}`)} className="group flex h-full min-h-0 w-full cursor-pointer flex-col text-left">
            <TileHeading tileId={tileId} icon="fa-house-user" action={userUnitId ? <span className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-teal-600">Unit</span> : undefined} />
            <div className={`flex min-h-0 flex-1 flex-col justify-center overflow-hidden rounded-2xl bg-teal-50 p-3 dark:bg-teal-950/30 sm:p-4 ${tileActionClass}`}>
              <p className="truncate text-2xl font-black text-teal-700 dark:text-teal-300 sm:text-3xl">{userUnit ? `Unit ${userUnit.number}` : 'No unit'}</p>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-widest text-teal-700/70 dark:text-teal-300/70">{userUnit ? `${userUnit.type} - Floor ${userUnit.floor}` : 'Contact administration'}</p>
              <p className="mt-3 truncate text-sm font-black text-teal-700 dark:text-teal-300">
                {userOpenRequests.length} Active {userOpenRequests.length === 1 ? 'Request' : 'Requests'}
              </p>
            </div>
          </button>
        );
      case 'my-requests':
        return (
          <div>
            <TileHeading tileId={tileId} icon="fa-list-check" action={<Link to="/maintenance" className="text-[10px] font-black uppercase tracking-widest text-teal-600">Report issue</Link>} />
            <div className="space-y-2">
              {userOpenRequests.slice(0, tileSize === 'large' ? 5 : tileSize === 'small' ? 2 : 3).map(request => (
                <button key={request.id} onClick={() => navigate(`/maintenance/${request.id}`)} className={`w-full rounded-2xl bg-slate-50 p-3 text-left dark:bg-slate-950/40 ${tileActionClass}`}>
                  <div className="flex items-center justify-between gap-2">{renderRequestBadge(request)}<span className="text-[9px] font-black uppercase text-slate-400">{request.status}</span></div>
                  <p className="mt-2 line-clamp-1 text-xs font-black text-slate-900 dark:text-white">{request.title || request.description}</p>
                  {tileSize === 'large' && <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-slate-500">{request.description}</p>}
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
              {committees.slice(0, tileSize === 'small' ? 1 : 3).map(committee => (
                <Link key={committee.id} to="/committees" className={`block rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/40 ${tileActionClass}`}>
                  <p className="text-xs font-black text-slate-900 dark:text-white">{committee.name}</p>
                  <p className={`mt-1 text-[10px] font-semibold text-slate-500 ${tileSize === 'wide' ? 'line-clamp-2' : 'line-clamp-1'}`}>{committee.description}</p>
                </Link>
              ))}
              {committees.length === 0 && <EmptyTile label="No committee prompts yet" />}
            </div>
          </div>
        );
      case 'quick-actions': {
        const isCompactActions = tileSize === 'small';
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
            <div className={`grid gap-2 ${isCompactActions ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {actions.slice(0, actionLimit).map(action => (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className={`min-w-0 rounded-2xl bg-slate-50 dark:bg-slate-950/40 ${isCompactActions ? 'flex min-h-[3.35rem] flex-col items-center justify-center gap-1 p-2 text-center' : 'flex items-center gap-3 p-4 text-left'} ${tileActionClass}`}
                >
                  <i className={`fa-solid ${action.icon} shrink-0 text-teal-600 dark:text-teal-300 ${isCompactActions ? 'text-sm' : ''}`}></i>
                  <span className={`min-w-0 max-w-full font-black leading-tight text-slate-900 dark:text-white ${isCompactActions ? 'line-clamp-2 break-words text-[9px]' : 'text-xs'}`}>{action.label}</span>
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
      <div className="relative overflow-hidden rounded-[20px] border border-white/5 bg-slate-900 p-5 pr-20 text-white shadow-2xl shadow-teal-accent/10 dark:bg-slate-950 sm:p-6 sm:pr-24 lg:p-10 lg:pr-28">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 -translate-y-24 translate-x-24 rounded-full bg-teal-500/20 blur-[100px]"></div>
        <div className="absolute right-4 top-4 z-20 flex gap-2 sm:right-6 sm:top-6 lg:right-8 lg:top-8">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-sm shadow-sm transition-all active:scale-95 ${
              isEditing ? 'bg-teal-500 text-white' : 'bg-white text-slate-950 hover:bg-teal-50'
            }`}
            aria-label="Customize your personal dashboard layout"
            title="Customize your personal dashboard layout"
          >
            <i className={`fa-solid ${isEditing ? 'fa-check' : 'fa-wrench'}`}></i>
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => updatePreference(createDefaultDashboardLayout(role))}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm text-white transition-all hover:bg-white/20 active:scale-95"
              aria-label="Restore default dashboard layout"
              title="Restore default dashboard layout"
            >
              <i className="fa-solid fa-rotate-left"></i>
            </button>
          )}
        </div>
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-teal-300">{isAdmin ? 'Board command dashboard' : 'Member home dashboard'}</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">Welcome home, {firstName}.</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-400">
              Welcome to {coopName}'s community space.
            </p>
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
