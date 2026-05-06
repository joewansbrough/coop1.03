// All Gemini calls go through the backend API to keep the API key server-side

import { createMaintenanceTriage } from '../utils/maintenanceAI.js';
import { createOracleFallbackResponse } from '../utils/oracle.js';

export const geminiService = {
  async triageMaintenanceRequest(description: string, visualDescription?: string) {
    try {
      const res = await fetch('/api/ai/triage', {
        method: 'POST',
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
    try {
      const res = await fetch('/api/oracle/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, language, pageContext }),
      });
      const data = await res.json();
      if (!res.ok && data.answer) return data;
      if (!res.ok) throw new Error(data.error || 'Failed to query Oracle');
      return data;
    } catch {
      return createOracleFallbackResponse(question, language);
    }
  },

  async analyzeMeetingNotes(rawNotes: string, meetingId?: string) {
    const res = await fetch('/api/ai/meeting-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawNotes, meetingId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to analyze meeting notes');
    return data;
  },

  async summarizeAndTag(content: string) {
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
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
