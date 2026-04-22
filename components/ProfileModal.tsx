import React from 'react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThemeChange: (theme: string) => void;
  onRestartTour?: () => void;
  currentTheme: string;
  user: {
    email: string;
    name: string;
    picture: string;
    isAdmin: boolean;
  };
}

const THEMES = [
  { id: 'emerald', name: 'Emerald', color: 'bg-emerald-500' },
  { id: 'indigo', name: 'Indigo', color: 'bg-indigo-500' },
  { id: 'amber', name: 'Amber', color: 'bg-amber-500' },
  { id: 'rose', name: 'Rose', color: 'bg-rose-500' },
  { id: 'violet', name: 'Violet', color: 'bg-violet-500' },
];

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, onThemeChange, onRestartTour, currentTheme, user }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl">
        <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Account Configuration</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manage active session preferences</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center transition-colors">
            <i className="fa-solid fa-xmark text-slate-500"></i>
          </button>
        </div>

        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
          <div className="flex items-center gap-6 p-6 bg-slate-50 dark:bg-slate-950/30 rounded-3xl border border-slate-100 dark:border-white/5">
            <div className="relative text-center">
              {user.picture ? (
                <img src={user.picture} alt={user.name} className="w-20 h-20 rounded-3xl object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-20 h-20 rounded-3xl bg-brand-600 flex items-center justify-center text-white text-3xl font-black">
                  {user.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h4 className="text-lg font-black text-slate-900 dark:text-white">{user.isAdmin ? 'Admin Account' : 'Resident Account'}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-2">Profile fields are managed by your active sign-in provider.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Site Interface Theme</label>
              <div className="flex gap-4">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => onThemeChange(theme.id)}
                    className="group relative flex flex-col items-center gap-2"
                    title={theme.name}
                  >
                    <div className={`w-10 h-10 rounded-xl ${theme.color} shadow-lg transition-all duration-300 group-hover:scale-110 active:scale-90 ${currentTheme === theme.id ? 'ring-4 ring-offset-4 ring-slate-900 dark:ring-white ring-offset-white dark:ring-offset-slate-950 scale-110' : 'opacity-80 scale-100'}`} />
                    <span className={`text-[8px] font-black uppercase tracking-tighter ${currentTheme === theme.id ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{theme.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Display Name</label>
              <div className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">
                {user.name}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  readOnly
                  value={user.email}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-400 dark:text-slate-600 cursor-not-allowed"
                />
                <i className="fa-solid fa-lock absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-700 text-[10px]"></i>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  localStorage.removeItem('onboarding_hidden');
                  localStorage.removeItem('onboarding_completed');
                  onRestartTour?.();
                  onClose();
                }}
                className="w-full py-3 border border-dashed border-slate-200 dark:border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-600 hover:border-brand-500 transition-all"
              >
                <i className="fa-solid fa-rotate-left mr-2"></i> Reset Administrator Guide
              </button>
            </div>
          </div>

          <div className="pt-4 flex gap-3 sticky bottom-0 bg-white dark:bg-slate-900 py-4 border-t border-slate-100 dark:border-white/5">
            <button onClick={onClose} className="flex-1 py-4 bg-slate-900 dark:bg-brand-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black dark:hover:bg-brand-700 transition-all active:scale-95">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
