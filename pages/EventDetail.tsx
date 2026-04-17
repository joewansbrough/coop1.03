
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CoopEvent, Tenant } from '../types';

interface EventDetailProps {
  isAdmin: boolean;
  isGuest?: boolean;
  user: { email: string; name: string };
  events: CoopEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CoopEvent[]>>;
}

const EventDetail: React.FC<EventDetailProps> = ({ isAdmin, isGuest = false, user, events, setEvents }) => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState(events.find(e => e.id === eventId));
  const [isEditing, setIsEditing] = useState(false);
  const [isAttending, setIsAttending] = useState(false);
  
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
    };

    if (isTemp) {
      const updatedTempEvent = { ...event, ...payload };
      setEvents(events.map(ev => ev.id === event.id ? updatedTempEvent : ev));
      setIsEditing(false);
      alert("Temporary event updated for this session.");
      return;
    }

    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setEvents(events.map(ev => ev.id === event.id ? data : ev));
      setIsEditing(false);
      alert("Event details updated successfully!");
    } catch (err) {
      console.error(err);
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
      } else {
        alert(data.error || "Failed to confirm attendance.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 transition-colors duration-200">
      <div className="flex items-center gap-4 text-slate-500 text-sm mb-2">
        <Link to="/calendar" className="hover:text-brand-600 transition-colors flex items-center gap-1">
          <i className="fa-solid fa-arrow-left"></i> Back to Calendar
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800 dark:text-slate-200">{event.title}</span>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/5 overflow-hidden">
        <div className="h-48 bg-slate-900 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=1200')] bg-cover bg-center"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
          <div className="absolute bottom-8 left-8">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                event.category === 'Meeting' ? 'bg-blue-600 text-white' :
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
              {/* ... form content ... */}
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
    </div>
  );
};

export default EventDetail;
