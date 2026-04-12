import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '../../../../utils/session';
import { createGenerativeModel } from '../../../../utils/aiClient';

const PRIORITIES = ['Low', 'Medium', 'High', 'Emergency'] as const;
const CATEGORIES = ['Plumbing', 'Electrical', 'Structural', 'Appliance', 'HVAC', 'Exterior', 'Safety', 'Other'] as const;

const normalizeChoice = (value: unknown, options: readonly string[], fallback: string) => {
  if (!value) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  const match = options.find(option => option.toLowerCase() === normalized);
  return match ?? fallback;
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { description } = await request.json();
    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'Description is required.' }, { status: 400 });
    }

    const model = createGenerativeModel();
    const prompt = `
You are an expert maintenance triager for a housing cooperative in British Columbia.
Analyze the following member request and respond with a JSON object that includes "priority" (one of Low, Medium, High, Emergency) and "category" (choose from Plumbing, Electrical, Structural, Appliance, HVAC, Exterior, Safety, Other).
Return nothing except the JSON object.
Issue: ${description.trim()}
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
        maxOutputTokens: 256,
      },
    });
    const text = response.response.text() || '';
    const parsed = JSON.parse(text);
    const priority = normalizeChoice(parsed.priority, PRIORITIES, 'Medium');
    const category = normalizeChoice(parsed.category, CATEGORIES, 'Other');
    return NextResponse.json({ priority, category });
  } catch (error: any) {
    console.error('AI triage failed:', error);
    return NextResponse.json({ priority: 'Medium', category: 'Other' });
  }
}
