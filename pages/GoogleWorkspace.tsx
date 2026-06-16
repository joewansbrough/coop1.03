import React, { useEffect, useMemo, useState } from 'react';
import { useGoogleWorkspaceStatus, useSaveGoogleWorkspaceSettings, type GoogleWorkspaceSettingsInput } from '../hooks/useCoopData';

const WORKFLOW_STEPS = [
  'Confirm Google for Nonprofits eligibility and Workspace domain ownership.',
  'Connect Google OAuth and service-account credentials.',
  'Map shared Drive roots to coopHUB document visibility.',
  'Pilot Directory, Groups, Calendar, and Meet sync with the board.',
  'Expand Forms, Sheets, Groups notices, and Sites publishing after review.',
];

const GoogleWorkspace: React.FC = () => {
  const { data: status, isLoading, isError, error, refetch } = useGoogleWorkspaceStatus();
  const saveSettings = useSaveGoogleWorkspaceSettings();
  const [form, setForm] = useState<GoogleWorkspaceSettingsInput>({
    enabled: false,
    domain: '',
    adminEmail: '',
    driveRootFolderIds: [],
    directorySyncEnabled: false,
    calendarSyncEnabled: false,
    communicationsSyncEnabled: false,
    formsSyncEnabled: false,
    sitesEnabled: false,
  });
  const [driveRootsText, setDriveRootsText] = useState('');

  const enabledCapabilityIds = useMemo(
    () => new Set(status?.enabledCapabilities.map(capability => capability.id) || []),
    [status?.enabledCapabilities],
  );

  useEffect(() => {
    if (!status) return;
    setForm({
      enabled: status.connected,
      domain: status.domain || '',
      adminEmail: status.adminEmail || '',
      driveRootFolderIds: status.driveRootFolderIds,
      directorySyncEnabled: enabledCapabilityIds.has('directory'),
      calendarSyncEnabled: enabledCapabilityIds.has('calendar'),
      communicationsSyncEnabled: enabledCapabilityIds.has('communications'),
      formsSyncEnabled: enabledCapabilityIds.has('forms'),
      sitesEnabled: enabledCapabilityIds.has('sites'),
    });
    setDriveRootsText(status.driveRootFolderIds.join('\n'));
  }, [enabledCapabilityIds, status]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-600 border-t-transparent"></div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Workspace status...</p>
        </div>
      </div>
    );
  }

  if (isError || !status) {
    return (
      <div className="mx-auto max-w-3xl rounded-[20px] border border-rose-200 bg-white p-6 text-center shadow-sm dark:border-rose-500/20 dark:bg-slate-900">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-500">Workspace unavailable</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Could not load Google Workspace status</h1>
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

  const readinessSteps = Object.values(status.readiness);
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    saveSettings.mutate({
      ...form,
      driveRootFolderIds: driveRootsText
        .split(/\r?\n|,/)
        .map(item => item.trim())
        .filter(Boolean),
    });
  };
  const updateForm = <K extends keyof GoogleWorkspaceSettingsInput>(key: K, value: GoogleWorkspaceSettingsInput[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <section className="rounded-[20px] bg-slate-900 p-6 text-white shadow-2xl shadow-teal-900/10 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-teal-300">Google Workspace</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Co-op operations, connected.</h1>
            <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-slate-300">
              Use Google Workspace for identity, shared files, calendars, meetings, notices, forms, and a lightweight public portal while coopHUB keeps the governance record.
            </p>
          </div>
          <div className="grid min-w-64 gap-3 rounded-2xl border border-white/10 bg-white/10 p-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Domain</p>
              <p className="mt-1 text-sm font-black text-white">{status.domain || 'Not connected'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Admin</p>
              <p className="mt-1 truncate text-sm font-black text-white">{status.adminEmail || 'Not set'}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {readinessSteps.map(step => (
          <div key={step.key} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{step.label}</p>
                <p className="mt-2 text-sm font-bold leading-5 text-slate-700 dark:text-slate-200">{step.description}</p>
              </div>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${step.ready ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                <i className={`fa-solid ${step.ready ? 'fa-check' : 'fa-circle-exclamation'} text-xs`}></i>
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 dark:text-teal-300">Ecosystem map</p>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Workspace capabilities</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {status.capabilities.map(capability => (
              <article key={capability.id} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{capability.label}</p>
                    <p className="mt-2 text-sm font-bold leading-5 text-slate-600 dark:text-slate-300">{capability.value}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${capability.enabled ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {capability.enabled ? 'Ready' : 'Later'}
                  </span>
                </div>
                <p className="mt-3 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{capability.description}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 dark:text-teal-300">Rollout</p>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Recommended path</h2>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-slate-900">
            <ol className="space-y-4">
              {WORKFLOW_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-[10px] font-black text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-sm font-bold leading-5 text-slate-700 dark:text-slate-200">{step}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-950/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Eligibility note</p>
            <p className="mt-2 text-sm font-bold leading-6 text-amber-900 dark:text-amber-100">
              Some BC co-op associations may qualify for Google for Nonprofits, but each co-op still needs verification before assuming free Workspace licensing.
            </p>
          </div>
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <form onSubmit={handleSubmit} className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 dark:text-teal-300">Configuration</p>
              <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Workspace profile</h2>
            </div>
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={event => updateForm('enabled', event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              Enabled
            </label>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Workspace domain</span>
              <input
                value={form.domain}
                onChange={event => updateForm('domain', event.target.value)}
                placeholder="examplecoop.ca"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Workspace admin email</span>
              <input
                type="email"
                value={form.adminEmail}
                onChange={event => updateForm('adminEmail', event.target.value)}
                placeholder="admin@examplecoop.ca"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drive root folder IDs</span>
              <textarea
                value={driveRootsText}
                onChange={event => setDriveRootsText(event.target.value)}
                rows={4}
                placeholder="One folder ID per line"
                className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              />
            </label>
          </div>

          {saveSettings.isError && (
            <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
              {saveSettings.error?.message || 'Could not save Workspace settings.'}
            </p>
          )}
          {saveSettings.isSuccess && (
            <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
              Workspace settings saved.
            </p>
          )}

          <button
            type="submit"
            disabled={saveSettings.isPending}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            <i className={`fa-solid ${saveSettings.isPending ? 'fa-spinner animate-spin' : 'fa-floppy-disk'}`}></i>
            Save Workspace Settings
          </button>
        </form>

        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 dark:text-teal-300">Sync lanes</p>
          <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Enable in stages</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ['directorySyncEnabled', 'Directory & Groups', 'Mirror users, board, committee, and resident groups.'],
              ['calendarSyncEnabled', 'Calendar & Meet', 'Sync meetings, AGM dates, maintenance windows, and Meet links.'],
              ['communicationsSyncEnabled', 'Gmail & Groups Notices', 'Prepare announcements for trusted Workspace channels.'],
              ['formsSyncEnabled', 'Forms & Sheets Intake', 'Review form responses before importing records.'],
              ['sitesEnabled', 'Google Sites Portal', 'Publish selected documents, notices, and forms.'],
            ].map(([key, label, description]) => (
              <label key={key} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/5 dark:bg-slate-950">
                <input
                  type="checkbox"
                  checked={Boolean(form[key as keyof GoogleWorkspaceSettingsInput])}
                  onChange={event => updateForm(key as keyof GoogleWorkspaceSettingsInput, event.target.checked as never)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>
                  <span className="block text-sm font-black text-slate-900 dark:text-white">{label}</span>
                  <span className="mt-1 block text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default GoogleWorkspace;
