import React from 'react';

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filter: string;
  onFilterChange: (value: any) => void;
  filterOptions: string[];
}

const FilterBar: React.FC<FilterBarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder = "Filter results...",
  filter,
  onFilterChange,
  filterOptions
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm flex flex-col sm:flex-row gap-4">
      <div className="flex-1 relative">
        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input
          type="text"
          placeholder={searchPlaceholder}
          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-900 dark:text-white"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl overflow-x-auto scrollbar-hide">
        {filterOptions.map(f => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${filter === f ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FilterBar;
