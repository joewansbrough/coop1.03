
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, ShieldCheck, Home, Users, Wrench, Bot, Sparkles } from 'lucide-react';
import AppAlert from '../components/AppAlert';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/url');
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Could not get authentication URL');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setErrorMessage(`Login error: ${error.message}`);
      setIsLoading(false);
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
              <h1 className="text-2xl font-black tracking-tight text-white">
                <span className="text-white">coop</span><span className="text-teal-400">HUB</span><span className="text-white"> BC</span>
              </h1>
            </div>


            <h2 className="text-4xl lg:text-5xl font-black leading-tight mb-8">
              The Future of <br />
              <span className="text-brand-400">Co-op Housing</span> <br />
              Management.
            </h2>

            <button
              onClick={() => {
                localStorage.setItem('demo_mode', 'true');
                onLoginSuccess();
              }}
              className="px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl transition-all active:scale-95 flex items-center gap-3 group mb-12"
            >
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              <span className="text-sm font-black uppercase tracking-widest">Try Demo Mode</span>
            </button>

            <div className="mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-400">Key Features:</h3>
            </div>

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
              <span className="text-white">coop</span><span className="text-teal-400">HUB</span><span className="text-white"> BC</span> is a secure platform designed specifically for British Columbia housing co-operatives.
              Access is restricted to registered members and board administrators.
            </p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="p-12 lg:p-16 flex flex-col items-center justify-center bg-white dark:bg-slate-900">
          <div className="w-full max-w-sm">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Welcome Back</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                Please sign in with your registered Google account to access your co-op portal.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-6">
                <AppAlert message={errorMessage} type="error" onClose={() => setErrorMessage(null)} />
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-white/5 py-4 rounded-2xl hover:border-brand-500 dark:hover:border-brand-500 transition-all group active:scale-95 disabled:opacity-50 disabled:pointer-events-none mb-4"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-black text-slate-700 dark:text-white uppercase tracking-widest">
                {isLoading ? 'Connecting...' : 'Continue with Google'}
              </span>
            </button>

            <button
              onClick={() => {
                localStorage.setItem('demo_mode', 'true');
                onLoginSuccess();
              }}
              className="w-full flex items-center justify-center gap-4 bg-teal-600 hover:bg-teal-700 py-4 rounded-2xl transition-all active:scale-95"
            >
              <span className="text-sm font-black text-white uppercase tracking-widest">
                Try Demo Mode
              </span>
            </button>
          </div>
        </div>
      </motion.div>

      <div className="mt-8 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
        &copy; 2026 <span className="text-white">coop</span><span className="text-teal-400">HUB</span><span className="text-white"> BC</span> &bull; All Rights Reserved
      </div>
    </div>
  );
};

export default Login;
