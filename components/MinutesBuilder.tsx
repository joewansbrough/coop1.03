import React, { useState, useEffect } from 'react';
import { useTenants, useCommittees, useEvents } from '../hooks/useCoopData';
import { Tenant, Committee, CoopEvent } from '../types';

interface MinutesBuilderProps {
  meetingId: string;
  initialData?: any;
  onSave: (data: any) => void;
}

type MeetingType = 'quick' | 'regular' | 'agm' | 'special';

interface MotionItem {
  id: string;
  description: string;
  mover: string;
  seconder: string;
  result: 'carried' | 'defeated' | 'tabled' | 'withdrawn' | '';
}

interface AttendeeItem {
  id: string;
  name: string;
  position: string;
}

const MinutesBuilder: React.FC<MinutesBuilderProps> = ({ meetingId, initialData, onSave }) => {
  const [step, setStep] = useState<'select' | 'build'>('select');
  const [meetingType, setMeetingType] = useState<MeetingType>('regular');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const { data: tenants = [] } = useTenants();
  const { data: committees = [] } = useCommittees();
  const { data: events = [] } = useEvents();

  const currentEvent = events.find(e => e.id === meetingId);
  const committeeMembers = React.useMemo(() => {
    if (!currentEvent?.committeeId) return tenants;
    const committee = committees.find(c => c.id === currentEvent.committeeId);
    if (!committee) return tenants;
    // Assuming committee.members is an array of tenant IDs or objects
    // If it's a list of IDs, we filter tenants.
    // Based on types.ts, it's any[]. Let's try to match by firstName/lastName if needed, 
    // but usually it's better to just use all tenants as options if committee info is sparse.
    return tenants; 
  }, [currentEvent, committees, tenants]);

  // Form state
  const [formData, setFormData] = useState({
    meetingDate: '',
    startTime: '',
    endTime: '',
    location: '',
    chair: '',
    territorialAck: '',
    quorumRequired: '',
    quorumPresent: '',
    noticeConfirmed: false,
    quorumConfirmed: false,
    minuteTaker: '',
    directorsAbsent: '',
    guests: '',
    agendaChanges: '',
    agendaApproved: false,
    previousMinutesDate: '',
    minutesCorrections: '',
    minutesApproved: false,
    businessArising: '',
    boardReport: '',
    financeReport: '',
    committeeReports: '',
    auditorReport: '',
    managementReport: '',
    newBusiness: '',
    actionItems: '',
    approvedBy: '',
    approvalDate: '',
    additionalNotes: '',
    // Quick meeting specific
    keyDecisions: '',
    nextSteps: '',
    // AGM specific
    totalSeats: '',
    vacancies: '',
    candidates: '',
    nominations: '',
    electionResults: '',
    scrutineers: '',
    ballotsDisposed: false,
  });

  const [attendees, setAttendees] = useState<AttendeeItem[]>([
    { id: '1', name: '', position: '' }
  ]);
  const [motions, setMotions] = useState<MotionItem[]>([]);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData.formData || formData);
      setAttendees(initialData.attendees || attendees);
      setMotions(initialData.motions || motions);
      setMeetingType(initialData.meetingType || 'regular');
      setStep('build');
    } else {
      // Load from localStorage if available
      const saved = localStorage.getItem(`minutes-${meetingId}`);
      if (saved) {
        const data = JSON.parse(saved);
        setFormData(data.formData || formData);
        setAttendees(data.attendees || attendees);
        setMotions(data.motions || motions);
        setMeetingType(data.meetingType || 'regular');
        if (data.meetingType) {
          setStep('build');
        }
      }
    }
  }, [meetingId, initialData]);

  const autoSave = () => {
    const data = {
      formData,
      attendees,
      motions,
      meetingType,
      lastSaved: new Date().toISOString(),
    };
    localStorage.setItem(`minutes-${meetingId}`, JSON.stringify(data));
    setLastSaved(new Date());
  };

  useEffect(() => {
    if (step === 'build') {
      const interval = setInterval(autoSave, 30000);
      return () => clearInterval(interval);
    }
  }, [formData, attendees, motions, step]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addAttendee = () => {
    setAttendees([...attendees, { id: Date.now().toString(), name: '', position: '' }]);
  };

  const removeAttendee = (id: string) => {
    if (attendees.length > 1) {
      setAttendees(attendees.filter(a => a.id !== id));
    }
  };

  const updateAttendee = (id: string, field: 'name' | 'position', value: string) => {
    setAttendees(attendees.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const addMotion = () => {
    setMotions([...motions, {
      id: Date.now().toString(),
      description: '',
      mover: '',
      seconder: '',
      result: ''
    }]);
  };

  const removeMotion = (id: string) => {
    setMotions(motions.filter(m => m.id !== id));
  };

  const updateMotion = (id: string, field: keyof MotionItem, value: any) => {
    setMotions(motions.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleSave = () => {
    autoSave();
    onSave({ formData, attendees, motions, meetingType });
  };

  const handleExport = () => {
    window.print();
  };

  const selectMeetingType = (type: MeetingType) => {
    setMeetingType(type);
    setStep('build');
  };

  if (step === 'select') {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-top-2">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
            Select Meeting Type
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            Choose the meeting format to get the appropriate template and guidance. 
            You can always add or remove sections as needed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Quick Meeting */}
          <button
            onClick={() => selectMeetingType('quick')}
            className="group relative bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-slate-200 dark:border-white/5 hover:border-brand-500 dark:hover:border-brand-500 transition-all hover:scale-[1.02] active:scale-100 text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <i className="fa-solid fa-bolt text-8xl"></i>
            </div>
            <div className="relative">
              <div className="w-14 h-14 bg-brand-100 dark:bg-brand-900/30 rounded-2xl flex items-center justify-center mb-4">
                <i className="fa-solid fa-bolt text-2xl text-brand-600 dark:text-brand-400"></i>
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">
                Quick Meeting
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                For informal check-ins, brief updates, or quick decision-making sessions.
              </p>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-brand-500"></i>
                  <span>Basic attendance & decisions</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-brand-500"></i>
                  <span>Key points & action items</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-brand-500"></i>
                  <span>~5 minute setup</span>
                </div>
              </div>
            </div>
          </button>

          {/* Regular Board Meeting */}
          <button
            onClick={() => selectMeetingType('regular')}
            className="group relative bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-slate-200 dark:border-white/5 hover:border-brand-500 dark:hover:border-brand-500 transition-all hover:scale-[1.02] active:scale-100 text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <i className="fa-solid fa-clipboard-list text-8xl"></i>
            </div>
            <div className="relative">
              <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4">
                <i className="fa-solid fa-clipboard-list text-2xl text-blue-600 dark:text-blue-400"></i>
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">
                Regular Board Meeting
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Standard monthly or bi-weekly board meetings with full agenda and reporting.
              </p>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-blue-500"></i>
                  <span>Complete attendance tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-blue-500"></i>
                  <span>Reports, motions & discussions</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-blue-500"></i>
                  <span>~10-15 minute setup</span>
                </div>
              </div>
            </div>
          </button>

          {/* Annual General Meeting */}
          <button
            onClick={() => selectMeetingType('agm')}
            className="group relative bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-slate-200 dark:border-white/5 hover:border-brand-500 dark:hover:border-brand-500 transition-all hover:scale-[1.02] active:scale-100 text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <i className="fa-solid fa-award text-8xl"></i>
            </div>
            <div className="relative">
              <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-4">
                <i className="fa-solid fa-award text-2xl text-purple-600 dark:text-purple-400"></i>
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">
                Annual General Meeting
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Comprehensive AGM template with elections, auditor report, and full compliance.
              </p>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-purple-500"></i>
                  <span>Director elections & voting</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-purple-500"></i>
                  <span>Auditor report & financials</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-purple-500"></i>
                  <span>Full legal compliance</span>
                </div>
              </div>
            </div>
          </button>

          {/* Special Meeting */}
          <button
            onClick={() => selectMeetingType('special')}
            className="group relative bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-slate-200 dark:border-white/5 hover:border-brand-500 dark:hover:border-brand-500 transition-all hover:scale-[1.02] active:scale-100 text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <i className="fa-solid fa-exclamation-triangle text-8xl"></i>
            </div>
            <div className="relative">
              <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-4">
                <i className="fa-solid fa-exclamation-triangle text-2xl text-amber-600 dark:text-amber-400"></i>
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">
                Special Meeting
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                For urgent matters, special resolutions, or extraordinary business items.
              </p>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-amber-500"></i>
                  <span>Focused agenda items</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-amber-500"></i>
                  <span>Special resolutions tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-amber-500"></i>
                  <span>Notice compliance checks</span>
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="text-center">
          <p className="text-xs text-slate-400">
            <i className="fa-solid fa-info-circle mr-2"></i>
            Your progress auto-saves every 30 seconds
          </p>
        </div>
      </div>
    );
  }

  // Render the appropriate template based on meeting type
  return (
    <div className="space-y-6">
      {/* Header with meeting type badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setStep('select')}
            className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
              Meeting Minutes
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                meetingType === 'quick' ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400' :
                meetingType === 'regular' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                meetingType === 'agm' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              }`}>
                {meetingType === 'quick' ? 'Quick Meeting' :
                 meetingType === 'regular' ? 'Regular Board Meeting' :
                 meetingType === 'agm' ? 'Annual General Meeting' :
                 'Special Meeting'}
              </span>
              {lastSaved && (
                <span className="text-[10px] text-slate-400">
                  Last saved: {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <i className="fa-solid fa-download mr-2"></i>Export
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-black uppercase hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20 active:scale-95"
          >
            <i className="fa-solid fa-save mr-2"></i>Save
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-8">
        {meetingType === 'quick' && <QuickMeetingTemplate formData={formData} handleInputChange={handleInputChange} members={committeeMembers} />}
        {meetingType === 'regular' && <RegularMeetingTemplate formData={formData} handleInputChange={handleInputChange} attendees={attendees} addAttendee={addAttendee} removeAttendee={removeAttendee} updateAttendee={updateAttendee} motions={motions} addMotion={addMotion} removeMotion={removeMotion} updateMotion={updateMotion} members={committeeMembers} />}
        {meetingType === 'agm' && <AGMMeetingTemplate formData={formData} handleInputChange={handleInputChange} attendees={attendees} addAttendee={addAttendee} removeAttendee={removeAttendee} updateAttendee={updateAttendee} motions={motions} addMotion={addMotion} removeMotion={removeMotion} updateMotion={updateMotion} members={committeeMembers} />}
        {meetingType === 'special' && <SpecialMeetingTemplate formData={formData} handleInputChange={handleInputChange} attendees={attendees} addAttendee={addAttendee} removeAttendee={removeAttendee} updateAttendee={updateAttendee} motions={motions} addMotion={addMotion} removeMotion={removeMotion} updateMotion={updateMotion} members={committeeMembers} />}
        
        <div className="mt-12 pt-8 border-t border-slate-100 dark:border-white/5 flex justify-end">
           <button
            onClick={handleSave}
            className="px-8 py-4 bg-brand-600 text-white rounded-2xl text-sm font-black uppercase hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20 active:scale-95 flex items-center gap-2"
          >
            <i className="fa-solid fa-save"></i>
            Finalize & Save Minutes
          </button>
        </div>
      </div>
    </div>
  );
};

// Name Dropdown Component
const NameSelector: React.FC<{ 
  value: string, 
  onChange: (val: string) => void, 
  members: Tenant[],
  placeholder?: string 
}> = ({ value, onChange, members, placeholder = "Select member..." }) => {
  const [isManual, setIsManual] = useState(false);

  if (isManual) {
    return (
      <div className="flex gap-2">
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          placeholder="Enter name manually" 
          className="form-input flex-1"
          autoFocus
        />
        <button 
          onClick={() => setIsManual(false)}
          className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl hover:bg-slate-200"
          title="Back to list"
        >
          <i className="fa-solid fa-list"></i>
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select 
        value={value} 
        onChange={(e) => {
          if (e.target.value === '__add__') {
            setIsManual(true);
            onChange('');
          } else {
            onChange(e.target.value);
          }
        }}
        className="form-input flex-1"
      >
        <option value="">{placeholder}</option>
        {members.sort((a,b) => a.firstName.localeCompare(b.firstName)).map(m => (
          <option key={m.id} value={`${m.firstName} ${m.lastName}`}>
            {m.firstName} {m.lastName}
          </option>
        ))}
        <option value="__add__">+ Add person manually...</option>
      </select>
    </div>
  );
};

// Quick Meeting Template
const QuickMeetingTemplate: React.FC<any> = ({ formData, handleInputChange, members }) => (
  <div className="space-y-8">
    <FormSection title="Meeting Info" icon="fa-info-circle">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Date" required>
          <input type="date" value={formData.meetingDate} onChange={(e) => handleInputChange('meetingDate', e.target.value)} className="form-input" required />
        </FormField>
        <FormField label="Time">
          <input type="time" value={formData.startTime} onChange={(e) => handleInputChange('startTime', e.target.value)} className="form-input" />
        </FormField>
      </div>
      <FormField label="Attendees">
        <textarea 
          value={formData.guests} 
          onChange={(e) => handleInputChange('guests', e.target.value)} 
          placeholder="Enter names separated by commas..." 
          className="form-textarea" 
          rows={2}
        />
      </FormField>
    </FormSection>

    <FormSection title="Key Points" icon="fa-list-check">
      <FormField label="Decisions Made">
        <textarea value={formData.keyDecisions} onChange={(e) => handleInputChange('keyDecisions', e.target.value)} placeholder="What was decided or discussed?" className="form-textarea" rows={5} />
      </FormField>
      <FormField label="Next Steps / Action Items">
        <textarea value={formData.nextSteps} onChange={(e) => handleInputChange('nextSteps', e.target.value)} placeholder="Who is doing what by when?" className="form-textarea" rows={5} />
      </FormField>
    </FormSection>
  </div>
);

// Regular Meeting Template (streamlined version)
const RegularMeetingTemplate: React.FC<any> = ({ formData, handleInputChange, attendees, addAttendee, removeAttendee, updateAttendee, motions, addMotion, removeMotion, updateMotion, members }) => (
  <div className="space-y-8">
    <FormSection title="Meeting Information" icon="fa-calendar-check">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Date" required>
          <input type="date" value={formData.meetingDate} onChange={(e) => handleInputChange('meetingDate', e.target.value)} className="form-input" required />
        </FormField>
        <FormField label="Start Time" required>
          <input type="time" value={formData.startTime} onChange={(e) => handleInputChange('startTime', e.target.value)} className="form-input" required />
        </FormField>
        <FormField label="End Time">
          <input type="time" value={formData.endTime} onChange={(e) => handleInputChange('endTime', e.target.value)} className="form-input" />
        </FormField>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Location" required>
          <input type="text" value={formData.location} onChange={(e) => handleInputChange('location', e.target.value)} placeholder="e.g., Common Room" className="form-input" required />
        </FormField>
        <FormField label="Chair" required>
          <NameSelector 
            value={formData.chair} 
            onChange={(val) => handleInputChange('chair', val)} 
            members={members} 
            placeholder="Select chairperson..." 
          />
        </FormField>
      </div>
    </FormSection>

    <FormSection title="Attendance" icon="fa-users">
      <FormField label="Directors Present">
        <div className="space-y-3">
          {attendees.map(attendee => (
            <div key={attendee.id} className="flex gap-3">
              <div className="flex-1">
                <NameSelector 
                  value={attendee.name} 
                  onChange={(val) => updateAttendee(attendee.id, 'name', val)} 
                  members={members} 
                />
              </div>
              <input 
                type="text" 
                value={attendee.position}
                onChange={(e) => updateAttendee(attendee.id, 'position', e.target.value)}
                placeholder="Position (optional)" 
                className="form-input flex-1"
              />
              {attendees.length > 1 && (
                <button 
                  type="button"
                  onClick={() => removeAttendee(attendee.id)}
                  className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button 
            type="button"
            onClick={addAttendee}
            className="text-sm font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
          >
            <i className="fa-solid fa-plus mr-2"></i>Add Director
          </button>
        </div>
      </FormField>
      <FormField label="Directors Absent">
        <input type="text" value={formData.directorsAbsent} onChange={(e) => handleInputChange('directorsAbsent', e.target.value)} placeholder="Names of absent directors" className="form-input" />
      </FormField>
      <FormField label="Guests & Observers">
        <input type="text" value={formData.guests} onChange={(e) => handleInputChange('guests', e.target.value)} placeholder="e.g., Auditor - Jane Smith" className="form-input" />
      </FormField>
      <FormField label="Minutes Recorded By" required>
        <NameSelector 
          value={formData.minuteTaker} 
          onChange={(val) => handleInputChange('minuteTaker', val)} 
          members={members} 
          placeholder="Select recorder..." 
        />
      </FormField>
    </FormSection>

    <FormSection title="Reports" icon="fa-file-lines">
      <FormField label="Board Report">
        <textarea value={formData.boardReport} onChange={(e) => handleInputChange('boardReport', e.target.value)} placeholder="Overview of activities, challenges, and outcomes" className="form-textarea" rows={5} />
      </FormField>
      <FormField label="Financial Report">
        <textarea value={formData.financeReport} onChange={(e) => handleInputChange('financeReport', e.target.value)} placeholder="Financial overview and budget status" className="form-textarea" rows={4} />
      </FormField>
      <FormField label="Committee Reports">
        <textarea value={formData.committeeReports} onChange={(e) => handleInputChange('committeeReports', e.target.value)} placeholder="Reports from any committees" className="form-textarea" rows={4} />
      </FormField>
    </FormSection>

    <FormSection title="Motions & Decisions" icon="fa-gavel">
      <div className="space-y-4">
        {motions.map((motion, index) => (
          <div key={motion.id} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/5">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Motion {index + 1}</h4>
              <button 
                type="button"
                onClick={() => removeMotion(motion.id)}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
            <div className="space-y-3">
              <FormField label="Description">
                <textarea 
                  value={motion.description}
                  onChange={(e) => updateMotion(motion.id, 'description', e.target.value)}
                  placeholder="Describe the motion..."
                  className="form-textarea"
                  rows={3}
                />
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField label="Moved By">
                  <NameSelector 
                    value={motion.mover} 
                    onChange={(val) => updateMotion(motion.id, 'mover', val)} 
                    members={members} 
                  />
                </FormField>
                <FormField label="Seconded By">
                  <NameSelector 
                    value={motion.seconder} 
                    onChange={(val) => updateMotion(motion.id, 'seconder', val)} 
                    members={members} 
                  />
                </FormField>
                <FormField label="Result">
                  <select 
                    value={motion.result}
                    onChange={(e) => updateMotion(motion.id, 'result', e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select...</option>
                    <option value="carried">Carried</option>
                    <option value="defeated">Defeated</option>
                    <option value="tabled">Tabled</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </FormField>
              </div>
            </div>
          </div>
        ))}
        <button 
          type="button"
          onClick={addMotion}
          className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
        >
          <i className="fa-solid fa-plus mr-2"></i>Add Motion
        </button>
      </div>
    </FormSection>

    <FormSection title="Action Items" icon="fa-tasks">
      <FormField label="Follow-up Required">
        <textarea value={formData.actionItems} onChange={(e) => handleInputChange('actionItems', e.target.value)} placeholder="List action items, responsible parties, and deadlines" className="form-textarea" rows={5} />
      </FormField>
    </FormSection>
  </div>
);

// AGM Meeting Template (comprehensive)
const AGMMeetingTemplate: React.FC<any> = ({ formData, handleInputChange, attendees, addAttendee, removeAttendee, updateAttendee, motions, addMotion, removeMotion, updateMotion, members }) => (
  <div className="space-y-8">
    <RegularMeetingTemplate 
      formData={formData} 
      handleInputChange={handleInputChange}
      attendees={attendees}
      addAttendee={addAttendee}
      removeAttendee={removeAttendee}
      updateAttendee={updateAttendee}
      motions={motions}
      addMotion={addMotion}
      removeMotion={removeMotion}
      updateMotion={updateMotion}
      members={members}
    />

    <FormSection title="Auditor's Report" icon="fa-file-invoice-dollar">
      <FormField label="Auditor's Report Summary">
        <textarea value={formData.auditorReport} onChange={(e) => handleInputChange('auditorReport', e.target.value)} placeholder="Summary of auditor's report and year-end financial statements" className="form-textarea" rows={5} />
      </FormField>
    </FormSection>

    <FormSection title="Election of Directors" icon="fa-person-booth">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <FormField label="Total Seats">
          <input type="number" value={formData.totalSeats} onChange={(e) => handleInputChange('totalSeats', e.target.value)} className="form-input" />
        </FormField>
        <FormField label="Vacancies">
          <input type="number" value={formData.vacancies} onChange={(e) => handleInputChange('vacancies', e.target.value)} className="form-input" />
        </FormField>
        <FormField label="Candidates">
          <input type="number" value={formData.candidates} onChange={(e) => handleInputChange('candidates', e.target.value)} className="form-input" />
        </FormField>
      </div>
      <FormField label="Nominations Received">
        <textarea value={formData.nominations} onChange={(e) => handleInputChange('nominations', e.target.value)} placeholder="List all candidates who accepted nomination" className="form-textarea" rows={4} />
      </FormField>
      <FormField label="Election Results">
        <textarea value={formData.electionResults} onChange={(e) => handleInputChange('electionResults', e.target.value)} placeholder="Document elected directors, vote counts, and terms of office" className="form-textarea" rows={5} />
      </FormField>
      <FormField label="Scrutineers">
        <input type="text" value={formData.scrutineers} onChange={(e) => handleInputChange('scrutineers', e.target.value)} placeholder="Names of scrutineers" className="form-input" />
      </FormField>
      <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
        <input 
          type="checkbox" 
          id="ballotsDisposed"
          checked={formData.ballotsDisposed}
          onChange={(e) => handleInputChange('ballotsDisposed', e.target.checked)}
          className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <label htmlFor="ballotsDisposed" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Motion to dispose of ballots approved
        </label>
      </div>
    </FormSection>
  </div>
);

// Special Meeting Template
const SpecialMeetingTemplate: React.FC<any> = ({ formData, handleInputChange, attendees, addAttendee, removeAttendee, updateAttendee, motions, addMotion, removeMotion, updateMotion, members }) => (
  <div className="space-y-8">
    <FormSection title="Meeting Information" icon="fa-calendar-check">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Date" required>
          <input type="date" value={formData.meetingDate} onChange={(e) => handleInputChange('meetingDate', e.target.value)} className="form-input" required />
        </FormField>
        <FormField label="Start Time" required>
          <input type="time" value={formData.startTime} onChange={(e) => handleInputChange('startTime', e.target.value)} className="form-input" required />
        </FormField>
        <FormField label="Location" required>
          <input type="text" value={formData.location} onChange={(e) => handleInputChange('location', e.target.value)} className="form-input" required />
        </FormField>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Chair" required>
          <NameSelector 
            value={formData.chair} 
            onChange={(val) => handleInputChange('chair', val)} 
            members={members} 
          />
        </FormField>
        <FormField label="Notice Period Confirmed">
          <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <input 
              type="checkbox" 
              id="noticeConfirmed"
              checked={formData.noticeConfirmed}
              onChange={(e) => handleInputChange('noticeConfirmed', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="noticeConfirmed" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Notice properly delivered (min. 14 days)
            </label>
          </div>
        </FormField>
      </div>
    </FormSection>

    <FormSection title="Attendance" icon="fa-users">
      <FormField label="Members Present">
        <div className="space-y-3">
          {attendees.map(attendee => (
            <div key={attendee.id} className="flex gap-3">
              <div className="flex-1">
                <NameSelector 
                  value={attendee.name} 
                  onChange={(val) => updateAttendee(attendee.id, 'name', val)} 
                  members={members} 
                />
              </div>
              {attendees.length > 1 && (
                <button 
                  type="button"
                  onClick={() => removeAttendee(attendee.id)}
                  className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button 
            type="button"
            onClick={addAttendee}
            className="text-sm font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
          >
            <i className="fa-solid fa-plus mr-2"></i>Add Member
          </button>
        </div>
      </FormField>
      <FormField label="Minutes Recorded By" required>
        <NameSelector 
          value={formData.minuteTaker} 
          onChange={(val) => handleInputChange('minuteTaker', val)} 
          members={members} 
        />
      </FormField>
    </FormSection>

    <FormSection title="Special Business" icon="fa-exclamation-triangle">
      <FormField label="Purpose of Special Meeting">
        <textarea value={formData.newBusiness} onChange={(e) => handleInputChange('newBusiness', e.target.value)} placeholder="Document the specific reason for calling this special meeting" className="form-textarea" rows={4} />
      </FormField>
    </FormSection>

    <FormSection title="Motions & Resolutions" icon="fa-gavel">
      <div className="space-y-4">
        {motions.map((motion, index) => (
          <div key={motion.id} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/5">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Motion {index + 1}</h4>
              <button 
                type="button"
                onClick={() => removeMotion(motion.id)}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
            <div className="space-y-3">
              <FormField label="Description">
                <textarea 
                  value={motion.description}
                  onChange={(e) => updateMotion(motion.id, 'description', e.target.value)}
                  placeholder="Describe the motion..."
                  className="form-textarea"
                  rows={3}
                />
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField label="Moved By">
                  <NameSelector 
                    value={motion.mover} 
                    onChange={(val) => updateMotion(motion.id, 'mover', val)} 
                    members={members} 
                  />
                </FormField>
                <FormField label="Seconded By">
                  <NameSelector 
                    value={motion.seconder} 
                    onChange={(val) => updateMotion(motion.id, 'seconder', val)} 
                    members={members} 
                  />
                </FormField>
                <FormField label="Result">
                  <select 
                    value={motion.result}
                    onChange={(e) => updateMotion(motion.id, 'result', e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select...</option>
                    <option value="carried">Carried</option>
                    <option value="defeated">Defeated</option>
                    <option value="tabled">Tabled</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </FormField>
              </div>
            </div>
          </div>
        ))}
        <button 
          type="button"
          onClick={addMotion}
          className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
        >
          <i className="fa-solid fa-plus mr-2"></i>Add Motion
        </button>
      </div>
    </FormSection>

    <FormSection title="Action Items" icon="fa-tasks">
      <FormField label="Follow-up Required">
        <textarea value={formData.actionItems} onChange={(e) => handleInputChange('actionItems', e.target.value)} placeholder="List action items, responsible parties, and deadlines" className="form-textarea" rows={5} />
      </FormField>
    </FormSection>
  </div>
);

// Helper Components
const FormSection: React.FC<{ title: string; icon: string; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="space-y-6">
    <h3 className="flex items-center gap-3 text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight border-b border-slate-200 dark:border-white/5 pb-3">
      <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center">
        <i className={`fa-solid ${icon} text-brand-600 dark:text-brand-400 text-sm`}></i>
      </div>
      {title}
    </h3>
    <div className="space-y-6">
      {children}
    </div>
  </div>
);

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div className="space-y-2">
    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

export default MinutesBuilder;
