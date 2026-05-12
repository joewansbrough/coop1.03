import React, { useEffect, useState, useRef } from 'react';
import { Bot, Send, Sparkles, X, Mic, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const sessionReadyRef = useRef(false);
  const greetingSentRef = useRef(false);
  const [volume, setVolume] = useState(0);
  const [language, setLanguage] = useState<OracleLanguage>('English');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; response?: OracleResponse }>>([
    { role: 'assistant', content: 'Ask me about co-op policies, meetings, documents, or maintenance steps.' },
  ]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const liveSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Gapless Audio Playback for Live Mode
  const playAudioChunk = async (base64: string) => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
    const ctx = audioContextRef.current;

    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    
    // Convert PCM 16-bit to Float32 for Web Audio API
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

    const buffer = ctx.createBuffer(1, float32.length, 24000); // Live API uses 24kHz
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
    activeSourceRef.current = source;
  };

  const stopLiveMode = () => {
    console.log("Stopping Live Mode...");
    setIsLiveMode(false);
    sessionReadyRef.current = false;
    setIsLoading(false);

    if (liveSessionRef.current) {
      liveSessionRef.current.then((s: any) => s.close());
      liveSessionRef.current = null;
    }

    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch (e) {}
      activeSourceRef.current = null;
    }

    if (audioWorkletNodeRef.current) {
      try {
        audioWorkletNodeRef.current.port.onmessage = null;
        audioWorkletNodeRef.current.disconnect();
      } catch (e) {
        console.warn("Error disconnecting worklet:", e);
      }
      audioWorkletNodeRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    
    nextStartTimeRef.current = 0;
  };

  const startLiveMode = async () => {
    if (isLiveMode) {
      stopLiveMode();
      return;
    }

    setIsLiveMode(true);
    setMode('voice');
    setMessages(prev => [...prev, { role: 'assistant', content: "[Live Mode Started] You can talk naturally now." }]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = ctx;
      
      // Ensure context is running
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      console.log("AudioContext initialized:", ctx.state, ctx.sampleRate);

      // Load the module FIRST and await it completely
      try {
        await ctx.audioWorklet.addModule('/VoiceWorklet.js');
        console.log("VoiceWorklet module loaded successfully");
      } catch (e) {
        console.error("Failed to load VoiceWorklet module:", e);
        throw new Error("Could not load audio processor. Please refresh.");
      }

      const workletNode = new AudioWorkletNode(ctx, 'voice-worklet');
      audioWorkletNodeRef.current = workletNode;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(workletNode);

      const hasAlreadyBeenGreeted = typeof window !== 'undefined' && sessionStorage.getItem('oracle_greeted') === 'true';

      const systemInstruction = `You are the smart "Oak Bay Co-op Oracle" in Real-time Mode.
      Respond briefly and conversationally. You can help with database queries too.
      Always stay in ${language}.
      
      NEW CAPABILITY: Integrated Deep Linking. 
      You can automatically navigate the user's interface to specific co-op pages or records using tools.
      - Use 'view_event' (or 'viewEvent') to show a specific event/meeting. Set view='minutes' to show decisions/minutes.
      - Use 'view_maintenance_request' (or 'viewMaintenanceRequest') to show a specific maintenance record.
      - Use 'view_committee' (or 'viewCommittee') to show a specific committee.
      - Use 'view_document' (or 'viewDocument') to pull up a document.
      - Use 'navigate_to_page' (or 'navigateToPage') to pull up helpful pages like /maintenance, /tenants, /committees, /calendar, /resource-library, or /announcements.
      
      If you are discussing a specific record or if a page would be helpful context, use these tools to "show" it to the user.
      If the user's request is ambiguous (e.g., they ask for the "last meeting" but there are several), ASK for clarifying details first, then use the tool once you are sure.
      
      GREETING LOGIC:
      - This user has ${hasAlreadyBeenGreeted ? 'ALREADY' : 'NOT YET'} been greeted this session.
      - If NOT YET greeted: Greet them warmly and explain you are ready to help.
      - If ALREADY greeted: Provide a very brief acknowledgment (e.g. "I'm back," "Listening," or just a quick "Hello again"). Do NOT give a long intro.
      - Stay concise.`;

      const sessionPromise = geminiService.connectLive({
        onOpen: async () => {
          console.log("Live session fully established");
          sessionReadyRef.current = true;
          setMessages(prev => [...prev, { role: 'assistant', content: "[Connected] The Oracle is listening." }]);
          
          // Only send the automatic text trigger if we haven't greeted them this session
          if (!hasAlreadyBeenGreeted && !greetingSentRef.current) {
            const session = await sessionPromise;
            (session as any).sendRealtimeInput({
              text: "Hello! I am ready to help. Please let me know how I can assist with your co-op questions."
            });
            greetingSentRef.current = true;
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('oracle_greeted', 'true');
            }
          } else {
             // Subtle acknowledgement for return users
             const session = await sessionPromise;
             (session as any).sendRealtimeInput({
               text: "I'm back and ready to help."
             });
          }
        },
        onClose: () => {
          console.log("Live session closed");
          stopLiveMode();
        },
        onError: (err) => {
          console.error("Live error:", err);
          setMessages(prev => [...prev, { role: 'assistant', content: "The Oracle has lost its connection. Please try again." }]);
          stopLiveMode();
        },
        onInterrupted: () => {
          if (activeSourceRef.current) {
            try { activeSourceRef.current.stop(); } catch (e) {}
            activeSourceRef.current = null;
          }
          nextStartTimeRef.current = 0;
        },
        onText: (text) => {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant' && !last.response) {
              return [...prev.slice(0, -1), { ...last, content: last.content + text }];
            }
            return [...prev, { role: 'assistant', content: text }];
          });
        },
        onAudio: (base64) => playAudioChunk(base64),
        onToolCall: (name, args) => {
          console.log(`Tool called: ${name}`, args);
          if ((name === 'viewMaintenanceRequest' || name === 'view_maintenance_request') && args.requestId) {
            navigate(`/maintenance/${args.requestId}`);
          } else if ((name === 'viewEvent' || name === 'view_event') && args.eventId) {
            const url = args.view === 'minutes' ? `/calendar/${args.eventId}?tab=minutes` : `/calendar/${args.eventId}`;
            navigate(url);
          } else if ((name === 'viewCommittee' || name === 'view_committee') && args.committeeId) {
            navigate(`/committees?id=${args.committeeId}`);
          } else if ((name === 'viewDocument' || name === 'view_document')) {
            if (args.documentId) {
              navigate(`/documents?id=${args.documentId}`);
            } else if (args.title) {
              navigate(`/documents?search=${encodeURIComponent(args.title)}`);
            }
          } else if ((name === 'viewTenant' || name === 'view_tenant') && args.tenantId) {
            navigate(`/admin/tenants/${args.tenantId}`);
          } else if ((name === 'viewUnit' || name === 'view_unit') && args.unitId) {
            navigate(`/admin/units/${args.unitId}`);
          } else if ((name === 'navigateToPage' || name === 'navigate_to_page') && args.page) {
            const url = args.query ? `${args.page}?${args.query}` : args.page;
            navigate(url);
          }
        }
      }, systemInstruction);


      liveSessionRef.current = sessionPromise;

      let chunkCount = 0;
      workletNode.port.onmessage = async (event) => {
        if (event.data.type === 'volume') {
          setVolume(event.data.volume);
        } else if (event.data.type === 'audio') {
          if (!sessionReadyRef.current) return;

          const pcmBuffer = event.data.data;
          const base64 = window.btoa(String.fromCharCode(...new Uint8Array(pcmBuffer)));
          
          const session = await sessionPromise;
          chunkCount++;
          if (chunkCount % 100 === 0) console.log(`DEBUG: Sent ${chunkCount} audio chunks to Google`);
          
          if (session && typeof (session as any).sendRealtimeInput === 'function') {
            (session as any).sendRealtimeInput({
              audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
            });
          }
        }
      };

    } catch (err) {
      console.error("Failed to start live mode", err);
      setIsLiveMode(false);
      setMessages(prev => [...prev, { role: 'assistant', content: "Microphone access is required for Live Mode." }]);
    }
  };

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animationId: number;
      const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barCount = 12;
        const spacing = 4;
        const width = (canvas.width - (barCount - 1) * spacing) / barCount;
        
        ctx.fillStyle = '#0d9488';
        for (let i = 0; i < barCount; i++) {
          const v = Math.max(2, volume * 1000 * (0.5 + Math.random() * 0.5));
          const h = (v / 100) * canvas.height;
          ctx.beginPath();
          ctx.roundRect(i * (width + spacing), (canvas.height - h) / 2, width, h, 2);
          ctx.fill();
        }
        animationId = requestAnimationFrame(render);
      };
      render();
      return () => cancelAnimationFrame(animationId);
    }
  }, [volume]);


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

      {isLiveMode && (
        <div className="bg-slate-50 dark:bg-slate-950/50 p-4 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-600 animate-pulse">Live Session Active</p>
            <div className="flex items-center gap-1.5">
              <Volume2 className="h-3 w-3 text-slate-400" />
              <div className="h-1 w-24 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-teal-500 transition-all duration-75" 
                  style={{ width: `${Math.min(100, volume * 500)}%` }}
                ></div>
              </div>
            </div>
          </div>
          <canvas ref={canvasRef} width={400} height={40} className="w-full h-10" />
        </div>
      )}

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
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={startLiveMode} 
            className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all shadow-sm ${isLiveMode ? 'bg-red-600 text-white animate-pulse' : 'bg-teal-50 text-teal-600 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300'}`}
            aria-label={isLiveMode ? "Stop Live Mode" : "Start Live Mode"}
          >
            <Mic className={`h-5 w-5 ${isLiveMode ? 'animate-bounce' : ''}`} />
          </button>
          <button type="submit" disabled={!input.trim() || isLoading} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white disabled:opacity-50 shadow-sm">
            <Send className="h-4 w-4" />
          </button>
        </div>
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
