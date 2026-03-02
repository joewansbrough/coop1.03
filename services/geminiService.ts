
import { GoogleGenAI, Type } from "@google/genai";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  /**
   * Triage a maintenance request based on description
   */
  async triageMaintenanceRequest(description: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Evaluate the following maintenance request for a BC housing co-op and return a suggested urgency level (Low, Medium, High, Emergency) and a category (Plumbing, Electrical, Structural, Appliance, Other). 
      Request: "${description}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            urgency: { type: Type.STRING },
            category: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          },
          required: ["urgency", "category"]
        }
      }
    });

    try {
      // response.text is a property (not a method) that directly returns the string output.
      return JSON.parse(response.text || '{}');
    } catch (e) {
      return { urgency: 'Medium', category: 'Other' };
    }
  },

  /**
   * Answer questions based on Co-op Policies
   */
  async askPolicyQuestion(question: string, context: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an AI assistant for a BC Housing Co-operative. Answer the following member question based strictly on the provided policy snippets. If the answer isn't in the context, say you don't know and advise them to contact the board.
      
      Context: ${context}
      Question: ${question}`,
      config: {
        temperature: 0.2
      }
    });
    // response.text is a property (not a method) that directly returns the string output.
    return response.text;
  }
};
