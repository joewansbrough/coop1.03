import React, { useState } from 'react';
import { Tenant, Unit } from '../types';
import { useNavigate } from 'react-router-dom';
import FilterBar from '../components/FilterBar';
import AppAlert from '../components/AppAlert';
import { formatDate, formatShortDate } from '../utils/dateUtils';
import { useCreateTenant } from '../hooks/useCoopData';
import type { TenantImportPreview } from '../utils/tenantImport';

interface TenantsProps {
  isAdmin?: boolean;
  isLoading?: boolean;
  tenants: Tenant[];
  setTenants: React.Dispatch<React.SetStateAction<Tenant[]>>;
  units: Unit[];
  isTenantsLoading?: boolean;
  isTenantsError?: boolean;
}

const Tenants: React.FC<TenantsProps> = ({ isAdmin = false, isLoading = false, tenants, setTenants, units }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [importCsv, setImportCsv] = useState('');
  const [importPreview, setImportPreview] = useState<TenantImportPreview | null>(null);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);

  const createTenantMutation = useCreateTenant();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [unitId, setUnitId] = useState('');
  const [status, setStatus] = useState<'Current' | 'Waitlist'>('Current');

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertMessage({ message, type });
    window.setTimeout(() => setAlertMessage(null), 5000);
  };

  const postTenantImport = async (path: 'preview' | 'confirm') => {
    const response = await fetch(`/api/tenants/import/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: importCsv }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(errorText);
    }

    return response.json();
  };

  const handleDownloadTemplate = () => {
    window.location.href = '/api/tenants/import-template';
  };

  const handleTenantCsvSelected = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    setImportCsv(text);
    setImportPreview(null);
  };

  const handlePreviewImport = async () => {
    if (!importCsv.trim()) {
      showAlert('Choose a tenant CSV file before previewing.', 'error');
      return;
    }

    setIsPreviewingImport(true);
    try {
      const preview = await postTenantImport('preview') as TenantImportPreview;
      setImportPreview(preview);
      showAlert(`Preview ready: ${preview.validRows} importable row${preview.validRows === 1 ? '' : 's'}.`, 'info');
    } catch (error) {
      console.error('Tenant import preview failed:', error);
      showAlert('Failed to preview tenant import.', 'error');
    } finally {
      setIsPreviewingImport(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview?.validRows) {
      showAlert('Preview the CSV and fix blocking errors before confirming.', 'error');
      return;
    }

    setIsConfirmingImport(true);
    try {
      const result = await postTenantImport('confirm');
      const tenantsResponse = await fetch('/api/tenants', { credentials: 'include' });
      if (tenantsResponse.ok) {
        const nextTenants = await tenantsResponse.json();
        setTenants(nextTenants);
      }
      setImportPreview(result.preview);
      showAlert(`Imported ${result.summary.importedRows} member row${result.summary.importedRows === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      console.error('Tenant import confirm failed:', error);
      showAlert('Failed to import tenants.', 'error');
    } finally {
      setIsConfirmingImport(false);
    }
  };

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload: Omit<Tenant, 'id'> = {
      firstName,
      lastName,
      email,
      phone,
      unitId: unitId || undefined,
      status,
      role: 'MEMBER',
      startDate: new Date().toISOString().split('T')[0]
    };

    createTenantMutation.mutate(payload, {
      onSuccess: (data) => {
        setTenants([...tenants, data]);
        setShowAddForm(false);
        setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setUnitId('');
        showAlert('New member registered in association directory.', 'success');
      },
      onError: () => showAlert('Failed to register member.', 'error')
    });
  };

  const filteredTenants = tenants.filter(t => {
    const matchesSearch =
      `${t.firstName} ${t.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase()) ||
      (units.find(u => u.id === t.unitId)?.number.includes(search));
    
    // Improved filter logic
    const matchesFilter = filter === 'All' || 
                         (filter === 'Current' && t.status === 'Current') ||
                         (filter === 'Waitlist' && t.status === 'Waitlist') ||
                         (filter === 'Past' && t.status === 'Past');
    return matchesSearch && matchesFilter;
  });

  const unitGroups = Object.values(
    filteredTenants
      .filter((tenant) => tenant.status === 'Current' && tenant.unitId)
      .reduce((groups, tenant) => {
        const key = tenant.unitId as string;
        const fallbackUnit = units.find((unit) => unit.id === key);
        const resolvedUnit = tenant.unit || fallbackUnit;

        if (!resolvedUnit) {
          return groups;
        }

        if (!groups[key]) {
          groups[key] = { unit: resolvedUnit, members: [] as Tenant[] };
        }

        groups[key].members.push(tenant);
        return groups;
      }, {} as Record<string, { unit: Unit; members: Tenant[] }>)
  ).sort((a, b) => a.unit.number.localeCompare(b.unit.number, undefined, { numeric: true }));

  const waitlistMembers = filteredTenants.filter(t => t.status === 'Waitlist');

  return (
    <div className="space-y-6 lg:space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-12 transition-all" data-demo-target="member-directory-page">
      {alertMessage && <AppAlert message={alertMessage.message} type={alertMessage.type} onClose={() => setAlertMessage(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Member Registry
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {isAdmin ? 'Protected community records and historical data.' : 'Connecting neighbors while respecting privacy.'}
          </p>
        </div>
        {isAdmin && (
          <div className="w-full sm:w-auto flex flex-col xs:flex-row gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="w-full sm:w-auto bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:border-brand-500 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-file-arrow-down"></i> Template
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full sm:w-auto bg-brand-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-plus"></i> Add New Member
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="max-w-2xl">
              <p className="text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-[0.2em] mb-2">Onboarding import</p>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Load members after units are ready</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                Download the schema, fill in member rows, then preview before anything is saved. Missing units and duplicate emails are caught before import.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 min-w-full sm:min-w-0 lg:min-w-[220px]">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest hover:border-brand-500 transition-colors flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-download"></i> Download Schema
              </button>
              <label className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest hover:border-brand-500 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                <i className="fa-solid fa-upload"></i> Choose CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => handleTenantCsvSelected(event.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          {importCsv && (
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected CSV</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">{importCsv.split(/\r?\n/).filter(Boolean).length - 1} data row(s) ready to preview</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handlePreviewImport}
                  disabled={isPreviewingImport}
                  className="px-5 py-3 rounded-xl bg-brand-600 text-white text-xs font-black uppercase tracking-widest hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-magnifying-glass-chart"></i> {isPreviewingImport ? 'Previewing...' : 'Preview'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isConfirmingImport || !importPreview?.validRows}
                  className="px-5 py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-check"></i> {isConfirmingImport ? 'Importing...' : 'Confirm'}
                </button>
              </div>
            </div>
          )}

          {importPreview && (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
                  <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">Importable</p>
                  <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100">{importPreview.validRows}</p>
                </div>
                <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 px-4 py-3">
                  <p className="text-[10px] font-black text-rose-700 dark:text-rose-300 uppercase tracking-widest">Errors</p>
                  <p className="text-2xl font-black text-rose-900 dark:text-rose-100">{importPreview.errorRows}</p>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                  <p className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest">Warnings</p>
                  <p className="text-2xl font-black text-amber-900 dark:text-amber-100">{importPreview.warningRows}</p>
                </div>
              </div>

              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-white/5">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950/80 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Row</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Member</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {importPreview.rows.map(row => (
                      <tr key={row.rowNumber} className="bg-white dark:bg-slate-900">
                        <td className="px-4 py-3 text-xs font-black text-slate-500">{row.rowNumber}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{row.firstName} {row.lastName}</p>
                          <p className="text-[11px] text-slate-400 font-medium">{row.email || 'Missing email'}</p>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">{row.unitNumber || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${row.valid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'}`}>
                            {row.valid ? 'Ready' : 'Fix'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                          {[...row.errors, ...row.warnings].length > 0 ? [...row.errors, ...row.warnings].join(' ') : 'No issues.'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Add Member Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 animate-in slide-in-from-bottom sm:zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Register New Member</h3>
              <button onClick={() => setShowAddForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleAddTenant} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">First Name</label>
                  <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Name</label>
                  <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone Number</label>
                <input type="text" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit</label>
                  <select value={unitId} onChange={e => setUnitId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm outline-none text-slate-900 dark:text-white">
                    <option value="">None / Waitlist</option>
                    {units.map(u => <option key={u.id} value={u.id}>Unit {u.number}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm outline-none text-slate-900 dark:text-white">
                    <option value="Current">Current Member</option>
                    <option value="Waitlist">Waitlist</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-xs font-black uppercase hover:bg-brand-700 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-plus"></i> Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <FilterBar 
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={isAdmin ? "Filter by name, unit, or email..." : "Search neighbors..."}
        filter={filter}
        onFilterChange={setFilter}
        filterOptions={['All', 'Current', 'Past', 'Waitlist']}
      />

      {/* ── Mobile: Card List ── */}
      {isLoading && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 px-6 py-12 text-center">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading member directory...</p>
        </div>
      )}

      {!isLoading && <div className="sm:hidden space-y-3">
        {unitGroups.map(group => (
          <div key={group.unit.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
            {/* Unit header */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <div>
                <span className="text-base font-black text-slate-900 dark:text-white">Unit {group.unit.number}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter ml-2">{group.unit.type} • Floor {group.unit.floor}</span>
              </div>
              <span className="text-[9px] font-black px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 rounded-lg uppercase">
                {group.members.length} {group.members.length === 1 ? 'Member' : 'Members'}
              </span>
            </div>
            {/* Members */}
            {group.members.map((member, idx) => (
              <div
                key={member.id}
                className={`flex items-center justify-between px-4 py-3 ${idx < group.members.length - 1 ? 'border-b border-slate-100 dark:border-white/5' : ''}`}
                onClick={() => navigate(isAdmin ? `/admin/tenants/${member.id}` : `/directory`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-black uppercase shrink-0">
                    {member.firstName[0]}{member.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{member.firstName} {member.lastName}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase hidden xs:block">
                    Since {formatShortDate(member.startDate)}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400">
                    <i className="fa-solid fa-arrow-right-long text-xs"></i>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Waitlist on mobile */}
        {waitlistMembers.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20">
              <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Waitlist & Unassigned</span>
            </div>
            {waitlistMembers.map((member, idx) => (
              <div
                key={member.id}
                className={`flex items-center justify-between px-4 py-3 ${idx < waitlistMembers.length - 1 ? 'border-b border-slate-100 dark:border-white/5' : ''}`}
                onClick={() => navigate(isAdmin ? `/admin/tenants/${member.id}` : `/directory`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-black uppercase shrink-0">
                    {member.firstName[0]}{member.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{member.firstName} {member.lastName}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{member.email}</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 shrink-0">
                  <i className="fa-solid fa-arrow-right-long text-xs"></i>
                </div>
              </div>
            ))}
          </div>
        )}

        {unitGroups.length === 0 && waitlistMembers.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 px-6 py-12 text-center">
            <p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">
              {isAdmin && tenants.length === 0 ? 'Import or add the first members' : 'No member records found'}
            </p>
            <p className="text-xs text-slate-400 font-medium mt-2">
              {isAdmin && tenants.length === 0 ? 'Use the onboarding import above once units exist, or add members manually.' : 'Try adjusting your search or filter.'}
            </p>
          </div>
        )}
      </div>}

      {/* ── Desktop: Table ── */}
      {!isLoading && <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm" data-demo-target="member-directory-table">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-white/5">
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset/Unit</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Shareholders / Members</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Info</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Residency</th>
              <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-white/5">
            {unitGroups.map(group => (
              <tr key={group.unit.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group/row">
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="text-base font-black text-slate-900 dark:text-white">Unit {group.unit.number}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{group.unit.type} • Floor {group.unit.floor}</span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-2">
                    {group.members.map(member => (
                      <div key={member.id} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center text-[10px] font-black uppercase shrink-0">
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{member.firstName} {member.lastName}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-1.5">
                    {group.members.map(member => (
                      <div key={member.id} className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={member.email}>
                        {member.email}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-1">
                    {group.members.map(member => (
                      <span key={member.id} className="text-[10px] font-bold text-slate-400 uppercase">
                        Since {formatShortDate(member.startDate)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex flex-col items-end gap-2">
                    {group.members.map(member => (
                      <button
                        key={member.id}
                        onClick={() => navigate(isAdmin ? `/admin/tenants/${member.id}` : `/directory`)}
                        className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-500 transition-all shadow-sm"
                      >
                        <i className="fa-solid fa-arrow-right-long text-xs"></i>
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}

            {waitlistMembers.length > 0 && (
              <>
                <tr className="bg-slate-50 dark:bg-slate-950/80">
                  <td colSpan={5} className="px-8 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Waitlist & Unassigned Members</td>
                </tr>
                {waitlistMembers.map(member => (
                  <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-8 py-6">
                      <span className="text-[10px] font-black px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg uppercase">Waitlist</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-black uppercase shrink-0">
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-white">{member.firstName} {member.lastName}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{member.email}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Applied {formatDate(member.startDate)}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button
                        onClick={() => navigate(isAdmin ? `/admin/tenants/${member.id}` : `/directory`)}
                        className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 inline-flex items-center justify-center text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-500 transition-all shadow-sm"
                      >
                        <i className="fa-solid fa-arrow-right-long"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            )}

            {unitGroups.length === 0 && waitlistMembers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-20 text-center">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                    {isAdmin && tenants.length === 0 ? 'Import or add the first members' : 'No member records found'}
                  </p>
                  <p className="text-xs text-slate-400 font-medium mt-2">
                    {isAdmin && tenants.length === 0 ? 'Use the onboarding import above once units exist, or add members manually.' : 'Try adjusting your search or filter.'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>}
    </div>
  );
};

export default Tenants;
