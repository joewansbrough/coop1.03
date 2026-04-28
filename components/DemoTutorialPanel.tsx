import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ExternalLink, RotateCcw, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getNextIncompleteStep,
  getTutorialTrack,
  markTutorialStepDone,
  resetTutorialState,
  saveTutorialState,
  type DemoTutorialState,
} from '../utils/demoTutorial';

interface DemoTutorialPanelProps {
  state: DemoTutorialState;
  onStateChange: (state: DemoTutorialState | null) => void;
}

const DemoTutorialPanel: React.FC<DemoTutorialPanelProps> = ({ state, onStateChange }) => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const track = getTutorialTrack(state.trackId);
  const nextStep = useMemo(() => getNextIncompleteStep(state), [state]);

  if (!track || state.isPanelDismissed) return null;

  const completedCount = state.completedStepIds.length;
  const progress = Math.round((completedCount / track.steps.length) * 100);

  const persist = (nextState: DemoTutorialState | null) => {
    if (nextState) saveTutorialState(nextState);
    onStateChange(nextState);
  };

  const markDone = (stepId: string) => {
    persist(markTutorialStepDone(state, stepId));
  };

  const dismiss = () => {
    persist({ ...state, isPanelDismissed: true });
  };

  const reset = () => {
    persist(resetTutorialState(state));
  };

  return (
    <aside className="fixed bottom-4 right-4 z-[120] w-[calc(100vw-2rem)] max-w-sm rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-950/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-[0.22em]">Demo Guide</p>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mt-1">{track.title}</h3>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="w-8 h-8 rounded-xl bg-white dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label="Collapse tutorial panel">
              <ChevronDown className={`w-4 h-4 mx-auto transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
            </button>
            <button onClick={dismiss} className="w-8 h-8 rounded-xl bg-white dark:bg-white/10 text-slate-500 hover:text-rose-500 transition-colors" aria-label="Dismiss tutorial panel">
              <X className="w-4 h-4 mx-auto" />
            </button>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
            <span>{completedCount} of {track.steps.length} complete</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-3 max-h-[58vh] overflow-y-auto">
          {nextStep && (
            <div className="m-1 mb-3 p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/40">
              <p className="text-[9px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-300 mb-1">Next up</p>
              <p className="text-xs font-black text-slate-900 dark:text-white">{nextStep.title}</p>
              <button
                onClick={() => navigate(nextStep.route)}
                className="mt-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-300 hover:underline"
              >
                Go there <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="space-y-2">
            {track.steps.map((step, index) => {
              const isDone = state.completedStepIds.includes(step.id);
              return (
                <div key={step.id} className={`p-3 rounded-2xl border transition-colors ${isDone ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' : 'bg-white dark:bg-slate-950/30 border-slate-100 dark:border-white/5'}`}>
                  <div className="flex gap-3">
                    <button
                      onClick={() => markDone(step.id)}
                      className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-400 hover:border-teal-500 hover:text-teal-600'}`}
                      aria-label={`Mark ${step.title} complete`}
                    >
                      {isDone ? <Check className="w-4 h-4" /> : <span className="text-[10px] font-black">{index + 1}</span>}
                    </button>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 dark:text-white leading-snug">{step.title}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1">{step.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={reset} className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest hover:text-teal-600 transition-colors">
            <RotateCcw className="w-3 h-3" />
            Restart Track
          </button>
        </div>
      )}
    </aside>
  );
};

export default DemoTutorialPanel;
