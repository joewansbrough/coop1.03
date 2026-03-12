
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
    title: "Welcome to CoopConnect BC",
    description: "Your comprehensive platform for British Columbia housing co-operative management. Let's take a quick tour of your new Board Administrator tools.",
    icon: <ShieldCheck className="w-12 h-12" />,
    color: "bg-emerald-500"
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
    localStorage.removeItem('onboarding_hidden'); // Clear hidden if completed
    onClose();
  };

  const step = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] border border-slate-200 dark:border-white/10 overflow-hidden relative"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col md:flex-row h-full">
          {/* Left Side - Visual */}
          <div className={`w-full md:w-2/5 ${step.color} p-12 flex flex-col items-center justify-center text-white relative overflow-hidden transition-colors duration-500`}>
            {/* Decorative Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10">
              <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[length:24px_24px]"></div>
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
                <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-xl flex items-center justify-center ring-4 ring-white/30">
                  {step.icon}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 text-center relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Step {currentStep + 1} of {STEPS.length}</p>
              <div className="mt-4 flex gap-1.5 justify-center">
                {STEPS.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-8 bg-white' : 'w-1.5 bg-white/30'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - Content */}
          <div className="w-full md:w-3/5 p-12 flex flex-col justify-between bg-white dark:bg-slate-900">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="flex-1"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Administrator Guide</span>
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-tight mb-6">
                  {step.title}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  {step.description}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-12 flex items-center justify-between">
              <button 
                onClick={handleBack}
                disabled={currentStep === 0}
                className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${currentStep === 0 ? 'opacity-0 pointer-events-none' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <ChevronLeft size={16} />
                Back
              </button>

              <div className="flex gap-3">
                <button 
                  onClick={handleSkip}
                  className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  Skip
                </button>
                <button 
                  onClick={handleNext}
                  className="px-8 py-4 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black dark:hover:bg-emerald-700 transition-all flex items-center gap-2 group active:scale-95"
                >
                  {currentStep === STEPS.length - 1 ? 'Get Started' : 'Next Step'}
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-slate-100 dark:bg-white/5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-emerald-500"
          />
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingTour;
