
import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import StatCard from '../components/StatCard';
import { MOCK_UNITS, MOCK_REQUESTS } from '../constants';
import { MaintenanceCategory } from '../types';
import { Link } from 'react-router-dom';

const Reports: React.FC = () => {
  // Maintenance Expenditure States
  const [maintCategory, setMaintCategory] = useState<string>('All');
  const [maintUnit, setMaintUnit] = useState<string>('All');
  const [maintUrgency, setMaintUrgency] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const occupancyData: { month: string; rate: number }[] = [];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1', '#ec4899', '#94a3b8'];

  // Analytical Logic for Maintenance Spending
  const filteredMaintData = useMemo(() => {
    return MOCK_REQUESTS.filter(req => {
      const matchCat = maintCategory === 'All' || req.category.includes(maintCategory as MaintenanceCategory);
      const matchUnit = maintUnit === 'All' || req.unitId === maintUnit;
      const matchUrgency = maintUrgency === 'All' || req.urgency === maintUrgency;
      const date = new Date(req.createdAt).getTime();
      const matchStart = !startDate || date >= new Date(startDate).getTime();
      const matchEnd = !endDate || date <= new Date(endDate).getTime();
      return matchCat && matchUnit && matchUrgency && matchStart && matchEnd;
    });
  }, [maintCategory, maintUnit, maintUrgency, startDate, endDate]);

  const totalSpend = useMemo(() => {
    return filteredMaintData.reduce((acc, req) => 
      acc + req.expenses.reduce((eAcc, exp) => eAcc + exp.cost, 0), 0
    );
  }, [filteredMaintData]);

  const avgCost = filteredMaintData.length > 0 ? totalSpend / filteredMaintData.length : 0;

  const costByCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredMaintData.forEach(req => {
      const reqSpend = req.expenses.reduce((acc, exp) => acc + exp.cost, 0);
      req.category.forEach(cat => {
        map[cat] = (map[cat] || 0) + (reqSpend / req.category.length);
      });
    });
    return Object.entries(map).map(([name, spend]) => ({ name, spend }));
  }, [filteredMaintData]);

  const topSpendingUnit = useMemo(() => {
    const map: Record<string, number> = {};
    filteredMaintData.forEach(req => {
      const spend = req.expenses.reduce((acc, exp) => acc + exp.cost, 0);
      map[req.unitId] = (map[req.unitId] || 0) + spend;
    });
    const top = Object.entries(map).sort((a,b) => b[1] - a[1])[0];
    if (!top) return 'N/A';
    const unit = MOCK_UNITS.find(u => u.id === top[0]);
    return `Unit ${unit?.number || top[0]}`;
  }, [filteredMaintData]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Board Insight Center</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Strategic operational data for governance and long-term planning.</p>
        </div>
        <button 
          onClick={() => {
            alert("Generating PDF Export... Your report will be available for download in a few moments.");
            setTimeout(() => {
              const link = document.createElement('a');
              link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent('Mock PDF content for Board Insight Center Report');
              link.download = 'Coop_Insight_Report.pdf';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }, 1500);
          }} 
          className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95"
        >
          <i className="fa-solid fa-file-export"></i> Generate PDF Export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Response Time" value="N/A" icon="fa-clock" color="bg-emerald-500" />
        <StatCard label="Waitlist Volume" value="0 Families" icon="fa-users-line" color="bg-blue-500" />
        <StatCard label="Reserve Health" value="Stable" icon="fa-vault" color="bg-purple-500" />
        <StatCard label="Service Burn" value={`$${totalSpend.toLocaleString()}`} icon="fa-wrench" color="bg-rose-500" />
      </div>

      {/* NEW: Maintenance Financial Audit Panel */}
      <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden">
        <div className="p-8 border-b border-slate-50 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Maintenance Financial Audit</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Cross-unit cost analysis and categorical spending triggers.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-1">
                 <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Period Start</span>
                 <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-[10px] font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex flex-col gap-1">
                 <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Period End</span>
                 <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-[10px] font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex flex-col gap-1">
                 <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Unit Asset</span>
                 <select value={maintUnit} onChange={e => setMaintUnit(e.target.value)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-[10px] font-bold dark:text-white outline-none">
                    <option value="All">Global Association</option>
                    {MOCK_UNITS.map(u => <option key={u.id} value={u.id}>Unit {u.number}</option>)}
                 </select>
              </div>
              <div className="flex flex-col gap-1">
                 <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Type Filter</span>
                 <select value={maintCategory} onChange={e => setMaintCategory(e.target.value)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-[10px] font-bold dark:text-white outline-none">
                    <option value="All">All Categories</option>
                    <option>Plumbing</option><option>Electrical</option><option>Structural</option><option>HVAC</option>
                 </select>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-white/5 relative overflow-hidden">
                 <div className="absolute right-0 top-0 p-4 opacity-[0.03] text-6xl text-slate-900 dark:text-white"><i className="fa-solid fa-money-bill-trend-up"></i></div>
                 <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Audit Period Spend</p>
                 <h4 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">${totalSpend.toLocaleString()}</h4>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-white/5 relative overflow-hidden">
                 <div className="absolute right-0 top-0 p-4 opacity-[0.03] text-6xl text-slate-900 dark:text-white"><i className="fa-solid fa-calculator"></i></div>
                 <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Average Repair Index</p>
                 <h4 className="text-3xl font-black text-blue-600 dark:text-blue-400">${avgCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h4>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-white/5 relative overflow-hidden">
                 <div className="absolute right-0 top-0 p-4 opacity-[0.03] text-6xl text-slate-900 dark:text-white"><i className="fa-solid fa-building-circle-exclamation"></i></div>
                 <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">High-Spend Asset</p>
                 <h4 className="text-3xl font-black text-amber-600 dark:text-amber-400">{topSpendingUnit}</h4>
              </div>
           </div>

           <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
             <table className="w-full text-left">
               <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-white/5">
                 <tr>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Effective Date</th>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset/Unit</th>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Incident</th>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Investment</th>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Reference</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                 {filteredMaintData.length > 0 ? filteredMaintData.map(req => {
                   const spend = req.expenses.reduce((acc, exp) => acc + exp.cost, 0);
                   const unit = MOCK_UNITS.find(u => u.id === req.unitId);
                   return (
                     <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                       <td className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400">{new Date(req.createdAt).toLocaleDateString()}</td>
                       <td className="px-6 py-4 text-sm font-black text-slate-800 dark:text-slate-200">Unit {unit?.number || 'Common'}</td>
                       <td className="px-6 py-4 text-xs font-medium text-slate-600 dark:text-slate-400 max-w-xs truncate">{req.description}</td>
                       <td className="px-6 py-4 text-sm font-black text-slate-900 dark:text-white text-right">${spend.toLocaleString()}</td>
                       <td className="px-6 py-4 text-right">
                         <Link to={`/admin/maintenance/${req.id}`} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-all shadow-sm mx-auto">
                            <i className="fa-solid fa-arrow-right-long text-xs"></i>
                         </Link>
                       </td>
                     </tr>
                   );
                 }) : (
                   <tr>
                     <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs italic font-medium">No archived records match the active criteria.</td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </section>
    </div>
  );
};

export default Reports;
