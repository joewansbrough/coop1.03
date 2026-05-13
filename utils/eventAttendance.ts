import type { CoopEvent, Tenant } from '../types';

type AttendanceUser = {
  id?: string;
  tenantId?: string;
  name?: string;
  email: string;
};

const splitName = (name?: string) => {
  const parts = (name || 'Demo Member').trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || 'Demo';
  const lastName = parts.slice(1).join(' ') || 'Member';
  return { firstName, lastName };
};

export const addUserAttendance = <T extends Pick<CoopEvent, 'attendees'> & { id: string }>(
  event: T,
  user: AttendanceUser,
): T & { attendees: Tenant[] } => {
  const attendees = event.attendees || [];
  if (attendees.some(attendee => attendee.email === user.email || attendee.id === user.tenantId)) {
    return { ...event, attendees };
  }

  const { firstName, lastName } = splitName(user.name);
  const attendee: Tenant = {
    id: user.tenantId || user.id || `attendee-${user.email}`,
    firstName,
    lastName,
    email: user.email,
    status: 'Current',
    role: 'MEMBER',
    startDate: new Date().toISOString().split('T')[0],
  };

  return {
    ...event,
    attendees: [...attendees, attendee],
  };
};

export const createAttendanceRequestInit = (): RequestInit => ({
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
});
