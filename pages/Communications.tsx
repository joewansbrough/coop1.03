
import React, { useState } from 'react';
import { MOCK_MESSAGES } from '../constants';
import { Announcement } from '../types';

const Communications: React.FC<{ 
  isAdmin: boolean, 
  announcements: Announcement[], 
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>> 
}> = ({ isAdmin, announcements, setAnnouncements }) => {
  const [activeTab, setActiveTab] = useState<'announcements' | 'messaging'>('announcements');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  
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
    <div className="h-full flex flex-col space-y-4 lg:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-slate-800">Communication Hub</h2>
          <p className="text-slate-500 text-sm hidden sm:block">Association news and direct messaging.</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => { setActiveTab('announcements'); setSelectedThread(null); }}
            className={`flex-1 sm:px-8 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'announcements' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
          >
            Broadcasts
          </button>
          <button
            onClick={() => setActiveTab('messaging')}
            className={`flex-1 sm:px-8 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'messaging' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
          >
            Direct Inbox
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'announcements' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 pb-8">
            {isAdmin && !showNewAnnouncement && (
              <button 
                onClick={() => setShowNewAnnouncement(true)}
                className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
              >
                <div className="w-14 h-14 bg-slate-50 group-hover:bg-emerald-100 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-emerald-500 mb-4">
                  <i className="fa-solid fa-plus text-2xl"></i>
                </div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-plus"></i> Add New Announcement
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-[180px]">Notify all co-op members instantly.</p>
              </button>
            )}

            {isAdmin && showNewAnnouncement && (
              <div className="bg-white p-6 rounded-3xl border-2 border-emerald-500 animate-in zoom-in-95 duration-200 flex flex-col h-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black text-emerald-600 uppercase tracking-widest">Draft Announcement</h3>
                  <button onClick={() => setShowNewAnnouncement(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <form onSubmit={handleCreateAnnouncement} className="space-y-4 flex-1 flex flex-col">
                  <div>
                    <input 
                      type="text" 
                      placeholder="Announcement Title"
                      value={newAnnTitle}
                      onChange={(e) => setNewAnnTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex-1">
                    <textarea 
                      placeholder="Write your message here..."
                      value={newAnnContent}
                      onChange={(e) => setNewAnnContent(e.target.value)}
                      className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    ></textarea>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-auto pt-4">
                    <select 
                      value={newAnnPriority}
                      onChange={(e) => setNewAnnPriority(e.target.value as 'Normal' | 'Urgent')}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest outline-none flex-shrink-0"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                    <button 
                      type="submit"
                      className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
                    >
                      <i className="fa-solid fa-paper-plane"></i> Publish
                    </button>
                  </div>
                </form>
              </div>
            )}
            {announcements.map(ann => (
              <div key={ann.id} className="bg-white p-6 rounded-3xl border border-slate-200 relative overflow-hidden flex flex-col h-full">
                {ann.priority === 'Urgent' && <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500"></div>}
                <div className="flex justify-between items-center mb-4">
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${ann.priority === 'Urgent' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                    {ann.priority}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">{ann.date}</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2 leading-tight">{ann.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-8 flex-1">{ann.content}</p>
                <div className="flex items-center gap-2 pt-4 border-t border-slate-50">
                  <div className="w-7 h-7 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-black uppercase">
                    {ann.author[0]}
                  </div>
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{ann.author}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[calc(100vh-14rem)] bg-white rounded-3xl border border-slate-200 overflow-hidden relative">
            {/* Thread List - Hidden on mobile if thread selected */}
            <div className={`
              ${selectedThread ? 'hidden md:flex' : 'flex'}
              w-full md:w-80 border-r border-slate-100 flex-col shrink-0 transition-all
            `}>
              <div className="p-4 border-b border-slate-50 flex gap-2">
                <input type="text" placeholder="Search mail..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                <button 
                  onClick={() => setShowNewMessageModal(true)}
                  className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-700 transition-all"
                  title="New Message"
                >
                  <i className="fa-solid fa-pen-to-square text-xs"></i>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {threads.map(thread => (
                  <button 
                    key={thread.id} 
                    onClick={() => setSelectedThread(thread.id)}
                    className={`w-full p-5 flex gap-4 hover:bg-slate-50 text-left transition-colors border-b border-slate-50 ${selectedThread === thread.id ? 'bg-emerald-50/50' : ''}`}
                  >
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl shrink-0 flex items-center justify-center text-slate-400 font-black text-xs">
                      {thread.participant.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{thread.participant}</h4>
                        <span className="text-[9px] text-slate-400 font-bold shrink-0">{thread.date}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate font-medium">{thread.lastMsg}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Area - Full screen on mobile if thread selected */}
            <div className={`
              ${selectedThread ? 'flex' : 'hidden md:flex'}
              flex-1 flex-col bg-slate-50/50 relative
            `}>
              {selectedThread ? (
                <>
                  <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between z-10 shrink-0">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setSelectedThread(null)}
                        className="md:hidden p-2 text-slate-400 hover:text-emerald-600"
                      >
                        <i className="fa-solid fa-chevron-left"></i>
                      </button>
                      <div className="w-8 h-8 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-black text-[10px] uppercase">
                        {selectedThread.substring(0,2)}
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">Case Support</h4>
                    </div>
                    <div className="flex gap-1">
                      <button className="p-2 text-slate-400 hover:text-slate-600"><i className="fa-solid fa-phone-flip text-xs"></i></button>
                      <button className="p-2 text-slate-400 hover:text-slate-600"><i className="fa-solid fa-ellipsis-vertical text-xs"></i></button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
                    {MOCK_MESSAGES.map(msg => (
                      <div key={msg.id} className={`flex ${msg.fromId === 't1' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] sm:max-w-[70%] p-4 rounded-2xl text-sm shadow-sm ${
                          msg.fromId === 't1' 
                            ? 'bg-slate-900 text-white rounded-br-none' 
                            : 'bg-white border border-slate-100 text-slate-800 rounded-bl-none'
                        }`}>
                          <p className="leading-relaxed font-medium">{msg.body}</p>
                          <div className={`text-[8px] mt-2 font-black uppercase tracking-widest ${msg.fromId === 't1' ? 'text-slate-400' : 'text-slate-400'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                    <div className="flex gap-2">
                      <button className="p-2.5 text-slate-400 hover:text-emerald-600 bg-slate-50 rounded-xl"><i className="fa-solid fa-paperclip"></i></button>
                      <input 
                        type="text" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Aa" 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500" 
                      />
                      <button className="bg-emerald-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                        <i className="fa-solid fa-paper-plane text-xs"></i>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6 text-slate-200">
                    <i className="fa-solid fa-comment-dots text-4xl"></i>
                  </div>
                  <h4 className="text-lg font-black text-slate-800">Direct Messaging</h4>
                  <p className="text-sm font-medium mt-2 max-w-xs">Select a contact to start a secure conversation about your unit or co-op affairs.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-700 disabled:opacity-50"
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
