// All Gemini calls go through the backend API to keep the API key server-side

import { createMaintenanceTriage } from '../utils/maintenanceAI.js';

const isDemoMode = () => typeof window !== 'undefined' && localStorage.getItem('demo_mode') === 'true';

export const geminiService = {
  async triageMaintenanceRequest(description: string, visualDescription?: string) {
    const res = await fetch(isDemoMode() ? '/api/ai/triage-demo' : '/api/ai/triage', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, visualDescription }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to triage maintenance request with Gemini');
    return createMaintenanceTriage(data);
  },

  async describeMaintenanceImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(isDemoMode() ? '/api/ai/maintenance-image-description-demo' : '/api/ai/maintenance-image-description', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to describe maintenance image');
    }
    return data;
  },

  async askPolicyQuestion(question: string, context: string) {
    const res = await fetch('/api/ai/policy', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context }),
    });
    
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'Failed to get answer from AI');
    }
    return data.answer;
  },

  async askOracle(question: string, language: string, pageContext?: string) {
    const res = await fetch(isDemoMode() ? '/api/oracle/query-demo' : '/api/oracle/query', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, language, pageContext }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to query Oracle with Gemini');
    return data;
  },

  async analyzeMeetingNotes(rawNotes: string, meetingId?: string, meetingType?: string) {
    if (isDemoMode()) {
      const res = await fetch('/api/ai/meeting-analysis-demo', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawNotes, meetingId, meetingType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze meeting notes with Gemini');
      return data;
    }

    const res = await fetch('/api/ai/meeting-analysis', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawNotes, meetingId, meetingType }),
    });
    const data = await res.json();
    if (res.status === 401) throw new Error('Please sign in again before using AI meeting analysis.');
    if (res.status === 403) throw new Error('AI meeting analysis is available to admins only.');
    if (!res.ok) throw new Error(data.error || 'Failed to analyze meeting notes');
    return data;
  },

  async summarizeAndTag(content: string) {
    const res = await fetch(isDemoMode() ? '/api/ai/summarize-demo' : '/api/ai/summarize', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to summarize document with Gemini');
    return data;
  },
};
