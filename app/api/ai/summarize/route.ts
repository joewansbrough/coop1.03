import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '../../../../utils/session';
import { createGenerativeModel } from '../../../../utils/aiClient';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { content } = await request.json();
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required.' }, { status: 400 });
    }

    const model = createGenerativeModel();
    const prompt = `
Summarize the following housing co-op document in plain language. Return a JSON object with "summary" (short paragraph) and "tags" (array of keywords, max 6 terms).

Content:
${content.trim()}
`;

    const response = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 512,
      },
    });
    const jsonText = response.response.text();
    const parsed = JSON.parse(jsonText);
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const tags = Array.isArray(parsed.tags) ? parsed.tags.map((tag: unknown) => String(tag)) : [];
    return NextResponse.json({ summary, tags });
  } catch (error: any) {
    console.error('Document summarization failed:', error);
    return NextResponse.json({ summary: '', tags: [] });
  }
}
