
import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MOCK_NOTIFICATIONS } from '../constants';
import ProfileModal from './ProfileModal';
import HelpModal from './HelpModal';
import OnboardingTour from './OnboardingTour';
import { AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  isAdmin: boolean;
  user: {
    email: string;
    name: string;
    picture: string;
  };
  coopName: string;
}

interface NavItem {
  label: string;
  path: string;
  icon: string;
  isAdmin?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, isAdmin, user, coopName }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      const hasCompleted = localStorage.getItem('onboarding_completed');
      if (!hasCompleted) {
        // Small delay to let the initial page render
        const timer = setTimeout(() => setIsOnboardingOpen(true), 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isAdmin]);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const navItems: NavItem[] = [
    { label: 'Dashboard', path: '/', icon: 'fa-chart-line' },
    { label: 'Calendar', path: '/calendar', icon: 'fa-calendar-days' },
    { label: 'Committees', path: '/committees', icon: 'fa-users-gear' },
    { label: 'Maintenance', path: '/maintenance', icon: 'fa-tools' },
    { label: 'Documents', path: '/documents', icon: 'fa-file-lines' },
    { label: 'Finances', path: '/finances', icon: 'fa-wallet' },
    { label: 'Communications', path: '/communications', icon: 'fa-comments' },
    { label: 'Directory', path: '/directory', icon: 'fa-address-book' },
  ];

  if (isAdmin) {
    navItems.push(
      { label: 'Units', path: '/admin/units', icon: 'fa-house-chimney', isAdmin: true },
      { label: 'Tenants', path: '/admin/tenants', icon: 'fa-users', isAdmin: true },
      { label: 'Waitlist', path: '/admin/waitlist', icon: 'fa-list-check', isAdmin: true },
      { label: 'Reports', path: '/admin/reports', icon: 'fa-chart-pie', isAdmin: true }
    );
  }

  const handleLogout = async () => {
    if(confirm("Are you sure you want to log out of CoopConnect BC?")) {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        // Clear all local storage and session data
        localStorage.clear();
        sessionStorage.clear();
        // Force a full page reload to clear React state and trigger Auth check
        window.location.href = '/';
      } catch (error) {
        console.error('Logout failed:', error);
        window.location.reload();
      }
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-200">
      {/* Sidebar Backdrop */}
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 dark:bg-slate-950 text-white flex flex-col transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 border-r border-white/5`}>
        <div className="p-6 flex justify-between items-center lg:block">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <i className="fa-solid fa-house-signal text-emerald-400"></i>
              <span>{coopName}</span>
            </h1>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black">Co-op Management</p>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-white">
             <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-hide">
          {navItems.map((item, index) => {
            const isFirstAdminItem = isAdmin && item.isAdmin && !navItems[index - 1]?.isAdmin;
            return (
              <React.Fragment key={item.path}>
                {isFirstAdminItem && (
                  <div className="pt-6 pb-2 px-3">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Board Administration</p>
                  </div>
                )}
                <Link
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                    location.pathname === item.path 
                      ? (item.isAdmin ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/20' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20') 
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <i className={`fa-solid ${item.icon} w-5 group-hover:scale-110 transition-transform ${location.pathname === item.path ? 'text-white' : (item.isAdmin ? 'text-amber-500/70' : 'text-slate-500')}`}></i>
                  <span className="text-sm font-bold">{item.label}</span>
                </Link>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <button 
            onClick={toggleDarkMode}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-800 text-slate-400 hover:text-amber-400 transition-all"
          >
            <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button 
            onClick={handleLogout} 
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
              isAdmin 
                ? 'bg-amber-500 text-white hover:bg-amber-600' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-emerald-400'
            }`}
          >
            <i className={`fa-solid ${isAdmin ? 'fa-user-shield' : 'fa-user'}`}></i>
            {isAdmin ? 'Admin Session' : 'Member Session'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full relative">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 lg:px-8 shadow-sm shrink-0 z-30 transition-colors duration-200">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:text-emerald-600 active:scale-95">
              <i className="fa-solid fa-bars-staggered text-xl"></i>
            </button>
            <div className="hidden sm:flex flex-col">
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight truncate leading-none">
                {navItems.find(n => n.path === location.pathname)?.label || 'Portal'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-slate-400 font-bold uppercase">Live Environment</span>
                {isAdmin && (
                  <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Admin Mode</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 lg:gap-3">
            <button 
              onClick={() => alert("Search functionality is currently restricted to active context pages.")}
              className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors hidden sm:block active:scale-95"
            >
              <i className="fa-solid fa-magnifying-glass"></i>
            </button>
            
            <button 
              onClick={() => setIsNotificationsOpen(true)}
              className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors relative active:scale-95"
            >
              <i className="fa-solid fa-bell"></i>
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></span>
            </button>

            <div className="relative" ref={profileRef}>
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 pl-2 lg:pl-4 border-l border-slate-200 dark:border-white/5 ml-2 active:scale-95"
              >
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-xl shadow-sm ring-2 ring-emerald-50 dark:ring-emerald-900/50" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-emerald-600 flex items-center justify-center text-white font-black text-xs shadow-sm ring-2 ring-emerald-50 dark:ring-emerald-900/50 hover:bg-emerald-600 transition-colors">
                    {user.name.charAt(0)}
                  </div>
                )}
                <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`}></i>
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-white/5 py-2 animate-in fade-in zoom-in-95 duration-100 overflow-hidden ring-1 ring-slate-200/50 dark:ring-white/10">
                  <div className="px-4 py-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-white/5 mb-1">
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100">{user.name}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
                    <div className="mt-3 flex gap-1">
                       <span className="text-[8px] font-black px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded uppercase">Certified</span>
                       {isAdmin && <span className="text-[8px] font-black px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded uppercase">Administrator</span>}
                    </div>
                  </div>
                  <button onClick={() => { setIsProfileModalOpen(true); setIsProfileOpen(false); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-3 transition-colors">
                    <i className="fa-solid fa-gear text-slate-400"></i> Account Configuration
                  </button>
                  <button onClick={() => { navigate('/documents'); setIsProfileOpen(false); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-3 transition-colors">
                    <i className="fa-solid fa-circle-info text-slate-400"></i> Association Protocols
                  </button>
                  <button onClick={() => { setIsHelpModalOpen(true); setIsProfileOpen(false); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-3 transition-colors">
                    <i className="fa-solid fa-circle-question text-slate-400"></i> Help & Support
                  </button>
                  <div className="border-t border-slate-100 dark:border-white/5 mt-1">
                    <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-xs font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-3 transition-colors uppercase tracking-widest">
                      <i className="fa-solid fa-power-off"></i> Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Notifications Slide-over */}
        {isNotificationsOpen && (
          <>
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity" onClick={() => setIsNotificationsOpen(false)} />
            <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-slate-900 z-50 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
              <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-xs">Communication Queue</h3>
                <button onClick={() => setIsNotificationsOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center transition-colors">
                  <i className="fa-solid fa-xmark text-slate-500"></i>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {MOCK_NOTIFICATIONS.length > 0 ? MOCK_NOTIFICATIONS.map(n => (
                  <div key={n.id} className={`p-4 rounded-2xl border transition-all hover:border-emerald-200 dark:hover:border-emerald-400 cursor-pointer group ${!n.isRead ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-white/5 opacity-70'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${n.type === 'urgent' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                        {n.type}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase">{n.timestamp}</span>
                    </div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white mb-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">{n.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{n.body}</p>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300 dark:text-slate-700">
                    <i className="fa-solid fa-inbox text-5xl mb-4 opacity-10"></i>
                    <p className="text-xs font-black uppercase tracking-widest">Inbox Clean</p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/50">
                <button 
                  onClick={() => alert("All notifications marked as read.")}
                  className="w-full bg-slate-900 dark:bg-emerald-600 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black dark:hover:bg-emerald-700 transition-all shadow-xl active:scale-95"
                >
                  Clear All Alerts
                </button>
              </div>
            </div>
          </>
        )}

        <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
        <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} onRestartTour={() => setIsOnboardingOpen(true)} />
        <AnimatePresence>
          {isOnboardingOpen && (
            <OnboardingTour isOpen={isOnboardingOpen} onClose={() => setIsOnboardingOpen(false)} />
          )}
        </AnimatePresence>

        <section className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-50/50 dark:bg-slate-950/20 relative transition-colors duration-200">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Layout;
