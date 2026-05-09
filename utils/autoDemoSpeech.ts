import { geminiService } from '../services/geminiService';
import { AUTO_DEMO_STOPS, type AutoDemoStop } from './autoDemo';

export type AutoDemoSpeechStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AutoDemoSpeechSnapshot {
  status: AutoDemoSpeechStatus;
  total: number;
  completed: number;
  failed: number;
  currentTitle: string;
  error?: string;
}

type Listener = (snapshot: AutoDemoSpeechSnapshot) => void;

const CONCURRENT_PRELOADS = 4;
const TTS_CACHE_STORAGE_KEY = 'auto_demo_tts_cache';
const listeners = new Set<Listener>();

// Initialize from LocalStorage if available
const loadPersistedCache = (): Map<string, string> => {
  if (typeof window === 'undefined') return new Map();
  try {
    const saved = localStorage.getItem(TTS_CACHE_STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      return new Map(Object.entries(data));
    }
  } catch (e) {
    console.warn('[TTS Cache] Failed to load persisted cache:', e);
  }
  return new Map();
};

const audioUrlByStopId = loadPersistedCache();

const savePersistedCache = () => {
  if (typeof window === 'undefined') return;
  try {
    const data = Object.fromEntries(audioUrlByStopId.entries());
    localStorage.setItem(TTS_CACHE_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[TTS Cache] Failed to persist cache:', e);
  }
};

let preloadPromise: Promise<AutoDemoSpeechSnapshot> | null = null;
let snapshot: AutoDemoSpeechSnapshot = {
  status: audioUrlByStopId.size >= AUTO_DEMO_STOPS.length ? 'ready' : 'idle',
  total: AUTO_DEMO_STOPS.length,
  completed: audioUrlByStopId.size,
  failed: 0,
  currentTitle: audioUrlByStopId.size >= AUTO_DEMO_STOPS.length ? 'Narration ready' : '',
};

export const getAutoDemoSpeechText = (stop: AutoDemoStop) =>
  `${stop.body}\n\n${stop.keyCapability}`;

const publish = (next: Partial<AutoDemoSpeechSnapshot>) => {
  snapshot = { ...snapshot, ...next };
  listeners.forEach(listener => listener(snapshot));
};

export const getAutoDemoSpeechSnapshot = () => snapshot;

export const subscribeAutoDemoSpeech = (listener: Listener) => {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
};

export const getAutoDemoSpeechUrl = (stopId: string) => audioUrlByStopId.get(stopId) || null;

export const setAutoDemoSpeechUrlForTest = (stopId: string, url: string) => {
  audioUrlByStopId.set(stopId, url);
  savePersistedCache();
};

const loadStopSpeech = async (stop: AutoDemoStop, options: { onDone: () => void; onError: () => void }, retries = 2) => {
  if (audioUrlByStopId.has(stop.id)) {
    options.onDone();
    return;
  }

  for (let i = 0; i <= retries; i++) {
    try {
      // Add a small jitter to spread out network requests
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
      
      const res = await fetch('/api/ai/demo-tour-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: getAutoDemoSpeechText(stop) }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // We use the direct URL if redirected (CDN), otherwise create a blob
      const url = res.redirected ? res.url : URL.createObjectURL(await res.blob());
      audioUrlByStopId.set(stop.id, url);
      savePersistedCache();
      options.onDone();
      return;
    } catch (err) {
      if (i === retries) {
        console.error(`Failed to preload TTS for stop ${stop.id} after ${retries + 1} attempts:`, err);
        options.onError();
      } else {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i + 1) * 1000));
      }
    }
  }
};

export const preloadAutoDemoSpeech = () => {
  if (preloadPromise) return preloadPromise;

  const stops = AUTO_DEMO_STOPS;
  // Initialize counts based on what's already in cache
  let completed = 0;
  stops.forEach(s => { if (audioUrlByStopId.has(s.id)) completed++; });
  
  if (completed === stops.length) {
    publish({ status: 'ready', completed, failed: 0, currentTitle: 'Narration ready' });
    return Promise.resolve(snapshot);
  }

  let failed = 0;

  publish({
    status: 'loading',
    total: stops.length,
    completed,
    failed: 0,
    currentTitle: 'Preparing narration...',
    error: undefined,
  });

  preloadPromise = new Promise<AutoDemoSpeechSnapshot>((resolve) => {
    let nextIndex = 0;
    let active = 0;

    const pump = () => {
      if (nextIndex >= stops.length && active === 0) {
        const status = failed === stops.length ? 'error' : 'ready';
        publish({
          status,
          completed,
          failed,
          currentTitle: status === 'ready' ? 'Narration ready' : 'Narration unavailable',
          error: status === 'error' ? 'Narration could not be prepared.' : undefined,
        });
        resolve(snapshot);
        return;
      }

      while (active < CONCURRENT_PRELOADS && nextIndex < stops.length) {
        const stop = stops[nextIndex];
        nextIndex += 1;
        
        if (audioUrlByStopId.has(stop.id)) {
          pump(); // Skip already cached
          continue;
        }

        active += 1;
        publish({ currentTitle: stop.title, completed, failed });

        loadStopSpeech(stop, {
          onDone: () => {
            completed += 1;
          },
          onError: () => {
            completed += 1;
            failed += 1;
          }
        }).finally(() => {
          active -= 1;
          publish({ completed, failed });
          pump();
        });
      }
    };

    pump();
  });

  return preloadPromise;
};

export const resetAutoDemoSpeechCache = () => {
  audioUrlByStopId.forEach(url => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  });
  audioUrlByStopId.clear();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TTS_CACHE_STORAGE_KEY);
  }
  preloadPromise = null;
  publish({
    status: 'idle',
    total: AUTO_DEMO_STOPS.length,
    completed: 0,
    failed: 0,
    currentTitle: '',
    error: undefined,
  });
};
