import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import FilterBar from '../components/FilterBar';
import { Announcement } from '../types';

const Communications: React.FC<{
  isAdmin: boolean,
  announcements: Announcement[],
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>
}> = ({ isAdmin, announcements, setAnnouncements }) => {
  const [annFilter, setAnnFilter] = useState('All');
  const [annSearch, setAnnSearch] = useState('');
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnPriority, setNewAnnPriority] = useState<'Normal' | 'Urgent'>('Normal');

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle || !newAnnContent) return;

    const newAnn: Announcement = {
      id: `a${Date.now()}`,
      title: newAnnTitle,
      content: newAnnContent,
      type: 'General',
      author: 'Management',
      date: new Date().toISOString().split('T')[0],
      priority: newAnnPriority
    };

    setAnnouncements((current) => [newAnn, ...current]);
    setShowNewAnnouncement(false);
    setNewAnnTitle('');
    setNewAnnContent('');
    setNewAnnPriority('Normal');
  };

  const filteredAnnouncements = announcements.filter((announcement) => {
    const matchesSearch =
      announcement.title.toLowerCase().includes(annSearch.toLowerCase()) ||
      announcement.content.toLowerCase().includes(annSearch.toLowerCase());
    const matchesFilter = annFilter === 'All' || announcement.priority === annFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 lg:space-y-8 max-w-7xl mx-auto pb-12 transition-all animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Communications
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Manage live association broadcasts.
          </p>
        </div>
      </div>

      <FilterBar
        search={annSearch}
        onSearchChange={setAnnSearch}
        searchPlaceholder="Search broadcasts..."
        filter={annFilter}
        onFilterChange={setAnnFilter}
        filterOptions={['All', 'Normal', 'Urgent']}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isAdmin && !showNewAnnouncement && (
          <button
            onClick={() => setShowNewAnnouncement(true)}
            className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-all group"
          >
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 rounded-3xl flex items-center justify-center text-slate-300 dark:text-slate-700 group-hover:text-brand-500 mb-6 transition-all duration-300">
              <i className="fa-solid fa-plus text-3xl"></i>
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-2 px-6">
              Broadcast to Association
            </h3>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-1 max-w-[220px]">Post a new building-wide announcement</p>
          </button>
        )}

        {isAdmin && showNewAnnouncement && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border-2 border-brand-500 shadow-2xl shadow-brand-500/10 animate-in zoom-in-95 duration-200 flex flex-col h-full relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-brand-500"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-[0.2em]">New Broadcast Draft</h3>
              <button onClick={() => setShowNewAnnouncement(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 transition-colors"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <form onSubmit={handleCreateAnnouncement} className="space-y-4 flex-1 flex flex-col">
              <div>
                <input
                  type="text"
                  placeholder="Give your announcement a clear title"
                  value={newAnnTitle}
                  onChange={(e) => setNewAnnTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl px-5 py-3.5 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>
              <div className="flex-1">
                <textarea
                  placeholder="Provide all essential details for members..."
                  value={newAnnContent}
                  onChange={(e) => setNewAnnContent(e.target.value)}
                  className="w-full h-40 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl px-5 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500 resize-none dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                ></textarea>
              </div>
              <div className="flex items-center justify-between gap-4 mt-auto pt-6 border-t border-slate-50 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-flag text-xs text-slate-400"></i>
                  <select
                    value={newAnnPriority}
                    onChange={(e) => setNewAnnPriority(e.target.value as 'Normal' | 'Urgent')}
                    className="bg-transparent text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest outline-none cursor-pointer hover:text-brand-500 transition-colors"
                  >
                    <option value="Normal">Normal Priority</option>
                    <option value="Urgent">Urgent Broadcast</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="bg-brand-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand-700 transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-brand-500/20"
                >
                  <i className="fa-solid fa-paper-plane mr-1"></i> Send Now
                </button>
              </div>
            </form>
          </div>
        )}

        {filteredAnnouncements.map((announcement) => (
          <Link
            key={announcement.id}
            to={`/announcements/${announcement.id}`}
            className="group bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 relative overflow-hidden flex flex-col h-full transition-all duration-300 hover:shadow-2xl hover:shadow-brand-500/[0.03] hover:-translate-y-2 hover:border-brand-300 dark:hover:border-brand-600 cursor-pointer active:scale-[0.98] z-10 hover:z-20 no-underline"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full -mr-16 -mt-16 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            {announcement.priority === 'Urgent' && <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500 dark:bg-rose-600"></div>}
            <div className="flex justify-between items-center mb-6">
              <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${announcement.priority === 'Urgent' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                {announcement.priority}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-tight">{announcement.date}</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3 leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors uppercase tracking-tight">{announcement.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-8 flex-1 font-medium group-hover:text-slate-900 dark:group-hover:text-slate-300 transition-colors">{announcement.content}</p>
            <div className="flex items-center gap-3 pt-6 border-t border-slate-50 dark:border-white/5">
              <div className="w-10 h-10 bg-slate-900 dark:bg-brand-600 text-white rounded-2xl flex items-center justify-center text-xs font-black uppercase shadow-lg shadow-black/10 group-hover:bg-brand-500 group-hover:scale-110 transition-all">
                {announcement.author[0]}
              </div>
              <div>
                <span className="block text-[10px] text-slate-900 dark:text-white font-black uppercase tracking-widest group-hover:text-brand-600 transition-colors">{announcement.author}</span>
                <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-widest group-hover:text-brand-400 transition-colors">Authorized Publisher</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Communications;
