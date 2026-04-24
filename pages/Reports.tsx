import React, { useMemo } from 'react';
import StatCard from '../components/StatCard';
import { MaintenanceRequest, RequestStatus, Tenant, Unit } from '../types';

interface ReportsProps {
  units: Unit[];
  tenants: Tenant[];
  requests: MaintenanceRequest[];
}

const calculateAverageDaysOpen = (requests: MaintenanceRequest[]) => {
  const closedRequests = requests.filter(
    (request) => request.status === RequestStatus.COMPLETED && request.createdAt && request.updatedAt
  );

  if (closedRequests.length === 0) {
    return 'N/A';
  }

  const totalDays = closedRequests.reduce((sum, request) => {
    const openedAt = new Date(request.createdAt as string).getTime();
    const closedAt = new Date(request.updatedAt as string).getTime();
    return sum + Math.max(0, closedAt - openedAt) / (1000 * 60 * 60 * 24);
  }, 0);

  return `${Math.round(totalDays / closedRequests.length)}d`;
};

const Reports: React.FC<ReportsProps> = ({ units, tenants, requests }) => {
  const currentResidents = useMemo(
    () => tenants.filter((tenant) => tenant.status === 'Current'),
    [tenants]
  );

  const waitlistCount = useMemo(
    () => tenants.filter((tenant) => tenant.status === 'Waitlist').length,
    [tenants]
  );

  const occupiedUnits = useMemo(
    () => units.filter((unit) => unit.status === 'Occupied').length,
    [units]
  );

  const occupancyRate = units.length > 0 ? Math.round((occupiedUnits / units.length) * 100) : 0;
  const activeRequests = requests.filter(
    (request) => request.status !== RequestStatus.COMPLETED && request.status !== RequestStatus.CANCELLED
  );
  const urgentRequests = activeRequests.filter((request) => request.priority === 'Emergency').length;
  const averageResolutionTime = calculateAverageDaysOpen(requests);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Board Insight Center</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Strategic operational data for governance and long-term planning.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Avg Resolution" value={averageResolutionTime} icon="fa-clock" color="bg-brand-500" />
        <StatCard label="Waitlist Volume" value={`${waitlistCount} Households`} icon="fa-users-line" color="bg-blue-500" />
        <StatCard label="Occupancy Rate" value={`${occupancyRate}%`} icon="fa-building-circle-check" color="bg-purple-500" />
        <StatCard label="Active Service" value={activeRequests.length} icon="fa-wrench" color="bg-rose-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 p-6">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Resident Snapshot</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{currentResidents.length}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">Current residents with live directory records.</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 p-6">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Urgent Requests</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{urgentRequests}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">Emergency-priority issues still active in the queue.</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 p-6">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Vacant Units</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{Math.max(0, units.length - occupiedUnits)}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">Inventory currently not assigned to an occupied household.</p>
        </div>
      </div>
    </div>
  );
};

export default Reports;
