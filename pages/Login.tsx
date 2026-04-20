
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { LogIn, ShieldCheck, Home, Users, Wrench, Bot, Sparkles } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [debugCount, setDebugCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('Received message from origin:', event.origin, 'Data:', event.data);
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('vercel.app')) {
        console.warn('Message origin rejected:', origin);
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        console.log('OAuth success message received, triggering callback');
        setIsVerifying(true);
        // Small delay to ensure cookie is synced
        setTimeout(() => {
          onLoginSuccess();
        }, 1000);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLoginSuccess]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/url');
      if (!response.ok) {
        let errorMsg = `Server Error (${response.status})`;
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch (e) {
          // Not JSON
        }
        throw new Error(errorMsg);
      }
      const { url } = await response.json();
      
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      console.log('Opening OAuth popup with URL:', url);
      const popup = window.open(
        url,
        'google_oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        alert('Popup was blocked! Please allow popups for this site to sign in.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      alert(`Login Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDebug = async () => {
    const newCount = debugCount + 1;
    setDebugCount(newCount);
    if (newCount >= 5) {
      try {
        const res = await fetch('/api/debug/config');
        const data = await res.json();
        setDebugInfo(data);
      } catch (e) {
        setDebugInfo({ error: 'Failed to fetch debug info' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/20 blur-[120px] rounded-full"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-white/10 overflow-hidden relative z-10"
      >
        {/* Left Side - Hero/Info */}
        <div className="bg-slate-900 p-12 lg:p-16 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[length:32px_32px]"></div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-black tracking-tight">CoopHub BC</h1>
            </div>

            <h2 className="text-4xl lg:text-5xl font-black leading-tight mb-8">
              The Future of <br />
              <span className="text-brand-400">Housing Co-op</span> <br />
              Management.
            </h2>

            <div className="space-y-6">
              {[
                { icon: <Home className="w-5 h-5" />, text: "Unit & Tenant Management" },
                { icon: <Wrench className="w-5 h-5" />, text: "Maintenance Workflows" },
                { icon: <Users className="w-5 h-5" />, text: "Committee Collaboration" },
                { icon: <Bot className="w-5 h-5" />, text: "AI-Powered Policy Assistant" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 text-slate-300">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className="font-bold text-sm uppercase tracking-widest">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/10 relative z-10">
            <p className="text-slate-400 text-xs font-medium leading-relaxed">
              CoopHub BC is a secure platform designed specifically for British Columbia housing co-operatives. 
              Access is restricted to registered members and board administrators.
            </p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="p-12 lg:p-16 flex flex-col items-center justify-center bg-white dark:bg-slate-900">
          <div className="w-full max-w-sm">
            <div className="text-center mb-12">
              <div 
                onClick={toggleDebug}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase tracking-widest mb-4 cursor-pointer select-none"
              >
                <Sparkles className="w-3 h-3" />
                Secure Access
              </div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Welcome Back</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                Please sign in with your registered Google account to access your co-op portal.
              </p>
            </div>

            <button 
              onClick={handleGoogleLogin}
              disabled={isLoading || isVerifying}
              className="w-full flex items-center justify-center gap-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-white/5 py-4 rounded-2xl hover:border-brand-500 dark:hover:border-brand-500 transition-all group active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-black text-slate-700 dark:text-white uppercase tracking-widest">
                {isVerifying ? 'Verifying Session...' : (isLoading ? 'Connecting...' : 'Continue with Google')}
              </span>
            </button>

            <div className="mt-6 w-full">
              <button 
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    const res = await fetch('/api/auth/bypass', { method: 'POST' });
                    if (res.ok) {
                      onLoginSuccess();
                    }
                  } catch (e) {
                    console.error('Bypass failed', e);
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className="w-full py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-brand-500 transition-colors border border-dashed border-slate-200 dark:border-white/5 rounded-xl"
              >
                Development Bypass (Skip Sign-In)
              </button>
            </div>

            {!debugInfo?.hasClientId && debugCount >= 5 && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-[10px] text-red-600 dark:text-red-400 font-bold">
                  ⚠️ GOOGLE_CLIENT_ID is not configured in environment variables.
                </p>
              </div>
            )}

            {debugInfo && (
              <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-auto max-h-60">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-black uppercase text-slate-500">Debug Info</p>
                  <button 
                    onClick={() => onLoginSuccess()}
                    className="text-[8px] bg-brand-500 text-white px-2 py-1 rounded font-black uppercase"
                  >
                    Manual Refresh
                  </button>
                </div>
                <pre className="text-[8px] text-slate-600 dark:text-slate-400">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}

            <div className="mt-12 text-center">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-4">Trusted By</p>
              <div className="flex justify-center gap-6 opacity-30 grayscale">
                <div className="text-xs font-black">BC HOUSING</div>
                <div className="text-xs font-black">CHF BC</div>
                <div className="text-xs font-black">CO-OP FED</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mt-8 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
        &copy; 2026 CoopHub BC &bull; All Rights Reserved
      </div>
    </div>
  );
};

export default Login;
