import React from 'react';
import { Link } from 'react-router-dom';
import type { OnboardingStatus } from '../../utils/onboardingStatus';

interface OnboardingProgressProps {
  status: OnboardingStatus;
  compact?: boolean;
}

const stepIconClass = (ready: boolean) =>
  ready
    ? 'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/40'
    : 'bg-slate-100 text-slate-400 ring-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:ring-white/10';

const OnboardingProgress: React.FC<OnboardingProgressProps> = ({ status, compact = false }) => {
  const steps = Object.values(status.steps);
  const progress = Math.round((status.completedCount / Math.max(1, status.totalCount)) * 100);

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-teal-600 dark:text-teal-300">Setup progress</p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:text-white">
            {status.isReadyToLaunch ? 'Workspace ready' : 'Load the first co-op data'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
            {status.isReadyToLaunch
              ? 'The core onboarding checklist is complete. You can keep refining records as the co-op settles in.'
              : 'The app is ready to use while units, members, documents, committees, and Oracle document search come online.'}
          </p>
        </div>
        <div className="min-w-[8rem] rounded-2xl bg-slate-50 p-4 text-center dark:bg-slate-950/50">
          <p className="text-3xl font-black text-slate-900 dark:text-white">{progress}%</p>
          <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
            {status.completedCount} of {status.totalCount}
          </p>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className={`mt-5 grid gap-3 ${compact ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2'}`}>
        {steps.map(step => (
          <div key={step.key} className="flex min-w-0 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-white/5 dark:bg-slate-950/40">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${stepIconClass(step.ready)}`}>
              <i className={`fa-solid ${step.ready ? 'fa-check' : 'fa-circle'}`}></i>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-black text-slate-900 dark:text-white">{step.label}</p>
                <span className={`shrink-0 rounded-lg px-2 py-1 text-[8px] font-black uppercase tracking-widest ${step.ready ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                  {step.ready ? 'Ready' : 'Open'}
                </span>
              </div>
              {!compact && <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{step.description}</p>}
              {!step.ready && (
                <Link to={step.actionHref} className="mt-3 inline-flex text-[10px] font-black uppercase tracking-widest text-teal-600 transition-colors hover:text-teal-700 dark:text-teal-300">
                  {step.actionLabel}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default OnboardingProgress;
