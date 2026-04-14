'use client';

import React from 'react';

export default function ReportsPage() {
  return (
    <div className="max-w-7xl mx-auto py-12 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-12 text-center border border-slate-200 dark:border-white/5">
        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-4xl mx-auto mb-8 animate-pulse">
          <i className="fa-solid fa-chart-line"></i>
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4">Financial Reports</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-10 font-medium">
          Detailed financial analytics and association performance reporting is currently under development.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-white/5">
          <i className="fa-solid fa-clock-rotate-left"></i> Coming Soon — Q3 2025
        </div>
      </div>
    </div>
  );
}
