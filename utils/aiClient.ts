import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('API_KEY is required to call Gemini endpoints.');
}

const aiClient = new GoogleGenerativeAI(apiKey);

export function createGenerativeModel() {
  return aiClient.getGenerativeModel({
    model: process.env.GENERATIVE_MODEL ?? 'gemini-2.0-flash-lite',
    generationConfig: {
      maxOutputTokens: 768,
    },
  });
}
