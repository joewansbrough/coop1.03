import React, { useEffect, useState } from 'react';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { geminiService } from '../services/geminiService';
import { ORACLE_LANGUAGES } from '../utils/oracle';
import type { OracleLanguage, OracleResponse } from '../types';

const chips = [
  'What is the pet policy?',
  'How do I join a committee?',
  'Can a guest stay for two weeks?',
  'What is the hallway clutter policy?',
  'My sink is leaking, what do I do?',
];

interface OracleAssistantProps {
  embedded?: boolean;
}

const OracleAssistant: React.FC<OracleAssistantProps> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(embedded);
  const [language, setLanguage] = useState<OracleLanguage>('English');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; response?: OracleResponse }>>([
    { role: 'assistant', content: 'Ask me about co-op policies, meetings, documents, or maintenance steps.' },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const showDemoQuestion = () => {
      const demoResponse: OracleResponse = {
        answer: 'Yes. Residents should submit repair issues through Maintenance so the board has the unit, category, urgency, notes, and follow-up history in one place. If the issue affects water, electrical safety, heat, entry access, or another urgent building system, mark it high priority and contact the office as well. You can start from [Maintenance](/maintenance).',
        citations: [
          { documentId: 'd1', title: 'Maintenance Request Policy', pageNumber: 2 },
          { documentId: 'd2', title: 'Resident Handbook', pageNumber: 8 },
        ],
        language: 'English',
        intent: 'maintenance',
        confidence: 0.94,
        suggestedAction: { type: 'start-maintenance-request', label: 'Open Maintenance', href: '/maintenance' },
      };
      setIsLoading(false);
      setMessages([
        { role: 'assistant', content: 'Ask me about co-op policies, meetings, documents, or maintenance steps.' },
        { role: 'user', content: 'A resident has a leaking sink. What should we do first?' },
        { role: 'assistant', content: demoResponse.answer, response: demoResponse },
      ]);
    };

    document.addEventListener('auto-demo-oracle-question', showDemoQuestion);
    return () => document.removeEventListener('auto-demo-oracle-question', showDemoQuestion);
  }, []);

  const ask = async (question: string) => {
    if (!question.trim() || isLoading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setIsLoading(true);
    try {
      const response = await geminiService.askOracle(question, language, typeof window !== 'undefined' ? window.location.hash : '');
      setMessages(prev => [...prev, { role: 'assistant', content: response.answer, response }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: error.message || 'The Oracle could not reach Gemini. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = (content: string, response?: OracleResponse) => {
    // Simple regex to find internal links like [Title](/path)
    const parts = content.split(/(\[.+?\]\(.+?\))/g);
    
    return (
      <div className="space-y-3">
        <p className="whitespace-pre-wrap">
          {parts.map((part, i) => {
            const match = part.match(/\[(.+?)\]\((.+?)\)/);
            if (match) {
              const [_, label, href] = match;
              return (
                <button
                  key={i}
                  onClick={() => navigate(href)}
                  className="mx-1 font-bold text-teal-600 underline decoration-teal-600/30 underline-offset-2 hover:text-teal-700"
                >
                  {label}
                </button>
              );
            }
            return part;
          })}
        </p>
        
        {/* Render Citations */}
        {response?.citations && response.citations.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-slate-200/50 pt-3 dark:border-white/5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sources</p>
            <div className="flex flex-wrap gap-2">
              {response.citations.map((citation, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/resource-library?id=${citation.documentId}`)}
                  className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-white/10"
                >
                  <Sparkles className="h-3 w-3 text-teal-500" />
                  {citation.title}
                  {citation.pageNumber && <span className="opacity-50">(p. {citation.pageNumber})</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const panel = (
    <div className={embedded ? 'h-full rounded-[24px] border border-slate-200 bg-white dark:border-white/5 dark:bg-slate-900' : 'fixed bottom-20 right-4 z-[120] w-[calc(100vw-2rem)] max-w-md rounded-[24px] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900'}>
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-300">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black uppercase text-slate-900 dark:text-white">Co-op Oracle</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Policy assistant</p>
          </div>
        </div>
        {!embedded && (
          <button onClick={() => setIsOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="border-b border-slate-100 p-3 dark:border-white/5">
        <select value={language} onChange={event => setLanguage(event.target.value as OracleLanguage)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none dark:border-white/10 dark:bg-slate-950 dark:text-slate-200">
          {ORACLE_LANGUAGES.map(item => <option key={item}>{item}</option>)}
        </select>
      </div>
      <div className="h-80 space-y-3 overflow-y-auto p-4" data-demo-target="policy-assistant-qa">
        {messages.map((message, index) => (
          <div key={index} className={message.role === 'user' ? 'text-right' : 'text-left'}>
            <div className={`inline-block max-w-[88%] rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed ${message.role === 'user' ? 'bg-teal-600 text-white' : 'bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-200'}`}>
              {message.role === 'assistant' ? renderContent(message.content, message.response) : message.content}
              {message.response?.suggestedAction && (
                <button
                  type="button"
                  onClick={() => navigate(message.response?.suggestedAction?.href || '/maintenance')}
                  className="mt-3 block rounded-xl bg-white px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-teal-700"
                >
                  {message.response.suggestedAction.label}
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && <p className="text-xs font-black uppercase tracking-widest text-teal-600">Oracle is reading...</p>}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3 dark:border-white/5">
        {chips.slice(0, embedded ? 5 : 3).map(chip => (
          <button key={chip} type="button" onClick={() => ask(chip)} className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {chip}
          </button>
        ))}
      </div>
      <form onSubmit={event => { event.preventDefault(); ask(input); }} className="flex gap-2 p-3">
        <input value={input} onChange={event => setInput(event.target.value)} placeholder="Ask a co-op question..." className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-teal-500 dark:border-white/10 dark:bg-slate-950 dark:text-white" />
        <button type="submit" disabled={!input.trim() || isLoading} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );

  if (embedded) return panel;

  return (
    <>
      {isOpen && panel}
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="fixed bottom-5 right-5 z-[110] flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-xl shadow-teal-900/20 active:scale-95" aria-label="Open Co-op Oracle">
          <Sparkles className="h-5 w-5" />
        </button>
      )}
    </>
  );
};

export default OracleAssistant;
