const padDatePart = (value: number) => value.toString().padStart(2, '0');

export const getLocalDateInputValue = (date: Date = new Date()) => {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
};

export const getDateOnlyValue = (date: string | Date | undefined | null) => {
  if (!date) return '';
  if (date instanceof Date) return getLocalDateInputValue(date);
  return date.includes('T') ? date.split('T')[0] : date;
};

const parseDateOnlyAsLocal = (date: string | Date | undefined | null) => {
  if (!date) return null;
  if (date instanceof Date) return date;

  const dateOnly = getDateOnlyValue(date);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(date);

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

export const formatDate = (date: string | Date | undefined | null) => {
  if (!date) return 'N/A';
  const d = parseDateOnlyAsLocal(date);
  if (!d) return 'N/A';
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

export const formatDateTime = (date: string | Date | undefined | null) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  const datePart = d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).toLowerCase();
  
  return `${datePart}, ${timePart}`;
};

export const formatShortDate = (date: string | Date | undefined | null) => {
  if (!date) return 'N/A';
  const d = parseDateOnlyAsLocal(date);
  if (!d) return 'N/A';
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const formatCalendarDateLabel = (date: string | Date | undefined | null) => {
  if (!date) return '';
  const d = parseDateOnlyAsLocal(date);
  if (!d || isNaN(d.getTime())) return '';

  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric'
  });
};
