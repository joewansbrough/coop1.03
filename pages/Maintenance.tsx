
import React, { useState } from 'react';
import { MaintenanceRequest, RequestStatus, RepairQuote, MaintenanceCategory, Unit, MaintenancePriority } from '../types';
import { MOCK_REQUESTS, MOCK_UNITS, MOCK_QUOTES } from '../constants';
import { geminiService } from '../services/geminiService';
import { useNavigate } from 'react-router-dom';
import FilterBar from '../components/FilterBar';
import { useQueryClient } from '@tanstack/react-query';

interface MaintenanceProps {
  isAdmin?: boolean;
  requests: MaintenanceRequest[];
  setRequests: React.Dispatch<React.SetStateAction<MaintenanceRequest[]>>;
  units: Unit[];
}

const Maintenance: React.FC<MaintenanceProps> = ({ isAdmin = false, requests, setRequests, units }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userUnitId = units.length > 0 ? units[0].id : 'u1';
  
  const [quotes, setQuotes] = useState<RepairQuote[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [activeView, setActiveView] = useState<'requests' | 'quotes'>('requests');
  const [selectedRequestIdForQuotes, setSelectedRequestIdForQuotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<{id: string, status: RequestStatus} | null>(null);
  
  // Filter requests based on user role, search, and status filter
  const allFilteredRequests = (Array.isArray(requests) ? requests : [])
    .filter(r => isAdmin || r.unitId === userUnitId)
    .filter(r => {
      const matchesFilter = filter === 'All' || r.status === filter;
      const matchesSearch = r.description.toLowerCase().includes(search.toLowerCase()) || 
                           (units.find(u => u.id === r.unitId)?.number.includes(search));
      return matchesFilter && matchesSearch;
    });

  const openRequests = allFilteredRequests.filter(r => r.status === RequestStatus.PENDING || r.status === RequestStatus.IN_PROGRESS);
  const archivedRequests = allFilteredRequests.filter(r => r.status === RequestStatus.COMPLETED || r.status === RequestStatus.CANCELLED);
  
  // Form State
  const [description, setDescription] = useState('');
  const [unitId, setUnitId] = isAdmin ? useState('') : useState(userUnitId);
  const [category, setCategory] = useState<MaintenanceCategory[]>(['Other']);
  const [priority, setPriority] = useState<MaintenancePriority>(MaintenancePriority.LOW);

  const handleTriage = async () => {
    if (!description || description.length < 10) return;
    setLoading(true);
    try {
      const result = await geminiService.triageMaintenanceRequest(description);
      if (result.category) setCategory([result.category as MaintenanceCategory]);
      if (result.priority) setPriority(result.priority as MaintenancePriority);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!category || category.length === 0) {
      alert("At least one category is required.");
      return;
    }

    const newRequest: MaintenanceRequest = {
      id: `r${Date.now()}`,
      title: description.substring(0, 30) + (description.length > 30 ? '...' : ''),
      unitId,
      tenantId: 't1', 
      category: category,
      description,
      priority: priority as MaintenancePriority,
      status: RequestStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: [],
      expenses: [],
      attachments: [],
      urgency // also set urgency field if present
    };
    
    // Optimistic local update (though ideally this would be a mutation)
    setRequests([newRequest, ...requests]);
    setShowForm(false);
    setDescription('');
    setCategory(['Other']);
    if (isAdmin) setUnitId('');
    alert("Maintenance request submitted successfully! Our maintenance committee will review it shortly.");
  };

  const confirmRequestStatus = async () => {
    if (!pendingRequest) return;
    const { id, status } = pendingRequest;
    const target = requests.find(r => r.id === id);
    if (!target) return;

    try {
      const res = await fetch(`/api/maintenance/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...target,
          status,
          updatedAt: new Date().toISOString()
        })
      });
      const data = await res.json();
      await queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      
      if (setRequests) {
        setRequests(prev => prev.map(r => r.id === id ? { ...data, category: Array.isArray(data.category) ? data.category : (data.category ? data.category.split(', ') : []) } : r));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setShowStatusConfirm(false);
      setPendingRequest(null);
    }
  };

  const updateRequestStatus = (id: string, status: RequestStatus) => {
    setPendingRequest({ id, status });
    setShowStatusConfirm(true);
  };

  const approveQuote = (quoteId: string) => {
    setQuotes(quotes.map(q => q.id === quoteId ? { ...q, status: 'Approved' } : q));
    alert("Quote approved. Vendor has been notified.");
  };

  const filteredQuotes = selectedRequestIdForQuotes 
    ? quotes.filter(q => q.requestId === selectedRequestIdForQuotes)
    : quotes;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{isAdmin ? 'Maintenance Operations' : 'My Service Requests'}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {isAdmin ? 'Managing building longevity and member comfort.' : 'Track and report issues for your residence.'}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {isAdmin && (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex-1 sm:flex-none">
              <button
                onClick={() => { setActiveView('requests'); setSelectedRequestIdForQuotes(null); }}
                className={`flex-1 sm:px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeView === 'requests' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
              >
                Requests
              </button>
              <button
                onClick={() => setActiveView('quotes')}
                className={`flex-1 sm:px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeView === 'quotes' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
              >
                Quotes {quotes.length > 0 && `(${quotes.length})`}
              </button>
            </div>
          )}
          <button 
            onClick={() => setShowForm(!showForm)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <i className="fa-solid fa-plus"></i> Submit New Request
          </button>
        </div>
      </div>

      <FilterBar 
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search maintenance requests..."
        filter={filter}
        onFilterChange={setFilter}
        filterOptions={['All', 'Pending', 'In Progress', 'Completed', 'Cancelled']}
      />

      {showForm && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-white/5 animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
               <i className="fa-solid fa-clipboard-list text-emerald-500"></i> {isAdmin ? 'Report Building Defect' : 'Request Maintenance'}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Detailed Problem Description</label>
              <textarea
                className="w-full border border-slate-200 dark:border-white/5 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50 dark:bg-slate-950/50 min-h-[120px] text-slate-800 dark:text-slate-200"
                placeholder="Where is it? What happened? When did it start?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleTriage}
                required
              />
              {loading && <p className="text-[10px] text-emerald-600 mt-2 font-black animate-pulse flex items-center gap-2"><i className="fa-solid fa-sparkles"></i> AI TRIAGING IN PROGRESS...</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:col-span-2">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Location/Unit</label>
                {isAdmin ? (
                  <select className="w-full border border-slate-200 dark:border-white/5 rounded-xl p-3 text-sm outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
                    <option value="">Select Unit</option>
                    {units.map(u => <option key={u.id} value={u.id}>Unit {u.number}</option>)}
                    <option value="common">Common Areas</option>
                  </select>
                ) : (
                  <div className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                    Unit {units.find(u => u.id === userUnitId)?.number || '101'} (Assigned)
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                    <span className="text-[8px] text-slate-400 font-bold uppercase italic">(Ctrl+Click to multi-select)</span>
                  </div>
                  <select 
                    multiple
                    size={4}
                    className="w-full border border-slate-200 dark:border-white/5 rounded-xl p-3 text-sm outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" 
                    value={category} 
                    onChange={(e) => setCategory(Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value as MaintenanceCategory))}
                    required
                  >
                    <option>Plumbing</option><option>Electrical</option><option>Appliance</option><option>Structural</option><option>HVAC</option><option>Exterior</option><option>Safety</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Priority</label>
                  <select className="w-full border border-slate-200 dark:border-white/5 rounded-xl p-3 text-sm outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold" value={priority} onChange={(e) => setPriority(e.target.value as MaintenancePriority)}>
                    <option value={MaintenancePriority.LOW} className="text-slate-500">Low</option>
                    <option value={MaintenancePriority.MEDIUM} className="text-blue-600">Medium</option>
                    <option value={MaintenancePriority.HIGH} className="text-amber-600">High</option>
                    <option value={MaintenancePriority.EMERGENCY} className="text-rose-600">Emergency</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col-reverse sm:flex-row justify-end gap-3 mt-4 border-t border-slate-50 dark:border-white/5 pt-6">
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 text-slate-500 font-black text-xs uppercase hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">Dismiss</button>
              <button type="submit" className="px-10 py-3 bg-slate-900 dark:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-black dark:hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                <i className="fa-solid fa-plus"></i> Submit New Request
              </button>
            </div>
          </form>
        </div>
      )}

      {activeView === 'requests' ? (
        <div className="space-y-10">
          {/* Open Requests Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Active Pipeline ({openRequests.length})</h3>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-white/5">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Target</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Issue Detail</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Priority</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {openRequests.length > 0 ? openRequests.map(req => (
                      <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => navigate(isAdmin ? `/admin/maintenance/${req.id}` : `/maintenance/${req.id}`)}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase">Unit {units.find(u => u.id === req.unitId)?.number || 'N/A'}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {req.category.map(cat => (
                                <span key={cat} className="text-[8px] text-slate-400 font-bold uppercase tracking-widest border border-slate-200 dark:border-white/10 px-1 rounded">{cat}</span>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{req.description}</p>
                          <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">Filed: {new Date(req.createdAt).toLocaleDateString()}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-tighter ${
                            req.priority === MaintenancePriority.EMERGENCY ? 'bg-rose-100 text-rose-700' :
                            req.priority === MaintenancePriority.HIGH ? 'bg-amber-100 text-amber-700' : 
                            req.priority === MaintenancePriority.MEDIUM ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}>
                            {req.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              req.status === RequestStatus.IN_PROGRESS ? 'bg-blue-500' : 'bg-amber-500'
                            }`}></div>
                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">{req.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isAdmin && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); updateRequestStatus(req.id, RequestStatus.COMPLETED); }}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg"
                                title="Mark Complete"
                              >
                                <i className="fa-solid fa-check"></i>
                              </button>
                            )}
                            <button 
                              onClick={(e) => { e.stopPropagation(); navigate(isAdmin ? `/admin/maintenance/${req.id}` : `/maintenance/${req.id}`); }}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                            >
                              <i className="fa-solid fa-arrow-right"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs italic font-medium">
                          No active service requests.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Archived Requests Section */}
          <div className="space-y-4 opacity-60">
            <div className="flex items-center gap-3 px-2">
              <i className="fa-solid fa-box-archive text-slate-400 text-[10px]"></i>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Archived History ({archivedRequests.length})</h3>
            </div>
            <div className="bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-slate-50/50 dark:bg-slate-950/30 border-b border-slate-200 dark:border-white/5">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Target</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Issue Detail</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Priority</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {archivedRequests.length > 0 ? archivedRequests.map(req => (
                      <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => navigate(isAdmin ? `/admin/maintenance/${req.id}` : `/maintenance/${req.id}`)}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col grayscale opacity-70">
                            <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase">Unit {units.find(u => u.id === req.unitId)?.number || 'N/A'}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {req.category.map(cat => (
                                <span key={cat} className="text-[8px] text-slate-400 font-bold uppercase tracking-widest border border-slate-200 dark:border-white/10 px-1 rounded">{cat}</span>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 line-clamp-1">{req.description}</p>
                          <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">Resolved: {new Date(req.updatedAt || req.createdAt).toLocaleDateString()}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-tighter bg-slate-100 dark:bg-slate-800 text-slate-400">
                            {req.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              req.status === RequestStatus.COMPLETED ? 'bg-emerald-500/50' : 'bg-rose-500/50'
                            }`}></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase">{req.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isAdmin && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); updateRequestStatus(req.id, RequestStatus.IN_PROGRESS); }}
                                className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg border border-amber-200/50 dark:border-amber-900/30"
                              >
                                Re-open Request
                              </button>
                            )}
                            <button 
                              onClick={(e) => { e.stopPropagation(); navigate(isAdmin ? `/admin/maintenance/${req.id}` : `/maintenance/${req.id}`); }}
                              className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                            >
                              <i className="fa-solid fa-arrow-right"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs italic font-medium">
                          No archived history.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuotes.map(quote => (
              <div key={quote.id} className={`bg-white dark:bg-slate-900 p-6 rounded-3xl border flex flex-col transition-all group ${quote.status === 'Approved' ? 'border-emerald-500' : 'border-slate-200 dark:border-white/5'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 group-hover:text-emerald-600 transition-colors">
                    <i className="fa-solid fa-file-invoice-dollar text-xl"></i>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest ${
                    quote.status === 'Approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  }`}>
                    {quote.status}
                  </span>
                </div>
                <h4 className="font-black text-slate-800 dark:text-white mb-1">{quote.vendorName}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-4 tracking-widest">Submitted: {quote.date}</p>
                <div className="flex-1 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-2xl border border-slate-100 dark:border-white/5 mb-6">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">"{quote.details}"</p>
                </div>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50 dark:border-white/5">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">${quote.amount.toLocaleString()}</span>
                  <div className="flex gap-2">
                    {quote.status !== 'Approved' && (
                      <button 
                        onClick={() => approveQuote(quote.id)}
                        className="bg-slate-900 dark:bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black dark:hover:bg-emerald-700 transition-all active:scale-95"
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {showStatusConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-8 animate-in zoom-in-95 duration-200 text-center">
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center text-2xl ${
              pendingRequest?.status === RequestStatus.COMPLETED ? 'bg-emerald-100 text-emerald-600' :
              pendingRequest?.status === RequestStatus.CANCELLED ? 'bg-rose-100 text-rose-600' :
              pendingRequest?.status === RequestStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-600' :
              'bg-amber-100 text-amber-600'
            }`}>
              <i className="fa-solid fa-circle-question"></i>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Update Status?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">
              Are you sure you want to move this request to <span className="font-black text-slate-700 dark:text-slate-300 uppercase">{pendingRequest?.status}</span>?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => { setShowStatusConfirm(false); setPendingRequest(null); }} 
                className="flex-1 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
              >
                Go Back
              </button>
              <button 
                onClick={confirmRequestStatus} 
                className={`flex-1 py-3 text-white rounded-xl text-xs font-black uppercase shadow-lg transition-all active:scale-95 ${
                  pendingRequest?.status === RequestStatus.COMPLETED ? 'bg-emerald-600 shadow-emerald-500/20' :
                  pendingRequest?.status === RequestStatus.CANCELLED ? 'bg-rose-600 shadow-rose-500/20' :
                  pendingRequest?.status === RequestStatus.IN_PROGRESS ? 'bg-blue-600 shadow-blue-500/20' :
                  'bg-amber-100 text-amber-600'
                }`}
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Maintenance;
