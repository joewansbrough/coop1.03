'use client';

import React, { useState } from 'react';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      const res = await fetch('/api/auth/url');
      const { url } = await res.json();
      
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const authWindow = window.open(
        url,
        'google-login',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      const messageListener = (event: MessageEvent) => {
        if (event.data.type === 'OAUTH_AUTH_SUCCESS') {
          onLoginSuccess();
          window.removeEventListener('message', messageListener);
        }
      };

      window.addEventListener('message', messageListener);
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  const handleBypass = async () => {
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/bypass', { method: 'POST' });
      if (res.ok) {
        onLoginSuccess();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-200 dark:border-white/5 shadow-2xl shadow-emerald-500/5 text-center">
        <div className="w-20 h-20 bg-emerald-600 rounded-3xl mx-auto mb-8 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-emerald-500/20">
          <i className="fa-solid fa-house-chimney"></i>
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Oak Bay Co-op</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium mb-10">Secure member portal for housing operations and community engagement.</p>
        
        <div className="space-y-4">
          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            <i className="fa-brands fa-google text-lg"></i>
            Sign in with Google
          </button>
          
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100 dark:border-white/5"></div></div>
            <div className="relative flex justify-center"><span className="bg-white dark:bg-slate-900 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Internal Access</span></div>
          </div>

          <button 
            onClick={handleBypass}
            disabled={isLoggingIn}
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
          >
            {isLoggingIn ? 'Authenticating...' : 'Developer Bypass'}
          </button>
        </div>
        
        <p className="mt-10 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
          Authorized Personnel Only<br />
          &copy; 2026 Co-operative Association
        </p>
      </div>
    </div>
  );
};

export default Login;
