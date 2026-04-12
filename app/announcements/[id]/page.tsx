'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAnnouncements } from '../../../hooks/useCoopData';

export default function AnnouncementDetailPage() {
  const params = useParams();
  const annId = params.id as string;
  const { data: announcements = [] } = useAnnouncements();
  const announcement = announcements.find(a => a.id === annId);

  if (!announcement) return <div className="p-8 text-center text-slate-500">Announcement not found.</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 transition-colors duration-200 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 text-slate-500 text-sm mb-2">
        <Link href="/" className="hover:text-emerald-600 transition-colors flex items-center gap-1 font-bold uppercase tracking-widest text-[10px]">
          <i className="fa-solid fa-arrow-left"></i> Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-[10px]">Broadcast Archive</span>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm transition-colors">
        <div className={`p-8 lg:p-12 border-b border-slate-50 dark:border-white/5 ${announcement.priority === 'Urgent' ? 'bg-rose-50/30 dark:bg-rose-950/20' : 'bg-slate-50/50 dark:bg-slate-950/30'}`}>
          <div className="flex items-center gap-3 mb-6">
            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
              announcement.priority === 'Urgent' ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'
            }`}>
              {announcement.priority} Update
            </span>
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{announcement.date}</span>
          </div>
          <h1 className="text-3xl lg:text-5xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight">
            {announcement.title}
          </h1>
        </div>

        <div className="p-8 lg:p-12">
          <div className="max-w-none">
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10 font-medium">
              {announcement.content}
            </p>
            <div className="space-y-6 text-slate-500 dark:text-slate-500 text-sm italic border-t border-slate-100 dark:border-white/5 pt-8">
               <p>This bulletin was issued in accordance with the Co-operative Association Act of British Columbia. Members seeking full agenda packages or additional meeting documents should visit the <Link href="/documents" className="text-emerald-600 underline">Document Archive</Link>.</p>
            </div>
          </div>

          <div className="mt-12 flex items-center gap-6 p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-white/5 transition-colors">
             <div className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-black/10">
                {announcement.author[0]}
             </div>
             <div>
                <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Issued By {announcement.author}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">Association Board Secretariat</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
