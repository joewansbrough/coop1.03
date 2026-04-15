
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Send, User, Sparkles, Shield, MessageSquare, ChevronRight, Info } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { Document, Announcement } from '../types';

const PolicyAssistant: React.FC<{ documents: Document[], announcements: Announcement[] }> = ({ documents, announcements }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your Co-op Policy Assistant. I can help you understand our bylaws, occupancy agreements, and house rules. What would you like to know today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [resourceQuestion, setResourceQuestion] = useState('');
  const [resourceAiResponse, setResourceAiResponse] = useState('');
  const [isResourceSearching, setIsResourceSearching] = useState(false);

  const handleResourceSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceQuestion) return;
    setIsResourceSearching(true);
    setResourceAiResponse('');

    const docContext = documents.length > 0
      ? documents.map(d =>
        `[Document] Title: ${d.title} | Category: ${d.category}` +
        (d.tags?.length ? ` | Tags: ${d.tags.join(', ')}` : '') +
        (d.content?.trim() ? `\nContent: ${d.content.substring(0, 3000)}` : ' | (no extracted text)')
      ).join('\n\n')
      : 'No documents in the library.';
    const context = `DOCUMENT CONTEXT:\n${docContext}`;

    try {
      const answer = await geminiService.askPolicyQuestion(resourceQuestion, context);
      setResourceAiResponse(answer || 'Sorry, I could not find an answer.');
    } catch (err) {
      setResourceAiResponse('Error communicating with AI Assistant.');
    } finally {
      setIsResourceSearching(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    // Prepare context from all documents that have text content
    const searchableDocs = documents.filter(d => 
      d.content && d.content.trim().length > 0
    );
    const docContext = searchableDocs.length > 0
      ? searchableDocs.map(d => `[Document] Title: ${d.title} | Category: ${d.category}\nContent: ${d.content}`).join('\n\n')
      : 'No documents currently have extracted text content.';

    // Prepare context from announcements
    const announcementContext = announcements.length > 0
      ? announcements.map(a => `[Announcement] Title: ${a.title} | Type: ${a.type} | Date: ${a.date}\nContent: ${a.content}`).join('\n\n')
      : 'No recent announcements available.';

    const generalContext = [
      'BC Co-op Housing Context:',
      '- BC housing co-ops operate under the Cooperative Association Act (RSBC 1996)',
      '- Members have occupancy rights, not tenancy - the Residential Tenancy Act does not apply',
      '- Members must participate through committee work (typically 8-12 hours/year)',
      '- Housing charges are set annually by the board based on operating costs, not market rents',
      '- Members can be evicted for non-payment or conduct violations with proper notice and a hearing',
      '- Subletting is generally prohibited or requires board approval',
      '- Board elections occur at the AGM; typically 5-7 directors serve staggered 2-year terms',
      '- Special general meetings require written notice (typically 14-21 days) and a quorum',
      '- Major capital expenditures above a threshold require member approval',
      '- The reserve fund must be maintained per a professional reserve fund study',
    ].join('\n');

    const fullContext = `DOCUMENT CONTEXT:\n${docContext}\n\nANNOUNCEMENT CONTEXT:\n${announcementContext}\n\nCO-OP PRINCIPLES:\n${generalContext}`;

    try {
      const response = await geminiService.askPolicyQuestion(userMessage, fullContext);
      setMessages(prev => [...prev, { role: 'assistant', content: response || "I'm sorry, I couldn't process that request." }]);
    } catch (error: any) {
      console.error('Policy Assistant Error:', error);
      const errorMessage = error.message || "I encountered an error while trying to find an answer.";
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMessage}. Please check your connection or contact the board.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = [
    "What are the rules for subletting my unit?",
    "How much notice is required for a general meeting?",
    "What is the policy on pets in the co-op?",
    "How are board members elected?"
  ];

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Policy Assistant</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">AI-powered guidance for BC Housing Co-operative regulations.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest">
          <Sparkles className="w-3 h-3" />
          Powered by Gemini AI
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
        {/* Sidebar Column */}
        <div className="hidden lg:flex flex-col lg:col-span-1">
          {/* Sidebar Row 1: How It Works */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-white/5 space-y-4 flex flex-col h-full">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Shield className="w-5 h-5" />
              <h4 className="text-xs font-black uppercase tracking-widest">How it works</h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              This assistant analyzes your co-op's archived documents and BC housing regulations to provide instant answers to policy questions.
            </p>
            <div className="pt-2 flex-1 overflow-y-auto min-h-0">
              <div className="flex items-center gap-2 text-slate-400 mb-3 sticky top-0 bg-white dark:bg-slate-900 pb-1">
                <MessageSquare className="w-4 h-4" />
                <h4 className="text-[10px] font-black uppercase tracking-widest">Try asking:</h4>
              </div>
              <div className="space-y-2">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(q)}
                    className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Column: Chat Interface */}
        <div className="lg:col-span-3 flex flex-col bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden">
          {/* Chat Messages */}
          <div className="h-[420px] overflow-y-auto p-6 space-y-6 scrollbar-hide">
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${msg.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                      {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-tr-none'
                        : 'bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-white/5'
                      }`}>
                      {msg.content}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl rounded-tl-none border border-slate-100 dark:border-white/5">
                    <div className="flex gap-1">
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-white/5 mt-auto">
            <form onSubmit={handleSend} className="relative flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about bylaws, rules, or occupancy agreements..."
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-12 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Resource Search Module - Full Width with Separator */}
      <div className="pt-8 border-t border-slate-100 dark:border-white/5">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-[15rem] pointer-events-none group-hover:opacity-10 transition-opacity">
            <i className="fa-solid fa-wand-magic-sparkles"></i>
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center">
                <i className="fa-solid fa-robot text-xl"></i>
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Resource Search</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Instant association rule lookup</p>
              </div>
            </div>
            <form onSubmit={handleResourceSearch} className="relative">
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 pr-32 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-medium"
                placeholder="e.g., How many days notice for a general meeting?"
                value={resourceQuestion}
                onChange={(e) => setResourceQuestion(e.target.value)}
              />
              <button
                type="submit"
                disabled={isResourceSearching}
                className="absolute right-2 top-2 bottom-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 active:scale-95"
              >
                {isResourceSearching ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                Query
              </button>
            </form>
            {resourceAiResponse && (
              <div className="mt-6 p-6 bg-white/5 border border-white/10 rounded-2xl text-sm leading-relaxed animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest border border-emerald-500/30 px-2 py-0.5 rounded">Search Result</span>
                </div>
                <p className="text-slate-200 font-medium leading-relaxed">{resourceAiResponse}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolicyAssistant;
