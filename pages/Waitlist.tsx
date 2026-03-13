
import React, { useState } from 'react';
import { Tenant } from '../types';
import FilterBar from '../components/FilterBar';

const Waitlist: React.FC<{ tenants: Tenant[], setTenants: React.Dispatch<React.SetStateAction<Tenant[]>> }> = ({ tenants, setTenants }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [unitType, setUnitType] = useState('2BR');

  const waitlistMembers = tenants.filter(t => {
    if (t.status !== 'Waitlist') return false;
    const matchesFilter = filter === 'All' || 
                         (filter === '3BR+' ? (t.notes?.includes('3BR') || t.notes?.includes('4BR')) : t.notes?.includes(filter));
    const matchesSearch = `${t.firstName} ${t.lastName}`.toLowerCase().includes(search.toLowerCase()) || 
                         t.email.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleAddApplication = (e: React.FormEvent) => {
    e.preventDefault();
    const newApplicant: Tenant = {
      id: `w${Date.now()}`,
      firstName,
      lastName,
      email,
      phone,
      status: 'Waitlist',
      startDate: new Date().toISOString().split('T')[0],
      balance: 0,
      shareCapital: 0,
      residencyHistory: []
    };
    setTenants([...tenants, newApplicant]);
    setShowAddModal(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    alert("New application successfully added to the waitlist.");
  };

  return (
    <div className="space-y-6 pb-12 transition-colors duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white uppercase tracking-tight">Prospective Member Waitlist</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Managing the future of our community through fair assessment.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-plus"></i> Add New Application
        </button>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-8 animate-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight">New Waitlist Application</h3>
            <form onSubmit={handleAddApplication} className="space-y-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone Number</label>
                  <input type="text" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Desired Unit Type</label>
                  <select value={unitType} onChange={e => setUnitType(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none text-slate-900 dark:text-white">
                    <option>1BR</option>
                    <option>2BR</option>
                    <option>3BR</option>
                    <option>4BR</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-700 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-plus"></i> Add New Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FilterBar 
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search applicants by name or email..."
        filter={filter}
        onFilterChange={setFilter}
        filterOptions={['All', '1BR', '2BR', '3BR+']}
      />

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Sorted by Application Date</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/5">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Applicant</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {waitlistMembers.map(app => (
                <tr key={app.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-slate-800 dark:text-white">{app.firstName} {app.lastName}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">Reference ID: {app.id}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{app.email}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">{app.phone}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {waitlistMembers.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-12 text-center text-slate-400 text-xs italic font-medium">
                    No active applications found on the waitlist.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Waitlist;
