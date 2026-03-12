
import React, { useState } from 'react';
import { MOCK_MESSAGES } from '../constants';
import { Announcement } from '../types';

const Communications: React.FC<{ 
  isAdmin: boolean, 
  isGuest?: boolean,
  announcements: Announcement[], 
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>> 
}> = ({ isAdmin, isGuest = false, announcements, setAnnouncements }) => {
  const [activeTab, setActiveTab] = useState<'announcements' | 'messaging'>('announcements');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  
  // Announcements local UI state
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false);
  const [editAnn, setEditAnn] = useState<Announcement | null>(null);
  
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnPriority, setNewAnnPriority] = useState<'Normal' | 'Urgent'>('Normal');

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest || !newAnnTitle || !newAnnContent) return;

    const payload = {
      title: newAnnTitle,
      content: newAnnContent,
      type: 'General',
      author: 'Board Administration',
      date: new Date().toISOString().split('T')[0],
      priority: newAnnPriority
    };

    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setAnnouncements([data, ...announcements]);
      setShowNewAnnouncement(false);
      setNewAnnTitle('');
      setNewAnnContent('');
      setNewAnnPriority('Normal');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest || !editAnn) return;

    try {
      const res = await fetch(`/api/announcements/${editAnn.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editAnn)
      });
      const data = await res.json();
      setAnnouncements(announcements.map(a => a.id === data.id ? data : a));
      setEditAnn(null);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (isGuest) return;
    if (!window.confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
      setAnnouncements(announcements.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');
  
  const handleStartNewMessage = () => {
    if (!selectedContactId) return;
    setSelectedThread(selectedContactId);
    setShowNewMessageModal(false);
    setSelectedContactId('');
  };

  const threads = MOCK_MESSAGES.length > 0 ? Array.from(new Set(MOCK_MESSAGES.map(m => m.fromId))).map(id => {
    const lastMsg = MOCK_MESSAGES.filter(m => m.fromId === id).pop();
    return {
      id,
      participant: id === 'admin' ? 'Board Support' : `Member ${id}`,
      lastMsg: lastMsg?.body || '',
      date: lastMsg ? new Date(lastMsg.timestamp).toLocaleDateString() : ''
    };
  }) : [];

  return (
    <div className="h-full flex flex-col space-y-4 lg:space-y-6 max-w-7xl mx-auto transition-colors duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Communication Hub</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm hidden sm:block">Association news and direct messaging.</p>
        </div>
        <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl w-full sm:w-auto">
          <button 
            onClick={() => { setActiveTab('announcements'); setSelectedThread(null); }}
            className={`flex-1 sm:px-8 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'announcements' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
          >
            Broadcasts
          </button>
          <button 
            onClick={() => setActiveTab('messaging')}
            className={`flex-1 sm:px-8 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'messaging' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
          >
            Direct Inbox
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'announcements' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 pb-8">
            {isAdmin && !isGuest && !showNewAnnouncement && !editAnn && (
              <button 
                onClick={() => setShowNewAnnouncement(true)}
                className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group min-h-[300px]"
              >
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-700 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 mb-6 transition-all">
                  <i className="fa-solid fa-plus text-3xl"></i>
                </div>
                <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">
                  Create Announcement
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-2 max-w-[180px]">Notify all co-op members instantly via portal and email.</p>
              </button>
            )}

            {isAdmin && !isGuest && (showNewAnnouncement || editAnn) && (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border-2 border-emerald-500 shadow-xl shadow-emerald-500/10 animate-in zoom-in-95 duration-200 flex flex-col h-full min-h-[300px]">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em]">{editAnn ? 'Modify Broadcast' : 'Draft New Broadcast'}</h3>
                  <button onClick={() => { setShowNewAnnouncement(false); setEditAnn(null); }} className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"><i className="fa-solid fa-xmark text-sm"></i></button>
                </div>
                <form onSubmit={editAnn ? handleUpdateAnnouncement : handleCreateAnnouncement} className="space-y-5 flex-1 flex flex-col">
                  <div>
                    <input 
                      type="text" 
                      placeholder="Catchy Headline"
                      value={editAnn ? editAnn.title : newAnnTitle}
                      onChange={(e) => editAnn ? setEditAnn({...editAnn, title: e.target.value}) : setNewAnnTitle(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex-1">
                    <textarea 
                      placeholder="Type your message to the community..."
                      value={editAnn ? editAnn.content : newAnnContent}
                      onChange={(e) => editAnn ? setEditAnn({...editAnn, content: e.target.value}) : setNewAnnContent(e.target.value)}
                      className="w-full h-full min-h-[120px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-slate-700 dark:text-slate-300"
                    ></textarea>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-auto pt-4">
                    <select 
                      value={editAnn ? editAnn.priority : newAnnPriority}
                      onChange={(e) => {
                        const val = e.target.value as 'Normal' | 'Urgent';
                        editAnn ? setEditAnn({...editAnn, priority: val}) : setNewAnnPriority(val);
                      }}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none text-slate-600 dark:text-slate-400"
                    >
                      <option value="Normal">Normal Priority</option>
                      <option value="Urgent">Urgent Priority</option>
                    </select>
                    <button 
                      type="submit"
                      className="bg-emerald-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap shadow-lg shadow-emerald-500/20"
                    >
                      <i className={`fa-solid ${editAnn ? 'fa-save' : 'fa-paper-plane'}`}></i> {editAnn ? 'Update' : 'Publish'}
                    </button>
                  </div>
                </form>
              </div>
            )}
            {announcements.map(ann => (
              <div key={ann.id} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 relative overflow-hidden flex flex-col h-full group transition-all hover:border-emerald-200 dark:hover:border-emerald-500/30">
                {ann.priority === 'Urgent' && <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500"></div>}
                <div className="flex justify-between items-start mb-6">
                  <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${ann.priority === 'Urgent' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                    {ann.priority}
                  </span>
                  <div className="flex items-center gap-3">
                    {isAdmin && !isGuest && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditAnn(ann)} className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-amber-600 hover:bg-amber-100 transition-colors"><i className="fa-solid fa-pen text-[10px]"></i></button>
                        <button onClick={() => deleteAnnouncement(ann.id)} className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-rose-600 hover:bg-rose-100 transition-colors"><i className="fa-solid fa-trash text-[10px]"></i></button>
                      </div>
                    )}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-tighter">{ann.date}</span>
                  </div>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3 leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{ann.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-8 flex-1 line-clamp-4 font-medium">{ann.content}</p>
                <div className="flex items-center gap-3 pt-6 border-t border-slate-50 dark:border-white/5">
                  <div className="w-8 h-8 bg-slate-900 dark:bg-emerald-600 text-white rounded-xl flex items-center justify-center text-[10px] font-black uppercase ring-4 ring-slate-100 dark:ring-emerald-900/20">
                    {ann.author[0]}
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest leading-none mb-1">Posted By</span>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">{ann.author}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[calc(100vh-16rem)] bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden relative shadow-sm">
            <div className={`
              ${selectedThread ? 'hidden md:flex' : 'flex'}
              w-full md:w-96 border-r border-slate-100 dark:border-white/5 flex-col shrink-0 transition-all
            `}>
              <div className="p-6 border-b border-slate-50 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/20 flex gap-3">
                <div className="flex-1 relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input type="text" placeholder="Search mail..." className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" />
                </div>
                <button 
                  onClick={() => setShowNewMessageModal(true)}
                  className="w-11 h-11 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
                  title="New Message"
                >
                  <i className="fa-solid fa-pen-to-square text-xs"></i>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {threads.map(thread => (
                  <button 
                    key={thread.id} 
                    onClick={() => setSelectedThread(thread.id)}
                    className={`w-full p-6 flex gap-4 hover:bg-slate-50 dark:hover:bg-white/5 text-left transition-colors border-b border-slate-50 dark:border-white/5 group ${selectedThread === thread.id ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-l-4 border-l-emerald-500' : 'border-l-4 border-l-transparent'}`}
                  >
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl shrink-0 flex items-center justify-center text-slate-400 dark:text-slate-500 font-black text-xs uppercase group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                      {thread.participant.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">{thread.participant}</h4>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase shrink-0">{thread.date}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">{thread.lastMsg}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className={`
              ${selectedThread ? 'flex' : 'hidden md:flex'}
              flex-1 flex-col bg-slate-50/30 dark:bg-slate-950/20 relative
            `}>
              {selectedThread ? (
                <>
                  <div className="p-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/5 flex items-center justify-between z-10 shrink-0 shadow-sm">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setSelectedThread(null)}
                        className="md:hidden w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-emerald-600"
                      >
                        <i className="fa-solid fa-chevron-left"></i>
                      </button>
                      <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-black text-xs uppercase shadow-lg shadow-emerald-500/20">
                        {selectedThread.substring(0,2)}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight">Case Support Channel</h4>
                        <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest">Active Thread</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition-all"><i className="fa-solid fa-phone-flip text-xs"></i></button>
                      <button className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition-all"><i className="fa-solid fa-ellipsis-vertical text-xs"></i></button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-6 scrollbar-hide">
                    {MOCK_MESSAGES.map(msg => (
                      <div key={msg.id} className={`flex ${msg.fromId === 't1' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] sm:max-w-[70%] p-5 rounded-[2rem] text-sm shadow-sm relative ${
                          msg.fromId === 't1' 
                            ? 'bg-slate-900 dark:bg-emerald-600 text-white rounded-br-none' 
                            : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-bl-none'
                        }`}>
                          <p className="leading-relaxed font-medium">{msg.body}</p>
                          <div className={`text-[8px] mt-3 font-black uppercase tracking-[0.2em] ${msg.fromId === 't1' ? 'text-white/50' : 'text-slate-400'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 shrink-0">
                    <div className="flex gap-3">
                      <button className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-emerald-600 bg-slate-50 dark:bg-slate-800 rounded-2xl transition-all border border-transparent hover:border-emerald-500/20"><i className="fa-solid fa-paperclip text-lg"></i></button>
                      <input 
                        type="text" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..." 
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" 
                      />
                      <button className="bg-emerald-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                        <i className="fa-solid fa-paper-plane text-sm"></i>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-32 h-32 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-white/5 flex items-center justify-center mb-10 shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <i className="fa-solid fa-comment-dots text-6xl text-slate-200 dark:text-slate-800"></i>
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Direct Access Mode</h4>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-4 max-w-[280px] leading-relaxed">Select a contact to begin a private, end-to-end encrypted session with co-op support or neighbors.</p>
                  <button onClick={() => setShowNewMessageModal(true)} className="mt-10 px-8 py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-500/20">Compose New Message</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showNewMessageModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-10 animate-in zoom-in-95 duration-200 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-8 uppercase tracking-tight">Direct Message</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Select Recipient Profile</label>
                <select 
                  value={selectedContactId} 
                  onChange={e => setSelectedContactId(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                >
                  <option value="">Search directory...</option>
                  <option value="admin">Board Operations (Admin)</option>
                  <option value="t1">Unit 101 - J. Doe</option>
                  <option value="t2">Unit 204 - S. Smith</option>
                  <option value="t3">Unit 402 - R. Wilson</option>
                </select>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setShowNewMessageModal(false)} className="flex-1 py-4 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Cancel</button>
                <button 
                  onClick={handleStartNewMessage} 
                  disabled={!selectedContactId}
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  Establish Link
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
