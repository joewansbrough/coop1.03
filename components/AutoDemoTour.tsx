import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, MousePointer2, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AUTO_DEMO_STOPS,
  AUTO_DEMO_TIMING,
  getAutoDemoPanelPlacement,
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

const AutoDemoTour: React.FC<AutoDemoTourProps> = ({ isOpen, onClose, onRoleSwitch, isAdmin = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect>(emptyRect);
  const [targetFound, setTargetFound] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [hasCursorArrived, setHasCursorArrived] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{ left: number; top: number } | null>(null);
  const stop = getAutoDemoStop(stepIndex);

  useEffect(() => {
    if (!isOpen || !stop) return;
    if (`${location.pathname}${location.search}` !== stop.route) {
      navigate(stop.route);
      window.setTimeout(snapPageToTop, 80);
    }
  }, [isOpen, location.pathname, location.search, navigate, stop]);

  useEffect(() => {
    if (!isOpen || !stop) return;

    let frame = 0;
    const measure = () => {
      const target = document.querySelector<HTMLElement>(`[data-demo-target="${stop.target}"]`);
      if (!target) {
        setTargetFound(false);
        setTargetRect(emptyRect);
        frame = window.setTimeout(measure, AUTO_DEMO_TIMING.measureDelayMs);
        return;
      }

      if (stop.scrollMode === 'top') {
        snapPageToTop();
      } else if (stop.scrollMode === 'target') {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      } else if (stop.scrollMode === 'dashboard-preview') {
        snapPageToTop();
        window.setTimeout(previewDashboardScroll, AUTO_DEMO_TIMING.panelDelayMs + 500);
      } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
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
          frame = window.setTimeout(measure, AUTO_DEMO_TIMING.measureDelayMs);
        }
      }, AUTO_DEMO_TIMING.measureDelayMs);
    };

    measure();
    const onResize = () => measure();
    const onScroll = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.clearTimeout(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [isOpen, location.pathname, location.search, stop]);

  useEffect(() => {
    if (!isOpen || !stop) return;
    setIsPanelVisible(false);
    setHasCursorArrived(false);
    setIsClicking(false);

    const arrivalTimer = window.setTimeout(() => {
      setHasCursorArrived(true);
    }, AUTO_DEMO_TIMING.cursorTravelMs);
    const panelTimer = window.setTimeout(() => {
      setIsPanelVisible(true);
    }, AUTO_DEMO_TIMING.panelDelayMs);

    return () => {
      window.clearTimeout(arrivalTimer);
      window.clearTimeout(panelTimer);
    };
  }, [isOpen, location.pathname, location.search, stepIndex, stop]);

  const cardPlacement = useMemo(() => {
    if (typeof window === 'undefined') return { left: 24, top: 24, width: 360, maxHeight: 420 };
    return getAutoDemoPanelPlacement({
      rect: targetRect,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }, [targetRect]);

  const isLastStep = stepIndex === AUTO_DEMO_STOPS.length - 1;
  const progress = Math.round(((stepIndex + 1) / AUTO_DEMO_STOPS.length) * 100);
  const cursorLeft = targetRect.left + Math.min(targetRect.width - 18, Math.max(18, targetRect.width * 0.72));
  const cursorTop = targetRect.top + Math.min(targetRect.height - 18, Math.max(18, targetRect.height * 0.42));
  const resolvedPanelPosition = panelPosition || { left: cardPlacement.left, top: cardPlacement.top };

  const goNext = useCallback(() => {
    if (isLastStep) {
      onClose();
      return;
    }
    setStepIndex(getNextAutoDemoIndex(stepIndex));
  }, [isLastStep, onClose, stepIndex]);

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

      const activeTarget = document.querySelector<HTMLElement>(`[data-demo-target="${stop.target}"]`);
      const clickedActiveTarget = Boolean(activeTarget && activeTarget.contains(node));
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (clickedActiveTarget && !isClicking) {
        performAction();
      }
    };

    document.addEventListener('click', interceptPageClick, true);
    return () => document.removeEventListener('click', interceptPageClick, true);
  }, [isClicking, isOpen, performAction, stop]);

  const beginPanelDrag = (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = resolvedPanelPosition.left;
    const startTop = resolvedPanelPosition.top;

    const movePanel = (moveEvent: PointerEvent) => {
      const maxLeft = Math.max(16, window.innerWidth - cardPlacement.width - 16);
      const maxTop = Math.max(16, window.innerHeight - 120);
      setPanelPosition({
        left: Math.max(16, Math.min(maxLeft, startLeft + moveEvent.clientX - startX)),
        top: Math.max(16, Math.min(maxTop, startTop + moveEvent.clientY - startY)),
      });
    };

    const stopDrag = () => {
      window.removeEventListener('pointermove', movePanel);
      window.removeEventListener('pointerup', stopDrag);
    };

    window.addEventListener('pointermove', movePanel);
    window.addEventListener('pointerup', stopDrag);
  };

  if (!isOpen || !stop) return null;

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
      `}</style>
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

      <div
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
      </div>

      <aside
        className={`pointer-events-auto absolute overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl transition-all duration-500 dark:bg-slate-900 ${isPanelVisible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
        style={{
          left: resolvedPanelPosition.left,
          top: resolvedPanelPosition.top,
          width: cardPlacement.width,
          maxHeight: cardPlacement.maxHeight,
          pointerEvents: isPanelVisible ? 'auto' : 'none',
        }}
        aria-live="polite"
        aria-hidden={!isPanelVisible}
        data-auto-demo-panel="true"
      >
        <div
          className="cursor-move select-none border-b border-slate-100 bg-slate-950 p-4 text-white dark:border-white/5"
          onPointerDown={beginPanelDrag}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-teal-300">Automated Demo</p>
            <button
              type="button"
              onClick={onClose}
              onPointerDown={(event) => event.stopPropagation()}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Exit automated demo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h3 className="text-lg font-black leading-tight tracking-tight">{stop.title}</h3>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-teal-300 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div
          className="space-y-4 overflow-y-auto p-4"
          style={{ maxHeight: Math.max(220, cardPlacement.maxHeight - 96) }}
        >
          {!targetFound && (
            <p className="rounded-2xl bg-amber-50 p-3 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              Finding this area on the current screen. You can continue if the page is still loading.
            </p>
          )}
          <p className="text-sm font-semibold leading-relaxed text-slate-600 dark:text-slate-300">{stop.body}</p>
          <div className="rounded-2xl bg-teal-50 p-3 dark:bg-teal-950/30">
            <p className="text-[9px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-300">Customer benefit</p>
            <p className="mt-1 text-xs font-bold leading-relaxed text-teal-900 dark:text-teal-100">{stop.customerValue}</p>
          </div>
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
      </aside>
    </div>
  );
};

export default AutoDemoTour;
