import React from 'react';
import OracleAssistant from '../components/OracleAssistant';
import { Announcement, Document } from '../types';

const PolicyAssistant: React.FC<{ documents: Document[]; announcements: Announcement[] }> = () => (
  <div className="mx-auto max-w-5xl space-y-6 pb-12" data-demo-target="policy-assistant">
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Co-op Oracle</h2>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        Ask natural-language questions about co-op policies, documents, governance, and maintenance next steps.
      </p>
    </div>
    <div className="h-[720px]">
      <OracleAssistant embedded />
    </div>
  </div>
);

export default PolicyAssistant;
