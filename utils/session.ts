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

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'a_very_secure_random_string_at_least_32_characters_long',
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
