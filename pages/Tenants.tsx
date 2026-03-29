
import React, { useState } from 'react';
import { Tenant, Unit } from '../types';
import { useNavigate } from 'react-router-dom';
import FilterBar from '../components/FilterBar';

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

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [unitId, setUnitId] = useState('');
  const [status, setStatus] = useState<'Current' | 'Waitlist'>('Current');

  const handleAddTenant = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `t${Date.now()}`;
    const newTenant: Tenant = {
      id: newId, firstName, lastName, email, phone,
      unitId: unitId || undefined,
      startDate: new Date().toISOString().split('T')[0],
      status: status as any,
      balance: 0, shareCapital: 0,
      history: unitId ? [{
        id: `h${Date.now()}`, tenantId: newId, unitId,
        unit: { number: units.find(u => u.id === unitId)?.number || '' } as any,
        startDate: new Date().toISOString().split('T')[0],
      }] : [],
      role: 'MEMBER'
    };
    setTenants([...tenants, newTenant]);
    setShowAddForm(false);
    setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setUnitId('');
    alert("New member registered in association directory.");
  };

  const filteredTenants = tenants.filter(t => {
    const matchesSearch =
      `${t.firstName} ${t.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase()) ||
      (t.unitId && units.find(u => u.id === t.unitId)?.number.includes(search));
    const matchesFilter = filter === 'All' || t.status === filter;
    return matchesSearch && matchesFilter;
  });

  const unitGroups = units.map(unit => {
    const members = filteredTenants.filter(t => t.unitId === unit.id);
    return { unit, members };
  }).filter(g => g.members.length > 0)
    .sort((a, b) => a.unit.number.localeCompare(b.unit.number, undefined, { numeric: true }));

  const waitlistMembers = filteredTenants.filter(t => !t.unitId);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 transition-colors duration-200">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {isAdmin ? 'Member Registry' : 'Community Directory'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {isAdmin ? 'Protected community records and historical data.' : 'Connecting neighbors while respecting privacy.'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-plus"></i> Add New Member
          </button>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 animate-in slide-in-from-bottom sm:zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Register New Member</h3>
              <button onClick={() => setShowAddForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleAddTenant} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">First Name</label>
                  <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Name</label>
                  <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone Number</label>
                <input type="text" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit</label>
                  <select value={unitId} onChange={e => setUnitId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm outline-none text-slate-900 dark:text-white">
                    <option value="">None / Waitlist</option>
                    {units.map(u => <option key={u.id} value={u.id}>Unit {u.number}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm outline-none text-slate-900 dark:text-white">
                    <option value="Current">Current Member</option>
                    <option value="Waitlist">Waitlist</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-700 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-plus"></i> Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <FilterBar 
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={isAdmin ? "Filter by name, unit, or email..." : "Search neighbors..."}
        filter={filter}
        onFilterChange={setFilter}
        filterOptions={['All', 'Current', 'Past', 'Waitlist']}
      />

      {/* ── Mobile: Card List ── */}
      <div className="sm:hidden space-y-3">
        {unitGroups.map(group => (
          <div key={group.unit.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
            {/* Unit header */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <div>
                <span className="text-base font-black text-slate-900 dark:text-white">Unit {group.unit.number}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter ml-2">{group.unit.type} · Floor {group.unit.floor}</span>
              </div>
              <span className="text-[9px] font-black px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg uppercase">
                {group.members.length} {group.members.length === 1 ? 'Member' : 'Members'}
              </span>
            </div>
            {/* Members */}
            {group.members.map((member, idx) => (
              <div
                key={member.id}
                className={`flex items-center justify-between px-4 py-3 ${idx < group.members.length - 1 ? 'border-b border-slate-100 dark:border-white/5' : ''}`}
                onClick={() => navigate(isAdmin ? `/admin/tenants/${member.id}` : `/directory`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black uppercase shrink-0">
                    {member.firstName[0]}{member.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{member.firstName} {member.lastName}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase hidden xs:block">
                    Since {new Date(member.startDate).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400">
                    <i className="fa-solid fa-arrow-right-long text-xs"></i>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Waitlist on mobile */}
        {waitlistMembers.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20">
              <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Waitlist & Unassigned</span>
            </div>
            {waitlistMembers.map((member, idx) => (
              <div
                key={member.id}
                className={`flex items-center justify-between px-4 py-3 ${idx < waitlistMembers.length - 1 ? 'border-b border-slate-100 dark:border-white/5' : ''}`}
                onClick={() => navigate(isAdmin ? `/admin/tenants/${member.id}` : `/directory`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-black uppercase shrink-0">
                    {member.firstName[0]}{member.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{member.firstName} {member.lastName}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{member.email}</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 shrink-0">
                  <i className="fa-solid fa-arrow-right-long text-xs"></i>
                </div>
              </div>
            ))}
          </div>
        )}

        {unitGroups.length === 0 && waitlistMembers.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 px-6 py-12 text-center text-slate-400 text-xs italic font-medium">
            No member records found matching your criteria.
          </div>
        )}
      </div>

      {/* ── Desktop: Table ── */}
      <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-white/5">
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset/Unit</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Shareholders / Members</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Info</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Residency</th>
              <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-white/5">
            {unitGroups.map(group => (
              <tr key={group.unit.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group/row">
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="text-base font-black text-slate-900 dark:text-white">Unit {group.unit.number}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{group.unit.type} • Floor {group.unit.floor}</span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-2">
                    {group.members.map(member => (
                      <div key={member.id} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black uppercase shrink-0">
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{member.firstName} {member.lastName}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-1.5">
                    {group.members.map(member => (
                      <div key={member.id} className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={member.email}>
                        {member.email}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-1">
                    {group.members.map(member => (
                      <span key={member.id} className="text-[10px] font-bold text-slate-400 uppercase">
                        Since {new Date(member.startDate).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex flex-col items-end gap-2">
                    {group.members.map(member => (
                      <button
                        key={member.id}
                        onClick={() => navigate(isAdmin ? `/admin/tenants/${member.id}` : `/directory`)}
                        className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500 transition-all shadow-sm"
                      >
                        <i className="fa-solid fa-arrow-right-long text-xs"></i>
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}

            {waitlistMembers.length > 0 && (
              <>
                <tr className="bg-slate-50 dark:bg-slate-950/80">
                  <td colSpan={5} className="px-8 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Waitlist & Unassigned Members</td>
                </tr>
                {waitlistMembers.map(member => (
                  <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-8 py-6">
                      <span className="text-[10px] font-black px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg uppercase">Waitlist</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-black uppercase shrink-0">
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-white">{member.firstName} {member.lastName}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{member.email}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Applied {new Date(member.startDate).toLocaleDateString()}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button
                        onClick={() => navigate(isAdmin ? `/admin/tenants/${member.id}` : `/directory`)}
                        className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 inline-flex items-center justify-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500 transition-all shadow-sm"
                      >
                        <i className="fa-solid fa-arrow-right-long"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            )}

            {unitGroups.length === 0 && waitlistMembers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs italic">
                  No member records found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Tenants;
