
import React, { useState } from 'react';
import { MaintenanceRequest, RequestStatus, RepairQuote, MaintenanceCategory, Unit } from '../types';
import { geminiService } from '../services/geminiService';
import { useNavigate } from 'react-router-dom';

interface MaintenanceProps {
  isAdmin?: boolean;
  isGuest?: boolean;
  requests: MaintenanceRequest[];
  setRequests: React.Dispatch<React.SetStateAction<MaintenanceRequest[]>>;
  units: Unit[];
}

const Maintenance: React.FC<MaintenanceProps> = ({ isAdmin = false, isGuest = false, requests, setRequests, units }) => {
  const navigate = useNavigate();
  const userUnitId = units.length > 0 ? units[0].id : 'u1';
  
  const [quotes, setQuotes] = useState<RepairQuote[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [activeView, setActiveView] = useState<'requests' | 'quotes'>('requests');
  const [selectedRequestIdForQuotes, setSelectedRequestIdForQuotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [editRequest, setEditRequest] = useState<MaintenanceRequest | null>(null);
  
  const displayedRequests = (isAdmin || isGuest)
    ? (Array.isArray(requests) ? requests : []) 
    : (Array.isArray(requests) ? requests.filter(r => r.unitId === userUnitId) : []);
  
  const [description, setDescription] = useState('');
  const [unitId, setUnitId] = useState(isAdmin ? '' : userUnitId);
  const [category, setCategory] = useState<MaintenanceCategory[]>(['Other']);
  const [urgency, setUrgency] = useState('Low');

  const handleTriage = async () => {
    if (!description || description.length < 10) return;
    setLoading(true);
    try {
      const result = await geminiService.triageMaintenanceRequest(description);
      if (result.category) setCategory([result.category as MaintenanceCategory]);
      if (result.urgency) setUrgency(result.urgency);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) { alert("Guest accounts cannot submit maintenance requests."); return; }
    const payload = {
      title: description.substring(0, 30) + '...',
      description, unitId,
      category: category[0],
      priority: urgency,
      status: RequestStatus.PENDING,
      requestedBy: 'member@example.com'
    };
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setRequests([{ ...data, category: [data.category] }, ...requests]);
      setShowForm(false);
      setDescription('');
      if (isAdmin) setUnitId('');
      alert("Maintenance request submitted successfully!");
    } catch (err) { console.error(err); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRequest) return;
    try {
      const res = await fetch(`/api/maintenance/${editRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editRequest, category: editRequest.category[0] })
      });
      const data = await res.json();
      setRequests(requests.map(r => r.id === data.id ? { ...data, category: [data.category] } : r));
      setEditRequest(null);
    } catch (err) { console.error(err); }
  };

  const deleteRequest = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this request?")) return;
    try {
      await fetch(`/api/maintenance/${id}`, { method: 'DELETE' });
      setRequests(requests.filter(r => r.id !== id));
    } catch (err) { console.error(err); }
  };

  const updateRequestStatus = async (id: string, status: RequestStatus) => {
    if (isGuest) return;
    const req = requests.find(r => r.id === id);
    if (!req) return;
    try {
      const res = await fetch(`/api/maintenance/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req, status, category: req.category[0] })
      });
      const data = await res.json();
      setRequests(requests.map(r => r.id === id ? { ...data, category: [data.category] } : r));
    } catch (err) { console.error(err); }
  };

  const approveQuote = (quoteId: string) => {
    if (isGuest) return;
    setQuotes(quotes.map(q => q.id === quoteId ? { ...q, status: 'Approved' } : q));
    alert("Quote approved. Vendor has been notified.");
  };

  const filteredQuotes = selectedRequestIdForQuotes 
    ? quotes.filter(q => q.requestId === selectedRequestIdForQuotes)
    : quotes;

  const priorityStyles = (priority: string) => {
    if (priority === 'Emergency') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    if (priority === 'High') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    if (priority === 'Medium') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  };

  const statusDot = (status: string) => {
    if (status === RequestStatus.COMPLETED) return 'bg-emerald-500';
    if (status === RequestStatus.PENDING) return 'bg-amber-500';
    return 'bg-blue-500';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors duration-200">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white">
            {isAdmin ? 'Maintenance Operations' : (isGuest ? 'Maintenance View (Guest)' : 'My Service Requests')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {isAdmin ? 'Managing building longevity and member comfort.' : (isGuest ? 'Viewing all co-op maintenance activity.' : 'Track and report issues for your residence.')}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {(isAdmin || isGuest) && (
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl flex-1 sm:flex-none">
              <button 
                onClick={() => { setActiveView('requests'); setSelectedRequestIdForQuotes(null); }}
                className={`flex-1 sm:px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeView === 'requests' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}
              >
                Requests
              </button>
              <button 
                onClick={() => setActiveView('quotes')}
                className={`flex-1 sm:px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeView === 'quotes' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}
              >
                Quotes {quotes.length > 0 && `(${quotes.length})`}
              </button>
            </div>
          )}
          {!isGuest && (
            <button 
              onClick={() => setShowForm(!showForm)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 active:scale-95 transition-all whitespace-nowrap"
            >
              <i className="fa-solid fa-plus"></i>
              <span className="hidden sm:inline">Submit New Request</span>
              <span className="sm:hidden">New Request</span>
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {(showForm || editRequest) && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-white/5 animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
              <i className="fa-solid fa-clipboard-list text-emerald-500"></i>
              {editRequest ? 'Edit Request' : (isAdmin ? 'Report Building Defect' : 'Request Maintenance')}
            </h3>
            <button onClick={() => { setShowForm(false); setEditRequest(null); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <form onSubmit={editRequest ? handleUpdate : handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Detailed Problem Description</label>
              <textarea
                className="w-full border border-slate-200 dark:border-white/5 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50 dark:bg-slate-950/50 min-h-[120px] text-slate-800 dark:text-slate-200"
                placeholder="Where is it? What happened? When did it start?"
                value={editRequest ? editRequest.description : description}
                onChange={(e) => editRequest ? setEditRequest({...editRequest, description: e.target.value}) : setDescription(e.target.value)}
                onBlur={!editRequest ? handleTriage : undefined}
                required
              />
              {loading && <p className="text-[10px] text-emerald-600 mt-2 font-black animate-pulse flex items-center gap-2"><i className="fa-solid fa-sparkles"></i> AI TRIAGING IN PROGRESS...</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:col-span-2">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Location/Unit</label>
                {isAdmin ? (
                  <select 
                    className="w-full border border-slate-200 dark:border-white/5 rounded-xl p-3 text-sm outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" 
                    value={editRequest ? editRequest.unitId : unitId} 
                    onChange={(e) => editRequest ? setEditRequest({...editRequest, unitId: e.target.value}) : setUnitId(e.target.value)} 
                    required
                  >
                    <option value="">Select Unit</option>
                    {units.map(u => <option key={u.id} value={u.id}>Unit {u.number}</option>)}
                    <option value="common">Common Areas</option>
                  </select>
                ) : (
                  <div className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                    Unit {units.find(u => u.id === (editRequest ? editRequest.unitId : unitId))?.number || '101'} (Assigned)
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                  <select 
                    className="w-full border border-slate-200 dark:border-white/5 rounded-xl p-3 text-sm outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" 
                    value={editRequest ? editRequest.category[0] : category[0]} 
                    onChange={(e) => {
                      const val = e.target.value as MaintenanceCategory;
                      editRequest ? setEditRequest({...editRequest, category: [val]}) : setCategory([val]);
                    }}
                  >
                    <option>Plumbing</option><option>Electrical</option><option>Appliance</option><option>Structural</option><option>HVAC</option><option>Exterior</option><option>Safety</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Urgency</label>
                  <select 
                    className="w-full border border-slate-200 dark:border-white/5 rounded-xl p-3 text-sm outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold" 
                    value={editRequest ? editRequest.priority : urgency} 
                    onChange={(e) => editRequest ? setEditRequest({...editRequest, priority: e.target.value}) : setUrgency(e.target.value)}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Emergency</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col-reverse sm:flex-row justify-end gap-3 mt-4 border-t border-slate-50 dark:border-white/5 pt-6">
              <button type="button" onClick={() => { setShowForm(false); setEditRequest(null); }} className="px-6 py-3 text-slate-500 font-black text-xs uppercase hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">Dismiss</button>
              <button type="submit" className="px-10 py-3 bg-slate-900 dark:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-black dark:hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                <i className={`fa-solid ${editRequest ? 'fa-save' : 'fa-plus'}`}></i>
                {editRequest ? 'Save Changes' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeView === 'requests' ? (
        <div>
          {/* ── Mobile: Card List ── */}
          <div className="sm:hidden space-y-3">
            {displayedRequests.length > 0 ? displayedRequests.map(req => (
              <div
                key={req.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden active:scale-[0.99] transition-transform"
                onClick={() => navigate(isAdmin ? `/admin/maintenance/${req.id}` : `/maintenance/${req.id}`)}
              >
                {/* Card top: unit + priority */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase">
                      Unit {units.find(u => u.id === req.unitId)?.number || 'N/A'}
                    </span>
                    {req.category.map(cat => (
                      <span key={cat} className="text-[8px] text-slate-400 font-bold uppercase border border-slate-200 dark:border-white/10 px-1.5 py-0.5 rounded">
                        {cat}
                      </span>
                    ))}
                  </div>
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-tighter ${priorityStyles(req.priority)}`}>
                    {req.priority}
                  </span>
                </div>

                {/* Description */}
                <div className="px-4 pb-3">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-2">{req.description}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                    Filed: {new Date(req.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Card footer: status + actions */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-white/5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${statusDot(req.status)}`}></div>
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">{req.status}</span>
                  </div>
                  <div className="flex gap-1">
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => updateRequestStatus(req.id, RequestStatus.COMPLETED)}
                          className="w-9 h-9 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl"
                          title="Mark Completed"
                        >
                          <i className="fa-solid fa-check text-sm"></i>
                        </button>
                        <button
                          onClick={() => { setEditRequest(req); window.scrollTo(0, 0); }}
                          className="w-9 h-9 flex items-center justify-center text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl"
                          title="Edit"
                        >
                          <i className="fa-solid fa-pen text-sm"></i>
                        </button>
                        <button
                          onClick={() => deleteRequest(req.id)}
                          className="w-9 h-9 flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl"
                          title="Delete"
                        >
                          <i className="fa-solid fa-trash text-sm"></i>
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => navigate(isAdmin ? `/admin/maintenance/${req.id}` : `/maintenance/${req.id}`)}
                      className="w-9 h-9 flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl"
                    >
                      <i className="fa-solid fa-arrow-right text-sm"></i>
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 px-6 py-12 text-center text-slate-400 text-xs italic font-medium">
                No service requests found for your unit.
              </div>
            )}
          </div>

          {/* ── Desktop: Table ── */}
          <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden">
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
                  {displayedRequests.length > 0 ? displayedRequests.map(req => (
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
                        <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-tighter ${priorityStyles(req.priority)}`}>
                          {req.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${statusDot(req.status)}`}></div>
                          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">{req.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isAdmin && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); updateRequestStatus(req.id, RequestStatus.COMPLETED); }} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg" title="Mark Completed">
                                <i className="fa-solid fa-check"></i>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setEditRequest(req); }} className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg" title="Edit">
                                <i className="fa-solid fa-pen"></i>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); deleteRequest(req.id); }} className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg" title="Delete">
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); navigate(isAdmin ? `/admin/maintenance/${req.id}` : `/maintenance/${req.id}`); }} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                            <i className="fa-solid fa-arrow-right"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs italic font-medium">
                        No service requests found for your unit.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuotes.map(quote => (
              <div key={quote.id} className={`bg-white dark:bg-slate-900 p-6 rounded-3xl border flex flex-col transition-all group ${quote.status === 'Approved' ? 'border-emerald-500' : 'border-slate-200 dark:border-white/5'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                    <i className="fa-solid fa-file-invoice-dollar text-xl"></i>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest ${quote.status === 'Approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
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
                  {quote.status !== 'Approved' && (
                    <button onClick={() => approveQuote(quote.id)} className="bg-slate-900 dark:bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black dark:hover:bg-emerald-700 transition-all active:scale-95">
                      Approve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Maintenance;
