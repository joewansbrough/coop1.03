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

  async askPolicyQuestion(question: string, context: string): Promise<string> {
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

  /**
   * RAG-powered policy search.
   * Embeds the question, retrieves top-K chunks from Supabase pgvector,
   * then calls Gemini with the retrieved context.
   */
  async askPolicyRAG(
    question: string,
    coopId: string = 'default',
    topK: number = 5
  ): Promise<{ answer: string; sources: { documentId: string; title: string; excerpt: string }[] }> {
    try {
      const res = await fetch('/api/policy/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, coopId, topK }),
      });
      if (!res.ok) {
        return {
          answer: 'Unable to search policy documents at this time. Please contact the board.',
          sources: [],
        };
      }
      return await res.json();
    } catch {
      return {
        answer: 'Unable to search policy documents at this time. Please contact the board.',
        sources: [],
      };
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