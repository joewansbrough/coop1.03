export const DEFAULT_AUDIO_VOICE = 'Kore';
export const AUDIO_PREFERENCE_KEY = 'audio';
export const AUDIO_PREFERENCE_STORAGE_KEY = 'audio_preference';

export interface AudioVoice {
  name: string;
  style: string;
}

export interface AudioPreference {
  voiceName: string;
}

export const AUDIO_VOICES: AudioVoice[] = [
  { name: 'Zephyr', style: 'Bright' },
  { name: 'Puck', style: 'Upbeat' },
  { name: 'Charon', style: 'Informative' },
  { name: 'Kore', style: 'Firm' },
  { name: 'Fenrir', style: 'Excitable' },
  { name: 'Leda', style: 'Youthful' },
  { name: 'Orus', style: 'Firm' },
  { name: 'Aoede', style: 'Breezy' },
  { name: 'Callirrhoe', style: 'Easy-going' },
  { name: 'Autonoe', style: 'Bright' },
  { name: 'Enceladus', style: 'Breathy' },
  { name: 'Iapetus', style: 'Clear' },
  { name: 'Umbriel', style: 'Easy-going' },
  { name: 'Algieba', style: 'Smooth' },
  { name: 'Despina', style: 'Smooth' },
  { name: 'Erinome', style: 'Clear' },
  { name: 'Algenib', style: 'Gravelly' },
  { name: 'Rasalgethi', style: 'Informative' },
  { name: 'Laomedeia', style: 'Upbeat' },
  { name: 'Achernar', style: 'Soft' },
  { name: 'Alnilam', style: 'Firm' },
  { name: 'Schedar', style: 'Even' },
  { name: 'Gacrux', style: 'Mature' },
  { name: 'Pulcherrima', style: 'Forward' },
  { name: 'Achird', style: 'Friendly' },
  { name: 'Zubenelgenubi', style: 'Casual' },
  { name: 'Vindemiatrix', style: 'Gentle' },
  { name: 'Sadachbia', style: 'Lively' },
  { name: 'Sadaltager', style: 'Knowledgeable' },
  { name: 'Sulafat', style: 'Warm' },
];

const voiceNameByLowercase = new Map(AUDIO_VOICES.map(voice => [voice.name.toLowerCase(), voice.name]));

export const normalizeAudioVoiceName = (voiceName: unknown): string => {
  if (typeof voiceName !== 'string') return DEFAULT_AUDIO_VOICE;
  return voiceNameByLowercase.get(voiceName.trim().toLowerCase()) || DEFAULT_AUDIO_VOICE;
};

export const normalizeAudioPreference = (preference: unknown): AudioPreference => {
  const voiceName = preference && typeof preference === 'object' && 'voiceName' in preference
    ? (preference as { voiceName?: unknown }).voiceName
    : undefined;
  return { voiceName: normalizeAudioVoiceName(voiceName) };
};

export const getAudioVoiceLabel = (voiceName: string) => {
  const voice = AUDIO_VOICES.find(item => item.name === normalizeAudioVoiceName(voiceName));
  return voice ? `${voice.name} - ${voice.style}` : `${DEFAULT_AUDIO_VOICE} - Firm`;
};

export const getAudioPreferenceFromStorage = (): AudioPreference => {
  if (typeof localStorage === 'undefined') return { voiceName: DEFAULT_AUDIO_VOICE };
  try {
    return normalizeAudioPreference(JSON.parse(localStorage.getItem(AUDIO_PREFERENCE_STORAGE_KEY) || 'null'));
  } catch {
    return { voiceName: DEFAULT_AUDIO_VOICE };
  }
};

export const saveAudioPreferenceToStorage = (preference: AudioPreference) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(AUDIO_PREFERENCE_STORAGE_KEY, JSON.stringify(normalizeAudioPreference(preference)));
};
