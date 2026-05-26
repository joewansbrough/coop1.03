import React from 'react';
import OracleAssistant from '../components/OracleAssistant';
import { Announcement, Document } from '../types';
import { getDocumentOnboardingState } from '../utils/documentOnboarding';

const PolicyAssistant: React.FC<{ documents: Document[]; announcements: Announcement[] }> = ({ documents }) => {
  const documentSetup = getDocumentOnboardingState(Array.isArray(documents) ? documents : []);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-7xl flex-col space-y-4 pb-4" data-demo-target="policy-assistant">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Co-op Oracle</h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Ask natural-language questions about co-op policies, documents, governance, and maintenance next steps.
        </p>
      </div>
      {!documentSetup.ragReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-500/20 dark:bg-amber-950/30">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">Document answers are still coming online</p>
          <p className="mt-2 text-sm font-medium leading-6 text-amber-900 dark:text-amber-100">
            Oracle can still help with app navigation and maintenance workflows, but policy answers with citations need indexed co-op documents. {documentSetup.documentsLoaded ? 'Index Drive-backed documents from the Resource Library.' : 'Add or link documents from the Resource Library first.'}
          </p>
        </div>
      )}
      <div className="min-h-[420px] flex-1 h-[calc(100dvh-12rem)]">
        <OracleAssistant embedded />
      </div>
    </div>
  );
};

export default PolicyAssistant;
