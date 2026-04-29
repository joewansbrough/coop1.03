import { CoopEvent } from '../types';

export type EventEditPayload = Pick<CoopEvent, 'title' | 'category' | 'date' | 'time' | 'location' | 'description'> & {
  committeeId: string | null;
};

export const applyEventEdit = <T extends CoopEvent>(event: T, payload: EventEditPayload): T & { committeeId?: string } => ({
  ...event,
  ...payload,
  committeeId: payload.committeeId || undefined,
});

export const createEventUpdateRequestInit = (payload: EventEditPayload): RequestInit => ({
  method: 'PUT',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
