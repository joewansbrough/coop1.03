import type { CoopEvent } from '../types';

export type MinutesEventDetails = {
  meetingDate: string;
  startTime: string;
  location: string;
};

export const getMinutesEventDetails = (event?: Pick<CoopEvent, 'date' | 'time' | 'location'> | null): MinutesEventDetails => ({
  meetingDate: event?.date?.split('T')[0] || '',
  startTime: event?.time || '',
  location: event?.location || '',
});

export const applyMinutesEventDetails = <T extends Record<string, any>>(
  formData: T,
  event?: Pick<CoopEvent, 'date' | 'time' | 'location'> | null,
): T & MinutesEventDetails => ({
  ...formData,
  ...getMinutesEventDetails(event),
});
