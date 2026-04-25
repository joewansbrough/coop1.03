import React, { useState } from 'react';
import { MinutesTemplate } from '../types';
import { useCreateMinutes, useUpdateMinutes } from '../hooks/useCoopData';
import AppAlert from '../components/AppAlert';

interface MinutesBuilderProps {
  meetingId: string;
  initialData?: MinutesTemplate;
  onSave: (data: MinutesTemplate) => void;
}

const MinutesBuilder: React.FC<MinutesBuilderProps> = ({ meetingId, initialData, onSave }) => {
  const [minutes, setMinutes] = useState<MinutesTemplate>(initialData || {
    id: `min-${Date.now()}`,
    meetingId,
    coopName: 'Oak Bay Housing Co-op',
    meetingType: 'Committee Meeting',
    date: new Date().toISOString().split('T')[0],
    startTime: '19:00',
    endTime: '20:30',
    location: 'Common Room',
    chair: '',
    secretary: '',
    attendees: [],
    guests: [],
    agenda: [],
    motions: [],
    actionItems: [],
    notes: '',
    status: 'Draft'
  });

  const [alert, setAlert] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const createMutation = useCreateMinutes();
  const updateMutation = useUpdateMinutes();

  const save = () => {
    if (initialData) {
      updateMutation.mutate(minutes, { onSuccess: () => onSave(minutes) });
    } else {
      createMutation.mutate(minutes, { onSuccess: (data) => onSave(data) });
    }
    setAlert({ message: 'Minutes saved successfully.', type: 'success' });
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-white/5 space-y-8 animate-in fade-in duration-300">
      {alert && <AppAlert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}
      
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-6">
        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Minutes Builder</h2>
        <div className="flex gap-3">
          <button onClick={save} className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase hover:bg-brand-700">Save Progress</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <input className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200" placeholder="Chairperson" value={minutes.chair} onChange={e => setMinutes({...minutes, chair: e.target.value})} />
        <input className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200" placeholder="Secretary" value={minutes.secretary} onChange={e => setMinutes({...minutes, secretary: e.target.value})} />
      </div>

      {/* Motions Table */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase text-slate-400">Motions</h3>
        <button 
          onClick={() => setMinutes({...minutes, motions: [...minutes.motions, { id: `${Date.now()}`, mover: '', seconder: '', resolution: '', carried: true }]})}
          className="text-brand-600 text-[10px] font-black uppercase"
        >+ Add Motion</button>
        {minutes.motions.map((m, i) => (
          <div key={m.id} className="grid grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200">
            <input className="bg-transparent text-sm font-bold" placeholder="Mover" value={m.mover} onChange={e => {
                const newMotions = [...minutes.motions];
                newMotions[i].mover = e.target.value;
                setMinutes({...minutes, motions: newMotions});
            }}/>
             <input className="bg-transparent text-sm font-bold" placeholder="Seconder" value={m.seconder} onChange={e => {
                const newMotions = [...minutes.motions];
                newMotions[i].seconder = e.target.value;
                setMinutes({...minutes, motions: newMotions});
            }}/>
            <input className="bg-transparent text-sm font-bold" placeholder="Resolution" value={m.resolution} onChange={e => {
                const newMotions = [...minutes.motions];
                newMotions[i].resolution = e.target.value;
                setMinutes({...minutes, motions: newMotions});
            }}/>
          </div>
        ))}
      </div>

      {/* Action Items */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase text-slate-400">Action Items</h3>
        <button 
          onClick={() => setMinutes({...minutes, actionItems: [...minutes.actionItems, { id: `${Date.now()}`, task: '', owner: '', dueDate: '' }]})}
          className="text-brand-600 text-[10px] font-black uppercase"
        >+ Add Action Item</button>
        {minutes.actionItems.map((a, i) => (
          <div key={a.id} className="grid grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200">
            <input className="bg-transparent text-sm font-bold" placeholder="Task" value={a.task} onChange={e => {
                const newItems = [...minutes.actionItems];
                newItems[i].task = e.target.value;
                setMinutes({...minutes, actionItems: newItems});
            }}/>
             <input className="bg-transparent text-sm font-bold" placeholder="Owner" value={a.owner} onChange={e => {
                const newItems = [...minutes.actionItems];
                newItems[i].owner = e.target.value;
                setMinutes({...minutes, actionItems: newItems});
            }}/>
            <input type="date" className="bg-transparent text-sm font-bold" value={a.dueDate} onChange={e => {
                const newItems = [...minutes.actionItems];
                newItems[i].dueDate = e.target.value;
                setMinutes({...minutes, actionItems: newItems});
            }}/>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MinutesBuilder;
