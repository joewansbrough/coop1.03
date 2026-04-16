
import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  trend?: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, trend, color }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-white/5 transition-all duration-300 group flex flex-col h-full cursor-pointer hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-2xl hover:shadow-brand-500/[0.03]">
      <div className="flex items-center justify-between mb-6">
        <div className={`w-12 h-12 rounded-2xl ${color.includes('brand') ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : color + ' text-white'} flex items-center justify-center text-xl transition-all duration-300 group-hover:scale-110 group-hover:bg-brand-50 dark:group-hover:bg-brand-900/30 group-hover:text-brand-600`}>
          <i className={`fa-solid ${icon}`}></i>
        </div>
        {trend && (
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${trend.startsWith('+') ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'}`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 group-hover:text-brand-500 transition-colors duration-300">{label}</p>
        <h3 className="text-2xl font-black text-slate-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors duration-300">{value}</h3>
      </div>
    </div>
  );
};

export default StatCard;
