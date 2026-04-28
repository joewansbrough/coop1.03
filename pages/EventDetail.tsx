
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { Committee, CoopEvent, Document as CoopDocument, Tenant } from '../types';
import AppAlert from '../components/AppAlert';
import MinutesBuilder from '../components/MinutesBuilder';
import { useMinutes } from '../hooks/useCoopData';
import { MinutesPDF } from '../services/export/pdfGenerator';

const MinutesReadOnly: React.FC<{ data: any; event: CoopEvent }> = ({ data, event }) => {
  const formData = data?.formData || data?.data;
  const [isExporting, setIsExporting] = useState(false);

  if (!data || !formData) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/5 p-12 text-center">
        <p className="text-slate-500">Unable to load minutes data. Please contact the administrator.</p>
      </div>
    );
  }

  const { attendees = [], motions = [], meetingType } = data;
  const linkedDocuments = Array.isArray(formData.linkedDocuments)
    ? formData.linkedDocuments
    : formData.linkedDocument
      ? [formData.linkedDocument]
      : [];
  const actionItems = Array.isArray(formData.actionItemsList)
    ? formData.actionItemsList.filter((item: any) => item?.description?.trim() || item?.responsible?.length || item?.dueDate)
    : [];
  const attendeeRecords = attendees.filter((attendee: any) => attendee?.name?.trim());
  const guestNames = Array.isArray(formData.guests) ? formData.guests.filter((name: string) => name?.trim()) : [];
  const presentPeople = attendeeRecords.length > 0
    ? attendeeRecords
    : meetingType === 'quick'
      ? guestNames.map((name: string) => ({ name, position: '' }))
      : [];

  const getMeetingLabel = (type: string) => {
    switch (type) {
      case 'quick': return 'Quick Meeting';
      case 'regular': return 'Regular Board Meeting';
      case 'agm': return 'Annual General Meeting';
      case 'special': return 'Special General Meeting';
      default: return 'Meeting Minutes';
    }
  };

  const getPresentLabel = (type: string) => {
    switch (type) {
      case 'regular':
      case 'agm':
        return 'Directors Present';
      case 'special':
        return 'Members Present';
      case 'quick':
        return 'Attendees Present';
      default:
        return 'Present';
    }
  };

  const formatTime12h = (time?: string) => {
    if (!time) return 'N/A';
    const [hoursValue, minutesValue = '00'] = time.split(':');
    const hours = Number(hoursValue);
    if (Number.isNaN(hours)) return time;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutesValue.padStart(2, '0')} ${suffix}`;
  };

  const formatDateOnly = (date?: string) => {
    if (!date) return 'No due date';
    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) return date;
    return new Date(year, month - 1, day).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const minutesData = {
        ...data,
        formData,
        attendees: presentPeople,
        motions,
        meetingType,
      };
      const blob = await pdf(<MinutesPDF data={minutesData} event={event} />).toBlob();
      saveAs(blob, `Minutes_${formData.meetingDate || event.date.split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4">
      <div className="bg-slate-900 p-8 flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
        <div>
          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-brand-500 text-white uppercase tracking-widest mb-2 inline-block">
            {getMeetingLabel(meetingType)}
          </span>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Community Record</h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meeting Date</p>
          <p className="text-lg font-black text-white">{formData.meetingDate || event.date.split('T')[0]}</p>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={`fa-solid ${isExporting ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>
            {isExporting ? 'Exporting...' : 'Export to PDF'}
          </button>
        </div>
      </div>

      <div className="p-8 lg:p-12 space-y-12">
        <ReadOnlySection title="Meeting Information" icon="fa-info-circle">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <ReadOnlyField label="Location" value={formData.location || event.location} />
            <ReadOnlyField label="Start Time" value={formatTime12h(formData.startTime || event.time)} />
            <ReadOnlyField label="Chairperson" value={formData.chair} />
            <ReadOnlyField label="Recorded By" value={formData.minuteTaker} />
          </div>
        </ReadOnlySection>

        {linkedDocuments.length > 0 && (
          <ReadOnlySection title="Linked Documents" icon="fa-link">
            <div className="space-y-3">
              {linkedDocuments.map((linkedDocument: any) => (
                <div key={linkedDocument.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Attached Record</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">{linkedDocument.title}</p>
                  </div>
                  {linkedDocument.url && linkedDocument.url !== '#' && (
                    <button
                      type="button"
                      onClick={() => window.open(linkedDocument.url, '_blank', 'noopener,noreferrer')}
                      className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square mr-2"></i>
                      Open Document
                    </button>
                  )}
                </div>
              ))}
            </div>
          </ReadOnlySection>
        )}

        <ReadOnlySection title="Attendance" icon="fa-users">
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{getPresentLabel(meetingType)}</p>
              {presentPeople.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {presentPeople.map((a: any, i: number) => (
                    <span key={`${a.name}-${i}`} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/5">
                      {a.name}{a.position ? ` (${a.position})` : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No attendees recorded.</p>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {formData.directorsAbsent?.length > 0 && (
                <ReadOnlyField label="Regrets/Absent" value={Array.isArray(formData.directorsAbsent) ? formData.directorsAbsent.join(', ') : formData.directorsAbsent} />
              )}
              {meetingType !== 'quick' && formData.guests?.length > 0 && (
                <ReadOnlyField label="Guests/Attendees" value={Array.isArray(formData.guests) ? formData.guests.join(', ') : formData.guests} />
              )}
            </div>
          </div>
        </ReadOnlySection>

        {(formData.boardReport || formData.financeReport || formData.committeeReports) && (
          <ReadOnlySection title="Reports & Discussion" icon="fa-file-lines">
            <div className="space-y-8">
              {formData.boardReport && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Board Report</p>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: formData.boardReport }}></div>
                </div>
              )}
              {formData.financeReport && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Financial Report</p>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: formData.financeReport }}></div>
                </div>
              )}
              {formData.committeeReports && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Committee Reports</p>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: formData.committeeReports }}></div>
                </div>
              )}
            </div>
          </ReadOnlySection>
        )}

        {motions.length > 0 && (
          <ReadOnlySection title="Motions & Resolutions" icon="fa-gavel">
            <div className="space-y-4">
              {motions.map((m: any, i: number) => (
                <div key={i} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-white/5">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motion #{i + 1}</span>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                      m.result === 'carried' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      m.result === 'defeated' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {m.result || 'Pending'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">{m.description}</p>
                  <div className="flex gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span>Moved by: <span className="text-slate-600 dark:text-slate-300">{m.mover}</span></span>
                    <span>Seconded by: <span className="text-slate-600 dark:text-slate-300">{m.seconder}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </ReadOnlySection>
        )}

        {actionItems.length > 0 ? (
          <ReadOnlySection title="Action Items" icon="fa-tasks">
            <div className="space-y-4">
              {actionItems.map((item: any, index: number) => (
                <div key={item.id || index} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Action Item #{index + 1}</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">{item.description || 'No action described.'}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ReadOnlyField label="Responsible" value={Array.isArray(item.responsible) && item.responsible.length > 0 ? item.responsible.join(', ') : 'Unassigned'} />
                    <ReadOnlyField label="Complete By" value={formatDateOnly(item.dueDate)} />
                  </div>
                </div>
              ))}
            </div>
          </ReadOnlySection>
        ) : formData.actionItems && (
          <ReadOnlySection title="Action Items" icon="fa-tasks">
            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: formData.actionItems }}></div>
          </ReadOnlySection>
        )}
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 p-8 border-t border-slate-200 dark:border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <i className="fa-solid fa-check-double"></i>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Status</p>
            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase">Finalized & Archived Community Record</p>
          </div>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
          Oak Bay Housing Co-op | Digitally Verified
        </p>
      </div>
    </div>
  );
};

const ReadOnlySection: React.FC<{ title: string; icon: string; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="space-y-6">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 bg-brand-50 dark:bg-brand-900/20 rounded-2xl flex items-center justify-center text-brand-600 dark:text-brand-400">
        <i className={`fa-solid ${icon} text-sm`}></i>
      </div>
      <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{title}</h3>
      <div className="h-px bg-slate-100 dark:bg-white/5 flex-1"></div>
    </div>
    <div className="pl-14">
      {children}
    </div>
  </div>
);

const ReadOnlyField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{value || 'N/A'}</p>
  </div>
);

interface EventDetailProps {
  isAdmin: boolean;
  isGuest?: boolean;
  user: { email: string; name: string };
  events: CoopEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CoopEvent[]>>;
  committees?: Committee[];
  documents?: CoopDocument[];
  setDocuments?: React.Dispatch<React.SetStateAction<CoopDocument[]>>;
}

const EventDetail: React.FC<EventDetailProps> = ({ isAdmin, isGuest = false, user, events, setEvents, committees = [], documents = [], setDocuments }) => {
  const { eventId } = useParams<{ eventId: string }>();
  const queryClient = useQueryClient();
  const [event, setEvent] = useState(events.find(e => e.id === eventId));
  const [isEditing, setIsEditing] = useState(false);
  const [isAttending, setIsAttending] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'minutes'>('overview');

  const { data: minutesList } = useMinutes();
  
  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertMessage({ message, type });
    window.setTimeout(() => setAlertMessage(null), 5000);
  };

  const isTemp = event?.id.toString().startsWith('temp-');

  useEffect(() => {
    const foundEvent = events.find(e => e.id === eventId);
    setEvent(foundEvent);
    if (foundEvent && foundEvent.attendees) {
      setIsAttending(foundEvent.attendees.some(a => a.email === user.email));
    }
  }, [eventId, events, user.email]);

  const formatTime12h = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours24, minutes] = timeStr.split(':');
    const hours = parseInt(hours24, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes} ${ampm}`;
  };

  const meetingMinutes = event ? minutesList?.find(m => m.meetingId === event.id) : null;

  // Debugging log: Check isAdmin and meetingMinutes status
  useEffect(() => {
    // ... existing effect code ...
    console.log('EventDetail Mount Check:', { isAdmin, meetingMinutes: !!meetingMinutes, eventId: event?.id, meetingMinutesId: meetingMinutes?.id });
  }, [isAdmin, meetingMinutes, event]);
    
  if (!event) return <div className="p-8 text-center text-slate-500">Event not found.</div>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const payload = {
      title: (form.elements.namedItem('title') as HTMLInputElement).value,
      category: (form.elements.namedItem('category') as HTMLSelectElement).value as any,
      date: (form.elements.namedItem('date') as HTMLInputElement).value,
      time: (form.elements.namedItem('time') as HTMLInputElement).value,
      location: (form.elements.namedItem('location') as HTMLInputElement).value,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value,
      committeeId: (form.elements.namedItem('committeeId') as HTMLSelectElement).value || null,
    };

    if (isTemp) {
      const updatedTempEvent = { ...event, ...payload };
      setEvents(current => current.map(ev => ev.id === event.id ? updatedTempEvent : ev));
      setIsEditing(false);
      showAlert('Temporary event updated for this session.', 'success');
      return;
    }

    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setEvents(current => current.map(ev => ev.id === event.id ? data : ev));
      setIsEditing(false);
      showAlert('Event details updated successfully.', 'success');
    } catch (err) {
      console.error(err);
      showAlert('Failed to update event details.', 'error');
    }
  };

  const handleAttend = async () => {
    if (isGuest) return;
    try {
      const res = await fetch(`/api/events/${event.id}/attend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setEvents(events.map(ev => ev.id === event.id ? data : ev));
        setIsAttending(true);
        showAlert('Attendance confirmed.', 'success');
      } else {
        showAlert(data.error || 'Failed to confirm attendance.', 'error');
      }
    } catch (err) {
      console.error(err);
      showAlert('Failed to confirm attendance.', 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 transition-colors duration-200">
      {alertMessage && <AppAlert message={alertMessage.message} type={alertMessage.type} onClose={() => setAlertMessage(null)} />}
      <div className="flex items-center gap-4 text-slate-500 text-sm mb-2">
        <Link to="/calendar" className="hover:text-brand-600 transition-colors flex items-center gap-1">
          <i className="fa-solid fa-arrow-left"></i> Back to Calendar
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800 dark:text-slate-200">{event.title}</span>
      </div>

      <nav className="flex border-b border-slate-200 dark:border-white/5 shrink-0 overflow-x-auto scrollbar-hide">
        {[
          { id: 'overview', label: 'Event Details' },
          ...(isAdmin || meetingMinutes ? [{ id: 'minutes', label: 'Meeting Minutes' }] : []),
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'minutes' ? (
        <div className="animate-in fade-in slide-in-from-top-2">
          {isAdmin ? (
            <MinutesBuilder
              meetingId={event.id}
              initialData={meetingMinutes}
              documents={documents}
              setDocuments={setDocuments}
              onSave={(savedMinutes) => {
                queryClient.setQueryData<any[]>(['minutes'], (current = []) => {
                  const nextMinutes = {
                    ...savedMinutes,
                    formData: savedMinutes.formData || savedMinutes.data,
                  };
                  const existingIndex = current.findIndex(m => m.meetingId === event.id);
                  if (existingIndex === -1) return [nextMinutes, ...current];
                  return current.map((m, index) => index === existingIndex ? nextMinutes : m);
                });
                queryClient.invalidateQueries({ queryKey: ['minutes'] });
                showAlert('Meeting minutes have been saved and archived.', 'success');
              }}
            />
          ) : meetingMinutes ? (
            <MinutesReadOnly data={meetingMinutes} event={event} />
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/5 p-12 text-center">
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <i className="fa-solid fa-file-signature text-3xl text-slate-300"></i>
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Minutes Pending</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                The minutes for this meeting have not yet been finalized by the board. 
                Please check back later once the recording process is complete.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/5 overflow-hidden">
          <div className="h-48 bg-slate-900 relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=1200')] bg-cover bg-center"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
            <div className="absolute bottom-8 left-8">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${event.category === 'Meeting' ? 'bg-blue-600 text-white' :
                    event.category === 'Social' ? 'bg-brand-600 text-white' :
                      'bg-amber-600 text-white'
                  }`}>
                  {event.category}
                </span>
                {isTemp && (
                  <span className="text-[10px] font-black px-3 py-1 rounded-full bg-white text-slate-900 uppercase tracking-widest border border-white/20">
                    <i className="fa-solid fa-clock-rotate-left mr-1.5"></i> Session Only
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-black text-white">{event.title}</h1>
            </div>
          </div>

          <div className="p-8 lg:p-12">
            {isEditing && isAdmin ? (
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Title</label>
                    <input
                      name="title"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
                      defaultValue={event.title}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</label>
                    <select name="category" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white" defaultValue={event.category}>
                      <option value="Meeting">Meeting</option>
                      <option value="Social">Social</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Board">Board</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Committee <span className="text-slate-300">(Optional)</span></label>
                    <select name="committeeId" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white" defaultValue={event.committeeId || ''}>
                      <option value="">No committee link</option>
                      {committees.map(committee => (
                        <option key={committee.id} value={committee.id}>{committee.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
                    <input name="date" type="date" required className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white" defaultValue={event.date.includes('T') ? event.date.split('T')[0] : event.date} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Time</label>
                    <input name="time" type="time" required className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white" defaultValue={event.time} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</label>
                  <input name="location" required className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white" defaultValue={event.location} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</label>
                  <textarea name="description" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white h-32" defaultValue={event.description}></textarea>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-4 text-xs font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-2xl transition-all hover:bg-slate-200 dark:hover:bg-slate-700">Cancel</button>
                  <button type="submit" className="flex-1 py-4 bg-brand-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-brand-700 shadow-lg shadow-brand-500/20 active:scale-95 transition-all">Save Changes</button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-8">
                  {isTemp && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50 p-5 rounded-[1.5rem] flex items-start gap-4">
                      <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <i className="fa-solid fa-circle-info"></i>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest mb-1">Temporary Event Notice</p>
                        <p className="text-xs text-amber-600 dark:text-amber-500 font-medium leading-relaxed">
                          This event was imported from an external source for this session only. It is not permanently stored in the community database and will be cleared when you log out.
                        </p>
                      </div>
                    </div>
                  )}
                  <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-50 dark:border-white/5 pb-2">Event Description</h3>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                      {event.description || "No detailed description provided for this event. Please contact the board for further information regarding agendas or required preparation."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                        <i className="fa-solid fa-calendar-check text-xl"></i>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">When</p>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                          {new Date(event.date).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
                          <br /><span className="text-slate-400">at {formatTime12h(event.time)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                        <i className="fa-solid fa-location-dot text-xl"></i>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Where</p>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200">{event.location}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {isAdmin && !isGuest && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="w-full bg-slate-900 dark:bg-slate-800 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95"
                    >
                      <i className="fa-solid fa-pen-to-square mr-2"></i> Edit Event
                    </button>
                  )}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-white/5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Attendee List</h4>
                    <div className="space-y-3">
                      {isTemp ? (
                        <div className="text-center py-4 px-2">
                          <i className="fa-solid fa-user-slash text-slate-300 dark:text-slate-600 text-xl mb-3"></i>
                          <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed italic">Attendance tracking disabled for temporary events</p>
                        </div>
                      ) : (
                        <>
                          {event.attendees && event.attendees.length > 0 ? (
                            event.attendees.map((attendee: Tenant) => (
                              <div key={attendee.id} className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-[10px] text-white font-black">
                                  {attendee.firstName[0]}{attendee.lastName[0]}
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{attendee.firstName} {attendee.lastName}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 italic">No members have confirmed attendance yet.</p>
                          )}
                          {!isAttending && !isGuest && (
                            <button
                              onClick={handleAttend}
                              className="w-full mt-6 py-3 text-[10px] font-black uppercase text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl border border-brand-100 dark:border-brand-800 transition-all"
                            >
                              I'm Attending
                            </button>
                          )}
                          {isAttending && (
                            <div className="w-full mt-6 py-3 text-center text-[10px] font-black uppercase text-brand-600 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-100 dark:border-brand-800">
                              <i className="fa-solid fa-check mr-2"></i> Confirmed
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

};

export default EventDetail;
