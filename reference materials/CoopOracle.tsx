
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { geminiService } from '../services/geminiService';
import { Document } from '../types';

interface CoopOracleProps {
  documents: Document[];
}

const CoopOracle: React.FC<CoopOracleProps> = ({ documents }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: "Hello! I'm the Co-op Oracle. I can help you understand our co-op's bylaws and policies. What would you like to know today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [isListening, setIsListening] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [volume, setVolume] = useState(0);
  const isPlayingRef = useRef(false);

  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [maintenanceSuggestion, setMaintenanceSuggestion] = useState<{ isMaintenance: boolean; briefDescription?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<SpeechSynthesis | null>(window.speechSynthesis);

  // Gapless Audio Playback for Live Mode
  const schedulePlayback = (samples: Int16Array) => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
    const ctx = audioContextRef.current;

    const buffer = ctx.createBuffer(1, samples.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      channelData[i] = samples[i] / 32768.0;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    // Schedule start time: either now or right after the last scheduled buffer
    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    
    activeSourceRef.current = source;
    nextStartTimeRef.current = startTime + buffer.duration;
  };

  const stopLiveMode = () => {
    setIsLiveMode(false);
    setVolume(0);
    
    if (liveSessionRef.current) {
      liveSessionRef.current.then((s: any) => s.close());
      liveSessionRef.current = null;
    }

    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch (e) {}
      activeSourceRef.current = null;
    }

    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
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
    setMessages(prev => [...prev, { role: 'ai', text: "[Live Mode Started] You can talk naturally now." }]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      // Load the Voice Worklet
      await ctx.audioWorklet.addModule(new URL('./VoiceWorklet.ts', import.meta.url));
      
      const source = ctx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(ctx, 'voice-worklet');
      audioWorkletNodeRef.current = workletNode;

      const systemInstruction = `You are the smart "Oak Bay Co-op Oracle" in Real-time Mode.
      Respond briefly and conversationally. You can help with database queries too.
      Always stay in ${selectedLanguage}.
      
      NEW CAPABILITY: You can now deep-link users to specific maintenance requests. 
      If a user asks about a maintenance issue or if you find one in the database that is relevant, 
      you SHOULD use the 'viewMaintenanceRequest' tool to show them the details. 
      The UI will automatically navigate to that request.`;

      const handleToolCall = (name: string, args: any) => {
        console.log(`Tool called: ${name}`, args);
        if (name === 'viewMaintenanceRequest' && args.requestId) {
          navigate(`/maintenance?highlight=${args.requestId}`);
        }
      };

      const sessionPromise = geminiService.connectLive({
        onOpen: () => console.log("Live session open"),
        onClose: () => stopLiveMode(),
        onError: (err) => {
          console.error("Live error", err);
          let errorMessage = "The Oracle has lost its connection. Please try again in a moment.";
          
          try {
            const errStr = typeof err === 'string' ? err : JSON.stringify(err);
            if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("429")) {
              errorMessage = "The Oracle has reached its daily quota limit. Please try again tomorrow.";
            }
          } catch (e) {}

          setMessages(prev => [...prev, { role: 'ai', text: errorMessage }]);
          stopLiveMode();
        },
        onToolCall: handleToolCall,
        onText: (text) => {
           setMessages(prev => {
             const lastIdx = prev.length - 1;
             if (prev[lastIdx]?.role === 'ai' && prev[lastIdx].text.startsWith("[Live")) {
               const newMessages = [...prev];
               newMessages[lastIdx] = { ...prev[lastIdx], text: text };
               return newMessages;
             }
             return [...prev, { role: 'ai', text }];
           });
        },
        onAudio: (base64) => {
          const binary = window.atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const samples = new Int16Array(bytes.buffer);
          schedulePlayback(samples);
        },
        onInterrupted: () => {
          // Immediately stop current playback on barge-in
          if (activeSourceRef.current) {
            try { activeSourceRef.current.stop(); } catch (e) {}
            activeSourceRef.current = null;
          }
          nextStartTimeRef.current = 0;
        }
      }, systemInstruction);

      liveSessionRef.current = sessionPromise;

      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'volume') {
          setVolume(event.data.volume);
        } else if (event.data.type === 'audio') {
          const pcmBuffer = event.data.data;
          const base64 = window.btoa(String.fromCharCode(...new Uint8Array(pcmBuffer)));
          sessionPromise.then((session: any) => {
            session.sendRealtimeInput({
              audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
            });
          });
        }
      };

      source.connect(workletNode);
      workletNode.connect(ctx.destination);

    } catch (err) {
      console.error("Live mode initialization error", err);
      setIsLiveMode(false);
    }
  };

  const LANGUAGES = ['English', 'Spanish', 'French', 'Cantonese', 'Mandarin', 'Punjabi', 'Tagalog'];
  const SUGGESTIONS = [
    "How do I pay my housing charge?",
    "What's the pet policy?",
    "How do I join a committee?",
    "Emergency maintenance contact"
  ];

  const playPCM = (base64Audio: string) => {
    try {
      // Gemini TTS returns raw 16-bit PCM at 24kHz
      const binaryString = window.atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const samples = new Int16Array(bytes.buffer);
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const buffer = audioCtx.createBuffer(1, samples.length, 24000);
      const channelData = buffer.getChannelData(0);

      for (let i = 0; i < samples.length; i++) {
        channelData[i] = samples[i] / 32768.0;
      }

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
    } catch (audioError) {
      console.error("PCM Playback error:", audioError);
    }
  };

  const speakText = async (text: string, queue = false) => {
    // Stop any existing browser speech synthesis if not queuing
    if (!queue && synthRef.current) synthRef.current.cancel();

    try {
      // Try high-quality Gemini TTS
      const base64Audio = await geminiService.generateSpeech(text);
      if (base64Audio) {
        playPCM(base64Audio);
        return;
      }
    } catch (e) {
      console.error("Gemini TTS high-quality failing, falling back...", e);
    }

    // Standard Browser Fallback
    browserFallbackSpeak(text);
  };

  const browserFallbackSpeak = (text: string) => {
    if (!synthRef.current) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    synthRef.current.speak(utterance);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isLiveMode || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    let animationFrame: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = 40;
      const maxExtraRadius = 40;
      
      // Draw dynamic pulse circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + (volume * maxExtraRadius), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)'; // Emerald-500 with opacity
      ctx.fill();

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + (volume * maxExtraRadius * 0.5), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      animationFrame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrame);
  }, [isLiveMode, volume]);

  const handleSend = async (overrideText?: string, wasVoice = false) => {
    const textToSend = overrideText || input.trim();
    if (!textToSend || isLoading) return;

    setInput('');
    setMaintenanceSuggestion(null);
    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setIsLoading(true);

    try {
      const handleToolCall = (name: string, args: any) => {
        if (name === 'viewMaintenanceRequest' && args.requestId) {
          navigate(`/maintenance?highlight=${args.requestId}`);
        }
      };

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
      const [intent, stream] = await Promise.all([
        geminiService.detectMaintenanceIntent(textToSend),
        geminiService.chatWithOracle(textToSend, history, selectedLanguage, handleToolCall)
      ]);

      let fullResponse = "";
      let lastSpokenIndex = 0;
      
      // Update with an empty AI message to start streaming into
      setMessages(prev => [...prev, { role: 'ai', text: "" }]);

      for await (const chunk of (stream as AsyncGenerator<string>)) {
        fullResponse += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: 'ai', text: fullResponse };
          return newMessages;
        });

        // Promptly speak sentences for better conversational feel
        if (mode === 'voice') {
          const sentences = fullResponse.split(/[.!?]\s+/);
          if (sentences.length > lastSpokenIndex + 1) {
            const sentenceToSpeak = sentences[lastSpokenIndex];
            speakText(sentenceToSpeak, true); // True to not cancel previous if we implemented queue, 
                                             // but for now it will just start speaking.
            lastSpokenIndex++;
          }
        }
      }

      const finalResponse = fullResponse || "I'm sorry, I couldn't find an answer to that.";
      
      if (mode === 'voice' && lastSpokenIndex === 0) {
        // If it was a very short response without sentences, speak it all now
        speakText(finalResponse);
      } else if (mode === 'voice') {
        // Speak the remaining part
        const sentences = fullResponse.split(/[.!?]\s+/);
        if (sentences[sentences.length - 1].trim()) {
           speakText(sentences[sentences.length - 1]);
        }
      }

      if (intent.isMaintenance) {
        setMaintenanceSuggestion(intent);
      }
    } catch (error: any) {
      console.error("Oracle error:", error);
      let errorMsg = "I'm having a bit of trouble connecting right now. Please try again or contact the Board directly.";
      
      try {
        const errStr = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
        if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("429")) {
          errorMsg = "The Oracle has reached its daily quota limit. Please try again tomorrow or contact your administrator.";
        }
      } catch (e) {}

      setMessages(prev => [...prev, { role: 'ai', text: errorMsg }]);
      if (mode === 'voice') speakText(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = (newMode: 'chat' | 'voice') => {
    if (newMode === mode) return;
    
    // Cleanup if leaving voice/live
    if (mode === 'voice') {
      stopLiveMode();
    }
    
    setMode(newMode);
    
    if (newMode === 'voice') {
      // Small delay to ensure UI transition
      setTimeout(() => {
        startLiveMode();
      }, 300);
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
        handleSend(refined, true);
      } catch (e) {
        handleSend(transcript, true);
      } finally {
        setIsLoading(false);
      }
    };

    recognition.start();
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 45 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            aria-label="Open Co-op Oracle AI Chatbot"
            className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center z-[100] cursor-pointer"
            id="coop-oracle-fab"
          >
            <i className="fa-solid fa-sparkles text-xl"></i>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-[400px] max-w-[calc(100vw-48px)] h-[600px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/5 flex flex-col z-[110] overflow-hidden"
            style={{ transformOrigin: 'bottom right' }}
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
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                >
                  <i className="fa-solid fa-xmark text-slate-400"></i>
                </button>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-800/50 border-b border-white/5 flex items-center justify-between">
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => toggleMode('chat')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'chat' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  Chat
                </button>
                <button
                  onClick={() => toggleMode('voice')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'voice' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  Live
                </button>
              </div>
              
              <select 
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest outline-none focus:ring-1 focus:ring-emerald-500 text-slate-300"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            <div 
              className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium leading-relaxed relative group ${
                    msg.role === 'user' 
                      ? 'bg-emerald-600 text-white rounded-tr-none' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-white/5 shadow-sm'
                  }`}>
                    {msg.text}
                    {msg.role === 'ai' && (
                      <button 
                        onClick={() => speakText(msg.text)}
                        className="absolute -right-10 top-2 p-2 text-slate-400 hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Read Aloud"
                      >
                        <i className="fa-solid fa-volume-high text-xs"></i>
                      </button>
                    )}
                  </div>

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

              {!isLoading && messages.length <= 1 && mode === 'chat' && (
                <div className="flex flex-col gap-4 mt-4 pt-4 border-t border-slate-50 dark:border-white/5">
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s, i) => (
                      <button 
                        key={i}
                        onClick={() => handleSend(s)}
                        className="flex-1 min-w-[45%] text-[9px] font-black uppercase tracking-widest px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 rounded-xl hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
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
              {mode === 'voice' ? (
                <div className="flex flex-col items-center justify-center py-2 space-y-4 relative min-h-[160px]">
                  <canvas 
                    ref={canvasRef} 
                    width={200} 
                    height={200} 
                    className="absolute pointer-events-none"
                  />
                  <motion.button
                    animate={isLiveMode ? { scale: 1 + (volume * 0.2) } : { scale: 1 }}
                    onClick={startLiveMode}
                    className={`w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all border-4 shadow-xl z-10 ${
                      isLiveMode 
                        ? 'bg-emerald-600 border-emerald-500 text-white' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-400'
                    }`}
                  >
                    <i className={`fa-solid ${isLiveMode ? 'fa-waveform' : 'fa-microphone'} text-2xl mb-1`}></i>
                  </motion.button>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 z-10">
                    {isLiveMode ? "System Listening" : "Tap to Speak"}
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={isListening ? "Listening..." : "Ask a question..."}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white placeholder:text-[10px] placeholder:uppercase placeholder:font-black placeholder:tracking-widest"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={startVoiceInput}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                        isListening 
                          ? 'bg-rose-500 text-white animate-pulse' 
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-emerald-500'
                      }`}
                      title="Voice Input"
                    >
                      <i className="fa-solid fa-microphone text-xs"></i>
                    </button>
                    <button
                      onClick={() => handleSend()}
                      disabled={isLoading || !input.trim()}
                      className="w-12 h-12 bg-slate-900 dark:bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-black dark:hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <i className="fa-solid fa-paper-plane text-xs"></i>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CoopOracle;
