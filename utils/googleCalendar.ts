export type CoopHubCalendarEventLike = {
  id: string;
  title: string;
  description?: string | null;
  date: Date | string;
  time?: string | null;
  location?: string | null;
  category?: string | null;
};

export type CoopHubCalendarCooperativeLike = {
  name: string;
  slug: string;
};

const pad = (value: number) => String(value).padStart(2, '0');

const getDateOnly = (date: Date | string) => {
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  const value = String(date || '').trim();
  return value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
};

const getCleanTime = (time?: string | null) => {
  const value = String(time || '').trim();
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  if (/^\d{1}:\d{2}$/.test(value)) return `0${value}`;
  return '19:00';
};

const addMinutes = (dateTime: string, minutes: number) => {
  const [datePart, timePart] = dateTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const date = new Date(year, month - 1, day, hour, minute + minutes, 0);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
};

const cleanBaseUrl = (appBaseUrl: string) => appBaseUrl.replace(/\/+$/, '');

export const getGoogleCalendarSyncKey = (eventId: string) => `coopHubEventId=${eventId}`;

export const buildGoogleCalendarEventPayload = ({
  event,
  cooperative,
  appBaseUrl,
  timeZone = 'America/Vancouver',
}: {
  event: CoopHubCalendarEventLike;
  cooperative: CoopHubCalendarCooperativeLike;
  appBaseUrl: string;
  timeZone?: string;
}) => {
  const date = getDateOnly(event.date);
  const time = getCleanTime(event.time);
  const startDateTime = `${date}T${time}:00`;
  const eventUrl = `${cleanBaseUrl(appBaseUrl)}/#/calendar/${event.id}`;
  const descriptionParts = [
    event.description?.trim(),
    '',
    `coopHUB event: ${eventUrl}`,
    `Co-op: ${cooperative.name}`,
    event.category ? `Category: ${event.category}` : null,
  ].filter((part): part is string => part !== null && part !== undefined);

  return {
    summary: event.title || 'Co-op event',
    location: event.location || '',
    description: descriptionParts.join('\n'),
    start: {
      dateTime: startDateTime,
      timeZone,
    },
    end: {
      dateTime: addMinutes(startDateTime, 60),
      timeZone,
    },
    extendedProperties: {
      private: {
        coopHubEventId: event.id,
        coopHubCooperativeSlug: cooperative.slug,
      },
    },
    conferenceData: {
      createRequest: {
        requestId: `coophub-${event.id}-meet`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };
};
