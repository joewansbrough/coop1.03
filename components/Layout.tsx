
import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ProfileModal from './ProfileModal';
import HelpModal from './HelpModal';
import OnboardingTour from './OnboardingTour';
import { AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  isAdmin: boolean;
  isActualAdmin?: boolean;
  onToggleAdminView?: () => void;
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

const Layout: React.FC<LayoutProps> = ({ children, isAdmin, isActualAdmin, onToggleAdminView, user, coopName }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme === 'dark';
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('app-theme') || 'brand';
    }
    return 'brand';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);
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
      const isHidden = localStorage.getItem('onboarding_hidden');
      if (!hasCompleted && !isHidden) {
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
    { label: 'Policy Assistant', path: '/policy-assistant', icon: 'fa-robot' },
    { label: 'Communications', path: '/communications', icon: 'fa-comments' },
    { label: 'Directory', path: '/directory', icon: 'fa-address-book' },
  ];

  const effectiveIsAdmin = isAdmin;

  if (effectiveIsAdmin) {
    navItems.push(
      { label: 'Units', path: '/admin/units', icon: 'fa-house-chimney', isAdmin: true },
      { label: 'Tenants', path: '/admin/tenants', icon: 'fa-users', isAdmin: true },
      { label: 'Waitlist', path: '/admin/waitlist', icon: 'fa-list-check', isAdmin: true }
    );
  }

  const handleLogout = async () => {
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
  };
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-200">
      {/* Sidebar Backdrop */}
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 text-slate-800 dark:text-white flex flex-col transition-transform duration-300 transform border-r border-slate-200 dark:border-white/5 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:relative lg:translate-x-0`}>
      <div className="p-6">
        <Link to="/" className="text-xl font-black flex items-center tracking-tight whitespace-nowrap">
          <span className="text-slate-900 dark:text-slate-100">coop</span><span className="text-teal-600 dark:text-teal-400">HUB</span> <span className="text-slate-900 dark:text-slate-100">BC</span>
        </Link>
        <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest font-black">Co-op Management</p>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item, index) => {
          const isFirstAdminItem = isAdmin && item.isAdmin && !navItems[index - 1]?.isAdmin;
          return (
            <React.Fragment key={item.path}>
              {isFirstAdminItem && (
                <div className="pt-6 pb-2 px-3">
                  <p className="text-[10px] font-black text-teal-accent uppercase tracking-[0.2em]">Board Administration</p>
                </div>
              )}
              <Link
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-[20px] transition-all group active:scale-95 ${
                  location.pathname === item.path 
                    ? 'bg-teal-accent text-white' 
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <i className={`fa-solid ${item.icon} w-5 ${location.pathname === item.path ? 'text-white' : 'text-slate-400'}`}></i>
                <span className="text-sm font-bold">{item.label}</span>
              </Link>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <button 
          onClick={toggleDarkMode}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[20px] text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-teal-accent transition-all active:scale-95"
        >
          <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          {isDarkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
        {isActualAdmin ? (
          <button 
            onClick={onToggleAdminView} 
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
              isAdmin 
                ? 'bg-amber-500 text-white hover:bg-amber-600' 
                : 'bg-teal-accent text-white hover:bg-teal-700'
            }`}
          >
            <i className={`fa-solid ${isAdmin ? 'fa-user-shield' : 'fa-user'}`}></i>
            {isAdmin ? 'Switch to Tenant View' : 'Switch to Admin View'}
          </button>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-default">
            <i className="fa-solid fa-user"></i>
            Resident Session
          </div>
        )}
      </div>
      </aside>
      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full relative">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 lg:px-8 shrink-0 z-30 transition-colors duration-200 relative">
          <div className="flex items-center gap-3 z-10">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:text-brand-600 active:scale-95">
              <i className="fa-solid fa-bars-staggered text-xl"></i>
            </button>
            <div className="hidden lg:flex flex-col">
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">
                <Link to="/" className="hover:text-brand-500 transition-colors">Home</Link>
                {location.pathname !== '/' && (
                  <>
                    <i className="fa-solid fa-chevron-right text-[8px]"></i>
                    <span className="text-slate-600 dark:text-slate-300">
                      {navItems.find(n => n.path === location.pathname)?.label || 
                       (location.pathname.includes('/calendar/') ? 'Event Detail' : 
                        location.pathname.includes('/announcements/') ? 'Announcement' : 'Portal')}
                    </span>
                  </>
                )}
              </div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight truncate leading-none">
                {navItems.find(n => n.path === location.pathname)?.label || 
                 (location.pathname.includes('/calendar/') ? 'Event Detail' : 
                  location.pathname.includes('/announcements/') ? 'Announcement' : 'Portal')}
              </h2>
            </div>
          </div>

          {/* Centered Logo for Mobile */}
          <div className="absolute inset-0 flex items-center justify-center lg:hidden pointer-events-none">
            <Link to="/" className="text-xl font-black flex items-center tracking-tight pointer-events-auto">
              <span className="text-slate-900 dark:text-slate-100">coop</span><span className="text-teal-600 dark:text-teal-400">HUB</span> <span className="text-slate-900 dark:text-slate-100">BC</span>
            </Link>
          </div>

          <div className="flex items-center gap-1 lg:gap-3 z-10">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors hidden sm:block active:scale-95"
            >
              <i className="fa-solid fa-magnifying-glass"></i>
            </button>
            
            <div className="relative" ref={profileRef}>
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 pl-2 lg:pl-4 border-l border-slate-200 dark:border-white/5 ml-2 active:scale-95"
              >
                {user.picture ? (
                  <img src={user.picture} alt={user.name || 'User'} className="w-8 h-8 rounded-xl" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-brand-600 flex items-center justify-center text-white font-black text-xs hover:bg-brand-600 transition-colors">
                    {(user.name || 'User').charAt(0)}
                  </div>
                )}
                <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`}></i>
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5 py-2 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                  <div className="px-4 py-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-white/5 mb-1">
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100">{user.name}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
                    <div className="mt-3 flex gap-1">
                       <span className="text-[8px] font-black px-1.5 py-0.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 rounded uppercase">Certified</span>
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

        {/* Search Modal */}
        {isSearchOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-20 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden animate-in slide-in-from-top-4 duration-300">
              <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center gap-4">
                <i className="fa-solid fa-magnifying-glass text-slate-400"></i>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Search association records, policies, or events..." 
                  className="flex-1 bg-transparent border-none outline-none text-lg font-bold text-slate-800 dark:text-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button onClick={() => setIsSearchOpen(false)} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Esc</button>
              </div>
              <div className="p-8 text-center">
                {searchQuery ? (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No results found for "{searchQuery}"</p>
                    <p className="text-[10px] text-slate-500">Try searching for "Bylaws", "AGM", or "Maintenance"</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => { navigate('/documents'); setIsSearchOpen(false); }} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 text-left hover:border-brand-500 transition-all">
                      <p className="text-[10px] font-black text-brand-500 uppercase mb-1">Quick Link</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">Policy Library</p>
                    </button>
                    <button onClick={() => { navigate('/calendar'); setIsSearchOpen(false); }} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 text-left hover:border-brand-500 transition-all">
                      <p className="text-[10px] font-black text-blue-500 uppercase mb-1">Quick Link</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">Event Calendar</p>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <ProfileModal 
          isOpen={isProfileModalOpen} 
          onClose={() => setIsProfileModalOpen(false)} 
          onThemeChange={setTheme}
          onRestartTour={() => setIsOnboardingOpen(true)}
          currentTheme={theme}
          user={{
            email: user.email,
            name: user.name,
            picture: user.picture,
            isAdmin: isAdmin
          }}
        />
        <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} onRestartTour={() => setIsOnboardingOpen(true)} />
        <AnimatePresence>
          {isOnboardingOpen && (
            <OnboardingTour isOpen={isOnboardingOpen} onClose={() => setIsOnboardingOpen(false)} />
          )}
        </AnimatePresence>

        <section key={theme} className="flex-1 overflow-y-auto p-4 lg:p-12 bg-slate-50/50 dark:bg-slate-950/20 relative transition-colors duration-200 animate-in fade-in duration-1000">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Layout;
