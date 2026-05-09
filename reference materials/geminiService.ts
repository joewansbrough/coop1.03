
import { GoogleGenAI, Type, Modality, ThinkingLevel } from "@google/genai";
import { MOCK_TENANTS, MOCK_UNITS, MOCK_REQUESTS, MOCK_COMMITTEES, MOCK_EVENTS, MOCK_DOCS, MOCK_ANNOUNCEMENTS, MOCK_TRANSACTIONS, MOCK_PARTICIPATION, MOCK_SCHEDULED, MOCK_QUOTES, MOCK_NOTIFICATIONS, MOCK_MESSAGES } from "../constants";

// Always use GEMINI_API_KEY for the Gemini API in this environment
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
        name: "getRepairQuotes",
        description: "Fetch vendor quotes for a specific maintenance request.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            requestId: { type: Type.STRING, description: "The ID of the maintenance request (e.g., 'r1')." }
          },
          required: ["requestId"]
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
        name: "getFinancialData",
        description: "Fetch transactions and financial summaries (balance, shares).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            memberName: { type: Type.STRING },
            unitNumber: { type: Type.STRING }
          }
        }
      },
      {
        name: "getParticipationRecords",
        description: "Fetch community participation/volunteer hours.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            memberName: { type: Type.STRING }
          }
        }
      },
      {
        name: "getScheduledMaintenance",
        description: "Fetch recurring maintenance tasks (filters, smoke detectors).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            unitNumber: { type: Type.STRING }
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
        name: "getAnnouncements",
        description: "Fetch latest board/management announcements.",
        parameters: {
          type: Type.OBJECT
        }
      },
      {
        name: "getNotifications",
        description: "Fetch system notifications and alerts.",
        parameters: {
          type: Type.OBJECT
        }
      },
      {
        name: "getMessages",
        description: "Fetch recorded messages between members and administration.",
        parameters: {
          type: Type.OBJECT,
          properties: {
             memberName: { type: Type.STRING }
          }
        }
      },
      {
        name: "viewMaintenanceRequest",
        description: "Navigate the user's interface to a specific maintenance request to show details.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            requestId: { type: Type.STRING, description: "The ID of the maintenance request (e.g., 'r1')." }
          },
          required: ["requestId"]
        }
      }
    ]
  }
];

// Tool implementations
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
    let list = [...MOCK_REQUESTS];
    if (unitNumber) {
      const unit = MOCK_UNITS.find(u => u.number === unitNumber);
      if (unit) list = list.filter(r => r.unitId === unit.id);
    }
    if (status) list = list.filter(r => r.status.toLowerCase().includes(status.toLowerCase()));
    if (urgency) list = list.filter(r => r.urgency.toLowerCase() === urgency.toLowerCase());
    return list;
  },
  getRepairQuotes: ({ requestId }: any) => {
    return MOCK_QUOTES.filter(q => q.requestId === requestId);
  },
  getCommittees: ({ name }: any) => {
    if (name) {
      const term = name.toLowerCase();
      return MOCK_COMMITTEES.filter(c => c.name.toLowerCase().includes(term));
    }
    return MOCK_COMMITTEES;
  },
  getFinancialData: ({ memberName, unitNumber }: any) => {
    let tenant = null;
    if (memberName) {
      const term = memberName.toLowerCase();
      tenant = MOCK_TENANTS.find(t => t.firstName.toLowerCase().includes(term) || t.lastName.toLowerCase().includes(term));
    } else if (unitNumber) {
      const unit = MOCK_UNITS.find(u => u.number === unitNumber);
      if (unit) tenant = MOCK_TENANTS.find(t => t.id === unit.currentTenantId);
    }
    if (!tenant) return { error: "Member/Unit not found for financial query" };
    const transactions = MOCK_TRANSACTIONS.filter(tr => tr.tenantId === tenant!.id);
    return {
      member: `${tenant.firstName} ${tenant.lastName}`,
      balance: tenant.balance,
      shareCapital: tenant.shareCapital,
      transactions
    };
  },
  getParticipationRecords: ({ memberName }: any) => {
    const term = memberName.toLowerCase();
    const tenant = MOCK_TENANTS.find(t => t.firstName.toLowerCase().includes(term) || t.lastName.toLowerCase().includes(term));
    if (!tenant) return { error: "Member not found" };
    const records = MOCK_PARTICIPATION.filter(p => p.tenantId === tenant.id);
    return { member: `${tenant.firstName} ${tenant.lastName}`, records };
  },
  getScheduledMaintenance: ({ unitNumber }: any) => {
    let list = [...MOCK_SCHEDULED];
    if (unitNumber) {
      const unit = MOCK_UNITS.find(u => u.number === unitNumber);
      if (unit) list = list.filter(s => s.unitId === unit.id);
    }
    return list.map(s => ({ ...s, unitNumber: MOCK_UNITS.find(u => u.id === s.unitId)?.number || 'Global' }));
  },
  getDocuments: ({ query }: any) => {
    if (query) {
      const term = query.toLowerCase();
      return MOCK_DOCS.filter(d => d.title.toLowerCase().includes(term) || d.category.toLowerCase().includes(term));
    }
    return MOCK_DOCS;
  },
  getEvents: ({ category }: any) => {
    if (category) return MOCK_EVENTS.filter(e => e.category.toLowerCase() === category.toLowerCase());
    return MOCK_EVENTS;
  },
  getAnnouncements: () => MOCK_ANNOUNCEMENTS,
  getNotifications: () => MOCK_NOTIFICATIONS,
  getMessages: ({ memberName }: any) => {
    if (memberName) {
      const term = memberName.toLowerCase();
      const tenant = MOCK_TENANTS.find(t => t.firstName.toLowerCase().includes(term) || t.lastName.toLowerCase().includes(term));
      if (tenant) return MOCK_MESSAGES.filter(m => m.fromId === tenant.id || m.toId === tenant.id);
    }
    return MOCK_MESSAGES;
  },
  viewMaintenanceRequest: ({ requestId }: any) => {
    return { success: true, message: `Showing maintenance request ${requestId}` };
  }
};

export const geminiService = {
  /**
   * Triage a maintenance request based on description and optional image
   */
  async triageMaintenanceRequest(description: string, imageBase64?: string) {
    const parts: any[] = [
      { text: `Evaluate the following maintenance request for a BC housing co-op. 
      Analyze the text and any provided images to suggest:
      1. Urgency Level: Low (cosmetic), Medium (standard), High (potential damage/safety), Emergency (immediate risk).
      2. Category: Plumbing, Electrical, Structural, Appliance, Exterior, Safety, or Other.
      3. Reasoning: A brief explanation (1 sentence).
      4. AI Tip: A quick tip for the resident (e.g., "Locate your water shut-off valve").
      5. Latent Risk: Identify if this could be an early symptom of a massive failure (e.g., "small leak" -> "Total pipe failure risks").
      
      Request: "${description}"` }
    ];

    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            urgency: { type: Type.STRING },
            category: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            aiTip: { type: Type.STRING },
            latentRisk: { type: Type.STRING }
          },
          required: ["urgency", "category", "reasoning"]
        }
      }
    });

    try {
      return JSON.parse(response.text || '{}');
    } catch (e) {
      console.error("Failed to parse triage response", e);
      return { urgency: 'Medium', category: 'Other', reasoning: 'Standard triage applied.', aiTip: 'Contact maintenance chair if concerns persist.' };
    }
  },

  /**
   * Summarize meeting minutes and extract action items
   */
  async summarizeMinutes(rawNotes: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Summarize the following co-op meeting notes for easy reading by members. 
      Format with a "Key Decisions" section and an "Action Items" list (assigned to specific committees where possible).
      Keep the tone professional yet community-oriented.
      
      Notes: ${rawNotes}`,
    });
    return response.text;
  },

  /**
   * Advanced Smart Chat with DB access via tools (Streaming)
   */
  async *chatWithOracle(question: string, history: any[], language: string = 'English', onToolCall?: (name: string, args: any) => void) {
    const contents = [...history, { role: 'user', parts: [{ text: question }] }];

    const systemInstruction = `You are the smart "Oak Bay Co-op Oracle". 
        You have direct access to the co-op's database via specialized tools.
        
        Current Language: ${language}. You MUST respond in ${language}.
        
        Rules:
        1. NO MARKDOWN: Never use bold (**) or headers (###) in your response. Keep it clean, plain text.
        2. BE SUCCINCT: Provide the answer directly and briefly. Avoid long-winded explanations.
        3. BE FRIENDLY: Maintain a helpful, community-oriented tone.
        4. Use tools to fetch real data for member (getTenants), unit (getUnits), policy (getDocuments), events (getEvents), announcement (getAnnouncements), financial (getFinancialData), or participation (getParticipationRecords) queries.
        5. MULTI-STEP REASONING: If a query requires multiple steps, chain your tool calls.
        6. FINANCIAL DATA: You can check balances, share capital, and transactions via getFinancialData.
        7. MAINTENANCE: Use getMaintenanceRequests for specific issues and getScheduledMaintenance for routine tasks.
        8. DEEP LINKING: Use viewMaintenanceRequest to show the user the details page for a specific maintenance request if you are discussing it.
        9. Never make up data. If the tools return no results, inform the user clearly and briefly.`;

    const config = {
      systemInstruction,
      tools: tools as any
    };

    const model = 'gemini-3-flash-preview';

    let response = await ai.models.generateContent({
      model,
      contents,
      config
    });

    let functionCalls = response.functionCalls;
    let rounds = 0;

    // Handle tool call rounds
    while (functionCalls && rounds < 3) {
      const toolCasts = [];
      for (const call of functionCalls) {
        const fnName = call.name as keyof typeof functions;
        if (functions[fnName]) {
          const toolResult = (functions[fnName] as any)(call.args);
          
          if (onToolCall) {
            onToolCall(call.name, call.args);
          }

          toolCasts.push({
            functionResponse: {
              name: fnName,
              response: { result: toolResult },
              id: (call as any).id
            }
          });
        }
      }

      if (toolCasts.length > 0) {
        const modelPart = response.candidates?.[0]?.content;
        if (modelPart) contents.push(modelPart);
        contents.push({ role: 'user', parts: toolCasts as any });

        response = await ai.models.generateContent({
          model,
          contents,
          config
        });
        functionCalls = response.functionCalls;
      } else {
        break;
      }
      rounds++;
    }

    // Finally stream the actual text response
    const stream = await ai.models.generateContentStream({
      model,
      contents,
      config
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  },

  /**
   * Answer questions based on Co-op Policies
   */
  async askPolicyQuestion(question: string, contextDocuments: any[]) {
    // Convert documents to a combined context string
    const docContext = contextDocuments.map(d => `Document: ${d.title}\nCategory: ${d.category}\nContent: ${d.content || 'N/A'}`).join('\n\n');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are the "Oak Bay Co-op Oracle". 
      Answer the question using the provided co-op policies.
      
      Rules:
      1. NO MARKDOWN: Do not use bold (**) or headers.
      2. BE SUCCINCT: Keep it brief and friendly.
      3. Focus on specific rules found in the text.
      
      Policies:
      ${docContext}
      
      Question: ${question}`,
      config: {
        temperature: 0.3
      }
    });
    return response.text;
  },

  /**
   * Simplify complex co-op jargon into plain English for accessibility
   */
  async simplifyText(text: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an accessibility specialist. Rewrite the following co-op policy or text into "Plain English" for a member with cognitive disabilities or for someone who prefers clear, simple language. 
      Guidelines:
      - Use short sentences.
      - Use active voice.
      - Use simple words instead of legal jargon.
      - Use clear bullet points for rules.
      - Maintain the original meaning exactly.
      
      Text to simplify: ${text}`,
    });
    return response.text;
  },

  /**
   * Generate high-quality alt-text and audio-description content for images
   */
  async describeImageForAccessibility(imageBase64: string, context?: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { text: `Describe this image for a member who is visually impaired. 
            Focus on:
            1. What is shown (colors, objects, orientation).
            2. For maintenance: The specific damage or issue visible.
            3. For documents: Any text or structural layout info.
            Provide a concise description for alt-text (1 sentence) and a detailed description for audio (3-4 sentences).
            Context if known: ${context || 'General co-op asset'}` },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            altText: { type: Type.STRING },
            detailedAudioDescription: { type: Type.STRING }
          },
          required: ["altText", "detailedAudioDescription"]
        }
      }
    });
    
    try {
      return JSON.parse(response.text || '{}');
    } catch (e) {
      return { altText: "Image showing co-op related content.", detailedAudioDescription: "An image provided for the co-op system. Please contact the office if more detail is required." };
    }
  },

  /**
   * Clean up voice transcriptions to handle stutters, filler words, or audio noise
   */
  async refineTranscription(rawTranscript: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `The following text is a raw voice-to-text transcription from a co-op member. 
      Clean it up by:
      - Removing filler words (um, uh, like).
      - Fixing obvious grammatical errors caused by audio artifacts.
      - Preserving the user's intent and emotional tone.
      - Formatting it as a clear statement or question.
      
      Transcription: "${rawTranscript}"`,
    });
    return response.text;
  },

  /**
   * Refine administrative drafts to be empathetic yet compliant with co-op values
   */
  async refineCommunicationTone(draft: string, intent: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a communications specialist for a Housing Co-operative. 
      The goal is "Empathetic Enforcement". 
      Rewrite the following draft to be warmer, more cooperative, and community-centered, while clearly communicating the necessary intent/rules.
      
      Intent: ${intent}
      Draft: "${draft}"`,
    });
    return response.text;
  },

  /**
   * Extract high-level community trends from anonymized request data
   */
  async getCommunityPulse(requestData: any[]) {
    const dataString = JSON.stringify(requestData);
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following co-op maintenance request data (anonymized) and provide a "Community Pulse" report.
      1. Identify the top 2 recurring themes/concerns.
      2. Suggest one proactive community announcement the Board should make.
      3. Rate the "Community Stress Level" (Low, Moderate, High) based on urgency and volume.
      
      Data: ${dataString}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topThemes: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedAnnouncement: { type: Type.STRING },
            stressLevel: { type: Type.STRING }
          },
          required: ["topThemes", "suggestedAnnouncement", "stressLevel"]
        }
      }
    });
    try {
      return JSON.parse(response.text || '{}');
    } catch (e) {
      return { topThemes: ["General Maintenance"], suggestedAnnouncement: "Maintain standard community cooperation.", stressLevel: "Low" };
    }
  },

  /**
   * Cross-reference a new policy draft against existing Bylaws to find contradictions
   */
  async auditPolicyConflict(newPolicyText: string, masterBylaws: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a legal auditor for a Housing Co-op.
      Compare the following "New Draft" against the "Master Bylaws".
      Identify any:
      1. Direct Contradictions.
      2. Logical Inconsistencies.
      3. Ambiguous Phrasing.
      
      Master Bylaws: ${masterBylaws}
      New Draft: ${newPolicyText}`,
    });
    return response.text;
  },

  /**
   * High-level scenario coaching for co-op board member disputes or sensitive member issues
   */
  async resolveDisputeCoach(scenario: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a mediator specializing in Housing Co-operatives and community living.
      Provide a 3-step strategy to resolve the following scenario based on "Co-operative Values" (Self-help, Democracy, Equality, Equity, Solidarity).
      
      Scenario: ${scenario}
      
      Format the response as:
      1. The Approach (Mindset)
      2. The Action (Process)
      3. The Resolution (Ideal Outcome)`,
    });
    return response.text;
  },

  /**
   * Dream a community improvement using AI visualization (Text-to-Image helper)
   * This method just refines the prompt for the actual tool.
   */
  async refineImagePrompt(basicIdea: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Turn this simple co-op improvement idea into a highly detailed, photorealistic prompt for an image generator. 
      Focus on architectural beauty, inclusivity, and community warmth.
      Idea: ${basicIdea}
      
      Return only the prompt.`,
    });
    return response.text;
  },

  /**
   * Translate text into a target language for co-op members
   */
  async translateText(text: string, targetLanguage: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Translate the following co-op policy or response into ${targetLanguage}. 
      Ensure the tone remains professional, helpful, and community-oriented. 
      Preserve any technical co-op terms (like "Bylaws", "Share Purchase") but provide the translation for them in the target language.
      
      Text: "${text}"`,
    });
    return response.text;
  },

  /**
   * Detect if a user's question to the Oracle is actually a maintenance request
   */
  async detectMaintenanceIntent(message: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Determine if the following user message to a Housing Co-op assistant is seeking information about a maintenance problem (e.g., something broken, leaking, not working).
      
      Message: "${message}"
      
      Return a JSON boolean "isMaintenance" and a suggested "briefDescription" if true.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isMaintenance: { type: Type.BOOLEAN },
            briefDescription: { type: Type.STRING }
          },
          required: ["isMaintenance"]
        }
      }
    });
    try {
      return JSON.parse(response.text || '{}');
    } catch (e) {
      return { isMaintenance: false };
    }
  },

  /**
   * Generate high-quality human-sounding speech using Gemini TTS
   */
  async generateSpeech(text: string) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Say with a helpful, warm, and professional co-op employee voice: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' } // 'Kore' is a warm professional voice
            }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return base64Audio;
    } catch (error) {
      console.error("Gemini TTS Error:", error);
      return null;
    }
  },

  /**
   * Create a Multimodal Live API session for real-time conversation
   */
  connectLive(callbacks: {
    onOpen: () => void;
    onClose: () => void;
    onAudio: (base64PCM: string) => void;
    onText: (text: string) => void;
    onError: (err: any) => void;
    onInterrupted: () => void;
    onToolCall?: (name: string, args: any) => void;
  }, systemInstruction: string) {
    const session = ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      callbacks: {
        onopen: callbacks.onOpen,
        onclose: callbacks.onClose,
        onerror: callbacks.onError,
        onmessage: async (message) => {
          // Handle Tool Calls (Function Calling)
          if (message.toolCall) {
            const toolResponses: any[] = [];
            for (const call of message.toolCall.functionCalls) {
              const fnName = call.name as keyof typeof functions;
              if (functions[fnName]) {
                try {
                  // Execute tool implementation
                  const result = await (functions[fnName] as any)(call.args);
                  
                  // Notify UI of tool call for side-effects
                  if (callbacks.onToolCall) {
                    callbacks.onToolCall(call.name, call.args);
                  }

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
        systemInstruction,
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
