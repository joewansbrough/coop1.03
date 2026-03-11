
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Send, User, Sparkles, Shield, MessageSquare, ChevronRight, Info } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { Document } from '../types';

const PolicyAssistant: React.FC<{ documents: Document[] }> = ({ documents }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { 
      role: 'assistant', 
      content: "Hello! I'm your Co-op Policy Assistant. I can help you understand our bylaws, occupancy agreements, and house rules. What would you like to know today?" 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    // Prepare context from policy documents - match both 'Policy' and 'Policies' categories
    const policyDocs = documents.filter(d => 
      d.category === 'Policy' || d.category === 'Policies' || d.category === 'Bylaws'
    );
    const docContext = policyDocs.length > 0 
      ? policyDocs.map(d => `Document: ${d.title}
Content: ${d.content || '(Full text not available)'}`).join('

')
      : 'No local policy documents currently have extracted text content.';
    
    const generalContext = `BC Co-op Housing Context:
- BC housing co-ops operate under the Cooperative Association Act (RSBC 1996)
- Members have occupancy rights, not tenancy - the Residential Tenancy Act does not apply
- Members must participate through committee work (typically 8-12 hours/year)
- Housing charges are set annually by the board based on operating costs, not market rents
- Members can be evicted for non-payment or conduct violations with proper notice and a hearing
- Subletting is generally prohibited or requires board approval
- Board elections occur at the AGM; typically 5-7 directors serve staggered 2-year terms
- Special general meetings require written notice (typically 14-21 days) and a quorum
- Major capital expenditures above a threshold require member approval
- The reserve fund must be maintained per a professional reserve fund study`;
    
    const fullContext = docContext + generalContext;

    try {
      const response = await geminiService.askPolicyQuestion(userMessage, fullContext);
      setMessages(prev => [...prev, { role: 'assistant', content: response || "I'm sorry, I couldn't process that request." }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "I encountered an error while trying to find an answer. Please try again later or contact the board." }]);
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
    <div className="max-w-5xl mx-auto h-[calc(100vh-8rem)] flex flex-col gap-6 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Policy Assistant</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">AI-powered guidance for BC Housing Co-operative regulations.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest">
          <Sparkles className="w-3 h-3" />
          Powered by Gemini AI
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        {/* Sidebar - Info & Suggestions */}
        <div className="hidden lg:flex flex-col gap-6 lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-white/5 space-y-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Shield className="w-5 h-5" />
              <h4 className="text-xs font-black uppercase tracking-widest">How it works</h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              This assistant analyzes your co-op's archived documents and BC housing regulations to provide instant answers to policy questions.
            </p>
            <div className="pt-2">
              <div className="flex items-center gap-2 text-slate-400 mb-3">
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

          <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-3xl border border-amber-100 dark:border-amber-900/30">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500 mb-2">
              <Info className="w-4 h-4" />
              <h4 className="text-[10px] font-black uppercase tracking-widest">Disclaimer</h4>
            </div>
            <p className="text-[10px] text-amber-800/70 dark:text-amber-500/70 leading-relaxed italic">
              AI responses are for guidance only. Always verify with the official signed Bylaws and Occupancy Agreement.
            </p>
          </div>
        </div>

        {/* Main Chat Interface */}
        <div className="lg:col-span-3 flex flex-col bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      msg.role === 'user' 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
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
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1] }} 
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="w-1.5 h-1.5 bg-emerald-500 rounded-full" 
                      />
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1] }} 
                        transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                        className="w-1.5 h-1.5 bg-emerald-500 rounded-full" 
                      />
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1] }} 
                        transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                        className="w-1.5 h-1.5 bg-emerald-500 rounded-full" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-white/5">
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
            <div className="mt-3 flex justify-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Secure AI Assistant &bull; Member Data Protected
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolicyAssistant;
