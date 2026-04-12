import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '../../../../utils/session';
import { createGenerativeModel } from '../../../../utils/aiClient';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { question, context } = await request.json();
    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required.' }, { status: 400 });
    }

    const model = createGenerativeModel();
    const prompt = `
You are a concise, friendly policy assistant for a British Columbia housing cooperative.
Answer the question based on the context, referencing the relevant bylaws or operating principles when applicable.
Context:
${context || 'No additional context provided.'}

Question: ${question.trim()}
`;
    const response = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 512,
      },
    });
    return NextResponse.json({ answer: response.response.text() });
  } catch (error: any) {
    console.error('Policy assistant failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to reach Gemini.' }, { status: 500 });
  }
}
