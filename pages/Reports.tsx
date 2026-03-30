
import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import StatCard from '../components/StatCard';
import { MOCK_UNITS, MOCK_REQUESTS } from '../constants';
import { MaintenanceCategory, MaintenancePriority } from '../types';
import { Link } from 'react-router-dom';

const Reports: React.FC = () => {
  // Maintenance Expenditure States
  const [maintCategory, setMaintCategory] = useState<string>('All');
  const [maintUnit, setMaintUnit] = useState<string>('All');
  const [maintPriority, setMaintPriority] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const occupancyData: { month: string; rate: number }[] = [];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1', '#ec4899', '#94a3b8'];

  // Analytical Logic for Maintenance Spending
  const filteredMaintData = useMemo(() => {
    return MOCK_REQUESTS.filter(req => {
      const matchCat = maintCategory === 'All' || req.category.includes(maintCategory as MaintenanceCategory);
      const matchUnit = maintUnit === 'All' || req.unitId === maintUnit;
      const matchPriority = maintPriority === 'All' || req.priority === maintPriority;
      const date = new Date(req.createdAt).getTime();
      const matchStart = !startDate || date >= new Date(startDate).getTime();
      const matchEnd = !endDate || date <= new Date(endDate).getTime();
      return matchCat && matchUnit && matchPriority && matchStart && matchEnd;
    });
  }, [maintCategory, maintUnit, maintPriority, startDate, endDate]);

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
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium font-medium">Strategic operational data for governance and long-term planning.</p>
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
        <StatCard label="Occupancy Rate" value={`${MOCK_UNITS.length > 0 ? Math.round((MOCK_UNITS.filter(u => u.status === 'Occupied').length / MOCK_UNITS.length) * 100) : 0}%`} icon="fa-building-circle-check" color="bg-purple-500" />
        <StatCard label="Active Service" value={MOCK_REQUESTS.filter(r => r.status !== 'Completed' && r.status !== 'Cancelled').length} icon="fa-wrench" color="bg-rose-500" />
      </div>
    </div>
  );
};

export default Reports;
