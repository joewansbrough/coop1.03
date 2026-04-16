
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Unit, Tenant } from '../types';
import FilterBar from '../components/FilterBar';

const AdminUnits: React.FC<{ units: Unit[], setUnits: React.Dispatch<React.SetStateAction<Unit[]>>, tenants: Tenant[] }> = ({ units, setUnits, tenants }) => {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
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
    .filter(u => {
      const matchesFilter = filter === 'All' || u.status === filter;
      const matchesSearch = u.number.includes(search) || u.type.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });

  const unitsByFloor = sortedUnits.reduce((acc, unit) => {
    const floor = unit.floor || 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(unit);
    return acc;
  }, {} as Record<number, Unit[]>);

  const sortedFloors = Object.keys(unitsByFloor)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-6 lg:space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-12 transition-all">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Unit Inventory
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium font-medium">
            Managing building envelope and unit assignments.
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto bg-brand-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-plus"></i> Add New Unit
        </button>
      </div>

      <FilterBar 
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter by unit number or type..."
        filter={filter}
        onFilterChange={setFilter}
        filterOptions={['All', 'Occupied', 'Vacant', 'Maintenance']}
      />

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-8 animate-in slide-in-from-bottom sm:zoom-in-95">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">Register New Co-op Unit</h3>
            <form onSubmit={handleAddUnit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit Number</label>
                <input type="text" required value={number} onChange={e => setNumber(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white" placeholder="e.g. 402" />
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
                <button type="submit" className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-xs font-black uppercase hover:bg-brand-700 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-plus"></i> Add New Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-12">
        {sortedFloors.length > 0 ? sortedFloors.map(floor => (
          <div key={floor} className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-white/5 shadow-sm">
                Floor {floor}
              </div>
              <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {unitsByFloor[floor].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })).map(unit => {
                const tenant = tenants.find(t => t.id === unit.currentTenantId);
                return (
                  <div 
                    key={unit.id} 
                    onClick={() => navigate(`/admin/units/${unit.id}`)}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden hover:border-brand-300 dark:hover:border-brand-500 transition-all group flex flex-col cursor-pointer active:scale-[0.98] shadow-sm"
                  >
                    <div className={`h-1 ${
                      unit.status === 'Occupied' ? 'bg-brand-500' :
                      unit.status === 'Vacant' ? 'bg-slate-200 dark:bg-slate-700' :
                      'bg-amber-500'
                    }`}></div>
                    <div className="p-6 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-lg font-black text-slate-800 dark:text-white group-hover:text-brand-600 transition-colors">Unit {unit.number}</h3>
                        <div className={`w-2 h-2 rounded-full ${
                          unit.status === 'Occupied' ? 'bg-brand-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                          unit.status === 'Vacant' ? 'bg-slate-300' :
                          'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                        }`}></div>
                      </div>
                      
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{unit.type}</p>
                        <div className="p-2 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-white/5">
                          <p className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Assigned</p>
                          <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate">
                            {tenant ? `${tenant.firstName} ${tenant.lastName}` : <span className="text-slate-400 italic font-medium">Vacant</span>}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-50 dark:border-white/5 flex justify-between items-center">
                        <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase">View Details</span>
                        <i className="fa-solid fa-chevron-right text-[8px] text-slate-300 group-hover:text-brand-500 transition-colors"></i>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )) : (
          <div className="py-20 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[2.5rem]">
            <i className="fa-solid fa-building-circle-exclamation text-4xl text-slate-200 dark:text-slate-800 mb-4"></i>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No units found matching criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUnits;
