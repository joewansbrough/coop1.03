import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ExternalLink, Maximize2, RotateCcw, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getNextIncompleteStep,
  getTutorialTrack,
  markTutorialStepDone,
  resetTutorialState,
  saveTutorialState,
  type DemoTutorialState,
} from '../utils/demoTutorial';
import { getSheetGestureAction } from '../utils/demoTutorialSheetGesture';

interface DemoTutorialPanelProps {
  state: DemoTutorialState;
  onStateChange: (state: DemoTutorialState | null) => void;
}

const DemoTutorialPanel: React.FC<DemoTutorialPanelProps> = ({ state, onStateChange }) => {
  const navigate = useNavigate();
  const pointerStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  );
  const [shouldNudge, setShouldNudge] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  );
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

  const toggleCollapsed = () => {
    setShouldNudge(false);
    setIsCollapsed(!isCollapsed);
  };

  const handleSheetPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleSheetPointerMove = (event: React.PointerEvent) => {
    if (pointerStartRef.current && event.pointerType !== 'mouse') {
      event.preventDefault();
    }
  };

  const handleSheetPointerUp = (event: React.PointerEvent) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || event.pointerType === 'mouse') return;

    const action = getSheetGestureAction({
      deltaX: event.clientX - start.x,
      deltaY: event.clientY - start.y,
      isCollapsed,
    });

    if (!action) return;
    setShouldNudge(false);
    setIsCollapsed(action === 'collapse');
  };

  useEffect(() => {
    if (!shouldNudge) return;
    const timer = window.setTimeout(() => setShouldNudge(false), 2600);
    return () => window.clearTimeout(timer);
  }, [shouldNudge]);

  return (
    <aside className={`fixed inset-x-0 bottom-0 z-[120] sm:inset-x-auto sm:bottom-4 sm:right-4 w-full sm:w-[calc(100vw-2rem)] sm:max-w-sm rounded-t-3xl sm:rounded-3xl border-x border-t sm:border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)] ${isCollapsed ? '' : 'max-h-[88dvh]'} ${shouldNudge ? 'demo-guide-nudge' : ''}`}>
      <div
        className="px-4 py-3 sm:p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-950/50 touch-none select-none"
        onPointerDown={handleSheetPointerDown}
        onPointerMove={handleSheetPointerMove}
        onPointerUp={handleSheetPointerUp}
        onPointerCancel={() => {
          pointerStartRef.current = null;
        }}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden"
          aria-label={isCollapsed ? 'Expand demo guide' : 'Collapse demo guide'}
          aria-expanded={!isCollapsed}
        />
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="min-w-0 flex-1 text-left sm:pointer-events-none"
            aria-expanded={!isCollapsed}
          >
            <p className="text-[9px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-[0.22em]">Demo Guide</p>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mt-1 truncate">{track.title}</h3>
            {isCollapsed && nextStep && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1 truncate sm:hidden">{nextStep.title}</p>
            )}
          </button>
          <div className="flex gap-1">
            <button onClick={toggleCollapsed} className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-white dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-center" aria-label={isCollapsed ? 'Expand tutorial panel' : 'Collapse tutorial panel'} aria-expanded={!isCollapsed}>
              <ChevronDown className={`w-4 h-4 mx-auto transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
            </button>
            <button onClick={dismiss} className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-white dark:bg-white/10 text-slate-500 hover:text-rose-500 transition-colors flex items-center justify-center" aria-label="Dismiss tutorial panel">
              <X className="w-4 h-4 mx-auto" />
            </button>
          </div>
        </div>
        <div className="mt-3 sm:mt-4">
          <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
            <span>{completedCount} of {track.steps.length} complete</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {isCollapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-colors active:scale-[0.99] dark:bg-white dark:text-slate-950 sm:hidden"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            View full guide
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="p-3 max-h-[calc(88dvh-9rem)] sm:max-h-[58vh] overflow-y-auto">
          {nextStep && (
            <div className="m-1 mb-3 p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/40">
              <p className="text-[9px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-300 mb-1">Next up</p>
              <p className="text-xs font-black text-slate-900 dark:text-white">{nextStep.title}</p>
              <button
                onClick={() => {
                  navigate(nextStep.route);
                  if (window.matchMedia('(max-width: 639px)').matches) setIsCollapsed(true);
                }}
                className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 sm:bg-transparent sm:px-0 sm:py-0 text-[10px] font-black uppercase tracking-widest text-white sm:text-teal-700 sm:dark:text-teal-300 sm:hover:underline"
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
                      className={`w-9 h-9 sm:w-7 sm:h-7 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-400 hover:border-teal-500 hover:text-teal-600'}`}
                      aria-label={`Mark ${step.title} complete`}
                    >
                      {isDone ? <Check className="w-4 h-4" /> : <span className="text-[10px] font-black">{index + 1}</span>}
                    </button>
                    <div className="min-w-0">
                      <p className="text-[13px] sm:text-xs font-black text-slate-900 dark:text-white leading-snug">{step.title}</p>
                      <p className="text-[11px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1">{step.description}</p>
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
