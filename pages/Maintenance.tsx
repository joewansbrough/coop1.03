
import React, { useState } from 'react';
import { MaintenanceRequest, RequestStatus, RepairQuote, MaintenanceCategory, Unit } from '../types';
import { MOCK_REQUESTS, MOCK_UNITS, MOCK_QUOTES } from '../constants';
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
  
  // Filter requests based on user role
  const displayedRequests = (isAdmin || isGuest)
    ? (Array.isArray(requests) ? requests : []) 
    : (Array.isArray(requests) ? requests.filter(r => r.unitId === userUnitId) : []);
  
  // Form State
  const [description, setDescription] = useState('');
  const [unitId, setUnitId] = isAdmin ? useState('') : useState(userUnitId);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      alert("Guest accounts cannot submit maintenance requests.");
      return;
    }
    const newRequest: MaintenanceRequest = {
      id: `r${Date.now()}`,
      title: description.substring(0, 30) + '...',
      unitId,
      tenantId: 't1', 
      category: category,
      description,
      priority: urgency,
      status: RequestStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: [],
      expenses: [],
      attachments: []
    };
    setRequests([newRequest, ...requests]);
    setShowForm(false);
    setDescription('');
    if (isAdmin) setUnitId('');
    alert("Maintenance request submitted successfully! Our maintenance committee will review it shortly.");
  };

  const updateRequestStatus = (id: string, status: RequestStatus) => {
    if (isGuest) return;
    setRequests(requests.map(r => r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r));
  };

  const approveQuote = (quoteId: string) => {
    if (isGuest) return;
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
          <h2 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white">{isAdmin ? 'Maintenance Operations' : (isGuest ? 'Maintenance View (Guest)' : 'My Service Requests')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {isAdmin ? 'Managing building longevity and member comfort.' : (isGuest ? 'Viewing all co-op maintenance activity.' : 'Track and report issues for your residence.')}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {(isAdmin || isGuest) && (
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl flex-1 sm:flex-none">
              <button 
                onClick={() => { setActiveView('requests'); setSelectedRequestIdForQuotes(null); }}
                className={`flex-1 sm:px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeView === 'requests' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
              >
                Requests
              </button>
              <button 
                onClick={() => setActiveView('quotes')}
                className={`flex-1 sm:px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeView === 'quotes' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
              >
                Quotes {quotes.length > 0 && `(${quotes.length})`}
              </button>
            </div>
          )}
          {!isGuest && (
            <button 
              onClick={() => setShowForm(!showForm)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <i className="fa-solid fa-plus"></i> Submit New Request
            </button>
          )}
        </div>
      </div>

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
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                  <select 
                    multiple
                    className="w-full border border-slate-200 dark:border-white/5 rounded-xl p-3 text-sm outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" 
                    value={category} 
                    onChange={(e) => setCategory(Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value as MaintenanceCategory))}
                  >
                    <option>Plumbing</option><option>Electrical</option><option>Appliance</option><option>Structural</option><option>HVAC</option><option>Exterior</option><option>Safety</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Urgency</label>
                  <select className="w-full border border-slate-200 dark:border-white/5 rounded-xl p-3 text-sm outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                    <option className="text-slate-500">Low</option>
                    <option className="text-blue-600">Medium</option>
                    <option className="text-amber-600">High</option>
                    <option className="text-rose-600">Emergency</option>
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
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden">
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
                      <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-tighter ${
                        req.urgency === 'Emergency' ? 'bg-rose-100 text-rose-700' :
                        req.urgency === 'High' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {req.urgency}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${req.status === RequestStatus.COMPLETED ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">{req.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdmin && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); updateRequestStatus(req.id, RequestStatus.COMPLETED); }}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg"
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
                      No service requests found for your unit.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
    </div>
  );
};

export default Maintenance;
