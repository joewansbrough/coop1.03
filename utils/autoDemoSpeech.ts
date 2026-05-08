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
const listeners = new Set<Listener>();
const audioUrlByStopId = new Map<string, string>();
let preloadPromise: Promise<AutoDemoSpeechSnapshot> | null = null;
let snapshot: AutoDemoSpeechSnapshot = {
  status: 'idle',
  total: AUTO_DEMO_STOPS.length,
  completed: 0,
  failed: 0,
  currentTitle: '',
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
      
      const blob = await geminiService.synthesizeDemoTourSpeech(getAutoDemoSpeechText(stop));
      audioUrlByStopId.set(stop.id, URL.createObjectURL(blob));
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
  let completed = 0;
  let failed = 0;

  publish({
    status: 'loading',
    total: stops.length,
    completed: 0,
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
        active += 1;

        // Update current title to show progress
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
          // After each task, update snapshot with the latest local counts
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
  audioUrlByStopId.forEach(url => URL.revokeObjectURL(url));
  audioUrlByStopId.clear();
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
