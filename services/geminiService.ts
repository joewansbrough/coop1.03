// All Gemini calls go through the backend API to keep the API key server-side

export const geminiService = {
  async triageMaintenanceRequest(description: string) {
    try {
      const res = await fetch('/api/ai/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) return { urgency: 'Medium', category: 'Other' };
      return await res.json();
    } catch {
      return { urgency: 'Medium', category: 'Other' };
    }
  },

  async askPolicyQuestion(question: string, context: string) {
    try {
      const res = await fetch('/api/ai/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context }),
      });
      if (!res.ok) return 'Unable to answer at this time. Please contact the board.';
      const data = await res.json();
      return data.answer;
    } catch {
      return 'Unable to answer at this time. Please contact the board.';
    }
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
