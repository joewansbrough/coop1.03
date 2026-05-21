import { useCallback, useEffect, useState } from 'react';
import {
  getAudioPreferenceFromStorage,
  normalizeAudioPreference,
  saveAudioPreferenceToStorage,
  type AudioPreference,
} from '../utils/audioPreferences';
import { isDemoMode } from './useCoopData';

const fetchAudioPreference = async (): Promise<AudioPreference> => {
  if (isDemoMode()) return getAudioPreferenceFromStorage();

  const response = await fetch('/api/user/preferences/audio', { credentials: 'include' });
  if (!response.ok) throw new Error(await response.text());
  return normalizeAudioPreference(await response.json());
};

const saveAudioPreference = async (preference: AudioPreference): Promise<AudioPreference> => {
  const normalized = normalizeAudioPreference(preference);
  saveAudioPreferenceToStorage(normalized);

  if (isDemoMode()) return normalized;

  const response = await fetch('/api/user/preferences/audio', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalized),
  });
  if (!response.ok) throw new Error(await response.text());
  return normalizeAudioPreference(await response.json());
};

export const useAudioPreferences = () => {
  const [preference, setPreference] = useState<AudioPreference>(() => getAudioPreferenceFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetchAudioPreference()
      .then(next => {
        if (!active) return;
        setPreference(next);
        saveAudioPreferenceToStorage(next);
      })
      .catch(() => {
        if (active) setPreference(getAudioPreferenceFromStorage());
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const savePreference = useCallback(async (next: AudioPreference) => {
    const previous = preference;
    const normalized = normalizeAudioPreference(next);
    setPreference(normalized);
    setIsSaving(true);
    try {
      const saved = await saveAudioPreference(normalized);
      setPreference(saved);
      return saved;
    } catch (error) {
      setPreference(previous);
      saveAudioPreferenceToStorage(previous);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [preference]);

  return {
    preference,
    isLoading,
    isSaving,
    savePreference,
  };
};
