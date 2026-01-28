import { format, parseISO } from 'date-fns';

const normalizeDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = parseISO(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const formatMeridiem = (value: string) =>
  value.replace(/\bAM\b/g, 'a.m.').replace(/\bPM\b/g, 'p.m.');

export const formatDateTime = (value?: string | Date | null, pattern = 'yyyy-MM-dd h:mm a') => {
  const date = normalizeDate(value);
  if (!date) return '-';
  return formatMeridiem(format(date, pattern));
};

export const formatDateTimeLong = (value?: string | Date | null) =>
  formatDateTime(value, 'MMM dd, yyyy h:mm a');
