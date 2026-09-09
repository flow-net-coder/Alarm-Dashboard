export type ClientLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  label?: string;
  timezone?: string;
};

export type AssistantClientContext = {
  timezone?: string;
  locale?: string;
  location?: ClientLocation | null;
};

type SerperOrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
};

type SerperResponse = {
  answerBox?: {
    answer?: string;
    snippet?: string;
  };
  organic?: SerperOrganicResult[];
};

const SERPER_API_KEY = process.env.SERPER_API_KEY ?? process.env.SERPER_API ?? process.env.SERP_API_KEY ?? '';
const SERPER_BASE_URL = 'https://google.serper.dev/search';

const WEB_HINTS = [
  /\bgoogle\b/i,
  /\bsearch\b/i,
  /\blook\s+up\b/i,
  /\bfrom\s+the\s+web\b/i,
  /\bweb\b/i,
  /\blatest\b/i,
  /\bcurrent\b/i,
  /\btoday\b/i,
  /\bnews\b/i,
  /\bweather\b/i,
  /\bnear\s+me\b/i,
  /\bnearby\b/i,
  /\bwhere\s+is\b/i,
  /\bwho\s+is\b/i,
  /\bwhat\s+is\b/i,
  /\bwhen\s+is\b/i,
  /\bprice\b/i,
];

export function shouldUseWebSearch(message: string) {
  return Boolean(SERPER_API_KEY) && WEB_HINTS.some((pattern) => pattern.test(message));
}

function locationString(location?: ClientLocation | null) {
  if (!location) return undefined;
  if (location.label?.trim()) return location.label.trim();
  return `${location.latitude},${location.longitude}`;
}

export function buildClientContextBlock(context?: AssistantClientContext) {
  if (!context) return '';
  const lines = [
    `Client date/time: ${new Date().toISOString()}`,
    context.timezone ? `Client timezone: ${context.timezone}` : '',
    context.locale ? `Client locale: ${context.locale}` : '',
    context.location
      ? `Client location: ${locationString(context.location)}${
          context.location.accuracy ? `, accuracy about ${Math.round(context.location.accuracy)}m` : ''
        }`
      : '',
  ].filter(Boolean);

  return lines.length ? `CLIENT CONTEXT:\n${lines.join('\n')}` : '';
}

export async function searchWebForMarcus(query: string, context?: AssistantClientContext) {
  if (!shouldUseWebSearch(query)) return '';

  const response = await fetch(SERPER_BASE_URL, {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num: 5,
      location: locationString(context?.location),
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Serper ${response.status}: ${message || response.statusText}`);
  }

  const data = (await response.json()) as SerperResponse;
  const lines: string[] = [];

  if (data.answerBox?.answer || data.answerBox?.snippet) {
    lines.push(`Answer: ${data.answerBox.answer ?? data.answerBox.snippet}`);
  }

  for (const item of data.organic?.slice(0, 5) ?? []) {
    if (!item.title && !item.snippet) continue;
    lines.push(
      [
        item.title ? `Title: ${item.title}` : '',
        item.snippet ? `Snippet: ${item.snippet}` : '',
        item.date ? `Date: ${item.date}` : '',
        item.link ? `Source: ${item.link}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    );
  }

  return lines.length ? `WEB RESULTS:\n${lines.join('\n')}` : '';
}
