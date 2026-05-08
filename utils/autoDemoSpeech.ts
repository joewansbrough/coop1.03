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

const CONCURRENT_PRELOADS = 3;
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

const loadStopSpeech = async (stop: AutoDemoStop) => {
  if (audioUrlByStopId.has(stop.id)) {
    publish({ completed: snapshot.completed + 1, currentTitle: stop.title });
    return;
  }

  publish({ currentTitle: stop.title });
  const blob = await geminiService.synthesizeDemoTourSpeech(getAutoDemoSpeechText(stop));
  audioUrlByStopId.set(stop.id, URL.createObjectURL(blob));
  publish({ completed: snapshot.completed + 1 });
};

export const preloadAutoDemoSpeech = () => {
  if (preloadPromise) return preloadPromise;

  const stops = AUTO_DEMO_STOPS;
  publish({
    status: 'loading',
    total: stops.length,
    completed: 0,
    failed: 0,
    currentTitle: 'Welcome to your guided tour',
    error: undefined,
  });

  preloadPromise = new Promise<AutoDemoSpeechSnapshot>((resolve) => {
    let nextIndex = 0;
    let active = 0;

    const pump = () => {
      if (nextIndex >= stops.length && active === 0) {
        const status = snapshot.failed === snapshot.total ? 'error' : 'ready';
        publish({
          status,
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
        loadStopSpeech(stop)
          .catch(() => {
            publish({
              completed: snapshot.completed + 1,
              failed: snapshot.failed + 1,
              currentTitle: stop.title,
            });
          })
          .finally(() => {
            active -= 1;
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
