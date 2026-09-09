import { useState, useEffect, useRef, useCallback } from 'react';
import {
  sendMessage,
  getHistory,
  getActions,
  updateAction,
  triggerHeartbeat,
  type Message,
  type ActionItem,
  type MarcusState,
} from '../api';
import { findWebsiteShortcut, parseOpenWebsiteCommand } from '@/lib/websites';
import { openExternalUrl } from '@/lib/open-url';
import { parseAlarmCommand } from '@/lib/alarm-commands';
import type { Alarm } from '@/App';
import { parseNoteCommand, parseReminderCommand, parseTimedWebsiteCommand } from '@/lib/marcus-commands';
import type { NoteItem } from '@/lib/notes';

interface Props {
  marcus: MarcusState | null;
  onMarcusUpdate: () => void;
  onCreateAlarm?: (alarm: Alarm) => void;
  onCreateNote?: (note: NoteItem) => void;
  onScheduleReminder?: (reminder: { title: string; body: string; at: Date; timeLabel: string }) => Promise<boolean>;
  onScheduleWebsiteOpen?: (command: { query: string; site: ReturnType<typeof findWebsiteShortcut>; at: Date; timeLabel: string }) => Promise<boolean>;
  onMarcusReply?: (reply: string) => void;
}

const TYPE_ICON: Record<string, string> = {
  task: '✅',
  meeting: '📅',
  email: '📧',
  call: '📞',
  reminder: '⏰',
  other: '📌',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function ChatScreen({ marcus, onMarcusUpdate, onCreateAlarm, onCreateNote, onScheduleReminder, onScheduleWebsiteOpen, onMarcusReply }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [heartbeating, setHeartbeating] = useState(false);
  const [showActions, setShowActions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastHeartbeatMsg, setLastHeartbeatMsg] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [hist, acts] = await Promise.all([
        getHistory(60),
        getActions('pending'),
      ]);
      setMessages(hist);
      setActions(acts);
    } catch (err) {
      console.error('[ChatScreen] loadData error:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll for new action items every 8 seconds (background extraction is async)
    const interval = setInterval(() => {
      getActions('pending').then(setActions).catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setError(null);

    const timedWebsite = parseTimedWebsiteCommand(text);
    if (timedWebsite && onScheduleWebsiteOpen) {
      const now = new Date().toISOString();
      const tempUserMsg: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: text,
        sessionDate: now.split('T')[0]!,
        createdAt: now,
      };
      const scheduled = timedWebsite.site ? await onScheduleWebsiteOpen(timedWebsite) : false;
      const assistantMsg: Message = {
        id: `temp-ai-${Date.now()}`,
        role: 'assistant',
        content: timedWebsite.site
          ? scheduled
            ? `Done. I will remind you to open ${timedWebsite.site.title} at ${timedWebsite.timeLabel}.`
            : 'I need native notification permissions before I can schedule that.'
          : `I couldn't find "${timedWebsite.query}" in your website shortcuts.`,
        sessionDate: now.split('T')[0]!,
        createdAt: new Date().toISOString(),
      };
      onMarcusReply?.(assistantMsg.content);
      setMessages((prev) => [...prev, tempUserMsg, assistantMsg]);
      inputRef.current?.focus();
      return;
    }

    const reminder = parseReminderCommand(text);
    if (reminder && onScheduleReminder) {
      const now = new Date().toISOString();
      const tempUserMsg: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: text,
        sessionDate: now.split('T')[0]!,
        createdAt: now,
      };
      const scheduled = await onScheduleReminder(reminder);
      const assistantMsg: Message = {
        id: `temp-ai-${Date.now()}`,
        role: 'assistant',
        content: scheduled ? `Done. I will notify you at ${reminder.timeLabel}: ${reminder.body}.` : 'I need native notification permissions before I can schedule that.',
        sessionDate: now.split('T')[0]!,
        createdAt: new Date().toISOString(),
      };
      onMarcusReply?.(assistantMsg.content);
      setMessages((prev) => [...prev, tempUserMsg, assistantMsg]);
      inputRef.current?.focus();
      return;
    }

    const note = parseNoteCommand(text);
    if (note && onCreateNote) {
      const now = new Date().toISOString();
      const tempUserMsg: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: text,
        sessionDate: now.split('T')[0]!,
        createdAt: now,
      };
      const assistantMsg: Message = {
        id: `temp-ai-${Date.now()}`,
        role: 'assistant',
        content: `Saved note: ${note.content}`,
        sessionDate: now.split('T')[0]!,
        createdAt: new Date().toISOString(),
      };
      onMarcusReply?.(assistantMsg.content);
      onCreateNote(note);
      setMessages((prev) => [...prev, tempUserMsg, assistantMsg]);
      inputRef.current?.focus();
      return;
    }

    const websiteQuery = parseOpenWebsiteCommand(text);
    if (websiteQuery) {
      const now = new Date().toISOString();
      const tempUserMsg: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: text,
        sessionDate: now.split('T')[0]!,
        createdAt: now,
      };
      const site = findWebsiteShortcut(websiteQuery);
      const assistantMsg: Message = {
        id: `temp-ai-${Date.now()}`,
        role: 'assistant',
        content: site
          ? `Opening ${site.title}.`
          : `I couldn't find "${websiteQuery}" in your website shortcuts. Add it in Websites & Apps first, then ask me to open it.`,
        sessionDate: now.split('T')[0]!,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempUserMsg, assistantMsg]);
      onMarcusReply?.(assistantMsg.content);
      if (site) {
        void openExternalUrl(site.url);
      }
      inputRef.current?.focus();
      return;
    }

    const alarm = parseAlarmCommand(text);
    if (alarm && onCreateAlarm) {
      const now = new Date().toISOString();
      const tempUserMsg: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: text,
        sessionDate: now.split('T')[0]!,
        createdAt: now,
      };
      const assistantMsg: Message = {
        id: `temp-ai-${Date.now()}`,
        role: 'assistant',
        content: `Done. I set "${alarm.label}" for ${alarm.time} ${alarm.meridiem}.`,
        sessionDate: now.split('T')[0]!,
        createdAt: new Date().toISOString(),
      };

      onCreateAlarm(alarm);
      onMarcusReply?.(assistantMsg.content);
      setMessages((prev) => [...prev, tempUserMsg, assistantMsg]);
      inputRef.current?.focus();
      return;
    }

    setLoading(true);

    // Optimistic user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      sessionDate: new Date().toISOString().split('T')[0]!,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const { reply } = await sendMessage(text);
      const tempAssistantMsg: Message = {
        id: `temp-ai-${Date.now()}`,
        role: 'assistant',
        content: reply,
        sessionDate: new Date().toISOString().split('T')[0]!,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, tempAssistantMsg]);
      onMarcusReply?.(reply);

      // Refresh actions after a short delay (extraction runs in background)
      setTimeout(() => {
        getActions('pending').then(setActions).catch(() => {});
      }, 3000);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleHeartbeat = async () => {
    setHeartbeating(true);
    setLastHeartbeatMsg(null);
    try {
      const result = await triggerHeartbeat();
      setLastHeartbeatMsg(`Heartbeat complete — ${result.conversationsProcessed} messages, ${result.actionItemsCreated} new items`);
      await loadData();
      onMarcusUpdate();
    } catch (err) {
      setLastHeartbeatMsg('Heartbeat failed. Check server logs.');
    } finally {
      setHeartbeating(false);
    }
  };

  const handleMarkDone = async (id: string) => {
    try {
      await updateAction(id, 'done');
      setActions((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to update action:', err);
    }
  };

  const managerName = marcus?.name ?? 'Marcus';
  const lastBeat = marcus?.lastHeartbeat;

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Chat panel ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex flex-col gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
              {managerName.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 text-sm">{managerName}</div>
              <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                AI Manager
                {lastBeat && (
                  <span className="ml-2 text-gray-400">
                    · last sync {new Date(lastBeat.ranAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleHeartbeat}
              disabled={heartbeating}
              title="Run heartbeat — compile all updates and refresh manager state"
              className="flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-all hover:bg-gray-50 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className={heartbeating ? 'animate-pulse' : ''}>💓</span>
              {heartbeating ? 'Running…' : 'Heartbeat'}
            </button>
            <button
              onClick={() => setShowActions((p) => !p)}
              className="hidden min-h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-all hover:bg-gray-50 hover:border-gray-300 sm:flex"
            >
              {showActions ? '→ Hide' : '← Actions'}
              {actions.length > 0 && (
                <span className="ml-1 bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                  {actions.length > 9 ? '9+' : actions.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {lastHeartbeatMsg && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
            💓 {lastHeartbeatMsg}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-3xl mb-4">🧠</div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">
                Hi, I'm {managerName}
              </h2>
              <p className="text-gray-500 text-sm max-w-xs">
                Your AI manager. Tell me about your schedule, tasks, or anything you need tracked — I remember everything.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-2 w-full max-w-xs">
                {[
                  'I have a meeting with Sarah tomorrow at 2pm',
                  'Email John about the project deadline',
                  'Remind me to follow up with the client on Friday',
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="text-left px-3 py-2 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                  >
                    "{s}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold mr-2 mt-1 shrink-0">
                  {managerName.charAt(0)}
                </div>
              )}
              <div
                className={`max-w-[86%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm sm:max-w-[72%] ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold mr-2 mt-1 shrink-0">
                {managerName.charAt(0)}
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 bg-white border-t border-gray-200">
          <div className="flex gap-2 items-end bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${managerName}…`}
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none max-h-32 leading-5"
              style={{ minHeight: '20px' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${el.scrollHeight}px`;
              }}
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="hidden text-center text-[10px] text-gray-400 mt-1.5 sm:block">
            Enter to send · Shift+Enter for new line · Heartbeat runs hourly
          </p>
        </div>
      </div>

      {/* ── Action items panel ──────────────────────────────── */}
      {showActions && (
        <aside className="hidden w-72 shrink-0 bg-white border-l border-gray-200 sm:flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">
                Pending Actions
              </h2>
              <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
                {actions.length}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Ready for connected app · auto-updates every 8s
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
            {actions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-2xl mb-2">🎯</div>
                <p className="text-xs">No pending actions yet.<br />Start chatting to create them.</p>
              </div>
            ) : (
              actions.map((action) => (
                <div
                  key={action.id}
                  className="bg-gray-50 border border-gray-100 rounded-xl p-3 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm">{TYPE_ICON[action.type] ?? '📌'}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLOR[action.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {action.type}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-gray-800 leading-snug line-clamp-2">
                        {action.title}
                      </p>
                      {action.dueDate && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          📅 {new Date(action.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {action.description && (
                        <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{action.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleMarkDone(action.id)}
                      title="Mark done"
                      className="shrink-0 w-6 h-6 rounded-lg bg-white border border-gray-200 hover:bg-green-50 hover:border-green-300 text-gray-400 hover:text-green-600 flex items-center justify-center transition-all"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Context summary */}
          {marcus?.context && Object.keys(marcus.context).length > 0 && (
            <div className="border-t border-gray-100 p-3">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">
                Manager knows
              </p>
              <div className="space-y-1">
                {Object.entries(marcus.context).slice(0, 4).map(([k, v]) => (
                  <div key={k} className="flex gap-1.5 text-[10px]">
                    <span className="text-gray-400 shrink-0">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-gray-700 truncate">{v}</span>
                  </div>
                ))}
                {Object.keys(marcus.context).length > 4 && (
                  <p className="text-[10px] text-gray-400">+{Object.keys(marcus.context).length - 4} more</p>
                )}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
