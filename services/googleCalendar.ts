import { google } from 'googleapis';
import {
  buildGoogleCalendarEventPayload,
  getGoogleCalendarSyncKey,
  type CoopHubCalendarCooperativeLike,
  type CoopHubCalendarEventLike,
} from '../utils/googleCalendar.js';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const parseServiceAccountCredentials = () => {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON');

  let cleaned = raw;
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = JSON.parse(cleaned);
  }

  const credentials = JSON.parse(cleaned);
  if (credentials && typeof credentials.private_key === 'string') {
    credentials.private_key = credentials.private_key
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r');
  }
  return credentials;
};

export const googleCalendarClient = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: parseServiceAccountCredentials(),
    scopes: [CALENDAR_SCOPE],
  });
  return google.calendar({ version: 'v3', auth });
};

export type SyncGoogleCalendarEventInput = {
  event: CoopHubCalendarEventLike;
  cooperative: CoopHubCalendarCooperativeLike;
  calendarId: string;
  appBaseUrl: string;
  timeZone?: string;
  dryRun?: boolean;
  calendar?: ReturnType<typeof googleCalendarClient>;
};

export const syncGoogleCalendarEvent = async ({
  event,
  cooperative,
  calendarId,
  appBaseUrl,
  timeZone,
  dryRun = false,
  calendar = googleCalendarClient(),
}: SyncGoogleCalendarEventInput) => {
  if (!calendarId?.trim()) throw new Error('Google Calendar ID is required.');

  const payload = buildGoogleCalendarEventPayload({
    event,
    cooperative,
    appBaseUrl,
    timeZone,
  });

  if (dryRun) {
    return {
      mode: 'dry-run' as const,
      calendarId,
      payload,
    };
  }

  const existing = await calendar.events.list({
    calendarId,
    privateExtendedProperty: [getGoogleCalendarSyncKey(event.id)],
    maxResults: 1,
    singleEvents: true,
  });
  const existingEvent = existing.data.items?.[0];
  const response = existingEvent?.id
    ? await calendar.events.update({
      calendarId,
      eventId: existingEvent.id,
      requestBody: payload,
      conferenceDataVersion: 1,
    })
    : await calendar.events.insert({
      calendarId,
      requestBody: payload,
      conferenceDataVersion: 1,
    });

  return {
    mode: existingEvent?.id ? 'updated' as const : 'created' as const,
    calendarId,
    googleEventId: response.data.id || null,
    htmlLink: response.data.htmlLink || null,
    hangoutLink: response.data.hangoutLink || response.data.conferenceData?.entryPoints?.find(entry => entry.entryPointType === 'video')?.uri || null,
    payload,
  };
};
