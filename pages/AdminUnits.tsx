
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Unit, Tenant } from '../types';

const AdminUnits: React.FC<{ units: Unit[], setUnits: React.Dispatch<React.SetStateAction<Unit[]>>, tenants: Tenant[] }> = ({ units, setUnits, tenants }) => {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Occupied' | 'Vacant' | 'Maintenance'>('All');
  
  // Form State
  const [number, setNumber] = useState('');
  const [type, setType] = useState<'1BR' | '2BR' | '3BR' | '4BR'>('2BR');
  const [floor, setFloor] = useState(1);

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const newUnit: Unit = {
      id: `u${Date.now()}`,
      number,
      type,
      floor,
      status: 'Vacant',
    };
    setUnits([...units, newUnit]);
    setShowAddModal(false);
    setNumber('');
    alert("New unit added to association inventory.");
  };

  const sortedUnits = [...units]
    .filter(u => filter === 'All' || u.status === filter)
    .sort((a, b) => {
      if (a.floor !== b.floor) return a.floor - b.floor;
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    });

  return (
    <div className="space-y-6 pb-12 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Unit Inventory</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Managing building envelope and unit assignments.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <i className="fa-solid fa-plus"></i> Add New Unit
        </button>
      </div>

      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl overflow-x-auto scrollbar-hide">
        {['All', 'Occupied', 'Vacant', 'Maintenance'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${filter === f ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-8 animate-in slide-in-from-bottom sm:zoom-in-95">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">Register New Co-op Unit</h3>
            <form onSubmit={handleAddUnit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit Number</label>
                <input type="text" required value={number} onChange={e => setNumber(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" placeholder="e.g. 402" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit Type</label>
                  <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none text-slate-900 dark:text-white">
                    <option>1BR</option><option>2BR</option><option>3BR</option><option>4BR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Floor</label>
                  <input type="number" required value={floor} onChange={e => setFloor(parseInt(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none text-slate-900 dark:text-white" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-700 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-plus"></i> Add New Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sortedUnits.map(unit => {
          const tenant = tenants.find(t => t.id === unit.currentTenantId);
          return (
            <div 
              key={unit.id} 
              onClick={() => navigate(`/admin/units/${unit.id}`)}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden hover:border-emerald-300 dark:hover:border-emerald-500 transition-all group flex flex-col cursor-pointer"
            >
              <div className={`h-2 ${
                unit.status === 'Occupied' ? 'bg-emerald-500' :
                unit.status === 'Vacant' ? 'bg-slate-300 dark:bg-slate-700' :
                'bg-amber-500'
              }`}></div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Unit {unit.number}</h3>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{unit.type} • Floor {unit.floor}</p>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase border tracking-tighter ${
                    unit.status === 'Occupied' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800' :
                    unit.status === 'Vacant' ? 'bg-slate-50 dark:bg-slate-800/30 text-slate-700 dark:text-slate-400 border-slate-100 dark:border-white/5' :
                    'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800'
                  }`}>
                    {unit.status}
                  </span>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-white/5">
                    <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Assigned Resident</p>
                    {tenant ? (
                      <div 
                        onClick={(e) => { e.stopPropagation(); navigate(`/admin/tenants/${tenant.id}`); }}
                        className="flex items-center gap-2 group/tenant"
                      >
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover/tenant:text-emerald-600 transition-colors truncate">
                          {tenant.firstName} {tenant.lastName}
                        </span>
                        <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-300 dark:text-slate-600 group-hover/tenant:text-emerald-400"></i>
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-slate-400 italic">No Member Assigned</span>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-50 dark:border-white/5">
                  <button 
                    className="w-full bg-slate-900 dark:bg-emerald-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black dark:hover:bg-emerald-700 transition-all active:scale-95"
                  >
                    View Maintenance & Files
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminUnits;
