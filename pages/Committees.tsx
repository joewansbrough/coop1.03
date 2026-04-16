import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Committee, Tenant, Document } from '../types';

interface CommitteesProps {
  isAdmin: boolean;
  isGuest?: boolean;
  committees: Committee[];
  setCommittees: React.Dispatch<React.SetStateAction<Committee[]>>;
  tenants: Tenant[];
  documents?: Document[];
}

const Committees: React.FC<CommitteesProps> = ({ isAdmin, isGuest = false, committees, setCommittees, tenants, documents = [] }) => {
  const location = useLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showAddCommittee, setShowAddCommittee] = useState(false);
  const [showAssignMember, setShowAssignMember] = useState<string | null>(null);
  
  const [msgBody, setMsgBody] = useState('');
  const [sentStatus, setSentStatus] = useState(false);
  
  const [newCommitteeName, setNewCommitteeName] = useState('');
  const [newCommitteeDesc, setNewCommitteeDesc] = useState('');
  const [newCommitteeChair, setNewCommitteeChair] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (id && Array.isArray(committees) && committees.some(c => c.id === id)) {
      setSelectedId(id);
    }
  }, [location.search, committees]);

  const selectedCommittee = Array.isArray(committees) ? committees.find(c => c.id === selectedId) : null;
  const committeeDocs = Array.isArray(documents) && selectedCommittee
    ? documents.filter(d => 
        d.committee === selectedCommittee.name || 
        (d.tags && d.tags.some(tag => tag.toLowerCase() === selectedCommittee.name.toLowerCase())) ||
        d.category === selectedCommittee.name ||
        d.title.toLowerCase().includes(selectedCommittee.name.toLowerCase())
      )
    : [];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      alert("Guest accounts cannot send inquiries.");
      return;
    }
    setSentStatus(true);
    setTimeout(() => {
      setSentStatus(false);
      setShowContact(false);
      setMsgBody('');
      alert("Message broadcasted to committee members!");
    }, 2000);
  };

  const handleUploadMinute = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) return;
    alert("Minutes successfully uploaded to General Library. Members will be notified.");
    setShowUpload(false);
  };

  const handleAddCommittee = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) return;
    const newCommittee: Committee = {
      id: `c${Date.now()}`,
      name: newCommitteeName,
      description: newCommitteeDesc,
      chair: newCommitteeChair,
      members: [newCommitteeChair],
      icon: 'fa-users'
    };
    setCommittees([...committees, newCommittee]);
    setShowAddCommittee(false);
    setNewCommitteeName('');
    setNewCommitteeDesc('');
    setNewCommitteeChair('');
    alert("New committee successfully created.");
  };

  const handleAssignMember = (committeeId: string) => {
    if (isGuest) return;
    const tenant = tenants.find(t => t.id === selectedMemberId);
    if (!tenant) return;
    
    const memberName = `${tenant.firstName} ${tenant.lastName}`;
    
    setCommittees(committees.map(c => {
      if (c.id === committeeId) {
        if (c.members.includes(memberName)) {
          alert("Member is already in this committee.");
          return c;
        }
        return { ...c, members: [...c.members, memberName] };
      }
      return c;
    }));
    setShowAssignMember(null);
    setSelectedMemberId('');
    alert(`${memberName} has been assigned to the committee.`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Member Committees</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Empowering our community through collective action and self-governance.</p>
        </div>
        {isAdmin && !isGuest && !selectedId && (
          <button 
            onClick={() => setShowAddCommittee(true)}
            className="bg-brand-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-plus"></i> Add New Committee
          </button>
        )}
      </div>

      {showAddCommittee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-8 animate-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight">Create New Committee</h3>
            <form onSubmit={handleAddCommittee} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Committee Name</label>
                <input type="text" required value={newCommitteeName} onChange={e => setNewCommitteeName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</label>
                <textarea required value={newCommitteeDesc} onChange={e => setNewCommitteeDesc(e.target.value)} rows={3} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white resize-none" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Committee Chair</label>
                <select required value={newCommitteeChair} onChange={e => setNewCommitteeChair(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none text-slate-900 dark:text-white">
                  <option value="">Select a member...</option>
                  {tenants.filter(t => t.status === 'Current').map(t => (
                    <option key={t.id} value={`${t.firstName} ${t.lastName}`}>{t.firstName} {t.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddCommittee(false)} className="flex-1 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-xs font-black uppercase hover:bg-brand-700 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-plus"></i> Add New Committee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignMember && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-8 animate-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight">Assign Member to Committee</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Select Member</label>
                <select value={selectedMemberId} onChange={e => setSelectedMemberId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none text-slate-900 dark:text-white">
                  <option value="">Select a member...</option>
                  {tenants.filter(t => t.status === 'Current').map(t => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAssignMember(null)} className="flex-1 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                <button onClick={() => handleAssignMember(showAssignMember)} className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-xs font-black uppercase hover:bg-brand-700 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-plus"></i> Assign Member
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {committees.map(committee => (
            <div
              key={committee.id}
              onClick={() => setSelectedId(committee.id)}
              className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-white/5 hover:border-brand-400 dark:hover:border-brand-500/50 hover:-translate-y-1 transition-all text-left group overflow-hidden relative cursor-pointer"
            >
              <div className="absolute -right-8 -bottom-8 opacity-[0.03] text-9xl group-hover:opacity-[0.08] transition-opacity">
                <i className={`fa-solid ${committee.icon}`}></i>
              </div>
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/20 rounded-2xl flex items-center justify-center text-brand-600 dark:text-brand-400 text-3xl group-hover:scale-110 transition-transform">
                  <i className={`fa-solid ${committee.icon}`}></i>
                </div>
                <div className="flex gap-2">
                  {isAdmin && !isGuest && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowAssignMember(committee.id); }}
                      className="p-2 text-slate-400 hover:text-brand-500 transition-colors"
                      title="Assign Member"
                    >
                      <i className="fa-solid fa-user-plus"></i>
                    </button>
                  )}
                  <div className="p-2 text-slate-400 group-hover:text-brand-500 transition-colors">
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2 relative z-10 uppercase tracking-tight">{committee.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6 line-clamp-3 relative z-10">{committee.description}</p>
              <div className="flex items-center justify-between pt-6 border-t border-slate-50 dark:border-white/5 relative z-10">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Led by</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{committee.chair}</span>
                </div>
                <div className="flex -space-x-2">
                  {committee.members.slice(0, 3).map((m, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-black text-slate-400">
                      {m.split(' ').map(n => n[0]).join('')}
                    </div>
                  ))}
                  {committee.members.length > 3 && (
                    <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-900/30 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-black text-brand-600">
                      +{committee.members.length - 3}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <button 
            onClick={() => { setSelectedId(null); setShowContact(false); setShowUpload(false); }}
            className="text-xs font-black text-slate-400 hover:text-brand-600 flex items-center gap-2 uppercase tracking-widest transition-all group mb-6"
          >
            <i className="fa-solid fa-chevron-left text-[10px] group-hover:-translate-x-1 transition-transform"></i> All Committees
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl border border-slate-200 dark:border-white/5 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 opacity-5 text-[15rem] text-brand-900 pointer-events-none">
                  <i className={`fa-solid ${selectedCommittee?.icon}`}></i>
                </div>
                
                <div className="relative z-10">
                  <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <i className="fa-solid fa-shield-halved"></i> Community Entity
                    </div>
                    <div className="flex gap-2">
                       {isAdmin && !isGuest && (
                         <button 
                           onClick={() => setShowUpload(true)}
                           className="px-4 py-2 bg-slate-900 dark:bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black dark:hover:bg-brand-700 transition-all"
                         >
                           Upload Minutes
                         </button>
                       )}
                    </div>
                  </div>
                  <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight">{selectedCommittee?.name} Committee</h1>
                  <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-10 max-w-2xl font-medium">{selectedCommittee?.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 dark:border-white/5 pb-2">Active Members</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedCommittee?.members.map(member => (
                          <span key={member} className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold border border-slate-200 dark:border-white/5 hover:border-brand-300 transition-colors cursor-default">{member}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 dark:border-white/5 pb-2">Contact Point</h4>
                      <div className="flex items-center gap-4 group">
                        <div className="w-14 h-14 bg-brand-600 text-white rounded-2xl flex items-center justify-center font-black text-lg group-hover:scale-105 transition-transform">
                          {selectedCommittee?.chair[0]}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 dark:text-white text-lg">{selectedCommittee?.chair}</p>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">Committee Chair</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {showUpload && isAdmin && !isGuest && (
                <div className="bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-500/20 p-8 rounded-3xl animate-in slide-in-from-top-4 duration-300">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-brand-900 dark:text-brand-400 uppercase text-xs tracking-widest">Secretary Submission Portal</h3>
                    <button onClick={() => setShowUpload(false)} className="text-brand-600"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                  <form onSubmit={handleUploadMinute} className="space-y-4">
                    <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-brand-200 dark:border-brand-500/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center group hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                      <i className="fa-solid fa-file-arrow-up text-3xl text-brand-300 group-hover:text-brand-500 mb-3"></i>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Drop PDF meeting minutes here or <span className="text-brand-600 underline cursor-pointer">browse</span></p>
                    </div>
                    <div className="flex gap-3">
                      <input type="date" className="flex-1 bg-white dark:bg-slate-800 border border-brand-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none" required />
                      <button type="submit" className="px-8 bg-brand-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-700 transition-all active:scale-95">Publish Minutes</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-white/5">
                 <div className="flex justify-between items-center mb-8">
                   <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                     <i className="fa-solid fa-file-contract text-brand-500"></i> Records & Archive
                   </h3>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PIPA Compliant Storage</span>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {committeeDocs.length > 0 ? committeeDocs.map(doc => (
                      <div 
                        key={doc.id} 
                        onClick={() => doc.url && doc.url !== '#' && window.open(doc.url, '_blank')}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-brand-300 dark:hover:border-brand-500/50 hover:bg-white dark:hover:bg-slate-800 transition-all group cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-rose-500 group-hover:bg-rose-50 transition-colors">
                             <i className={`fa-solid ${doc.fileType === 'pdf' ? 'fa-file-pdf' : doc.url.includes('drive.google.com') ? 'fa-file-word text-blue-500' : 'fa-file-lines text-slate-400'} text-xl`}></i>
                           </div>
                           <div className="overflow-hidden">
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate pr-2">{doc.title}</p>
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">{doc.date} • {doc.author}</p>
                           </div>
                        </div>
                        <i className="fa-solid fa-arrow-up-right-from-square text-slate-300 group-hover:text-brand-500 group-hover:scale-110 transition-all p-2"></i>
                      </div>
                    )) : (
                      <p className="col-span-2 text-center py-12 text-slate-300 italic text-sm border-2 border-dashed border-slate-100 dark:border-white/5 rounded-2xl">No archived records found.</p>
                    )}
                 </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-white/5">
                 <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Member Input</h3>
                 <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">Submit proposals or share feedback directly with the {selectedCommittee?.name} committee.</p>
                 
                 {!showContact ? (
                   <button 
                     onClick={() => setShowContact(true)}
                     disabled={isGuest}
                     className={`w-full py-3 rounded-2xl font-black text-sm transition-all ${isGuest ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700 hover:-translate-y-0.5 active:scale-95'}`}
                   >
                     {isGuest ? 'Guest (Read-Only)' : 'New Inquiry'}
                   </button>
                 ) : (
                   <form onSubmit={handleSendMessage} className="space-y-4 animate-in fade-in slide-in-from-top-2">
                     <textarea 
                        required
                        value={msgBody}
                        onChange={(e) => setMsgBody(e.target.value)}
                        placeholder="Detail your request or feedback..."
                        className="w-full border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none h-32 resize-none bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                     />
                     <div className="flex gap-2">
                       <button 
                        type="button"
                        onClick={() => setShowContact(false)}
                        className="flex-1 py-3 text-sm font-black text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
                       >
                         Discard
                       </button>
                       <button 
                        type="submit"
                        disabled={sentStatus || isGuest}
                        className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${sentStatus ? 'bg-brand-100 text-brand-700' : 'bg-slate-900 dark:bg-brand-600 text-white hover:bg-black dark:hover:bg-brand-700 active:scale-95'} ${isGuest ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                         {sentStatus ? <i className="fa-solid fa-check mr-2"></i> : <i className="fa-solid fa-paper-plane mr-2"></i>}
                         {sentStatus ? 'Sent!' : 'Dispatch'}
                       </button>
                     </div>
                   </form>
                 )}
              </div>

              <div className="bg-slate-900 dark:bg-slate-800 p-8 rounded-3xl text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><i className="fa-solid fa-users text-7xl"></i></div>
                <h3 className="text-xl font-black mb-2 flex items-center gap-2 uppercase tracking-tight">
                   <i className="fa-solid fa-star text-brand-500"></i> Join Us
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-6">Our co-op thrives on member participation. Help shape our community by joining this committee.</p>
                <button 
                  disabled={isGuest}
                  className={`w-full py-3 rounded-2xl font-black text-sm transition-all ${isGuest ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700 active:scale-95'}`}
                >
                   {isGuest ? 'Inquiry Locked' : 'Apply to Join'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Committees;
