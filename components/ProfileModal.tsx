
import React, { useState } from 'react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    email: string;
    name: string;
    picture: string;
    isAdmin: boolean;
  };
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user }) => {
  const [displayName, setDisplayName] = useState(user.name);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  if (!isOpen) return null;

  const handleUpdateAvatar = () => {
    setIsUpdatingAvatar(true);
    setTimeout(() => {
      alert("Avatar update functionality would typically connect to a storage bucket. Simulated success.");
      setIsUpdatingAvatar(false);
    }, 1500);
  };

  const handleSave = () => {
    // In a real app, we'd call an API here
    alert(`Profile updated. Display name changed to: ${displayName}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Account Configuration</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manage your digital identity</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center transition-colors">
            <i className="fa-solid fa-xmark text-slate-500"></i>
          </button>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="flex items-center gap-6 p-6 bg-slate-50 dark:bg-slate-950/30 rounded-3xl border border-slate-100 dark:border-white/5">
            <div className="relative group">
              {user.picture ? (
                <img src={user.picture} alt={user.name} className="w-20 h-20 rounded-3xl object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-20 h-20 rounded-3xl bg-emerald-600 flex items-center justify-center text-white text-3xl font-black">
                  {user.name.charAt(0)}
                </div>
              )}
              {isUpdatingAvatar && (
                <div className="absolute inset-0 bg-black/50 rounded-3xl flex items-center justify-center">
                  <i className="fa-solid fa-spinner animate-spin text-white"></i>
                </div>
              )}
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 dark:text-white">{user.isAdmin ? 'Admin Account' : 'Resident Account'}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Member since 2026</p>
              <button 
                onClick={handleUpdateAvatar}
                disabled={isUpdatingAvatar}
                className="mt-3 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest hover:underline disabled:opacity-50"
              >
                {isUpdatingAvatar ? 'Processing...' : 'Update Avatar'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Display Name</label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email Address (Read Only)</label>
              <div className="relative">
                <input 
                  type="email" 
                  readOnly
                  value={user.email}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-400 dark:text-slate-600 cursor-not-allowed"
                />
                <i className="fa-solid fa-lock absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-700 text-[10px]"></i>
              </div>
              <p className="mt-1.5 text-[9px] text-slate-400 font-medium italic">Email is managed via your primary authentication provider.</p>
            </div>
            <div className="pt-2">
              <button 
                onClick={() => {
                  localStorage.removeItem('onboarding_hidden');
                  localStorage.removeItem('onboarding_completed');
                  alert("Administrator Guide has been reset. It will appear on your next page refresh.");
                }}
                className="w-full py-3 border border-dashed border-slate-200 dark:border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-600 hover:border-emerald-500 transition-all"
              >
                <i className="fa-solid fa-rotate-left mr-2"></i> Reset Administrator Guide
              </button>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button onClick={onClose} className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all">Dismiss</button>
            <button 
              onClick={handleSave}
              className="flex-1 py-4 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black dark:hover:bg-emerald-700 transition-all active:scale-95"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
