
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { geminiService } from '../services/geminiService';
import { Document } from '../types';

interface CoopOracleProps {
  documents: Document[];
}

const CoopOracle: React.FC<CoopOracleProps> = ({ documents }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string; isSimplified?: boolean; originalText?: string }[]>([
    { role: 'ai', text: "Hello! I'm the Co-op Oracle. I can help you understand our co-op's bylaws and policies. What would you like to know today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [maintenanceSuggestion, setMaintenanceSuggestion] = useState<{ isMaintenance: boolean; briefDescription?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const LANGUAGES = ['English', 'Spanish', 'French', 'Cantonese', 'Mandarin', 'Punjabi', 'Tagalog'];
  const SUGGESTIONS = [
    "How do I pay my housing charge?",
    "What's the pet policy?",
    "How do I join a committee?",
    "Emergency maintenance contact"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || input.trim();
    if (!textToSend || isLoading) return;

    setInput('');
    setMaintenanceSuggestion(null);
    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setIsLoading(true);

    try {
      // Filter out the initial greeting if it's from the AI, 
      // as Gemini history must normally start with a 'user' role.
      const conversationMessages = messages[0]?.role === 'ai' 
        ? messages.slice(1) 
        : messages;

      // Map existing messages to Gemini format (limiting history to last 10 messages for context)
      const history = conversationMessages.slice(-10).map(m => ({
        role: (m.role === 'ai' ? 'model' : 'user') as 'model' | 'user',
        parts: [{ text: m.text }]
      }));

      // Parallelize bot response and intent detection
      const [intent, response] = await Promise.all([
        geminiService.detectMaintenanceIntent(textToSend),
        geminiService.chatWithOracle(textToSend, history)
      ]);

      let finalResponse = response || "I'm sorry, I couldn't find an answer to that.";
      
      // If language other than English is selected, translate the response
      if (selectedLanguage !== 'English') {
        const translated = await geminiService.translateText(finalResponse, selectedLanguage);
        finalResponse = translated || finalResponse;
      }

      setMessages(prev => [...prev, { role: 'ai', text: finalResponse }]);
      
      if (intent.isMaintenance) {
        setMaintenanceSuggestion(intent);
      }
    } catch (error) {
      console.error("Oracle error:", error);
      setMessages(prev => [...prev, { role: 'ai', text: "I'm having a bit of trouble connecting right now. Please try again or contact the Board directly." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimplify = async (index: number) => {
    if (isLoading) return;
    const msg = messages[index];
    if (msg.role !== 'ai' || msg.isSimplified) return;

    setIsLoading(true);
    try {
      const simpleVersion = await geminiService.simplifyText(msg.text);
      const newMessages = [...messages];
      newMessages[index] = { 
        ...msg, 
        text: simpleVersion || msg.text, 
        isSimplified: true, 
        originalText: msg.text 
      };
      setMessages(newMessages);
    } catch (error) {
      console.error("Simplification error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsLoading(true);
      try {
        const refined = await geminiService.refineTranscription(transcript);
        handleSend(refined);
      } catch (e) {
        handleSend(transcript);
      } finally {
        setIsLoading(false);
      }
    };

    recognition.start();
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close Co-op Oracle" : "Open Co-op Oracle AI Chatbot"}
        aria-expanded={isOpen}
        className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center z-[100] cursor-pointer"
        id="coop-oracle-fab"
      >
        <i className={`fa-solid ${isOpen ? 'fa-xmark' : 'fa-sparkles'} text-xl`}></i>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-[400px] max-w-[calc(100vw-48px)] h-[540px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/5 flex flex-col z-[100] overflow-hidden"
            role="dialog"
            aria-labelledby="oracle-title"
          >
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-xl">
                  <i className="fa-solid fa-sparkles text-sm"></i>
                </div>
                <div>
                  <h3 id="oracle-title" className="font-black text-sm uppercase tracking-widest">Co-op Oracle</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight leading-none mt-1">Accessibility First Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select 
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>
            </div>

            <div 
              className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-emerald-600 text-white rounded-tr-none' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-white/5 shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                  {msg.role === 'ai' && !isLoading && (
                    <div className="flex gap-2 mt-2">
                      <button 
                        onClick={() => handleSimplify(i)}
                        className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all border ${
                          msg.isSimplified 
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200' 
                            : 'bg-white dark:bg-slate-950 text-slate-400 border-slate-200 dark:border-white/5 hover:text-emerald-600 hover:border-emerald-500'
                        }`}
                      >
                        <i className={`fa-solid ${msg.isSimplified ? 'fa-check-circle' : 'fa-wand-magic-sparkles'} mr-1`}></i>
                        {msg.isSimplified ? 'Simplified for Clarity' : 'Simplify Language'}
                      </button>
                      {msg.isSimplified && (
                        <button 
                          onClick={() => {
                            const newMessages = [...messages];
                            newMessages[i] = { ...msg, text: msg.originalText!, isSimplified: false };
                            setMessages(newMessages);
                          }}
                          className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-white dark:bg-slate-950 text-slate-400 border border-slate-200 dark:border-white/5 rounded-full"
                        >
                          Show Original
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-200 dark:border-white/5 shadow-sm flex gap-1">
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                  </div>
                </div>
              )}

              {!isLoading && messages.length <= 1 && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-50 dark:border-white/5">
                  {SUGGESTIONS.map((s, i) => (
                    <button 
                      key={i}
                      onClick={() => handleSend(s)}
                      className="text-[9px] font-black uppercase tracking-widest px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 rounded-xl hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {maintenanceSuggestion && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 p-4 rounded-2xl space-y-3 shadow-sm border-dashed"
                >
                  <p className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-screwdriver-wrench text-amber-500"></i> Need Maintenance Help?
                  </p>
                  <p className="text-[11px] font-medium text-amber-900/80 dark:text-amber-200/80 leading-relaxed italic">
                    "It sounds like you have a maintenance issue. Would you like to start a formal request?"
                  </p>
                  <button 
                    onClick={() => {
                        window.location.href = '/maintenance';
                    }}
                    className="w-full py-2 bg-amber-600 text-white font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 active:scale-95"
                  >
                    Start Maintenance Request
                  </button>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex gap-2">
                <button
                  onClick={startVoiceInput}
                  disabled={isLoading || isListening}
                  aria-label="Speak your question"
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 border ${
                    isListening 
                      ? 'bg-rose-500 text-white animate-pulse border-rose-600 shadow-lg shadow-rose-500/20' 
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-emerald-500 hover:text-emerald-600'
                  }`}
                >
                  <i className={`fa-solid ${isListening ? 'fa-line-wave' : 'fa-microphone'} text-sm`}></i>
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isListening ? "Listening..." : "Ask a question..."}
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white placeholder:text-[10px] placeholder:uppercase placeholder:font-black placeholder:tracking-widest"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim()}
                  className="w-12 h-12 bg-slate-900 dark:bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-black dark:hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  <i className="fa-solid fa-paper-plane text-xs"></i>
                </button>
              </div>
              <p className="text-[8px] text-slate-400 dark:text-slate-500 text-center mt-3 font-black uppercase tracking-widest flex items-center justify-center gap-2">
                <i className="fa-solid fa-universal-access text-emerald-500"></i> Empowering Every Member
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CoopOracle;
