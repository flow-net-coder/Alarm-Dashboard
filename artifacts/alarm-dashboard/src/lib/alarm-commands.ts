import type { Alarm } from '@/App';

const dayKeys = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];

function parseDays(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes('weekdays') || lower.includes('work days')) return ['mo', 'tu', 'we', 'th', 'fr'];
  if (lower.includes('weekends')) return ['sa', 'su'];
  if (lower.includes('every day') || lower.includes('daily')) return dayKeys;

  const selected = [
    ['mo', /mondays?|mon\b/],
    ['tu', /tuesdays?|tue\b/],
    ['we', /wednesdays?|wed\b/],
    ['th', /thursdays?|thu\b|thur\b|thurs\b/],
    ['fr', /fridays?|fri\b/],
    ['sa', /saturdays?|sat\b/],
    ['su', /sundays?|sun\b/],
  ]
    .filter(([, pattern]) => (pattern as RegExp).test(lower))
    .map(([day]) => day as string);

  return selected.length > 0 ? selected : dayKeys;
}

function parseLabel(text: string) {
  const match = text.match(/\b(?:called|named|label(?:led)?|for|to)\s+(.+?)\s*$/i);
  if (!match?.[1]) return 'Marcus alarm';

  return match[1]
    .replace(/\b(?:every day|daily|weekdays?|work days|weekends?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)\b/gi, '')
    .trim()
    .replace(/[.?!]+$/, '') || 'Marcus alarm';
}

export function parseAlarmCommand(text: string): Alarm | null {
  const match = text.match(
    /\b(?:set|add|create|make|schedule)\s+(?:an?\s+)?alarm\s+(?:for|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b|\bwake\s+me\s+(?:up\s+)?(?:at|for)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
  );
  if (!match) return null;

  const rawHour = Number(match[1] ?? match[4]);
  const minute = Number(match[2] ?? match[5] ?? 0);
  const explicitMeridiem = (match[3] ?? match[6])?.toUpperCase() as 'AM' | 'PM' | undefined;
  if (!Number.isFinite(rawHour) || rawHour < 1 || rawHour > 23 || minute < 0 || minute > 59) return null;

  const meridiem = explicitMeridiem ?? (rawHour >= 12 ? 'PM' : 'AM');
  const hour = rawHour > 12 ? rawHour - 12 : rawHour;

  return {
    id: `marcus-${Date.now()}`,
    label: parseLabel(text),
    time: `${hour || 12}:${String(minute).padStart(2, '0')}`,
    meridiem,
    days: parseDays(text),
    color: '#78B7A5',
    enabled: true,
    snooze: 9,
    sound: 'Soft chimes',
    dingCount: 1,
    note: text.trim(),
  };
}
