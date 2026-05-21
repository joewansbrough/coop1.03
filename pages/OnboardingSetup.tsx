import React from 'react';
import OnboardingProgress from '../components/onboarding/OnboardingProgress';
import { useOnboardingStatus } from '../hooks/useCoopData';

const OnboardingSetup: React.FC = () => {
  const { data: status, isLoading, isError, error, refetch } = useOnboardingStatus();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-600 border-t-transparent"></div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading setup status...</p>
        </div>
      </div>
    );
  }

  if (isError || !status) {
    return (
      <div className="mx-auto max-w-3xl rounded-[20px] border border-rose-200 bg-white p-6 text-center shadow-sm dark:border-rose-500/20 dark:bg-slate-900">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-500">Setup unavailable</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Could not load onboarding status</h1>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">{error?.message || 'Please try again.'}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-5 rounded-2xl bg-slate-900 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-teal-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="rounded-[20px] bg-slate-900 p-6 text-white shadow-2xl shadow-teal-900/10 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-teal-300">Optional setup flow</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Prepare this co-op workspace.</h1>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-300">
          Use this checklist to load the first real units, members, documents, and committee structure. Normal app navigation stays available while setup is incomplete.
        </p>
      </div>

      <OnboardingProgress status={status} />
    </div>
  );
};

export default OnboardingSetup;
