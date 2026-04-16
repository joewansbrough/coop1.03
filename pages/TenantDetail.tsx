
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import StatCard from '../components/StatCard';
import { Tenant, Unit, MaintenanceRequest, TenantHistory } from '../types';

interface TenantDetailProps {
  tenants: Tenant[];
  units: Unit[];
  requests: MaintenanceRequest[];
}

const TenantDetail: React.FC<TenantDetailProps> = ({ tenants, units, requests }) => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const tenant = tenants.find(t => t.id === tenantId);
  const unit = units.find(u => u.id === tenant?.unitId);
  const tenantRequests = requests.filter(r => r.unitId === tenant?.unitId);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'maintenance' | 'participation' | 'tenancy'>('overview');
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgBody, setMsgBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<TenantHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (tenantId && activeTab === 'tenancy') {
      const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
          const res = await fetch(`/api/tenants/${tenantId}/history`);
          const data = await res.json();
          setHistory(data);
        } catch (e) {
          console.error('Failed to fetch history:', e);
        } finally {
          setIsLoadingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [tenantId, activeTab]);

  if (!tenant) return <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-bold">Member profile not found.</div>;

  const openRequests = tenantRequests.filter(r => r.status !== 'Completed' && r.status !== 'Cancelled');
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setShowMsgModal(false);
      setMsgBody('');
      alert(`Message sent to ${tenant.firstName} ${tenant.lastName}!`);
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors duration-200 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-sm mb-2">
        <Link to="/admin/tenants" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors flex items-center gap-1 font-bold">
          <i className="fa-solid fa-arrow-left"></i> Association Directory
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800 dark:text-slate-200">{tenant.firstName} {tenant.lastName}</span>
      </div>

      <header className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-[12rem] pointer-events-none dark:text-white">
          <i className="fa-solid fa-id-badge"></i>
        </div>

        <div className="flex items-center gap-6 relative z-10">
          <div className="w-24 h-24 rounded-2xl bg-slate-900 dark:bg-brand-600 text-white flex items-center justify-center text-4xl font-black ring-4 ring-brand-500/10">
            {tenant.firstName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">{tenant.firstName} {tenant.lastName}</h1>
              <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter border bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 border-brand-200 dark:border-brand-800`}>
                Active Member
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
              Shareholder since {new Date(tenant.startDate).toLocaleDateString()} 
              {unit && ` • Assigned to Unit ${unit.number}`}
            </p>
          </div>
        </div>

        <div className="flex gap-3 relative z-10">
          <button 
            onClick={() => setShowMsgModal(true)}
            className="bg-slate-900 dark:bg-brand-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-paper-plane"></i> Message
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard label="Service History" value={tenantRequests.length} icon="fa-wrench" color="bg-amber-500" />
        <StatCard label="Volunteer Log" value={`12 hrs`} icon="fa-heart" color="bg-purple-500" />
      </div>

      <nav className="flex border-b border-slate-200 dark:border-white/5 overflow-x-auto scrollbar-hide">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'tenancy', label: 'History' },
          { id: 'maintenance', label: 'Service' },
          { id: 'participation', label: 'Participation' },
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-8 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="animate-in fade-in duration-300">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5 space-y-6">
                      <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[10px] border-b border-slate-50 dark:border-white/5 pb-4">Personal Profile (Restricted)</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Full Name</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{tenant.firstName} {tenant.lastName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Direct Email</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{tenant.email}</p>
                        </div>
                      </div>
              </div>

              {unit && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5 space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-50 dark:border-white/5 pb-4">
                    <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[10px]">Current Unit Assignment</h3>
                    <Link to={`/admin/units/${unit.id}`} className="text-[10px] font-black text-brand-600 uppercase tracking-widest hover:underline">View Unit Detail</Link>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Unit Number</p>
                      <p className="text-lg font-black text-slate-900 dark:text-white">{unit.number}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Unit Type</p>
                      <p className="text-lg font-black text-slate-900 dark:text-white">{unit.type}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Status</p>
                      <span className="px-2 py-1 bg-brand-100 text-brand-700 rounded text-[10px] font-black uppercase">{unit.status}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5 space-y-6">
                <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[10px] border-b border-slate-50 dark:border-white/5 pb-4">Active Service Requests</h3>
                {openRequests.length > 0 ? (
                  <div className="space-y-4">
                    {openRequests.map(req => (
                      <div key={req.id} className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-white/5 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{req.title}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{req.priority} • {new Date(req.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${
                          req.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No active maintenance requests for this member.</p>
                )}
              </div>
            </div>
            
            <div className="space-y-8">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5 space-y-6">
                <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[10px] border-b border-slate-50 dark:border-white/5 pb-4">Engagement Status</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-white/5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Volunteer Status</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-1">Active contributor</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-8 rounded-3xl">
                <h3 className="font-black uppercase text-[10px] tracking-widest text-brand-400 mb-4">Board Notes</h3>
                <p className="text-xs font-medium leading-relaxed opacity-70 italic border-l-2 border-brand-500 pl-4">
                  "Member in good standing. Active contributor to community initiatives. No reported infractions."
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tenancy' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden">
            {isLoadingHistory ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading History...</p>
              </div>
            ) : (
              <>
                {/* Mobile: Cards */}
                <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/5">
                  {history.length > 0 ? history.map(h => (
                    <div key={h.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Link to={`/admin/units/${h.unitId}`} className="text-sm font-black text-slate-800 dark:text-slate-200 hover:text-brand-600">
                          Unit {h.unit?.number}
                        </Link>
                        <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${!h.endDate ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                          {!h.endDate ? 'Current' : 'Past'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {new Date(h.startDate).toLocaleDateString()} — {h.endDate ? new Date(h.endDate).toLocaleDateString() : 'Present'}
                      </p>
                      {h.moveReason && (
                        <p className="text-xs text-slate-400 italic">{h.moveReason}</p>
                      )}
                    </div>
                  )) : (
                    <div className="px-6 py-12 text-center text-xs text-slate-400 italic">No residency history found for this member.</div>
                  )}
                </div>

                {/* Desktop: Table */}
                <table className="hidden sm:table w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950/50">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Period</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                    {history.map(h => (
                      <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <Link to={`/admin/units/${h.unitId}`} className="text-sm font-black text-slate-800 dark:text-slate-200 hover:text-brand-600">Unit {h.unit?.number}</Link>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                          {new Date(h.startDate).toLocaleDateString()} - {h.endDate ? new Date(h.endDate).toLocaleDateString() : 'Present'}
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-500 italic">{h.moveReason || 'N/A'}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${!h.endDate ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                            {!h.endDate ? 'Current' : 'Past'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-xs text-slate-400 italic">No residency history found for this member.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden">

            {/* Mobile: Cards */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/5">
              {tenantRequests.length > 0 ? tenantRequests.map(req => (
                <div
                  key={req.id}
                  className="p-4 active:bg-slate-50 dark:active:bg-white/5 transition-colors"
                  onClick={() => navigate(`/admin/maintenance/${req.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 flex-1 line-clamp-2">{req.title}</p>
                    <span className={`text-[9px] font-black px-2 py-1 rounded uppercase shrink-0 ${
                      req.status === 'Completed' ? 'bg-brand-100 text-brand-700' :
                      req.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{req.priority}</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-[10px] font-bold text-slate-400">{new Date(req.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              )) : (
                <div className="px-6 py-12 text-center text-xs text-slate-400 italic">No service requests found for this member.</div>
              )}
            </div>

            {/* Desktop: Table */}
            <table className="hidden sm:table w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-950/50">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Title</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {tenantRequests.map(req => (
                  <tr
                    key={req.id}
                    onClick={() => navigate(`/admin/maintenance/${req.id}`)}
                    className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400">{new Date(req.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-600 transition-colors">{req.title}</td>
                    <td className="px-6 py-4 text-xs font-black text-slate-500 uppercase">{req.priority}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${
                        req.status === 'Completed' ? 'bg-brand-100 text-brand-700' :
                        req.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'participation' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5 space-y-6">
              <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[10px] border-b border-slate-50 dark:border-white/5 pb-4">Committee Assignments</h3>
              <div className="space-y-4">
                <p className="text-xs text-slate-400 italic">No active committee assignments.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5 space-y-6">
              <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[10px] border-b border-slate-50 dark:border-white/5 pb-4">Volunteer Log</h3>
              <div className="space-y-4">
                <p className="text-xs text-slate-400 italic">No volunteer hours logged.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Message Modal */}
      {showMsgModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/5">
            <div className="p-8 border-b border-slate-50 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Direct Message</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Recipient: {tenant.firstName} {tenant.lastName}</p>
              </div>
              <button onClick={() => setShowMsgModal(false)} className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center transition-colors">
                <i className="fa-solid fa-xmark text-slate-500"></i>
              </button>
            </div>
            <form onSubmit={handleSendMessage} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Message Content</label>
                <textarea 
                  required
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  placeholder="Type your message to the member..."
                  className="w-full h-40 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none resize-none dark:text-white"
                />
              </div>
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowMsgModal(false)}
                  className="flex-1 py-4 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSending || !msgBody.trim()}
                  className="flex-1 py-4 bg-slate-900 dark:bg-brand-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black dark:hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSending ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-paper-plane mr-2"></i>}
                  {isSending ? 'Sending...' : 'Dispatch Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantDetail;
