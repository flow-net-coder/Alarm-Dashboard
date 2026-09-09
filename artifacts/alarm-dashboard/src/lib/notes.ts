export type NoteItem = {
  id: string;
  content: string;
  createdAt: string;
  pinned: boolean;
};

export const NOTES_STORAGE_KEY = 'buzzer-notes';

export function loadNotes(): NoteItem[] {
  try {
    const saved = localStorage.getItem(NOTES_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as NoteItem[]) : [];
  } catch {
    return [];
  }
}

export function saveNotes(notes: NoteItem[]) {
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
}
