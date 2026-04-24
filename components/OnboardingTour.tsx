
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Home, 
  Wrench, 
  FileText, 
  Bot, 
  ChevronRight, 
  ChevronLeft, 
  X,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface Step {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const STEPS: Step[] = [
  {
    title: "Welcome to coopHUB BC",
    description: "Your comprehensive platform for British Columbia housing co-operative management. Let's take a quick tour of your new Board Administrator tools.",
    icon: <ShieldCheck className="w-12 h-12" />,
    color: "bg-brand-500"
  },
  {
    title: "Mission Control Dashboard",
    description: "Get a high-level view of your co-op. Monitor occupancy rates, pending maintenance, and recent announcements all in one place.",
    icon: <LayoutDashboard className="w-12 h-12" />,
    color: "bg-blue-500"
  },
  {
    title: "Unit & Tenant Management",
    description: "Manage the co-op's physical assets and resident records. Track move-ins, move-outs, and unit history with precision.",
    icon: <Home className="w-12 h-12" />,
    color: "bg-amber-500"
  },
  {
    title: "Maintenance Workflows",
    description: "Streamline repairs and inspections. Review resident requests, assign contractors, and track progress until completion.",
    icon: <Wrench className="w-12 h-12" />,
    color: "bg-rose-500"
  },
  {
    title: "Documents & Governance",
    description: "Keep your co-op's records organized. Access bylaws, meeting minutes, and governance records securely from any device.",
    icon: <FileText className="w-12 h-12" />,
    color: "bg-indigo-500"
  },
  {
    title: "AI Policy Assistant",
    description: "Navigate complex bylaws instantly. Our AI assistant helps you find answers to policy questions based on your co-op's specific rules.",
    icon: <Bot className="w-12 h-12" />,
    color: "bg-purple-500"
  }
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding_hidden', 'true');
    onClose();
  };

  const handleComplete = () => {
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.removeItem('onboarding_hidden');
    onClose();
  };

  const step = STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <style>{`
        @keyframes radar-pulse {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes breathing-glow {
          0%, 100% { filter: drop-shadow(0 0 5px rgba(255,255,255,0.4)); }
          50% { filter: drop-shadow(0 0 20px rgba(255,255,255,0.8)); }
        }
        @keyframes subtle-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-radar { animation: radar-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-glow { animation: breathing-glow 3s ease-in-out infinite; }
        .animate-float { animation: subtle-float 4s ease-in-out infinite; }
      `}</style>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white dark:bg-slate-900 w-full max-w-xl sm:max-w-2xl max-h-[85vh] rounded-[2.5rem] sm:rounded-[4rem] border-[4px] border-slate-200 dark:border-white/10 overflow-hidden relative shadow-2xl flex flex-col sm:block"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-8 sm:right-8 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors z-20"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col sm:flex-row h-full">
          <div className={`w-full sm:w-2/5 ${step.color} p-6 sm:p-12 flex flex-col items-center justify-center text-white relative overflow-hidden transition-colors duration-500`}>
            <div className="absolute top-0 left-0 w-full h-full opacity-10">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[length:24px_24px]"></div>
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 1.5, opacity: 0, rotate: 10 }}
                transition={{ type: "spring", damping: 12 }}
                className="relative z-10"
              >
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-white/20 backdrop-blur-xl flex items-center justify-center ring-2 sm:ring-4 ring-white/30 relative">
                  {currentStep === 1 && <div className="absolute inset-0 rounded-2xl sm:rounded-3xl border-2 border-white/50 animate-radar" />}
                  <div className={`relative z-10 scale-75 sm:scale-100 ${currentStep === 5 ? 'animate-glow' : 'animate-float'}`}>
                    {step.icon}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 sm:mt-8 text-center relative z-10">
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Step {currentStep + 1} of {STEPS.length}</p>
              <div className="mt-2 sm:mt-4 flex gap-1.5 justify-center">
                {STEPS.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1 sm:h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 sm:w-8 bg-white' : 'w-1 sm:w-1.5 bg-white/30'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="w-full sm:w-3/5 p-6 sm:p-12 flex flex-col justify-between bg-white dark:bg-slate-900 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="flex-1"
              >
                <div className="flex items-center gap-2 mb-2 sm:mb-4">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-brand-500" />
                  <span className="text-[9px] sm:text-[10px] font-black text-brand-500 uppercase tracking-widest">Administrator Guide</span>
                </div>
                <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight mb-3 sm:mb-6">
                  {step.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  {step.description}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 sm:mt-12 flex items-center justify-between">
              <button 
                onClick={handleBack}
                disabled={currentStep === 0}
                className={`flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${currentStep === 0 ? 'opacity-0 pointer-events-none' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <ChevronLeft size={14} />
                Back
              </button>

              <div className="flex gap-2 sm:gap-3">
                <button 
                  onClick={handleSkip}
                  className="px-4 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  Skip
                </button>
                <button 
                  onClick={handleNext}
                  className="px-6 sm:px-8 py-3 sm:py-4 bg-slate-900 dark:bg-brand-600 text-white rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-black dark:hover:bg-brand-700 transition-all flex items-center gap-2 group active:scale-95"
                >
                  {currentStep === STEPS.length - 1 ? 'Get Started' : 'Next'}
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingTour;
