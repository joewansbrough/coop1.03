
import React, { useState } from 'react';
import { Tenant, Unit } from '../types';
import { useNavigate } from 'react-router-dom';

interface TenantsProps {
  isAdmin?: boolean;
  tenants: Tenant[];
  setTenants: React.Dispatch<React.SetStateAction<Tenant[]>>;
  units: Unit[];
}

const Tenants: React.FC<TenantsProps> = ({ isAdmin = false, tenants, setTenants, units }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [unitId, setUnitId] = useState('');
  const [status, setStatus] = useState<'Current' | 'Waitlist'>('Current');

  const handleAddTenant = (e: React.FormEvent) => {
    e.preventDefault();
    const newTenant: Tenant = {
      id: `t${Date.now()}`,
      firstName,
      lastName,
      email,
      phone,
      unitId: unitId || undefined,
      startDate: new Date().toISOString().split('T')[0],
      status: status as any,
      balance: 0,
      shareCapital: 0,
      residencyHistory: unitId ? [{
        unitId,
        unitNumber: units.find(u => u.id === unitId)?.number || '',
        startDate: new Date().toISOString().split('T')[0],
        isCurrent: true
      }] : []
    };
    setTenants([...tenants, newTenant]);
    setShowAddForm(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setUnitId('');
    alert("New member registered in association directory.");
  };

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = `${t.firstName} ${t.lastName}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' || t.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {isAdmin ? 'Member Registry' : 'Community Directory'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {isAdmin ? 'Protected community records and historical data.' : 'Connecting neighbors while respecting privacy.'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAddForm(true)} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2">
            <i className="fa-solid fa-plus"></i> Add New Member
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight">Register New Member</h3>
            <form onSubmit={handleAddTenant} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">First Name</label>
                  <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Name</label>
                  <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone Number</label>
                <input type="text" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit Assignment</label>
                  <select value={unitId} onChange={e => setUnitId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none text-slate-900 dark:text-white">
                    <option value="">None / Waitlist</option>
                    {units.map(u => <option key={u.id} value={u.id}>Unit {u.number}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Membership Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none text-slate-900 dark:text-white">
                    <option value="Current">Current Member</option>
                    <option value="Waitlist">Waitlist</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase shadow-lg hover:bg-emerald-700 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-plus"></i> Add New Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input 
            type="text" 
            placeholder={isAdmin ? "Filter by name or identity..." : "Search neighbors..."} 
            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isAdmin && (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
            {['All', 'Current', 'Past', 'Waitlist'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter === f ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-white/5">
            <tr>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Member Identity</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Unit Assignment</th>
              {isAdmin && <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Membership Status</th>}
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">
                {isAdmin ? 'View' : 'Contact'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {filteredTenants.map(t => (
              <tr key={t.id} onClick={() => isAdmin && navigate(`/admin/tenants/${t.id}`)} className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group ${isAdmin ? 'cursor-pointer' : ''}`}>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center font-black text-slate-400 dark:text-slate-500 text-xs uppercase group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 group-hover:text-emerald-600 transition-colors">{t.firstName[0]}{t.lastName[0]}</div>
                    <div>
                      <p className="text-sm font-black text-slate-800 dark:text-white">{t.firstName} {t.lastName}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">{t.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Unit {units.find(u => u.id === t.unitId)?.number || 'N/A'}</span>
                </td>
                {isAdmin && (
                  <td className="px-6 py-5">
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase border tracking-widest ${
                      t.status === 'Current' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-500 border-slate-100 dark:border-white/5'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                )}
                <td className="px-6 py-5 text-right">
                  {isAdmin ? (
                    <i className="fa-solid fa-arrow-right-long text-slate-300 dark:text-slate-700 group-hover:text-emerald-500 transition-all"></i>
                  ) : (
                    <button className="p-2 text-slate-300 hover:text-emerald-500 transition-colors">
                      <i className="fa-solid fa-envelope"></i>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Tenants;
