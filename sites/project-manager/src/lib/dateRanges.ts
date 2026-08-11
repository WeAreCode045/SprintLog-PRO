export type DateRangePreset = 'today' | 'thisWeek' | 'thisMonth' | 'pastMonth' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function getDateRange(preset: DateRangePreset, custom?: { start: string; end: string }): DateRange {
  const now = new Date();

  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'thisWeek': {
      const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
      const monday = new Date(now);
      monday.setDate(monday.getDate() - dayOfWeek);
      return { start: startOfDay(monday), end: endOfDay(now) };
    }
    case 'thisMonth': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(first), end: endOfDay(now) };
    }
    case 'pastMonth': {
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfDay(firstOfLastMonth), end: endOfDay(lastOfLastMonth) };
    }
    case 'custom': {
      if (!custom) {
        return { start: startOfDay(now), end: endOfDay(now) };
      }
      return { start: startOfDay(new Date(custom.start)), end: endOfDay(new Date(custom.end)) };
    }
  }
}

export function formatDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function formatDateLabel(dateKey: string): string {
  return new Date(dateKey + 'T00:00:00').toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
