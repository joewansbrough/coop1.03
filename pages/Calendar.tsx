
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CoopEvent } from '../types';

interface CalendarProps {
  isAdmin?: boolean;
  isGuest?: boolean;
  events: CoopEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CoopEvent[]>>;
}

const Calendar: React.FC<CalendarProps> = ({ isAdmin = false, isGuest = false, events, setEvents }) => {
  const navigate = useNavigate();
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editEvent, setEditEvent] = useState<CoopEvent | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('19:00');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<'Meeting' | 'Social' | 'Maintenance' | 'Board'>('Meeting');
  const [description, setDescription] = useState('');

  const handleExportICS = () => {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Co-op Management System//EN\n";
    
    events.forEach(event => {
      const dtStart = event.date.replace(/-/g, '') + 'T' + event.time.replace(/:/g, '') + '00';
      // Simple 1-hour duration for export
      const startHour = parseInt(event.time.split(':')[0]);
      const endHour = (startHour + 1).toString().padStart(2, '0');
      const dtEnd = event.date.replace(/-/g, '') + 'T' + endHour + event.time.split(':')[1].replace(/:/g, '') + '00';

      icsContent += "BEGIN:VEVENT\n";
      icsContent += `SUMMARY:${event.title}\n`;
      icsContent += `DTSTART:${dtStart}\n`;
      icsContent += `DTEND:${dtEnd}\n`;
      icsContent += `LOCATION:${event.location}\n`;
      icsContent += `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}\n`;
      icsContent += `CATEGORIES:${event.category}\n`;
      icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', 'coop_events.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportICS = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const eventBlocks = content.split('BEGIN:VEVENT');
      eventBlocks.shift(); // Remove header

      const importedEvents = [];

      for (const block of eventBlocks) {
        const summary = block.match(/SUMMARY:(.*)/)?.[1]?.trim() || 'Imported Event';
        const dtstart = block.match(/DTSTART[:;](.*)/)?.[1]?.trim();
        const locationStr = block.match(/LOCATION:(.*)/)?.[1]?.trim() || 'Not Specified';
        const descriptionStr = block.match(/DESCRIPTION:(.*)/)?.[1]?.trim()?.replace(/\\n/g, '\n') || '';
        const categoryStr = block.match(/CATEGORIES:(.*)/)?.[1]?.trim() || 'Social';

        if (dtstart) {
          // Format: YYYYMMDDTHHMMSS
          const year = dtstart.substring(0, 4);
          const month = dtstart.substring(4, 6);
          const day = dtstart.substring(6, 8);
          const hour = dtstart.substring(9, 11) || '00';
          const minute = dtstart.substring(11, 13) || '00';

          const date = `${year}-${month}-${day}`;
          const time = `${hour}:${minute}`;

          try {
            const res = await fetch('/api/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: summary,
                date,
                time,
                location: locationStr,
                description: descriptionStr,
                category: ['Meeting', 'Social', 'Maintenance', 'Board'].includes(categoryStr) ? categoryStr : 'Social'
              })
            });
            if (res.ok) {
              const data = await res.json();
              importedEvents.push(data);
            }
          } catch (err) {
            console.error('Failed to import event:', err);
          }
        }
      }

      if (importedEvents.length > 0) {
        setEvents(prev => [...prev, ...importedEvents]);
        alert(`Successfully imported ${importedEvents.length} events!`);
      } else {
        alert("No valid events found in the .ics file.");
      }
      setIsImporting(false);
      // Reset input
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) return;

    const payload = { title, date: selectedDate, time, location, category, description };

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setEvents([...events, data]);
      setShowAddForm(false);
      setTitle('');
      setDescription('');
      alert("Event added to community calendar!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest || !editEvent) return;

    try {
      const res = await fetch(`/api/events/${editEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editEvent)
      });
      const data = await res.json();
      setEvents(events.map(ev => ev.id === data.id ? data : ev));
      setEditEvent(null);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteEvent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGuest) return;
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await fetch(`/api/events/${id}`, { method: 'DELETE' });
      setEvents(events.filter(ev => ev.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const monthName = viewDate.toLocaleString('default', { month: 'long' });

  // Robust date parsing to ensure consistent sorting across browsers
  const parseEventDate = (e: CoopEvent) => {
    if (!e.date || !e.time) return new Date(0);
    const [year, month, day] = e.date.split('-').map(Number);
    const [hour, minute] = e.time.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute);
  };

  // Find closest upcoming event
  const now = new Date();
  const nextEvent = [...events]
    .filter(e => parseEventDate(e) >= now)
    .sort((a, b) => parseEventDate(a).getTime() - parseEventDate(b).getTime())[0];

  return (
    <div className="space-y-6 lg:space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-12 transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Community Calendar</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium font-medium">Co-op meetings, social gatherings, and building maintenance events.</p>
        </div>
        {isAdmin && !isGuest && (
          <div className="flex gap-2">
            <button 
              onClick={handleExportICS}
              className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
              title="Export all events to .ics"
            >
              <i className="fa-solid fa-file-export"></i> Export
            </button>
            
            <label className="cursor-pointer">
              <input 
                type="file" 
                accept=".ics" 
                onChange={handleImportICS} 
                className="hidden" 
                disabled={isImporting}
              />
              <div className={`bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <i className={`fa-solid ${isImporting ? 'fa-spinner fa-spin' : 'fa-file-import'}`}></i> 
                {isImporting ? 'Importing...' : 'Import'}
              </div>
            </label>

            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-brand-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-700 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-brand-500/20"
            >
              <i className="fa-solid fa-calendar-plus"></i> Add Event
            </button>
          </div>
        )}
      </div>

      {(showAddForm || editEvent) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <i className="fa-solid fa-calendar-plus text-brand-600"></i>
                {editEvent ? 'Edit Co-op Event' : 'Create Co-op Event'}
              </h3>
              <button onClick={() => { setShowAddForm(false); setEditEvent(null); }} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <form onSubmit={editEvent ? handleUpdateEvent : handleAddEvent} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Event Title</label>
                <input type="text" required value={editEvent ? editEvent.title : title} onChange={e => editEvent ? setEditEvent({...editEvent, title: e.target.value}) : setTitle(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Garden Clean-up" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
                  <input type="date" required value={editEvent ? editEvent.date : selectedDate} onChange={e => editEvent ? setEditEvent({...editEvent, date: e.target.value}) : setSelectedDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Time</label>
                  <input type="time" required value={editEvent ? editEvent.time : time} onChange={e => editEvent ? setEditEvent({...editEvent, time: e.target.value}) : setTime(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</label>
                <select value={editEvent ? editEvent.category : category} onChange={e => {
                  const val = e.target.value as any;
                  editEvent ? setEditEvent({...editEvent, category: val}) : setCategory(val);
                }} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500">
                  <option>Meeting</option>
                  <option>Social</option>
                  <option>Maintenance</option>
                  <option>Board</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</label>
                <input type="text" required value={editEvent ? editEvent.location : location} onChange={e => editEvent ? setEditEvent({...editEvent, location: e.target.value}) : setLocation(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500" placeholder="Common Room / Courtyard" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Details</label>
                <textarea value={editEvent ? editEvent.description : description} onChange={e => editEvent ? setEditEvent({...editEvent, description: e.target.value}) : setDescription(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 h-24 resize-none" placeholder="Add some context..."></textarea>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddForm(false); setEditEvent(null); }} className="flex-1 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-xs font-black uppercase hover:bg-brand-700 active:scale-95 transition-all">
                  <i className={`fa-solid ${editEvent ? 'fa-save' : 'fa-plus'}`}></i> {editEvent ? 'Save Changes' : 'Add New Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 overflow-hidden transition-colors duration-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">{monthName} {currentYear}</h3>
            <div className="flex gap-2">
              <button onClick={handlePrevMonth} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl text-slate-400 transition-colors"><i className="fa-solid fa-chevron-left"></i></button>
              <button onClick={handleNextMonth} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl text-slate-400 transition-colors"><i className="fa-solid fa-chevron-right"></i></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-slate-50/50 dark:bg-slate-900/50 p-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</div>
            ))}
            {[...Array(firstDayOfMonth)].map((_, i) => (
              <div key={`empty-${i}`} className="bg-slate-50/20 dark:bg-slate-950/20 min-h-[90px] lg:min-h-[120px]"></div>
            ))}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1;
              const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              const hasEvents = events.filter(e => e.date === dateStr);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`bg-white dark:bg-slate-900 min-h-[90px] lg:min-h-[120px] p-2 text-left group hover:bg-slate-50 dark:hover:bg-slate-800 transition-all relative ${selectedDate === dateStr ? 'ring-2 ring-brand-500 ring-inset z-10' : ''}`}
                >
                  <span className={`text-xs font-black ${selectedDate === dateStr ? 'text-brand-600' : 'text-slate-400'}`}>{day}</span>
                  <div className="mt-1.5 space-y-1">
                    {hasEvents.map(e => (
                      <div 
                        key={e.id} 
                        onClick={(ev) => { ev.stopPropagation(); navigate(`/calendar/${e.id}`); }}
                        className={`text-[8px] font-black p-1 rounded-md truncate border cursor-pointer hover:scale-105 transition-transform ${
                          e.category === 'Meeting' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800' :
                          e.category === 'Social' ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 border-brand-100 dark:border-brand-800' :
                          'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800'
                        }`}
                      >
                        {e.title}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          {nextEvent && (
            <Link 
              to={`/calendar/${nextEvent.id}`}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:border-brand-500 transition-all group cursor-pointer relative overflow-hidden block active:scale-[0.98] shadow-sm hover:shadow-2xl hover:shadow-brand-500/10"
            >
              {/* Image Banner */}
              <div className="h-40 relative overflow-hidden">
                <img 
                  src={
                    nextEvent.category === 'Meeting' ? 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=400' :
                    nextEvent.category === 'Social' ? 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=400' :
                    nextEvent.category === 'Maintenance' ? 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80&w=400' :
                    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=400'
                  }
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  alt=""
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-900 via-transparent to-transparent"></div>
                
                {/* Floating Category Badge */}
                <div className="absolute top-4 left-4">
                  <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md border ${
                    nextEvent.category === 'Meeting' ? 'bg-amber-500/80 text-white border-white/20' :
                    nextEvent.category === 'Social' ? 'bg-brand-500/80 text-white border-white/20' :
                    'bg-slate-800/80 text-white border-white/20'
                  }`}>
                    {nextEvent.category}
                  </span>
                </div>

                {/* Glass Date Badge */}
                <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-2xl p-3 text-center min-w-[60px] shadow-lg">
                  <p className="text-[10px] font-black uppercase text-white/90 tracking-tighter leading-none">
                    {parseEventDate(nextEvent).toLocaleDateString([], { month: 'short' })}
                  </p>
                  <p className="text-xl font-black text-white leading-none mt-1">
                    {parseEventDate(nextEvent).toLocaleDateString([], { day: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="p-8 relative">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3">Next Upcoming Event</p>
                <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight line-clamp-2 leading-tight group-hover:text-brand-500 transition-colors">
                  {nextEvent.title}
                </h4>
                
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5 flex flex-col gap-2">
                  <div className="flex items-center gap-3 text-slate-500">
                    <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center">
                      <i className="fa-solid fa-clock text-[10px]"></i>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider">{nextEvent.time}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500">
                    <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center">
                      <i className="fa-solid fa-location-dot text-[10px]"></i>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider line-clamp-1">{nextEvent.location}</span>
                  </div>
                </div>
              </div>
            </Link>
          )}

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 transition-colors duration-200">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2 border-b border-slate-50 dark:border-white/5 pb-4">
               <i className="fa-solid fa-clock-rotate-left text-brand-500"></i>
               {monthName} Events
            </h3>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
              {events.filter(e => {
                const eventDate = new Date(e.date);
                return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
              }).length > 0 ? (
                events
                  .filter(e => {
                    const eventDate = new Date(e.date);
                    return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
                  })
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map(e => (
                  <div 
                    key={e.id} 
                    onClick={() => navigate(`/calendar/${e.id}`)}
                    className={`p-4 rounded-2xl border transition-all group cursor-pointer ${
                      e.date === selectedDate 
                        ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-900/20' 
                        : 'border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-slate-800/30 hover:bg-white dark:hover:bg-slate-800 hover:border-brand-200 dark:hover:border-brand-500'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                       <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest ${
                         e.category === 'Meeting' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                         e.category === 'Social' ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400' :
                         'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                       }`}>{e.category}</span>
                       <div className="flex items-center gap-1">
                         {isAdmin && !isGuest && (
                           <div className="flex gap-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={(ev) => { ev.stopPropagation(); setEditEvent(e); }} className="p-1 text-amber-600 hover:bg-amber-50 rounded"><i className="fa-solid fa-pen text-[10px]"></i></button>
                             <button onClick={(ev) => deleteEvent(e.id, ev)} className="p-1 text-rose-600 hover:bg-rose-50 rounded"><i className="fa-solid fa-trash text-[10px]"></i></button>
                           </div>
                         )}
                         <div className="flex flex-col items-end">
                           <span className="text-[10px] font-black text-slate-400 uppercase">{e.time}</span>
                           <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(e.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                         </div>
                       </div>
                    </div>
                    <h4 className="font-black text-slate-800 dark:text-white leading-tight mb-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{e.title}</h4>
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase"><i className="fa-solid fa-location-dot mr-1.5 text-slate-300 dark:text-slate-600"></i> {e.location}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-slate-400 bg-slate-50/50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-white/5">
                  <i className="fa-solid fa-calendar-day text-4xl mb-4 opacity-10"></i>
                  <p className="text-xs font-black uppercase tracking-widest opacity-40">No Activity Logged</p>
                </div>
              )}
            </div>
            {isAdmin && !isGuest && (
               <button 
                 onClick={() => setShowAddForm(true)}
                 className="w-full mt-6 py-3 border border-dashed border-slate-200 dark:border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-600 hover:border-brand-200 transition-all flex items-center justify-center gap-2"
               >
                 <i className="fa-solid fa-plus"></i> Fast Add Entry
               </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
