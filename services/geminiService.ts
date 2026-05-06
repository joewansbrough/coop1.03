// All Gemini calls go through the backend API to keep the API key server-side

import { createMaintenanceTriage } from '../utils/maintenanceAI.js';
import { createDemoMeetingAnalysis } from '../utils/meetingAnalysis.js';
import { createDemoOracleResponse, createOracleFallbackResponse } from '../utils/oracle.js';

const isDemoMode = () => typeof window !== 'undefined' && localStorage.getItem('demo_mode') === 'true';

export const geminiService = {
  async triageMaintenanceRequest(description: string, visualDescription?: string) {
    try {
      const res = await fetch('/api/ai/triage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, visualDescription }),
      });
      if (!res.ok) return createMaintenanceTriage({});
      return await res.json();
    } catch {
      return createMaintenanceTriage({});
    }
  },

  async describeMaintenanceImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch('/api/ai/maintenance-image-description', {
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
    if (isDemoMode()) return createDemoOracleResponse(question, language);

    try {
      const res = await fetch('/api/oracle/query', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, language, pageContext }),
      });
      const data = await res.json();
      if (res.status === 401 && isDemoMode()) return createDemoOracleResponse(question, language);
      if (!res.ok && data.answer) return data;
      if (!res.ok) throw new Error(data.error || 'Failed to query Oracle');
      return data;
    } catch {
      return createOracleFallbackResponse(question, language);
    }
  },

  async analyzeMeetingNotes(rawNotes: string, meetingId?: string) {
    if (isDemoMode()) return createDemoMeetingAnalysis(rawNotes, meetingId);

    const res = await fetch('/api/ai/meeting-analysis', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawNotes, meetingId }),
    });
    const data = await res.json();
    if (res.status === 401 && isDemoMode()) return createDemoMeetingAnalysis(rawNotes, meetingId);
    if (res.status === 401) throw new Error('Please sign in again before using AI meeting analysis.');
    if (res.status === 403) throw new Error('AI meeting analysis is available to admins only.');
    if (!res.ok) throw new Error(data.error || 'Failed to analyze meeting notes');
    return data;
  },

  async summarizeAndTag(content: string) {
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) return { summary: '', tags: [] };
      return await res.json();
    } catch {
      return { summary: '', tags: [] };
    }
  },
};
