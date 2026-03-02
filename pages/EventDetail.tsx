
import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MOCK_EVENTS } from '../constants';
import { CoopEvent } from '../types';

const EventDetail: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState(MOCK_EVENTS.find(e => e.id === eventId));
  const [isEditing, setIsEditing] = useState(false);

  if (!event) return <div className="p-8 text-center text-slate-500">Event not found.</div>;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    alert("Event details updated successfully!");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 transition-colors duration-200">
      <div className="flex items-center gap-4 text-slate-500 text-sm mb-2">
        <Link to="/calendar" className="hover:text-emerald-600 transition-colors flex items-center gap-1">
          <i className="fa-solid fa-arrow-left"></i> Back to Calendar
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800 dark:text-slate-200">{event.title}</span>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-xl overflow-hidden">
        <div className="h-48 bg-slate-900 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=1200')] bg-cover bg-center"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
          <div className="absolute bottom-8 left-8">
            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
              event.category === 'Meeting' ? 'bg-blue-600 text-white' :
              event.category === 'Social' ? 'bg-emerald-600 text-white' :
              'bg-amber-600 text-white'
            }`}>
              {event.category}
            </span>
            <h1 className="text-3xl font-black text-white mt-3">{event.title}</h1>
          </div>
        </div>

        <div className="p-8 lg:p-12">
          {isEditing && isAdmin ? (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Title</label>
                  <input 
                    className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold"
                    defaultValue={event.title}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</label>
                  <select className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold">
                    <option>Meeting</option><option>Social</option><option>Maintenance</option><option>Board</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
                  <input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold" defaultValue={event.date} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Time</label>
                  <input type="time" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold" defaultValue={event.time} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</label>
                <input className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold" defaultValue={event.location} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</label>
                <textarea className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded-xl px-4 py-3 text-sm font-medium h-32" defaultValue={event.description}></textarea>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-4 text-xs font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-2xl">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase shadow-xl hover:bg-emerald-700">Save Changes</button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2 space-y-8">
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
                        <br /><span className="text-slate-400">at {event.time}</span>
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
                {isAdmin && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="w-full bg-slate-900 dark:bg-slate-800 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-95"
                  >
                    <i className="fa-solid fa-pen-to-square mr-2"></i> Edit Event
                  </button>
                )}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-white/5">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Attendee List</h4>
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400 italic">No members have confirmed attendance yet.</p>
                  </div>
                  <button className="w-full mt-6 py-3 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800 transition-all">
                    I'm Attending
                  </button>
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
