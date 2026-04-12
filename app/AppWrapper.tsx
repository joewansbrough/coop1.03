'use client';

import React, { useState } from 'react';
import LayoutClient from '../components/LayoutClient';
import ScrollToTop from '../components/ScrollToTop';
import Login from '../components/Login';
import { useUser } from '../hooks/useCoopData';

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [coopName] = useState('Your Housing Co-op');
  
  const { data: user, isLoading: isUserLoading, refetch: fetchUser } = useUser();

  if (isUserLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Authenticating Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={() => fetchUser()} />;
  }

  const effectiveIsAdmin = user.isAdmin && !isAdminOverride;
  const isGuest = !!user.isGuest;

  return (
    <>
      <ScrollToTop />
      <LayoutClient 
        isAdmin={effectiveIsAdmin} 
        isActualAdmin={user.isAdmin}
        onToggleAdminView={() => setIsAdminOverride(!isAdminOverride)}
        user={user} 
        coopName={coopName}
      >
        {children}
      </LayoutClient>
    </>
  );
}
