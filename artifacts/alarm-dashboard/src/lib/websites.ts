export type WebsiteShortcut = {
  id: string;
  title: string;
  url: string;
  category: 'all' | 'pc' | 'mobile' | 'tools';
  icon?: string;
};

export const WEBSITES_STORAGE_KEY = 'morning-light-websites';

export const initialWebsites: WebsiteShortcut[] = [
  { id: '1', title: 'Google', url: 'https://google.com', category: 'tools', icon: '🔍' },
  { id: '2', title: 'YouTube', url: 'https://youtube.com', category: 'mobile', icon: '📺' },
  { id: '3', title: 'Notion Notes', url: 'https://notion.so', category: 'pc', icon: '📝' },
  { id: '4', title: 'Google Calendar', url: 'https://calendar.google.com', category: 'tools', icon: '📅' },
  { id: '5', title: 'GitHub', url: 'https://github.com', category: 'pc', icon: '💻' },
  { id: '6', title: 'Railway Console', url: 'https://railway.app', category: 'tools', icon: '🚀' },
  { id: '7', title: 'Supabase DB', url: 'https://supabase.com', category: 'tools', icon: '⚡' },
];

export function loadWebsiteShortcuts(): WebsiteShortcut[] {
  try {
    const saved = localStorage.getItem(WEBSITES_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as WebsiteShortcut[]) : initialWebsites;
  } catch {
    return initialWebsites;
  }
}

export function saveWebsiteShortcuts(websites: WebsiteShortcut[]) {
  localStorage.setItem(WEBSITES_STORAGE_KEY, JSON.stringify(websites));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').trim();
}

export function findWebsiteShortcut(query: string) {
  const normalized = normalize(query);
  if (!normalized) return null;

  const sites = loadWebsiteShortcuts();
  return (
    sites.find((site) => normalize(site.title) === normalized) ??
    sites.find((site) => normalize(site.url).split('/')[0] === normalized) ??
    sites.find((site) => normalize(site.title).includes(normalized) || normalize(site.url).includes(normalized)) ??
    null
  );
}

export function parseOpenWebsiteCommand(message: string) {
  const match = message
    .trim()
    .match(/^(?:marcus[, ]+)?(?:please\s+)?(?:open|launch|go to|visit|start)\s+(.+?)(?:\s+(?:for me|please))?$/i);
  return match?.[1]?.trim() ?? null;
}
