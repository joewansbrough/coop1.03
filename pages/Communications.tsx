
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FilterBar from '../components/FilterBar';
import { MOCK_MESSAGES } from '../constants';
import { Announcement } from '../types';

const Communications: React.FC<{ 
  isAdmin: boolean, 
  announcements: Announcement[], 
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>> 
}> = ({ isAdmin, announcements, setAnnouncements }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'announcements' | 'messaging'>('announcements');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  
  // Announcements filtering
  const [annFilter, setAnnFilter] = useState('All');
  const [annSearch, setAnnSearch] = useState('');
  
  // Announcements local UI state
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

    setAnnouncements([newAnn, ...announcements]);
    setShowNewAnnouncement(false);
    setNewAnnTitle('');
    setNewAnnContent('');
    setNewAnnPriority('Normal');
  };

  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');
  
  const handleStartNewMessage = () => {
    if (!selectedContactId) return;
    setSelectedThread(selectedContactId);
    setShowNewMessageModal(false);
    setSelectedContactId('');
  };

  const threads = MOCK_MESSAGES.length > 0 
    ? Array.from(new Set(MOCK_MESSAGES.map(m => m.fromId))).map(id => {
        const lastMsg = MOCK_MESSAGES.filter(m => m.fromId === id).pop();
        return {
          id,
          participant: id === 'admin' ? 'Co-op Management' : (id === 't1' ? 'Housing Board' : `Resident ${id}`),
          lastMsg: lastMsg?.body || '',
          date: lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          active: Math.random() > 0.5 // Mock presence
        };
      }) 
    : [];

  return (
    <div className="space-y-6 lg:space-y-8 max-w-7xl mx-auto pb-12 transition-all animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Communications</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Manage association broadcasts and secure member messaging.</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl w-full sm:w-auto ring-1 ring-inset ring-slate-200 dark:ring-white/5 backdrop-blur-xl shrink-0">
          <button
            onClick={() => { setActiveTab('announcements'); setSelectedThread(null); }}
            className={`flex-1 sm:px-10 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'announcements' ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-100'}`}
          >
            Broadcasts
          </button>
          <button
            onClick={() => setActiveTab('messaging')}
            className={`flex-1 sm:px-10 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'messaging' ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-xl shadow-brand-500/10' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-100'}`}
          >
            Direct Inbox
          </button>
        </div>
      </div>

      {activeTab === 'announcements' && (
        <FilterBar 
          search={annSearch}
          onSearchChange={setAnnSearch}
          searchPlaceholder="Search broadcasts..."
          filter={annFilter}
          onFilterChange={setAnnFilter}
          filterOptions={['All', 'Normal', 'Urgent']}
        />
      )}
      
      {activeTab === 'announcements' ? (
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
            {announcements
              .filter(ann => {
                const matchesSearch = ann.title.toLowerCase().includes(annSearch.toLowerCase()) || 
                                    ann.content.toLowerCase().includes(annSearch.toLowerCase());
                const matchesFilter = annFilter === 'All' || ann.priority === annFilter;
                return matchesSearch && matchesFilter;
              })
              .map(ann => (
              <Link 
                key={ann.id} 
                to={`/announcements/${ann.id}`}
                className="group bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 relative overflow-hidden flex flex-col h-full transition-all duration-300 hover:shadow-2xl hover:shadow-brand-500/[0.03] hover:-translate-y-2 hover:border-brand-300 dark:hover:border-brand-600 cursor-pointer active:scale-[0.98] z-10 hover:z-20 no-underline"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full -mr-16 -mt-16 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                {ann.priority === 'Urgent' && <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500 dark:bg-rose-600"></div>}
                <div className="flex justify-between items-center mb-6">
                  <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${ann.priority === 'Urgent' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                    {ann.priority}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-tight">{ann.date}</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3 leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors uppercase tracking-tight">{ann.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-8 flex-1 font-medium group-hover:text-slate-900 dark:group-hover:text-slate-300 transition-colors">{ann.content}</p>
                <div className="flex items-center gap-3 pt-6 border-t border-slate-50 dark:border-white/5">
                  <div className="w-10 h-10 bg-slate-900 dark:bg-brand-600 text-white rounded-2xl flex items-center justify-center text-xs font-black uppercase shadow-lg shadow-black/10 group-hover:bg-brand-500 group-hover:scale-110 transition-all">
                    {ann.author[0]}
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-900 dark:text-white font-black uppercase tracking-widest group-hover:text-brand-600 transition-colors">{ann.author}</span>
                    <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-widest group-hover:text-brand-400 transition-colors">Authorized Publisher</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex h-[calc(100vh-14rem)] bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden relative shadow-2xl shadow-brand-500/5">
            {/* Thread List - Hidden on mobile if thread selected */}
            <div className={`
              ${selectedThread ? 'hidden md:flex' : 'flex'}
              w-full md:w-96 border-r border-slate-100 dark:border-white/5 flex-col shrink-0 transition-all bg-white dark:bg-slate-900
            `}>
              <div className="p-6 border-b border-slate-50 dark:border-white/5 flex gap-3">
                <div className="flex-1 relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input type="text" placeholder="Search member conversations..." className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all dark:text-white" />
                </div>
                <button 
                  onClick={() => setShowNewMessageModal(true)}
                  className="w-12 h-12 bg-brand-600 text-white rounded-2xl flex items-center justify-center hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                  title="New Message"
                >
                  <i className="fa-solid fa-plus"></i>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {threads.map(thread => (
                  <button 
                    key={thread.id} 
                    onClick={() => setSelectedThread(thread.id)}
                    className={`w-full p-6 flex gap-4 hover:bg-slate-50 dark:hover:bg-brand-900/10 text-left transition-all border-b border-slate-50 dark:border-white/5 group relative active:scale-[0.98] ${selectedThread === thread.id ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''}`}
                  >
                    {selectedThread === thread.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-brand-500 rounded-r-full shadow-[4px_0_12px_rgba(var(--brand-primary),0.3)]"></div>}
                    <div className="relative">
                      <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-[1.25rem] shrink-0 flex items-center justify-center text-slate-400 dark:text-slate-500 font-black text-xs group-hover:scale-110 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 group-hover:text-brand-600 transition-all duration-300">
                        {thread.participant.split(' ').map(n => n[0]).join('')}
                      </div>
                      {thread.active && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-brand-500 border-4 border-white dark:border-slate-900 rounded-full group-hover:scale-125 transition-transform"></div>}
                    </div>
                    <div className="flex-1 overflow-hidden pt-1">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-brand-600 transition-colors">{thread.participant}</h4>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-tight shrink-0">{thread.date}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">{thread.lastMsg}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Area - Full screen on mobile if thread selected */}
            <div className={`
              ${selectedThread ? 'flex' : 'hidden md:flex'}
              flex-1 flex-col bg-slate-50/30 dark:bg-slate-950/20 relative
            `}>
              {selectedThread ? (
                <>
                  <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/5 flex items-center justify-between z-10 shrink-0">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setSelectedThread(null)}
                        className="md:hidden w-10 h-10 flex items-center justify-center text-slate-400 hover:text-brand-600 bg-slate-50 dark:bg-slate-800 rounded-xl"
                      >
                        <i className="fa-solid fa-chevron-left"></i>
                      </button>
                      <div className="relative">
                        <div className="w-12 h-12 bg-brand-600 text-white rounded-[1.25rem] flex items-center justify-center font-black text-xs uppercase shadow-lg shadow-brand-500/20">
                          {selectedThread.substring(0,2)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-brand-500 border-4 border-white dark:border-slate-900 rounded-full"></div>
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-base">Co-op Management</h4>
                        <p className="text-[10px] text-brand-500 font-black uppercase tracking-widest">Always Online</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-brand-600 transition-all"><i className="fa-solid fa-phone-flip text-xs"></i></button>
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-brand-600 transition-all"><i className="fa-solid fa-ellipsis-vertical text-xs"></i></button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-6 scrollbar-hide">
                    {MOCK_MESSAGES.map(msg => (
                      <div key={msg.id} className={`flex ${msg.fromId === 't1' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] sm:max-w-[70%] p-5 rounded-[1.75rem] text-sm shadow-xl ${
                          msg.fromId === 't1' 
                            ? 'bg-brand-600 text-white rounded-br-none shadow-brand-500/10' 
                            : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-tl-none'
                        }`}>
                          <p className="leading-relaxed font-semibold">{msg.body}</p>
                          <div className={`text-[8px] mt-3 font-black uppercase tracking-widest ${msg.fromId === 't1' ? 'text-brand-200' : 'text-slate-400 dark:text-slate-500'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Received
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 shrink-0">
                    <div className="flex gap-3">
                      <button className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-brand-600 bg-slate-50 dark:bg-slate-800 rounded-2xl transition-all hover:scale-105"><i className="fa-solid fa-paperclip"></i></button>
                      <input 
                        type="text" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a secure message..." 
                        className="flex-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/5 rounded-2xl px-6 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-all" 
                      />
                      <button className="bg-brand-600 text-white w-14 h-12 rounded-2xl flex items-center justify-center hover:bg-brand-700 transition-all shadow-xl shadow-brand-500/20 active:scale-90">
                        <i className="fa-solid fa-paper-plane text-sm"></i>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-white dark:bg-slate-900">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center mb-8 text-slate-200 dark:text-slate-700 shadow-inner">
                    <i className="fa-solid fa-comment-dots text-5xl"></i>
                  </div>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Direct Messaging</h4>
                  <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-3 max-w-xs">Select a secure conversation from the sidebar to begin.</p>
                </div>
              )}
            </div>
          </div>
      )}

      {showNewMessageModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-8 animate-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight">New Message</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Select Recipient</label>
                <select 
                  value={selectedContactId} 
                  onChange={e => setSelectedContactId(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none text-slate-900 dark:text-white"
                >
                  <option value="">Select a member...</option>
                  <option value="admin">Board Support (Admin)</option>
                  <option value="t1">Member T1</option>
                  <option value="t2">Member T2</option>
                  <option value="t3">Member T3</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowNewMessageModal(false)} className="flex-1 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                <button 
                  onClick={handleStartNewMessage} 
                  disabled={!selectedContactId}
                  className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-xs font-black uppercase hover:bg-brand-700 disabled:opacity-50"
                >
                  Start Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
  );
};

export default Communications;
