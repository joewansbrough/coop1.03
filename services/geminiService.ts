// All Gemini calls go through the backend API for standard requests
// Multimodal Live API uses direct client-side SDK (@google/genai) with standard API Key handling

import { GoogleGenAI, Type, Modality } from "@google/genai";
import { 
  MOCK_UNITS, 
  MOCK_TENANTS, 
  MOCK_MAINTENANCE, 
  MOCK_DOCUMENTS, 
  MOCK_EVENTS, 
  MOCK_ANNOUNCEMENTS, 
  MOCK_COMMITTEES, 
  MOCK_NOTIFICATIONS, 
  MOCK_USER 
} from '../utils/demoData';
import { createMaintenanceTriage } from '../utils/maintenanceAI.js';
import { DEMO_TUTORIAL_ROLE_VIEW_KEY } from '../utils/demoTutorial.js';

const isDemoMode = () => typeof window !== 'undefined' && localStorage.getItem('demo_mode') === 'true';

const getDemoOracleUser = () => {
  if (!isDemoMode() || typeof window === 'undefined') return undefined;
  const isResidentView = localStorage.getItem(DEMO_TUTORIAL_ROLE_VIEW_KEY) === 'true';
  return {
    id: MOCK_USER.id,
    tenantId: MOCK_USER.tenantId,
    email: MOCK_USER.email,
    role: isResidentView ? 'MEMBER' : MOCK_USER.role,
    isAdmin: !isResidentView && !!MOCK_USER.isAdmin,
  };
};

// Define tools for Gemini to interact with the "Database"
const tools = [
  {
    functionDeclarations: [
      {
        name: "getUnits",
        description: "Fetch all housing units or filter by status, floor, or type.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, description: "Filter by 'Occupied', 'Vacant', 'Maintenance'." },
            floor: { type: Type.NUMBER },
            unitNumber: { type: Type.STRING }
          }
        }
      },
      {
        name: "getTenants",
        description: "Fetch all co-op members (tenants) or search by name/status.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Search by first or last name." },
            status: { type: Type.STRING, description: "Filter by 'Current', 'Past', 'Waitlist'." },
            email: { type: Type.STRING }
          }
        }
      },
      {
        name: "getMaintenanceRequests",
        description: "Fetch all maintenance requests, filtering by unit, status, or urgency.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            unitNumber: { type: Type.STRING },
            status: { type: Type.STRING },
            urgency: { type: Type.STRING }
          }
        }
      },
      {
        name: "getCommittees",
        description: "Fetch committee details, chairs, and members.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Filter by committee name." }
          }
        }
      },
      {
        name: "getDocuments",
        description: "Search bylaws, policies, and minutes.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING }
          }
        }
      },
      {
        name: "getEvents",
        description: "Fetch meetings and social events.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING }
          }
        }
      },
      {
        name: "viewMaintenanceRequest",
        description: "Navigate the user's interface to a specific maintenance request to show details.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            requestId: { type: Type.STRING, description: "The ID of the maintenance request (e.g., 'm1')." }
          },
          required: ["requestId"]
        }
      }
    ]
  }
];

// Tool implementations using Mock Data
const functions = {
  getUnits: ({ status, floor, unitNumber }: any) => {
    let list = [...MOCK_UNITS];
    if (status) list = list.filter(u => u.status.toLowerCase() === status.toLowerCase());
    if (floor) list = list.filter(u => u.floor === floor);
    if (unitNumber) list = list.filter(u => u.number === unitNumber);
    return list;
  },
  getTenants: ({ name, status, email }: any) => {
    let list = [...MOCK_TENANTS];
    if (status) list = list.filter(t => t.status.toLowerCase() === status.toLowerCase());
    if (email) list = list.filter(t => t.email.toLowerCase() === email.toLowerCase());
    if (name) {
      const term = name.toLowerCase();
      list = list.filter(t => t.firstName.toLowerCase().includes(term) || t.lastName.toLowerCase().includes(term));
    }
    return list;
  },
  getMaintenanceRequests: ({ unitNumber, status, urgency }: any) => {
    let list = [...MOCK_MAINTENANCE];
    if (unitNumber) {
      const unit = MOCK_UNITS.find(u => u.number === unitNumber);
      if (unit) list = list.filter(r => r.unitId === unit.id);
    }
    if (status) list = list.filter(r => r.status.toLowerCase().includes(status.toLowerCase()));
    if (urgency) list = list.filter(r => r.priority.toLowerCase() === urgency.toLowerCase());
    return list;
  },
  getCommittees: ({ name }: any) => {
    if (name) {
      const term = name.toLowerCase();
      return MOCK_COMMITTEES.filter(c => c.name.toLowerCase().includes(term));
    }
    return MOCK_COMMITTEES;
  },
  getDocuments: ({ query }: any) => {
    if (query) {
      const term = query.toLowerCase();
      return MOCK_DOCUMENTS.filter(d => d.title.toLowerCase().includes(term) || d.category.toLowerCase().includes(term));
    }
    return MOCK_DOCUMENTS;
  },
  getEvents: ({ category }: any) => {
    if (category) return MOCK_EVENTS.filter(e => e.category.toLowerCase() === category.toLowerCase());
    return MOCK_EVENTS;
  },
  viewMaintenanceRequest: ({ requestId }: any) => {
    return { success: true, message: `Showing maintenance request ${requestId}` };
  }
};

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

  async describeMaintenanceImage(file: File, description?: string) {
    const formData = new FormData();
    formData.append('image', file);
    if (description?.trim()) formData.append('description', description.trim());
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
      body: JSON.stringify({ question, language, pageContext, demoUser: getDemoOracleUser() }),
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

  async synthesizeDemoTourSpeech(text: string) {
    const res = await fetch('/api/ai/demo-tour-tts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to generate guided tour narration');
    }
    return res.blob();
  },

  /**
   * Multimodal Live API session for real-time conversation
   */
  async connectLive(callbacks: {
    onOpen: () => void;
    onClose: () => void;
    onAudio: (base64PCM: string) => void;
    onText: (text: string) => void;
    onError: (err: any) => void;
    onInterrupted: () => void;
    onToolCall?: (name: string, args: any) => void;
  }, systemInstruction: string) {
    const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || '';
    const genAI = new GoogleGenAI({ apiKey });
    
    console.log("Initiating Live connection with model: gemini-3.1-flash-live-preview");
    const session = await genAI.live.connect({
      model: "gemini-3.1-flash-live-preview",
      callbacks: {
        onopen: () => {
          console.log("WebSocket Connection Opened Successfully");
          callbacks.onOpen();
        },
        onclose: (event: any) => {
          console.log(`WebSocket Connection Closed. Code: ${event.code}, Reason: ${event.reason}`);
          callbacks.onClose();
        },
        onerror: (err: any) => {
          console.error("WebSocket Connection Error:", err);
          callbacks.onError(err);
        },
        onmessage: async (message: any) => {
          console.log("DEBUG: Received message from Gemini:", Object.keys(message));
          
          // Handle Tool Calls
          if (message.toolCall) {
            console.log("DEBUG: Received Tool Call:", message.toolCall);
            const toolResponses: any[] = [];
            for (const call of message.toolCall.functionCalls) {
              const fnName = call.name as keyof typeof functions;
              if (functions[fnName]) {
                try {
                  const result = await (functions[fnName] as any)(call.args);
                  if (callbacks.onToolCall) callbacks.onToolCall(call.name, call.args);
                  toolResponses.push({
                    name: call.name,
                    id: call.id,
                    response: { result }
                  });
                } catch (err) {
                  toolResponses.push({
                    name: call.name,
                    id: call.id,
                    response: { error: String(err) }
                  });
                }
              }
            }
            if (toolResponses.length > 0) {
              const liveSession = await session;
              (liveSession as any).sendToolResponse({ functionResponses: toolResponses });
            }
          }

          if (message.serverContent?.modelTurn?.parts) {
            for (const part of message.serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                callbacks.onAudio(part.inlineData.data);
              }
              if (part.text) {
                callbacks.onText(part.text);
              }
            }
          }
          
          if (message.serverContent?.interrupted) {
            callbacks.onInterrupted();
          }
        }
      },
      config: {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        tools: tools as any,
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
        }
      }
    });

    return session;
  }
};
