import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FilterBar from '../components/FilterBar';
import { Announcement } from '../types';
import { useCreateAnnouncement } from '../hooks/useCoopData';
import { sortNewestFirst } from '../utils/contentOrdering';

const Communications: React.FC<{
  isAdmin: boolean,
  announcements: Announcement[],
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>
}> = ({ isAdmin, announcements, setAnnouncements }) => {
  const [searchParams] = useSearchParams();
  const [annFilter, setAnnFilter] = useState('All');
  const [annSearch, setAnnSearch] = useState('');
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnPriority, setNewAnnPriority] = useState<'Normal' | 'Urgent'>('Normal');

  const createAnnouncementMutation = useCreateAnnouncement();

  useEffect(() => {
    if (searchParams.get('action') === 'new-broadcast' && isAdmin) {
      setShowNewAnnouncement(true);
    }
  }, [searchParams, isAdmin]);

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle || !newAnnContent) return;

    const payload: Omit<Announcement, 'id'> = {
      title: newAnnTitle,
      content: newAnnContent,
      type: 'General',
      author: 'Management',
      date: new Date().toISOString().split('T')[0],
      priority: newAnnPriority
    };

    createAnnouncementMutation.mutate(payload, {
      onSuccess: (data) => {
        setAnnouncements((current) => [data, ...current]);
        setShowNewAnnouncement(false);
        setNewAnnTitle('');
        setNewAnnContent('');
        setNewAnnPriority('Normal');
      }
    });
  };

  const filteredAnnouncements = sortNewestFirst(announcements.filter((announcement) => {
    const matchesSearch =
      announcement.title.toLowerCase().includes(annSearch.toLowerCase()) ||
      announcement.content.toLowerCase().includes(annSearch.toLowerCase());
    const matchesFilter = annFilter === 'All' || announcement.priority === annFilter;
    return matchesSearch && matchesFilter;
  }));

  return (
    <div className="space-y-6 lg:space-y-8 max-w-7xl mx-auto pb-12 transition-all animate-in fade-in duration-500" data-demo-target="community-communications">
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

      {isAdmin && showNewAnnouncement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-8 animate-in zoom-in-95 duration-200 shadow-2xl border border-slate-200 dark:border-white/5">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tight">
                <i className="fa-solid fa-bullhorn text-brand-600"></i>
                New Broadcast
              </h3>
              <button onClick={() => setShowNewAnnouncement(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleCreateAnnouncement} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Broadcast Title</label>
                <input
                  type="text"
                  required
                  placeholder="Give your announcement a clear title"
                  value={newAnnTitle}
                  onChange={(e) => setNewAnnTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Priority</label>
                <select
                  value={newAnnPriority}
                  onChange={(e) => setNewAnnPriority(e.target.value as 'Normal' | 'Urgent')}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                >
                  <option value="Normal">Normal Priority</option>
                  <option value="Urgent">Urgent Broadcast</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Message</label>
                <textarea
                  required
                  placeholder="Provide all essential details for members..."
                  value={newAnnContent}
                  onChange={(e) => setNewAnnContent(e.target.value)}
                  className="w-full h-40 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 resize-none text-slate-900 dark:text-white"
                ></textarea>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewAnnouncement(false)}
                  className="flex-1 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-xs font-black uppercase hover:bg-brand-700 active:scale-95 transition-all"
                >
                  <i className="fa-solid fa-paper-plane mr-2"></i>
                  Send Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isAdmin && (
          <button
            onClick={() => setShowNewAnnouncement(true)}
            data-demo-target="communications-new-broadcast"
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

        {filteredAnnouncements.map((announcement, index) => (
          <Link
            key={announcement.id}
            to={`/announcements/${announcement.id}`}
            data-demo-target={index === 0 ? 'communications-first-broadcast' : undefined}
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
