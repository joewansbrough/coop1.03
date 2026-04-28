import React from 'react';
import { ArrowRight, Presentation, ShieldCheck, UserRound } from 'lucide-react';
import {
  createInitialTutorialState,
  DEMO_TUTORIAL_ROLE_VIEW_KEY,
  DEMO_TUTORIAL_TRACKS,
  saveTutorialState,
  type DemoTutorialTrackId,
} from '../utils/demoTutorial';
import { initializeDemoStorage } from '../utils/demoStorage';

interface DemoTrackPickerProps {
  onStart: () => void;
  onCancel: () => void;
}

const trackIcons: Record<DemoTutorialTrackId, React.ReactNode> = {
  admin: <ShieldCheck className="w-6 h-6" />,
  resident: <UserRound className="w-6 h-6" />,
  pitch: <Presentation className="w-6 h-6" />,
};

const DemoTrackPicker: React.FC<DemoTrackPickerProps> = ({ onStart, onCancel }) => {
  const startTrack = (trackId: DemoTutorialTrackId) => {
    const track = DEMO_TUTORIAL_TRACKS.find(item => item.id === trackId);
    localStorage.setItem('demo_mode', 'true');
    initializeDemoStorage();
    saveTutorialState(createInitialTutorialState(trackId));
    localStorage.setItem(DEMO_TUTORIAL_ROLE_VIEW_KEY, track?.startAsResident ? 'true' : 'false');
    window.location.hash = track?.startPath || '/';
    onStart();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
        <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-white/5 flex items-start justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-teal-600 dark:text-teal-400 mb-2">Demo Tutorial</p>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Choose your guided track</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2 max-w-2xl">
              Pick the story you want to experience. You can still explore freely once the checklist opens.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
            aria-label="Close demo track picker"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 sm:p-8">
          {DEMO_TUTORIAL_TRACKS.map(track => (
            <button
              key={track.id}
              onClick={() => startTrack(track.id)}
              className="text-left p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/30 hover:border-teal-500 hover:bg-white dark:hover:bg-slate-900 transition-all group active:scale-[0.98] flex flex-col min-h-[220px]"
            >
              <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                {trackIcons[track.id]}
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{track.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-2">{track.subtitle}</p>
              <div className="mt-auto pt-6 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400">
                <span>{track.steps.length} stops</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DemoTrackPicker;
