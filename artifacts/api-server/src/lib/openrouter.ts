type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ExtractedAction {
  type: 'task' | 'meeting' | 'email' | 'call' | 'reminder' | 'other';
  title: string;
  description?: string;
  details?: Record<string, unknown>;
  due_date?: string | null;
}

export interface ExtractionResult {
  action_items: ExtractedAction[];
  context_updates: Record<string, string>;
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'openrouter/free';
const OPENROUTER_HTTP_REFERER = process.env.OPENROUTER_HTTP_REFERER ?? 'http://localhost:5173';
const OPENROUTER_APP_TITLE = process.env.OPENROUTER_APP_TITLE ?? 'AI Marcus';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

if (!OPENROUTER_API_KEY) {
  console.warn('[marcus] OPENROUTER_API_KEY not set - AI responses will fail');
}

async function chatCompletion(
  messages: ChatMessage[],
  options: {
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
  } = {},
): Promise<{ content: string; model?: string }> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': OPENROUTER_HTTP_REFERER,
      'X-OpenRouter-Title': OPENROUTER_APP_TITLE,
      'X-OpenRouter-Metadata': 'enabled',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1024,
      ...(options.response_format ? { response_format: options.response_format } : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `OpenRouter request failed: ${response.status}`);
  }

  const data = await response.json() as {
    model?: string;
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  return {
    content: data.choices?.[0]?.message?.content?.trim() ?? '',
    model: data.model,
  };
}

export async function generateMarcusResponse(
  history: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  const { content } = await chatCompletion(
    [{ role: 'system', content: systemPrompt }, ...history],
    { temperature: 0.7, max_tokens: 1024 },
  );

  return content || 'I encountered an issue. Please try again.';
}

export async function extractEntities(
  userMessage: string,
  aiResponse: string,
): Promise<ExtractionResult> {
  const prompt = `You are an entity extraction system. Analyze this conversation exchange and extract structured data.

USER: "${userMessage}"
MANAGER: "${aiResponse}"

Extract ALL of the following:

1. action_items — tasks, meetings, emails, calls, reminders, or any other commitments mentioned.
   Each item needs: type (task|meeting|email|call|reminder|other), title (short), description (full detail), details (object with people, date, time, location, subject, etc.), due_date (ISO 8601 string if a date/time was mentioned, else null)

2. context_updates — key facts about the user or their work worth remembering permanently.
   Examples: user_name, company_name, role, team_members, ongoing_projects, preferences.
   Only include genuinely new or updated facts. Use short snake_case keys.

Return ONLY valid JSON, no markdown:
{
  "action_items": [],
  "context_updates": {}
}`;

  try {
    const { content } = await chatCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: 0.1, max_tokens: 800, response_format: { type: 'json_object' } },
    );

    const parsed = JSON.parse(content || '{}') as ExtractionResult;
    return {
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
      context_updates: parsed.context_updates && typeof parsed.context_updates === 'object'
        ? parsed.context_updates as Record<string, string>
        : {},
    };
  } catch {
    return { action_items: [], context_updates: {} };
  }
}

export async function generateHeartbeatSummary(
  recentMessages: Array<{ role: string; content: string }>,
  existingContext: Record<string, string>,
  pendingActionCount: number,
): Promise<{
  summary: string;
  new_action_items: ExtractedAction[];
  context_updates: Record<string, string>;
}> {
  if (recentMessages.length === 0) {
    return {
      summary: 'No new conversations since last heartbeat.',
      new_action_items: [],
      context_updates: {},
    };
  }

  const contextStr = Object.entries(existingContext)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const conversationStr = recentMessages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const prompt = `You are reviewing recent marcus conversations to update the marcus's state.

EXISTING CONTEXT:
${contextStr || 'None yet'}

RECENT CONVERSATIONS (last hour):
${conversationStr}

PENDING ACTIONS: ${pendingActionCount} items already tracked

Produce a heartbeat report. Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary of what happened and what needs attention",
  "new_action_items": [],
  "context_updates": {}
}

For new_action_items — only include items NOT already likely tracked (avoid duplicates). Same format as before: type, title, description, details, due_date.
For context_updates — any new facts learned about the user or their situation.`;

  try {
    const { content } = await chatCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, max_tokens: 1200, response_format: { type: 'json_object' } },
    );

    const parsed = JSON.parse(content || '{}') as {
      summary: string;
      new_action_items: ExtractedAction[];
      context_updates: Record<string, string>;
    };
    return {
      summary: parsed.summary ?? 'Heartbeat complete.',
      new_action_items: Array.isArray(parsed.new_action_items) ? parsed.new_action_items : [],
      context_updates: typeof parsed.context_updates === 'object' ? parsed.context_updates : {},
    };
  } catch {
    return {
      summary: 'Heartbeat ran but summary generation failed.',
      new_action_items: [],
      context_updates: {},
    };
  }
}
