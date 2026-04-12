import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleApiKey: process.env.PICKER_API_KEY,
  });
}
