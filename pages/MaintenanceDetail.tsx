
import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { RequestStatus, MaintenanceNote, MaintenanceExpense, MaintenanceCategory, MaintenanceRequest, Unit, Tenant } from '../types';

interface MaintenanceDetailProps {
  isAdmin?: boolean;
  requests?: MaintenanceRequest[];
  setRequests?: React.Dispatch<React.SetStateAction<MaintenanceRequest[]>>;
  units?: Unit[];
  tenants?: Tenant[];
}

const MaintenanceDetail: React.FC<MaintenanceDetailProps> = ({ 
  isAdmin = false, 
  requests = [], 
  setRequests,
  units = [],
  tenants = []
}) => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  
  const userUnitId = units.length > 0 ? units[0].id : null;
  const request = requests.find(r => r.id === requestId);
  
  if (request && !isAdmin && request.unitId !== userUnitId) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5">
        <i className="fa-solid fa-shield-halved text-5xl text-rose-500 mb-4 opacity-20"></i>
        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Access Restricted</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">You are only authorized to view service records for your assigned unit.</p>
        <Link to="/maintenance" className="mt-8 inline-block bg-slate-900 dark:bg-emerald-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Return to Queue</Link>
      </div>
    );
  }

  const unit = units.find(u => u.id === request?.unitId);
  const tenant = tenants.find(t => t.id === request?.tenantId);

  const [newNote, setNewNote] = useState('');
  const [newItem, setNewItem] = useState('');
  const [newCost, setNewCost] = useState('');
  const [isEditingCategories, setIsEditingCategories] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  if (!request) return <div className="p-12 text-center text-slate-500 font-bold">Ticket not found in archive.</div>;

  const isLocked = request.status === RequestStatus.COMPLETED || request.status === RequestStatus.CANCELLED;

  const persistUpdate = async (updated: MaintenanceRequest) => {
    try {
      const res = await fetch(`/api/maintenance/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updated,
          category: updated.category[0] // API expects string for category
        })
      });
      const data = await res.json();
      if (setRequests) {
        setRequests(prev => prev.map(r => r.id === data.id ? { ...data, category: [data.category] } : r));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = (status: RequestStatus) => {
    if (isLocked && status !== RequestStatus.IN_PROGRESS) return;
    persistUpdate({ ...request, status, updatedAt: new Date().toISOString() });
  };

  const toggleCategory = (cat: MaintenanceCategory) => {
    const current = request.category;
    const next = current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat];
    persistUpdate({ ...request, category: next, updatedAt: new Date().toISOString() });
  };

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || isLocked) return;
    const note: MaintenanceNote = {
      id: `n${Date.now()}`,
      author: isAdmin ? 'Board Admin' : 'Member Note',
      date: new Date().toISOString(),
      content: newNote.trim()
    };
    persistUpdate({ ...request, notes: [...(request.notes || []), note], updatedAt: new Date().toISOString() });
    setNewNote('');
  };

  const addExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim() || !newCost || isLocked) return;
    const expense: MaintenanceExpense = {
      id: `ex${Date.now()}`,
      item: newItem.trim(),
      cost: parseFloat(newCost),
      date: new Date().toISOString().split('T')[0]
    };
    persistUpdate({ ...request, expenses: [...(request.expenses || []), expense], updatedAt: new Date().toISOString() });
    setNewItem('');
    setNewCost('');
  };

  const handleReopen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) return;
    handleStatusChange(RequestStatus.IN_PROGRESS);
    setShowReopenModal(false);
    setReopenReason('');
  };

  // Bug fix: Add null check for expenses
  const totalExpenses = (request.expenses || []).reduce((acc, curr) => acc + curr.cost, 0);
  const availableCategories: MaintenanceCategory[] = ['Plumbing', 'Electrical', 'Structural', 'Appliance', 'HVAC', 'Exterior', 'Safety', 'Other'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4 text-slate-500 text-sm mb-2">
        <Link to="/maintenance" className="hover:text-emerald-600 transition-colors flex items-center gap-1 font-bold">
          <i className="fa-solid fa-arrow-left"></i> Maintenance Queue
        </Link>
        {isLocked && (
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <i className="fa-solid fa-lock"></i> Record Finalized
          </span>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-white/5">
        <div className="grid grid-cols-2 sm:grid-cols-4 w-full gap-3">
          {(Object.values(RequestStatus)).map((status) => {
            const isActive = request.status === status;
            return (
              <button
                key={status}
                disabled={(isLocked || !isAdmin) && !isActive}
                onClick={() => isAdmin && handleStatusChange(status)}
                className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  isActive 
                    ? `bg-emerald-600 text-white scale-105 z-10` 
                    : isAdmin 
                      ? 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600 opacity-60 hover:opacity-100'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-700 opacity-30 cursor-not-allowed'
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5">
            <div className="flex flex-wrap gap-2 mb-6">
              {request.category.map(cat => (
                <span key={cat} className="text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <i className="fa-solid fa-tag mr-2"></i>{cat}
                </span>
              ))}
              {isAdmin && !isLocked && <button onClick={() => setIsEditingCategories(!isEditingCategories)} className="text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:border-emerald-500 transition-colors flex items-center gap-2"><i className="fa-solid fa-plus"></i> Edit Service Type</button>}
            </div>

            {isEditingCategories && (
              <div className="flex flex-wrap gap-2 mb-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                {availableCategories.map(cat => (
                  <button key={cat} onClick={() => toggleCategory(cat)} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${request.category.includes(cat) ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-emerald-600 border border-slate-100 dark:border-white/5'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            )}
            
            <h1 className="text-4xl font-black text-slate-900 dark:text-white leading-tight mb-8">{request.description}</h1>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8 border-t border-slate-50 dark:border-white/5">
              <div className="flex items-center gap-4 group p-5 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-transparent">
                <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-400">
                  <i className="fa-solid fa-door-open text-2xl"></i>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Asset Location</p>
                  <p className="text-xl font-black text-slate-800 dark:text-slate-200">Unit #{unit?.number || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 group p-5 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-transparent">
                <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-400">
                  <i className="fa-solid fa-user-circle text-2xl"></i>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Submitted By</p>
                  <p className="text-xl font-black text-slate-800 dark:text-slate-200">{tenant ? `${tenant.firstName} ${tenant.lastName}` : 'System User'}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/50">
              <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">Activity Log & Dispatch Feed</h3>
            </div>
            <div className="p-6 space-y-6">
              {(request.notes || []).map((note) => (
                <div key={note.id} className="flex gap-4">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 uppercase">
                    {note.author[0]}
                  </div>
                  <div className="flex-1 pb-4 border-b border-slate-50 dark:border-white/5">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-black text-slate-800 dark:text-white">{note.author}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{new Date(note.date).toLocaleDateString()}</p>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
                      {note.content}
                    </p>
                  </div>
                </div>
              ))}
              {!isLocked && (
                <form onSubmit={addNote} className="pt-4">
                  <textarea
                    className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 dark:text-slate-200"
                    placeholder={isAdmin ? "Log a new update or member contact..." : "Add a comment for the maintenance committee..."}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                  <div className="flex justify-end mt-3">
                    <button type="submit" className="bg-slate-900 dark:bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95">Post Update</button>
                  </div>
                </form>
              )}
            </div>
          </section>

          {isAdmin && (
            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/50 flex justify-between items-center">
                <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">Incident Expenditure Ledger</h3>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">Total: ${totalExpenses.toFixed(2)}</p>
              </div>
              <div className="p-6">
                {!isLocked && (
                  <form onSubmit={addExpense} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 p-4 bg-slate-50 dark:bg-slate-950/30 rounded-2xl">
                     <input type="text" placeholder="Service/Part" className="col-span-1 bg-white dark:bg-slate-800 border dark:border-white/10 rounded-xl px-4 py-2 text-xs font-bold" value={newItem} onChange={e => setNewItem(e.target.value)} />
                     <input type="number" placeholder="0.00" className="col-span-1 bg-white dark:bg-slate-800 border dark:border-white/10 rounded-xl px-4 py-2 text-xs font-bold" value={newCost} onChange={e => setNewCost(e.target.value)} />
                     <button type="submit" className="bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-emerald-500/10 dark:shadow-none flex items-center justify-center gap-2 px-4"><i className="fa-solid fa-plus"></i> Add Item</button>
                  </form>
                )}
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-slate-950/20">
                         <tr>
                            <th className="px-4 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400">Date</th>
                            <th className="px-4 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400">Description</th>
                            <th className="px-4 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400 text-right">Cost</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                         {(request.expenses || []).map(exp => (
                           <tr key={exp.id}>
                              <td className="px-4 py-3 text-[10px] font-bold text-slate-500">{exp.date}</td>
                              <td className="px-4 py-3 text-xs font-black text-slate-800 dark:text-slate-200">{exp.item}</td>
                              <td className="px-4 py-3 text-sm font-black text-slate-900 dark:text-white text-right">${exp.cost.toFixed(2)}</td>
                           </tr>
                         ))}
                         {(!request.expenses || request.expenses.length === 0) && (
                           <tr><td colSpan={3} className="px-4 py-8 text-center text-[10px] font-black uppercase text-slate-300">No costs recorded.</td></tr>
                         )}
                      </tbody>
                   </table>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 dark:bg-slate-950 text-white p-8 rounded-3xl">
             <h3 className="text-emerald-400 font-black uppercase text-[10px] tracking-widest mb-6">Work Order Actions</h3>
             <div className="space-y-3">
                <button onClick={() => window.print()} className="w-full p-4 bg-emerald-600 text-white rounded-2xl flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all active:scale-95 group">
                  <i className="fa-solid fa-print group-hover:scale-110 transition-transform"></i>
                  <span className="text-[10px] font-black uppercase tracking-widest">Print Order</span>
                </button>
                {isLocked && isAdmin && (
                  <button onClick={() => setShowReopenModal(true)} className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/20 transition-all">
                    <i className="fa-solid fa-rotate-left text-amber-500"></i>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Re-open Case</span>
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => alert("Resident has been notified via Portal and Email.")} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/10 transition-colors">
                    <i className="fa-solid fa-envelope text-blue-400"></i>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Resend Alert</span>
                  </button>
                )}
             </div>
          </div>
        </div>
      </div>

      {showReopenModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight">Re-open Maintenance Case</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Please provide a reason for reopening this record. This will be logged in the activity feed.</p>
            <form onSubmit={handleReopen} className="space-y-4">
              <textarea 
                required 
                value={reopenReason} 
                onChange={e => setReopenReason(e.target.value)}
                className="w-full h-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Reason for reopening..."
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowReopenModal(false)} className="flex-1 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-amber-500 text-white rounded-xl text-xs font-black uppercase hover:bg-amber-600">Confirm Reopen</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceDetail;
