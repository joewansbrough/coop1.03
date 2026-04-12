import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface UserSession {
  email: string;
  name: string;
  picture: string;
  isAdmin: boolean;
  tenantId: string | null;
  unitNumber: string | null;
  role: string;
  geminiModel: string;
  isGuest?: boolean;
}

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be defined and at least 32 characters long.');
}

export const sessionOptions: SessionOptions = {
  password: sessionSecret,
  cookieName: 'oak_bay_housing_coop_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<UserSession>(cookieStore, sessionOptions);
  return session;
}
