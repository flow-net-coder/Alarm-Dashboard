import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Alarm } from '@/App';
import type { NoteItem } from '@/lib/notes';

type BuzzerWidgetDataPlugin = {
  updateWidgets(options: { alarmsText: string; notesText: string; marcusReply: string }): Promise<void>;
  getQuickNotes(): Promise<{ notes: NoteItem[] }>;
  clearQuickNotes(): Promise<void>;
};

const BuzzerWidgetData = registerPlugin<BuzzerWidgetDataPlugin>('BuzzerWidgetData');

function todayKey() {
  return ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'][new Date().getDay()]!;
}

export async function updateAndroidWidgets(alarms: Alarm[], notes: NoteItem[], marcusReply: string) {
  if (!Capacitor.isNativePlatform()) return;

  const today = todayKey();
  const alarmsText =
    alarms
      .filter((alarm) => alarm.enabled && alarm.days.includes(today))
      .slice(0, 4)
      .map((alarm) => `${alarm.time} ${alarm.meridiem} - ${alarm.label}`)
      .join('\n') || 'No alarms today.';

  const notesText =
    notes
      .slice(0, 5)
      .map((note) => `- ${note.content}`)
      .join('\n') || 'No notes yet.';

  await BuzzerWidgetData.updateWidgets({
    alarmsText,
    notesText,
    marcusReply: marcusReply || 'Ask Marcus from the widget.',
  }).catch(() => undefined);
}

export async function getAndroidQuickNotes() {
  if (!Capacitor.isNativePlatform()) return [];
  const result = await BuzzerWidgetData.getQuickNotes().catch(() => ({ notes: [] }));
  return result.notes;
}

export async function clearAndroidQuickNotes() {
  if (!Capacitor.isNativePlatform()) return;
  await BuzzerWidgetData.clearQuickNotes().catch(() => undefined);
}
