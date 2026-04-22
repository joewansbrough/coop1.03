
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
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[20px] border border-slate-200 dark:border-white/5 transition-all duration-300 group flex flex-col h-full cursor-pointer hover:border-teal-accent hover:shadow-accent">
      <div className="flex items-center justify-between mb-6">
        <div className={`w-12 h-12 rounded-[20px] ${color.includes('brand') ? 'bg-teal-accent/10 text-teal-accent' : color + ' text-white'} flex items-center justify-center text-xl transition-all duration-300 group-hover:scale-110`}>
          <i className={`fa-solid ${icon}`}></i>
        </div>
        {trend && (
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${trend.startsWith('+') ? 'bg-teal-accent/10 text-teal-accent' : 'bg-rose-50 text-rose-600'}`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1 group-hover:text-teal-accent transition-colors duration-300">{label}</p>
        <h3 className="text-2xl font-black text-slate-900 dark:text-white group-hover:text-teal-accent transition-colors duration-300">{value}</h3>
      </div>
    </div>
  );
};

export default StatCard;
