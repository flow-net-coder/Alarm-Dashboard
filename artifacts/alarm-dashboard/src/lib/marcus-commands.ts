import type { NoteItem } from '@/lib/notes';
import { findWebsiteShortcut } from '@/lib/websites';

type ParsedTime = {
  at: Date;
  label: string;
};

function parseTime(text: string): ParsedTime | null {
  const match = text.match(/\b(?:at|for)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  if (!Number.isFinite(hour) || hour < 1 || hour > 23 || minute < 0 || minute > 59) return null;
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;

  const at = new Date();
  at.setHours(hour, minute, 0, 0);
  if (at.getTime() <= Date.now()) {
    at.setDate(at.getDate() + 1);
  }

  return {
    at,
    label: at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
}

function stripTime(text: string) {
  return text.replace(/\b(?:at|for)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i, '').trim();
}

export function parseNoteCommand(text: string): NoteItem | null {
  const match = text.match(/^(?:marcus[, ]+)?(?:please\s+)?(?:add\s+)?(?:note|remember|write down)\s+(.+)$/i);
  const content = match?.[1]?.trim().replace(/[.?!]+$/, '');
  if (!content) return null;

  return {
    id: `note-${Date.now()}`,
    content,
    createdAt: new Date().toISOString(),
    pinned: false,
  };
}

export function parseReminderCommand(text: string) {
  const time = parseTime(text);
  if (!time) return null;

  const match = text.match(/^(?:marcus[, ]+)?(?:please\s+)?(?:remind me|notify me|send (?:me )?(?:a )?notification|tell me|(?:say\s+)?you said)\s+(.+)$/i);
  const body = match?.[1] ? stripTime(match[1]).replace(/^that\s+/i, '').replace(/[.?!]+$/, '').trim() : '';
  if (!body) return null;

  return {
    title: 'Marcus reminder',
    body,
    at: time.at,
    timeLabel: time.label,
  };
}

export function parseTimedWebsiteCommand(text: string) {
  const time = parseTime(text);
  if (!time) return null;

  const match = text.match(/^(?:marcus[, ]+)?(?:please\s+)?(?:open|launch|go to|visit|start)\s+(.+)$/i);
  const query = match?.[1] ? stripTime(match[1]).replace(/[.?!]+$/, '').trim() : '';
  if (!query) return null;

  const site = findWebsiteShortcut(query);
  return {
    query,
    site,
    at: time.at,
    timeLabel: time.label,
  };
}
