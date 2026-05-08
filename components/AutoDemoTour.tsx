import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ListChecks, Menu, MousePointer2, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AUTO_DEMO_SECTIONS,
  AUTO_DEMO_STOPS,
  AUTO_DEMO_TIMING,
  getAutoDemoSectionForIndex,
  getAutoDemoSectionForTarget,
  getAutoDemoSectionStartIndex,
  getAutoDemoStop,
  getNextAutoDemoIndex,
  getPreviousAutoDemoIndex,
} from '../utils/autoDemo';

interface AutoDemoTourProps {
  isOpen: boolean;
  onClose: () => void;
  onRoleSwitch?: () => void;
  isAdmin?: boolean;
}

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const emptyRect: TargetRect = {
  top: 120,
  left: 120,
  width: 280,
  height: 160,
};

const getScrollContainer = () => document.querySelector<HTMLElement>('main section[class*="overflow-y-auto"]');

const snapPageToTop = () => {
  getScrollContainer()?.scrollTo({ top: 0, behavior: 'auto' });
  window.scrollTo({ top: 0, behavior: 'auto' });
};

const previewDashboardScroll = () => {
  const container = getScrollContainer();
  if (!container) return;
  container.scrollTo({ top: 520, behavior: 'smooth' });
  window.setTimeout(() => container.scrollTo({ top: 0, behavior: 'smooth' }), 1300);
};

const scrollThroughMeetingRecord = (target: HTMLElement) => {
  const container = getScrollContainer();
  const scroller = container || document.documentElement;
  target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  window.setTimeout(() => {
    scroller.scrollTo({ top: scroller.scrollTop + 480, behavior: 'smooth' });
  }, AUTO_DEMO_TIMING.panelDelayMs + 500);
  window.setTimeout(() => {
    scroller.scrollTo({ top: scroller.scrollTop + 520, behavior: 'smooth' });
  }, AUTO_DEMO_TIMING.panelDelayMs + 1800);
};

const getRouteFromClickedLink = (node: HTMLElement | null) => {
  const href = node?.closest('a')?.getAttribute('href');
  if (!href) return null;
  if (href.startsWith('#/')) return href.slice(1);
  if (href.startsWith('/')) return href;
  try {
    const url = new URL(href, window.location.origin);
    return url.hash.startsWith('#/') ? url.hash.slice(1) : `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
};

const AutoDemoTour: React.FC<AutoDemoTourProps> = ({ isOpen, onClose, onRoleSwitch, isAdmin = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect>(emptyRect);
  const [targetFound, setTargetFound] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [hasCursorArrived, setHasCursorArrived] = useState(false);
  const [isGlowVisible, setIsGlowVisible] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isGuideCollapsed, setIsGuideCollapsed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const stop = getAutoDemoStop(stepIndex);
  const isWelcomeStep = stop?.id === 'welcome';
  const activeSection = getAutoDemoSectionForIndex(stepIndex);

  useEffect(() => {
    if (!isOpen || !stop) return;
    if (`${location.pathname}${location.search}` !== stop.route) {
      navigate(stop.route);
      window.setTimeout(snapPageToTop, 80);
    }
  }, [isOpen, location.pathname, location.search, navigate, stop]);

  useEffect(() => {
    if (!isOpen || !stop) return;
    if (isWelcomeStep) {
      setTargetFound(true);
      snapPageToTop();
      return;
    }

    let frame = 0;
    const measure = (shouldAdjustScroll = false) => {
      const target = document.querySelector<HTMLElement>(`[data-demo-target="${stop.target}"]`);
      if (!target) {
        setTargetFound(false);
        frame = window.setTimeout(() => measure(shouldAdjustScroll), AUTO_DEMO_TIMING.measureDelayMs);
        return;
      }

      if (shouldAdjustScroll) {
        if (stop.scrollMode === 'top') {
          snapPageToTop();
        } else if (stop.scrollMode === 'target') {
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        } else if (stop.scrollMode === 'dashboard-preview') {
          snapPageToTop();
          window.setTimeout(previewDashboardScroll, AUTO_DEMO_TIMING.panelDelayMs + 500);
        } else if (stop.scrollMode === 'minutes-record') {
          scrollThroughMeetingRecord(target);
        } else {
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      }
      frame = window.setTimeout(() => {
        const rect = target.getBoundingClientRect();
        setTargetFound(rect.width > 0 && rect.height > 0);
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        if (rect.width <= 0 || rect.height <= 0) {
          frame = window.setTimeout(() => measure(shouldAdjustScroll), AUTO_DEMO_TIMING.measureDelayMs);
        }
      }, AUTO_DEMO_TIMING.measureDelayMs);
    };

    measure(true);
    const onResize = () => measure(false);
    const onScroll = () => measure(false);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.clearTimeout(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [isOpen, isWelcomeStep, location.pathname, location.search, stop]);

  useEffect(() => {
    if (!isOpen || !stop) return;
    setIsPanelVisible(isWelcomeStep);
    setHasCursorArrived(false);
    setIsGlowVisible(!isWelcomeStep);
    setIsClicking(false);

    const arrivalTimer = window.setTimeout(() => {
      setHasCursorArrived(true);
    }, isWelcomeStep ? 0 : AUTO_DEMO_TIMING.cursorTravelMs);
    const panelTimer = window.setTimeout(() => {
      setIsPanelVisible(true);
    }, isWelcomeStep ? 0 : AUTO_DEMO_TIMING.panelDelayMs);
    const glowTimer = window.setTimeout(() => {
      setIsGlowVisible(false);
    }, isWelcomeStep ? 0 : AUTO_DEMO_TIMING.panelDelayMs + 900);

    return () => {
      window.clearTimeout(arrivalTimer);
      window.clearTimeout(panelTimer);
      window.clearTimeout(glowTimer);
    };
  }, [isOpen, isWelcomeStep, location.pathname, location.search, stepIndex, stop]);

  const isLastStep = stepIndex === AUTO_DEMO_STOPS.length - 1;
  const guidedStepCount = Math.max(1, AUTO_DEMO_STOPS.length - 1);
  const progress = isWelcomeStep
    ? 0
    : Math.round((stepIndex / guidedStepCount) * 100);
  const cursorLeft = targetRect.left + Math.min(targetRect.width - 18, Math.max(18, targetRect.width * 0.72));
  const cursorTop = targetRect.top + Math.min(targetRect.height - 18, Math.max(18, targetRect.height * 0.42));
  const welcomePlacement = {
    left: typeof window === 'undefined' ? 24 : Math.max(16, (window.innerWidth - Math.min(520, window.innerWidth - 32)) / 2),
    top: typeof window === 'undefined' ? 24 : Math.max(24, Math.min(120, window.innerHeight * 0.16)),
    width: typeof window === 'undefined' ? 520 : Math.min(520, window.innerWidth - 32),
    maxHeight: typeof window === 'undefined' ? 520 : Math.max(320, window.innerHeight - 48),
  };
  const guidePlacement = {
    width: typeof window === 'undefined' ? 380 : Math.min(380, window.innerWidth - 16),
    maxHeight: typeof window === 'undefined' ? 520 : Math.min(520, window.innerHeight - 16),
  };
  const goNext = useCallback(() => {
    if (isLastStep) {
      onClose();
      return;
    }
    if (stepIndex === 0) {
      setIsGuideCollapsed(false);
    }
    setStepIndex(getNextAutoDemoIndex(stepIndex));
    setIsMenuOpen(false);
  }, [isLastStep, onClose, stepIndex]);

  const goToSection = useCallback((sectionId: string) => {
    const startIndex = getAutoDemoSectionStartIndex(sectionId);
    if (startIndex < 0) return;
    setStepIndex(startIndex);
    setIsMenuOpen(false);
    setIsGuideCollapsed(false);
  }, []);

  const clickThenNavigate = useCallback((route: string) => {
    setIsClicking(true);
    window.setTimeout(() => {
      navigate(route);
      snapPageToTop();
      setStepIndex(getNextAutoDemoIndex(stepIndex));
      setIsClicking(false);
    }, AUTO_DEMO_TIMING.clickPulseMs);
  }, [navigate, stepIndex]);

  const performAction = useCallback(() => {
    if (!stop) return;
    if (stop.action === 'switch-role' && isAdmin) {
      onRoleSwitch?.();
    }
    if (stop.action === 'toggle-dashboard-customize') {
      document.dispatchEvent(new CustomEvent('auto-demo-dashboard-customize'));
    }
    if (stop.action === 'ask-policy-demo') {
      document.dispatchEvent(new CustomEvent('auto-demo-oracle-question'));
    }
    if (stop.routeAfterClick) {
      clickThenNavigate(stop.routeAfterClick);
      return;
    }
    goNext();
  }, [clickThenNavigate, goNext, isAdmin, onRoleSwitch, stop]);

  useEffect(() => {
    if (!isOpen || !stop) return;

    const interceptPageClick = (event: MouseEvent) => {
      const node = event.target as HTMLElement | null;
      if (!node || node.closest('[data-auto-demo-panel="true"]')) return;

      const activeTarget = isWelcomeStep ? null : document.querySelector<HTMLElement>(`[data-demo-target="${stop.target}"]`);
      const clickedActiveTarget = Boolean(activeTarget && activeTarget.contains(node));
      const clickedDemoTarget = node.closest<HTMLElement>('[data-demo-target]');
      const clickedSection = getAutoDemoSectionForTarget(clickedDemoTarget?.dataset.demoTarget);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (clickedActiveTarget && !isClicking) {
        performAction();
        return;
      }

      if (clickedSection && !isClicking) {
        const linkRoute = getRouteFromClickedLink(clickedDemoTarget);
        const clickedStop = AUTO_DEMO_STOPS[clickedSection.startIndex];
        const nextIndex = clickedStop?.routeAfterClick ? getNextAutoDemoIndex(clickedSection.startIndex) : clickedSection.startIndex;
        if (linkRoute) {
          navigate(linkRoute);
          window.setTimeout(snapPageToTop, 80);
        }
        setStepIndex(nextIndex);
        setIsMenuOpen(false);
        setIsGuideCollapsed(false);
      }
    };

    document.addEventListener('click', interceptPageClick, true);
    return () => document.removeEventListener('click', interceptPageClick, true);
  }, [isClicking, isOpen, isWelcomeStep, navigate, performAction, stop]);

  if (!isOpen || !stop) return null;

  const guideHeaderLabel = isWelcomeStep ? 'Guided Welcome' : activeSection ? `${activeSection.number}. ${activeSection.title}` : 'Guided Tour';
  const panelTitle = stop.title;
  const shouldShowPanel = isWelcomeStep || !isGuideCollapsed;

  return (
    <div className="pointer-events-none fixed inset-0 z-[260]">
      <style>{`
        @keyframes auto-demo-arrival-ring {
          0% { transform: scale(0.82); opacity: 0; }
          22% { opacity: 0.92; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes auto-demo-cursor-pop {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.16); }
        }
        @keyframes auto-demo-click-ring {
          0% { transform: scale(0.55); opacity: 0.95; }
          100% { transform: scale(2.15); opacity: 0; }
        }
        @keyframes auto-demo-welcome-bounce {
          0% { opacity: 0; transform: translateY(24px) scale(0.96); }
          56% { opacity: 1; transform: translateY(-7px) scale(1.015); }
          76% { transform: translateY(3px) scale(0.997); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {isWelcomeStep && (
        <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[3px]" aria-hidden="true" />
      )}
      {isGlowVisible && (
        <div
          className={`absolute rounded-[28px] border-2 bg-teal-200/5 shadow-[0_0_0_1px_rgba(45,212,191,0.35),0_0_34px_rgba(20,184,166,0.58)] transition-all ease-out ${hasCursorArrived ? 'border-teal-200/95' : 'border-teal-300/70'}`}
        style={{
          top: targetRect.top - 10,
          left: targetRect.left - 10,
          width: targetRect.width + 20,
          height: targetRect.height + 20,
          transitionDuration: `${AUTO_DEMO_TIMING.cursorTravelMs}ms`,
        }}
        />
      )}

      {!isWelcomeStep && <div
        className="absolute text-teal-300 drop-shadow-[0_8px_18px_rgba(15,23,42,0.45)] transition-all ease-out"
        style={{
          left: cursorLeft,
          top: cursorTop,
          transitionDuration: `${AUTO_DEMO_TIMING.cursorTravelMs}ms`,
          animation: hasCursorArrived || isClicking ? 'auto-demo-cursor-pop 650ms ease-out' : undefined,
        }}
        aria-hidden="true"
      >
        {(hasCursorArrived || isClicking) && (
          <span
            className={`absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${isClicking ? 'border-white bg-teal-300/20' : 'border-teal-200'}`}
            style={{ animation: isClicking ? 'auto-demo-click-ring 650ms ease-out' : 'auto-demo-arrival-ring 900ms ease-out 2' }}
          />
        )}
        <MousePointer2 className="h-9 w-9 fill-white text-teal-500" />
      </div>}

      {!isWelcomeStep && isGuideCollapsed && (
        <button
          type="button"
          onClick={() => setIsGuideCollapsed(false)}
          className="pointer-events-auto fixed bottom-2 right-2 z-[270] flex h-14 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-white shadow-xl shadow-slate-900/20 active:scale-95 dark:bg-white dark:text-slate-950"
          aria-label="Open guided tour"
        >
          <ListChecks className="h-5 w-5" />
          <span className="text-[10px] font-black uppercase tracking-widest">Tour</span>
        </button>
      )}

      {shouldShowPanel && <aside
        className={`pointer-events-auto absolute overflow-hidden border border-white/20 bg-white shadow-2xl transition-all duration-500 dark:bg-slate-900 ${isWelcomeStep ? 'rounded-3xl shadow-teal-950/20' : 'rounded-3xl sm:max-w-sm'} ${isPanelVisible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
        style={{
          left: isWelcomeStep ? welcomePlacement.left : undefined,
          top: isWelcomeStep ? welcomePlacement.top : undefined,
          right: isWelcomeStep ? undefined : 8,
          bottom: isWelcomeStep ? undefined : 8,
          width: isWelcomeStep ? welcomePlacement.width : guidePlacement.width,
          maxHeight: isWelcomeStep ? welcomePlacement.maxHeight : guidePlacement.maxHeight,
          pointerEvents: isPanelVisible ? 'auto' : 'none',
          animation: isWelcomeStep ? 'auto-demo-welcome-bounce 720ms cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
        }}
        aria-live="polite"
        aria-hidden={!isPanelVisible}
        data-auto-demo-panel="true"
      >
        <div
          className={`${isWelcomeStep ? 'cursor-default text-center bg-slate-950 text-white' : 'bg-slate-50 text-slate-900 dark:bg-slate-950/50 dark:text-white'} select-none border-b border-slate-100 p-4 dark:border-white/5`}
          onPointerDown={undefined}
        >
          <div className={`relative mb-3 flex items-center justify-between gap-3 ${isWelcomeStep ? 'justify-center' : ''}`}>
            <p className={`text-[9px] font-black uppercase tracking-[0.24em] ${isWelcomeStep ? 'text-teal-300' : 'text-teal-600 dark:text-teal-400'}`}>{guideHeaderLabel}</p>
            <button
              type="button"
              onClick={() => isWelcomeStep ? onClose() : setIsGuideCollapsed(true)}
              onPointerDown={(event) => event.stopPropagation()}
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${isWelcomeStep ? 'absolute right-0 top-1/2 -translate-y-1/2 bg-white/10 text-white hover:bg-white/20' : 'bg-white text-slate-500 hover:text-slate-900 dark:bg-white/10 dark:hover:text-white'}`}
              aria-label={isWelcomeStep ? 'Exit guided tour' : 'Collapse guided tour'}
            >
              {isWelcomeStep ? <X className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
          <h3 className={`${isWelcomeStep ? 'text-2xl sm:text-3xl' : 'text-sm uppercase text-slate-900 dark:text-white'} font-black leading-tight tracking-tight`}>{panelTitle}</h3>
          <div className={`mt-4 h-1.5 overflow-hidden rounded-full ${isWelcomeStep ? 'bg-white/10' : 'bg-slate-200 dark:bg-slate-800'}`}>
            <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div
          className="space-y-4 overflow-y-auto p-4"
          style={{ maxHeight: Math.max(220, (isWelcomeStep ? welcomePlacement.maxHeight : guidePlacement.maxHeight) - 96) }}
        >
          {!targetFound && (
            <p className="rounded-2xl bg-amber-50 p-3 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              Finding this area on the current screen. You can continue if the page is still loading.
            </p>
          )}
          <p className="text-sm font-semibold leading-relaxed text-slate-600 dark:text-slate-300">{stop.body}</p>
          <div className="rounded-2xl bg-teal-50 p-3 dark:bg-teal-950/30">
            <p className="text-[9px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-300">Key capability</p>
            <p className="mt-1 text-xs font-bold leading-relaxed text-teal-900 dark:text-teal-100">{stop.keyCapability}</p>
          </div>
          {!isWelcomeStep && isMenuOpen && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-slate-950/50">
              <p className="px-2 pb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Jump to a section</p>
              <div className="grid gap-1">
                {AUTO_DEMO_SECTIONS.map((section, index) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => goToSection(section.id)}
                    className={`rounded-xl px-3 py-2 text-left text-[11px] font-black transition-colors ${activeSection?.id === section.id ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'}`}
                  >
                    {index + 1}. {section.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStepIndex(getPreviousAutoDemoIndex(stepIndex))}
              disabled={stepIndex === 0}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300"
              aria-label="Previous demo stop"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            {!isWelcomeStep && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(current => !current)}
                  className="flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
                >
                  <Menu className="h-3.5 w-3.5" />
                  Menu
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 rounded-xl bg-slate-100 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-200 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  End
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={stop.action || stop.routeAfterClick ? performAction : goNext}
              disabled={isClicking}
              className="flex h-10 min-w-28 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-teal-700 disabled:opacity-70"
            >
              {isClicking ? 'Clicking...' : stop.action === 'switch-role' && isAdmin ? 'Switch View' : stop.routeAfterClick ? 'Click' : isLastStep ? 'Finish' : 'Next'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>}
    </div>
  );
};

export default AutoDemoTour;
