import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { AiChatBox } from '@/components/AiChatBox';
import { WebsitesView } from '@/components/WebsitesView';
import { playSound, unlockAudio } from '@/lib/sound';
import {
  cancelNativeAlarm,
  isNativeApp,
  requestNativeAlarmPermissions,
  scheduleNativeAlarm,
  sendNativeTestNotification,
  syncNativeAlarms,
} from '@/lib/native-alarms';
import {
  getNotificationPermissionState,
  getDeviceId,
  registerServerPush,
  requestNotificationPermission,
  sendAlarmNotification,
  syncAlarmsForServerPush,
} from '@/lib/notifications';
import { findWebsiteShortcut, parseOpenWebsiteCommand } from '@/lib/websites';
import { openExternalUrl } from '@/lib/open-url';
import { getHistory, sendMessage, sendTestPush, type Message } from '@/api';

import {
  AlarmClock,
  BellRing,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Download,
  Edit3,
  Flame,
  Globe,
  Menu,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Send,
  Sparkles,
  SunMedium,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

export type Alarm = {
  id: string;
  label: string;
  time: string;
  meridiem: 'AM' | 'PM';
  days: string[];
  color: string;
  enabled: boolean;
  snooze: number;
  sound: string;
  dingCount?: number;
  note?: string;
};

type Filter = 'all' | 'active' | 'paused';
type NavTab = 'alarms' | 'marcus' | 'websites';
type ServerPushStatus = 'unknown' | 'ready' | 'unsupported' | 'server_not_configured' | 'permission_not_granted' | 'sync_error';
type NativeAlarmStatus = 'browser' | 'unknown' | 'ready' | 'permission_not_granted' | 'sync_error';

const STORAGE_KEY = 'morning-light-alarms';
const palette = ['#E69C73', '#78B7A5', '#7E91C2', '#D6AE55', '#B48CBF', '#D67768'];
const dayKeys = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];
const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const initialAlarms: Alarm[] = [
  {
    id: 'wake-gently',
    label: 'Wake gently',
    time: '7:10',
    meridiem: 'AM',
    days: ['mo', 'tu', 'we', 'th', 'fr'],
    color: '#E69C73',
    enabled: true,
    snooze: 9,
    sound: 'Soft chimes',
    dingCount: 2,
    note: 'Open the curtains before checking your phone.',
  },
  {
    id: 'morning-stretch',
    label: 'Morning stretch',
    time: '7:40',
    meridiem: 'AM',
    days: ['mo', 'tu', 'we', 'th', 'fr'],
    color: '#78B7A5',
    enabled: true,
    snooze: 5,
    sound: 'Woodland',
    dingCount: 1,
    note: 'Five quiet minutes is plenty.',
  },
  {
    id: 'take-a-breather',
    label: 'Take a breather',
    time: '10:30',
    meridiem: 'AM',
    days: ['mo', 'tu', 'we', 'th', 'fr'],
    color: '#7E91C2',
    enabled: true,
    snooze: 10,
    sound: 'Low tide',
    dingCount: 1,
  },
  {
    id: 'wind-down',
    label: 'Wind down',
    time: '10:45',
    meridiem: 'PM',
    days: dayKeys,
    color: '#B48CBF',
    enabled: true,
    snooze: 9,
    sound: 'Night air',
    dingCount: 2,
    note: 'A gentle nudge toward tomorrow.',
  },
];

function makeDefaultAlarm(): Alarm {
  return {
    id: `alarm-${Date.now()}`,
    label: '',
    time: '07:00',
    meridiem: 'AM',
    days: ['mo', 'tu', 'we', 'th', 'fr'],
    color: palette[0],
    enabled: true,
    snooze: 9,
    sound: 'Soft chimes',
    dingCount: 1,
    note: '',
  };
}

function timeToMinutes(alarm: Alarm) {
  const [hourPart, minutePart] = alarm.time.split(':').map(Number);
  let hour = hourPart;
  if (alarm.meridiem === 'AM' && hour === 12) hour = 0;
  if (alarm.meridiem === 'PM' && hour !== 12) hour += 12;
  return hour * 60 + (minutePart || 0);
}

function toInputTime(alarm: Alarm) {
  let hour = Number(alarm.time.split(':')[0]);
  const minute = alarm.time.split(':')[1] || '00';
  if (alarm.meridiem === 'AM' && hour === 12) hour = 0;
  if (alarm.meridiem === 'PM' && hour !== 12) hour += 12;
  return `${String(hour).padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

function fromInputTime(value: string) {
  const [rawHour, minute] = value.split(':').map(Number);
  const meridiem: 'AM' | 'PM' = rawHour >= 12 ? 'PM' : 'AM';
  const hour = rawHour % 12 || 12;
  return { time: `${hour}:${String(minute || 0).padStart(2, '0')}`, meridiem };
}

function displayTime(alarm: Alarm) {
  const [hour, minute] = alarm.time.split(':');
  return `${hour}:${minute}`;
}

function todayKey() {
  const day = new Date().getDay();
  return day === 0 ? 'su' : dayKeys[day - 1];
}

function alarmDateForToday(alarm: Alarm, now = new Date()) {
  const [alarmHourRaw, alarmMinuteRaw] = alarm.time.split(':').map(Number);
  let alarmHour = alarmHourRaw;
  if (alarm.meridiem === 'AM' && alarmHour === 12) alarmHour = 0;
  if (alarm.meridiem === 'PM' && alarmHour !== 12) alarmHour += 12;
  const alarmDate = new Date(now);
  alarmDate.setHours(alarmHour, alarmMinuteRaw || 0, 0, 0);
  return alarmDate;
}

function formatToday() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

function scheduleLabel(days: string[]) {
  if (days.length === 7) return 'Every day';
  if (days.join(',') === 'mo,tu,we,th,fr') return 'Weekdays';
  if (days.join(',') === 'sa,su') return 'Weekends';
  return days.map((day) => dayLetters[dayKeys.indexOf(day)]).join(' · ');
}

function Sidebar({ activeTab, onTabChange }: { activeTab: NavTab; onTabChange: (tab: NavTab) => void }) {
  return (
    <aside className="sidebar flex flex-col px-7 py-8 md:px-6" data-testid="sidebar">
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] shadow-lg">
          <AlarmClock size={21} strokeWidth={2.2} />
        </div>
        <div>
          <div className="display-font text-[19px] leading-none tracking-[-0.03em]">Buzzer</div>
          <div className="mono-label mt-1 text-[hsl(var(--sidebar-foreground)/.52)]">personal timekeeper</div>
        </div>
      </div>

      <div className="relative z-10 mt-12 hidden md:block">
        <div className="mono-label text-[hsl(var(--sidebar-foreground)/.42)]">Navigation</div>
        <div className="mt-4 space-y-1.5">
          <button
            type="button"
            onClick={() => onTabChange('alarms')}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all ${
              activeTab === 'alarms'
                ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] shadow-sm'
                : 'text-[hsl(var(--sidebar-foreground)/.65)] hover:bg-[hsl(var(--sidebar-accent)/.5)]'
            }`}
          >
            <BellRing size={16} className={activeTab === 'alarms' ? 'text-[hsl(var(--sidebar-primary))]' : ''} />
            Alarms
          </button>

          <button
            type="button"
            onClick={() => onTabChange('marcus')}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all ${
              activeTab === 'marcus'
                ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] shadow-sm'
                : 'text-[hsl(var(--sidebar-foreground)/.65)] hover:bg-[hsl(var(--sidebar-accent)/.5)]'
            }`}
          >
            <Bot size={16} className={activeTab === 'marcus' ? 'text-[hsl(var(--sidebar-primary))]' : ''} />
            Marcus Chat
          </button>

          <button
            type="button"
            onClick={() => onTabChange('websites')}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all ${
              activeTab === 'websites'
                ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] shadow-sm'
                : 'text-[hsl(var(--sidebar-foreground)/.65)] hover:bg-[hsl(var(--sidebar-accent)/.5)]'
            }`}
          >
            <Globe size={16} className={activeTab === 'websites' ? 'text-[hsl(var(--sidebar-primary))]' : ''} />
            Websites & Apps
          </button>
        </div>
      </div>

      <div className="relative z-10 mt-auto hidden md:block">
        <div className="rounded-xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.55)] p-4">
          <Sparkles size={16} className="text-[hsl(var(--sidebar-primary))]" />
          <p className="mt-3 text-[13px] leading-5 text-[hsl(var(--sidebar-foreground)/.72)]">
            One ding for every reminder. Small rituals tuned to your day.
          </p>
        </div>
        <div className="mono-label mt-7 text-[hsl(var(--sidebar-foreground)/.36)]">Buzzer · v2.0</div>
      </div>
    </aside>
  );
}

function AlarmToggle({ enabled, onToggle, id }: { enabled: boolean; onToggle: () => void; id: string }) {
  return (
    <button
      type="button"
      aria-label={enabled ? 'Pause alarm' : 'Enable alarm'}
      aria-pressed={enabled}
      onClick={onToggle}
      data-testid={`button-toggle-alarm-${id}`}
      className={`toggle-track shrink-0 ${enabled ? 'is-on' : ''}`}
    >
      <span className="toggle-knob block" />
    </button>
  );
}

function AlarmRow({
  alarm,
  onToggle,
  onEdit,
  onDelete,
}: {
  alarm: Alarm;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={`alarm-row group flex items-center gap-4 border-b border-[hsl(var(--border)/.7)] py-5 transition-all duration-200 last:border-b-0 ${
        alarm.enabled ? '' : 'opacity-60'
      }`}
      data-testid={`card-alarm-${alarm.id}`}
    >
      <div className="h-11 w-1 shrink-0 rounded-full" style={{ backgroundColor: alarm.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="truncate text-[15px] font-extrabold tracking-[-0.02em]" data-testid={`text-alarm-label-${alarm.id}`}>
            {alarm.label || 'Untitled ritual'}
          </h3>
          <span className="mono-label text-[hsl(var(--muted-foreground))]">{scheduleLabel(alarm.days)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-[hsl(var(--muted-foreground))]">
          <span className="inline-flex items-center gap-1.5">
            <Volume2 size={13} /> {alarm.sound} ({alarm.dingCount ?? 1} ding{(alarm.dingCount ?? 1) > 1 ? 's' : ''})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={13} /> {alarm.snooze} min snooze
          </span>
          {alarm.note && <span className="hidden max-w-[220px] truncate lg:inline">{alarm.note}</span>}
        </div>
      </div>
      <div className="hidden items-baseline gap-1.5 sm:flex">
        <span className="display-font text-[27px] font-semibold leading-none tracking-[-0.04em]" data-testid={`text-alarm-time-${alarm.id}`}>
          {displayTime(alarm)}
        </span>
        <span className="mono-label text-[hsl(var(--muted-foreground))]">{alarm.meridiem}</span>
      </div>
      <div className="flex items-center gap-1.5 pl-1">
        <AlarmToggle enabled={alarm.enabled} onToggle={onToggle} id={alarm.id} />
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${alarm.label}`}
          title="Edit alarm"
          className="quiet-button h-9 w-9"
          data-testid={`button-edit-alarm-${alarm.id}`}
        >
          <Edit3 size={15} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${alarm.label}`}
          title="Delete alarm"
          className="quiet-button h-9 w-9 hover:!text-[hsl(var(--destructive))]"
          data-testid={`button-delete-alarm-${alarm.id}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

function AlarmModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Alarm | null;
  onClose: () => void;
  onSave: (alarm: Alarm) => void;
}) {
  const [form, setForm] = useState<Alarm>(() => initial ?? makeDefaultAlarm());
  const isEditing = Boolean(initial);

  useEffect(() => {
    setForm(initial ?? makeDefaultAlarm());
  }, [initial]);

  const update = <K extends keyof Alarm>(key: K, value: Alarm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleDay = (day: string) => {
    setForm((current) => ({
      ...current,
      days: current.days.includes(day) ? current.days.filter((item) => item !== day) : [...current.days, day],
    }));
  };

  const handleTestSound = () => {
    playSound(form.sound, form.dingCount ?? 1);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.label.trim() || !form.time || form.days.length === 0) return;
    onSave({ ...form, label: form.label.trim(), note: form.note?.trim() });
  };

  return (
    <div
      className="scrim fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card max-h-[94dvh] w-full overflow-y-auto rounded-t-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl sm:max-w-[560px] sm:rounded-[18px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alarm-modal-title"
      >
        <div className="flex items-start justify-between border-b border-[hsl(var(--border)/.7)] px-5 py-5 sm:px-7">
          <div>
            <div className="mono-label text-[hsl(var(--accent))]">{isEditing ? 'Refine a ritual' : 'Make room for one more'}</div>
            <h2 id="alarm-modal-title" className="display-font mt-1 text-[27px] font-semibold tracking-[-0.04em]">
              {isEditing ? 'Edit alarm' : 'New alarm'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close alarm form"
            className="quiet-button h-9 w-9"
            data-testid="button-close-alarm-modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-6 px-5 py-6 sm:px-7">
          <div className="grid gap-5 sm:grid-cols-[1fr_150px]">
            <label className="block">
              <span className="mono-label text-[hsl(var(--muted-foreground))]">Label</span>
              <input
                autoFocus
                value={form.label}
                onChange={(event) => update('label', event.target.value)}
                placeholder="e.g. Call Mum or Check oven"
                className="soft-input mt-2"
                data-testid="input-alarm-label"
                required
              />
            </label>
            <label className="block">
              <span className="mono-label text-[hsl(var(--muted-foreground))]">Time</span>
              <input
                type="time"
                value={toInputTime(form)}
                onChange={(event) => {
                  const next = fromInputTime(event.target.value);
                  setForm((current) => ({ ...current, ...next }));
                }}
                className="soft-input mt-2"
                data-testid="input-alarm-time"
                required
              />
            </label>
          </div>

          <fieldset>
            <legend className="mono-label text-[hsl(var(--muted-foreground))]">Repeat on</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {dayKeys.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`day-chip ${form.days.includes(day) ? 'is-selected' : ''}`}
                  aria-pressed={form.days.includes(day)}
                  data-testid={`button-day-${day}`}
                >
                  {dayLetters[index]}
                </button>
              ))}
            </div>
            {form.days.length === 0 && <p className="mt-2 text-xs text-[hsl(var(--destructive))]">Choose at least one day.</p>}
          </fieldset>

          <div>
            <div className="mono-label text-[hsl(var(--muted-foreground))]">Color note</div>
            <div className="mt-3 flex items-center gap-3">
              {palette.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => update('color', color)}
                  aria-label={`Choose color ${color}`}
                  className={`color-swatch ${form.color === color ? 'is-selected' : ''}`}
                  style={{ backgroundColor: color }}
                  data-testid={`button-color-${color.replace('#', '')}`}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <label className="block col-span-2">
              <div className="flex items-center justify-between">
                <span className="mono-label text-[hsl(var(--muted-foreground))]">Sound Style</span>
                <button
                  type="button"
                  onClick={handleTestSound}
                  className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  <Volume2 size={12} /> Test Sound
                </button>
              </div>
              <div className="relative mt-2">
                <select
                  value={form.sound}
                  onChange={(event) => update('sound', event.target.value)}
                  className="soft-input appearance-none pr-9 bg-white"
                  data-testid="select-alarm-sound"
                >
                  <option>Soft chimes</option>
                  <option>Woodland</option>
                  <option>Low tide</option>
                  <option>Night air</option>
                  <option>Single Ding</option>
                  <option>Multi-Ding (Urgent)</option>
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-[hsl(var(--muted-foreground))]" />
              </div>
            </label>

            <label className="block">
              <span className="mono-label text-[hsl(var(--muted-foreground))]">Dings</span>
              <div className="relative mt-2">
                <select
                  value={form.dingCount ?? 1}
                  onChange={(event) => update('dingCount', Number(event.target.value))}
                  className="soft-input appearance-none pr-9 bg-white"
                >
                  <option value={1}>1 ding</option>
                  <option value={2}>2 dings</option>
                  <option value={3}>3 dings</option>
                  <option value={4}>4 dings</option>
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-[hsl(var(--muted-foreground))]" />
              </div>
            </label>
          </div>

          <label className="block">
            <span className="mono-label text-[hsl(var(--muted-foreground))]">
              Snooze length
            </span>
            <div className="relative mt-2">
              <select
                value={form.snooze}
                onChange={(event) => update('snooze', Number(event.target.value))}
                className="soft-input appearance-none pr-9 bg-white"
                data-testid="select-alarm-snooze"
              >
                <option value={5}>5 minutes</option>
                <option value={9}>9 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={20}>20 minutes</option>
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-[hsl(var(--muted-foreground))]" />
            </div>
          </label>

          <label className="block">
            <span className="mono-label text-[hsl(var(--muted-foreground))]">
              Note details <span className="normal-case tracking-normal opacity-60">(notification note)</span>
            </span>
            <textarea
              value={form.note ?? ''}
              onChange={(event) => update('note', event.target.value)}
              placeholder="1 ding and popup note for what to remember..."
              rows={2}
              className="soft-input mt-2 resize-none"
              data-testid="textarea-alarm-note"
            />
          </label>

          <div className="flex flex-col-reverse gap-2 border-t border-[hsl(var(--border)/.7)] pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="quiet-button min-h-11 px-4" data-testid="button-cancel-alarm">
              Cancel
            </button>
            <button type="submit" className="primary-button min-h-11 px-5" data-testid="button-save-alarm">
              <Check size={15} /> {isEditing ? 'Save changes' : 'Add alarm'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function HomeChatWidget({ onOpenChat }: { onOpenChat: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHistory(4)
      .then((history) => {
        if (!cancelled) {
          setMessages(history.slice(-4));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const now = new Date().toISOString();
    const optimistic: Message = {
      id: `home-chat-${Date.now()}`,
      role: 'user',
      content: text,
      sessionDate: now.split('T')[0]!,
      createdAt: now,
    };

    setInput('');
    setError(null);
    setSending(true);
    setMessages((current) => [...current.slice(-3), optimistic]);

    const websiteQuery = parseOpenWebsiteCommand(text);
    if (websiteQuery) {
      const site = findWebsiteShortcut(websiteQuery);
      const assistantMessage: Message = {
        id: `home-chat-reply-${Date.now()}`,
        role: 'assistant',
        content: site
          ? `Opening ${site.title}.`
          : `I couldn't find "${websiteQuery}" in your website shortcuts.`,
        sessionDate: now.split('T')[0]!,
        createdAt: new Date().toISOString(),
      };

      setMessages((current) => [...current.slice(-3), assistantMessage]);
      setSending(false);
      if (site) {
        void openExternalUrl(site.url);
      }
      return;
    }

    try {
      const { reply } = await sendMessage(text);
      const assistantMessage: Message = {
        id: `home-chat-reply-${Date.now()}`,
        role: 'assistant',
        content: reply,
        sessionDate: now.split('T')[0]!,
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => [...current.slice(-3), assistantMessage]);
    } catch (err) {
      setError((err as Error).message ?? 'Could not send message');
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="col-span-2 rounded-[15px] border border-[hsl(var(--border))] bg-[hsl(var(--card)/.7)] p-4" aria-labelledby="home-chat-title">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mono-label text-[hsl(var(--accent))]">Marcus chat</div>
          <h2 id="home-chat-title" className="mt-1 text-sm font-extrabold text-[hsl(var(--foreground))]">Ask from home</h2>
        </div>
        <button type="button" onClick={onOpenChat} className="quiet-button h-9 px-3 text-xs" data-testid="button-open-full-chat">
          <MessageCircle size={14} /> Full chat
        </button>
      </div>

      <div className="mt-3 flex max-h-44 flex-col gap-2 overflow-y-auto rounded-[12px] bg-white/55 p-2">
        {messages.length > 0 ? (
          messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[92%] rounded-[12px] px-3 py-2 text-xs leading-5 ${
                message.role === 'user'
                  ? 'ml-auto bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'mr-auto border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]'
              }`}
            >
              {message.content}
            </div>
          ))
        ) : (
          <div className="rounded-[12px] border border-dashed border-[hsl(var(--border))] px-3 py-5 text-center text-xs text-[hsl(var(--muted-foreground))]">
            No chat yet. Send Marcus a quick note.
          </div>
        )}
      </div>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Message Marcus"
          className="soft-input h-10 text-sm"
          data-testid="input-home-chat"
          disabled={sending}
        />
        <button type="submit" className="primary-button h-10 w-10 shrink-0 px-0" disabled={!input.trim() || sending} aria-label="Send message">
          <Send size={15} />
        </button>
      </form>
      {error && <p className="mt-2 text-xs font-semibold text-[hsl(var(--destructive))]">{error}</p>}
    </section>
  );
}

function Home() {
  const [alarms, setAlarms] = useState<Alarm[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Alarm[]) : initialAlarms;
    } catch {
      return initialAlarms;
    }
  });

  const [activeTab, setActiveTab] = useState<NavTab>('alarms');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [modalAlarm, setModalAlarm] = useState<Alarm | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const nativeApp = isNativeApp();

  // Notification & Audio permission state
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>(() => getNotificationPermissionState());
  const notifGranted = permissionStatus === 'granted';
  const [serverPushStatus, setServerPushStatus] = useState<ServerPushStatus>('unknown');
  const [nativeAlarmStatus, setNativeAlarmStatus] = useState<NativeAlarmStatus>(() => (isNativeApp() ? 'unknown' : 'browser'));
  const [pushTestMessage, setPushTestMessage] = useState<string | null>(null);
  const shouldShowNotificationBanner = nativeApp
    ? nativeAlarmStatus !== 'ready'
    : !notifGranted || ['server_not_configured', 'unsupported', 'sync_error'].includes(serverPushStatus);
  const notificationBannerMessage =
    nativeApp && nativeAlarmStatus === 'permission_not_granted'
      ? 'Android notification or exact alarm permission is still off. Enable it so Buzzer can ring outside the app.'
      : nativeApp && nativeAlarmStatus === 'sync_error'
      ? 'Buzzer could not schedule Android alarms. Try enabling native alarms again.'
      : nativeApp
      ? 'Enable Android notifications and exact alarms so Buzzer can ring outside the app.'
      : permissionStatus === 'denied'
      ? 'Notifications are blocked for this site. Browser popups still show while Buzzer is open.'
      : permissionStatus === 'unsupported'
      ? 'This browser does not support notifications. Buzzer popups still show while the app is open.'
      : serverPushStatus === 'server_not_configured'
      ? 'Browser notifications are allowed, but Railway push needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to work while Buzzer is closed.'
      : serverPushStatus === 'unsupported'
      ? 'This browser cannot use closed-tab push notifications. Buzzer still works while it is open.'
      : serverPushStatus === 'sync_error'
      ? 'Buzzer could not sync alarms to the server. Closed-tab notifications may not fire until the API is reachable.'
      : 'Enable Browser Notifications & Audio to hear dings when your reminders trigger.';

  // Ringing alarm overlay state
  const [ringingAlarm, setRingingAlarm] = useState<Alarm | null>(null);
  const triggeredMinuteKeys = useRef<Set<string>>(new Set());
  const lastAlarmSweep = useRef<Date | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
    syncAlarmsForServerPush(alarms)
      .then(() => setServerPushStatus((status) => (status === 'sync_error' ? 'unknown' : status)))
      .catch(() => setServerPushStatus('sync_error'));
    syncNativeAlarms(alarms)
      .then(() => setNativeAlarmStatus((status) => (status === 'sync_error' ? 'ready' : status)))
      .catch(() => setNativeAlarmStatus('sync_error'));
  }, [alarms]);

  useEffect(() => {
    const applyLaunchTarget = (url: string) => {
      if (url.includes('tab=marcus') || url.includes('buzzer://chat')) {
        setActiveTab('marcus');
      }
    };

    applyLaunchTarget(window.location.href);
    let cancelled = false;

    CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      if (!cancelled) {
        applyLaunchTarget(url);
      }
    }).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  // Request Notification & unlock Audio
  const ensureAlarmPermissions = async () => {
    unlockAudio();
    if (nativeApp) {
      const nativeGranted = await requestNativeAlarmPermissions().catch(() => false);
      setNativeAlarmStatus(nativeGranted ? 'ready' : 'permission_not_granted');
      return nativeGranted;
    }

    const granted = await requestNotificationPermission();
    setPermissionStatus(getNotificationPermissionState());
    const pushResult = await registerServerPush().catch(() => ({ enabled: false, reason: 'sync_error' as const }));
    setServerPushStatus(pushResult.enabled ? 'ready' : pushResult.reason ?? 'sync_error');
    return granted;
  };

  const handleEnablePermissions = async () => {
    await ensureAlarmPermissions();
  };

  const handleTestPush = async () => {
    setPushTestMessage(null);
    if (nativeApp) {
      const sent = await sendNativeTestNotification().catch(() => false);
      setNativeAlarmStatus(sent ? 'ready' : 'permission_not_granted');
      setPushTestMessage(sent ? 'Native test notification scheduled.' : 'Android notification or exact alarm permission is not enabled yet.');
      return;
    }

    const pushResult = await registerServerPush().catch(() => ({ enabled: false, reason: 'sync_error' as const }));
    setServerPushStatus(pushResult.enabled ? 'ready' : pushResult.reason ?? 'sync_error');

    if (!pushResult.enabled) {
      setPushTestMessage('Server push is not ready yet.');
      return;
    }

    const result = await sendTestPush(getDeviceId()).catch(() => null);
    setPushTestMessage(
      result && result.sent > 0
        ? 'Test push sent. You should see a system notification.'
        : 'No push was sent. Check that this device is subscribed and Railway has VAPID keys.',
    );
  };

  // Real-time Alarm Check Clock Loop (runs every 1 sec)
  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      const day = todayKey();
      const previousSweep = lastAlarmSweep.current ?? new Date(now.getTime() - 60_000);
      lastAlarmSweep.current = now;

      alarms.forEach((alarm) => {
        if (!alarm.enabled || !alarm.days.includes(day)) return;

        const scheduledForToday = alarmDateForToday(alarm, now);
        const triggerId = `${alarm.id}-${scheduledForToday.toISOString()}`;
        const isDue =
          scheduledForToday.getTime() <= now.getTime() &&
          scheduledForToday.getTime() > previousSweep.getTime() &&
          !triggeredMinuteKeys.current.has(triggerId);

        if (!isDue) return;

        triggeredMinuteKeys.current.add(triggerId);
        playSound(alarm.sound, alarm.dingCount ?? 1);
        void sendAlarmNotification(alarm.label || 'Alarm Ding!', {
          body: alarm.note || `Time: ${alarm.time} ${alarm.meridiem}`,
        });
        setRingingAlarm(alarm);
      });
    };

    checkAlarms();
    const timer = setInterval(() => {
      checkAlarms();
    }, 1000);

    return () => clearInterval(timer);
  }, [alarms]);

  const nextAlarm = useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const today = todayKey();
    const todayAlarms = alarms.filter((alarm) => alarm.enabled && alarm.days.includes(today));
    const afterNow = todayAlarms
      .filter((alarm) => timeToMinutes(alarm) >= currentMinutes)
      .sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    return afterNow[0] ?? [...alarms].filter((alarm) => alarm.enabled).sort((a, b) => timeToMinutes(a) - timeToMinutes(b))[0];
  }, [alarms]);

  const visibleAlarms = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return alarms
      .filter((alarm) => filter === 'all' || (filter === 'active' ? alarm.enabled : !alarm.enabled))
      .filter((alarm) => !normalized || [alarm.label, alarm.note, alarm.sound].some((field) => field?.toLowerCase().includes(normalized)))
      .sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  }, [alarms, filter, query]);

  const activeCount = alarms.filter((alarm) => alarm.enabled).length;
  const averageSnooze = alarms.length ? Math.round(alarms.reduce((sum, alarm) => sum + alarm.snooze, 0) / alarms.length) : 0;

  const toggleAlarm = (id: string) => {
    const alarm = alarms.find((item) => item.id === id);
    if (alarm && !alarm.enabled) {
      void ensureAlarmPermissions();
      void scheduleNativeAlarm({ ...alarm, enabled: true }).catch(() => setNativeAlarmStatus('sync_error'));
    }
    if (alarm && alarm.enabled) {
      void cancelNativeAlarm(alarm).catch(() => setNativeAlarmStatus('sync_error'));
    }
    setAlarms((current) => current.map((alarm) => (alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm)));
  };

  const saveAlarm = (alarm: Alarm) => {
    if (alarm.enabled) {
      void ensureAlarmPermissions();
      void scheduleNativeAlarm(alarm).catch(() => setNativeAlarmStatus('sync_error'));
    }
    setAlarms((current) =>
      current.some((item) => item.id === alarm.id) ? current.map((item) => (item.id === alarm.id ? alarm : item)) : [...current, alarm],
    );
    setModalAlarm(null);
    setIsAdding(false);
  };

  const deleteAlarm = (alarm: Alarm) => {
    if (window.confirm(`Remove “${alarm.label || 'Untitled ritual'}”?`)) {
      void cancelNativeAlarm(alarm).catch(() => setNativeAlarmStatus('sync_error'));
      setAlarms((current) => current.filter((item) => item.id !== alarm.id));
    }
  };

  const openAdd = () => {
    setModalAlarm(null);
    setIsAdding(true);
    setMenuOpen(false);
  };

  const handleSnooze = () => {
    if (ringingAlarm) {
      // Add snooze minutes
      const snoozeMinutes = ringingAlarm.snooze || 5;
      const now = new Date();
      now.setMinutes(now.getMinutes() + snoozeMinutes);
      let hour = now.getHours();
      const meridiem: 'AM' | 'PM' = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12 || 12;
      const minStr = String(now.getMinutes()).padStart(2, '0');

      const snoozedAlarm: Alarm = {
        ...ringingAlarm,
        id: `snooze-${Date.now()}`,
        time: `${hour}:${minStr}`,
        meridiem,
        enabled: true,
      };

      setAlarms((prev) => [snoozedAlarm, ...prev]);
      setRingingAlarm(null);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="main-canvas">
        {/* Permission Request Banner */}
        {shouldShowNotificationBanner && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-amber-900 shadow-sm">
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              <VolumeX size={18} className="text-amber-600 shrink-0" />
              <span>{notificationBannerMessage}</span>
            </div>
            {(nativeApp || (permissionStatus !== 'denied' && permissionStatus !== 'unsupported')) && (
              <div className="flex flex-wrap items-center gap-2">
                {(nativeApp || serverPushStatus !== 'server_not_configured') && (
                  <button
                    type="button"
                    onClick={handleEnablePermissions}
                    className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors shrink-0"
                  >
                    {nativeApp ? 'Enable Native Alarms' : 'Enable Notifications & Sounds'}
                  </button>
                )}
                {(nativeApp || serverPushStatus === 'ready') && (
                  <button
                    type="button"
                    onClick={handleTestPush}
                    className="rounded-xl border border-amber-600/30 bg-white/70 px-3.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-white transition-colors shrink-0"
                  >
                    {nativeApp ? 'Test Native Alarm' : 'Test Push'}
                  </button>
                )}
              </div>
            )}
            {pushTestMessage && <div className="basis-full text-xs font-semibold text-amber-800">{pushTestMessage}</div>}
          </div>
        )}

        {/* Top Header */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="mono-label text-[hsl(var(--accent))]" data-testid="text-date">
              {formatToday()}
            </div>
            <h1 className="display-font mt-2 text-[clamp(2rem,4vw,3.35rem)] font-semibold leading-[1.03] tracking-[-0.055em]" data-testid="text-page-title">
              {activeTab === 'alarms' ? (
                <>
                  Make time for <em className="not-italic text-[hsl(var(--accent))]">what matters.</em>
                </>
              ) : activeTab === 'marcus' ? (
                'Marcus AI Assistant'
              ) : (
                'Websites & Apps'
              )}
            </h1>
            <p className="mt-3 max-w-[520px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              {activeTab === 'alarms'
                ? 'Your reminders & dings, tuned to the shape of your day.'
                : activeTab === 'marcus'
                ? 'Marcus takes your notes and organizes your reminders & action items.'
                : 'Desktop & mobile shortcuts for your favorite web apps.'}
            </p>
          </div>

          {/* Navigation Bar & Mobile Drawer Button */}
          <div className="flex items-center gap-2">
            {/* Desktop Quick Nav Tabs */}
            <div className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('alarms')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  activeTab === 'alarms' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🔔 Alarms
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('marcus')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  activeTab === 'marcus' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Marcus Chat
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('websites')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  activeTab === 'websites' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🌐 Websites
              </button>
            </div>

            <div className="relative md:hidden">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                aria-label="Open menu drawer"
                className="quiet-button h-10 w-10 border border-[hsl(var(--border))]"
                data-testid="button-mobile-menu"
              >
                <Menu size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('alarms');
                      setMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${
                      activeTab === 'alarms' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100'
                    }`}
                  >
                    <BellRing size={16} /> Alarms Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('marcus');
                      setMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${
                      activeTab === 'marcus' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100'
                    }`}
                  >
                    <Bot size={16} /> Marcus Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('websites');
                      setMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${
                      activeTab === 'websites' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100'
                    }`}
                  >
                    <Globe size={16} /> Websites & Web Apps
                  </button>

                  <div className="my-1.5 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={openAdd}
                    className="flex w-full items-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-left text-sm font-bold text-white hover:bg-blue-700"
                    data-testid="button-mobile-add"
                  >
                    <Plus size={16} /> Add an Alarm
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Tab Content Views */}
        {activeTab === 'marcus' && (
          <div className="mt-6 h-[80vh] rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <AiChatBox />
          </div>
        )}

        {activeTab === 'websites' && (
          <div className="mt-6">
            <WebsitesView />
          </div>
        )}

        {activeTab === 'alarms' && (
          <>
            <section className="mt-9 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.8fr)]">
              <div className="relative overflow-hidden rounded-[18px] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-lg sm:p-8">
                <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[30px] border-[hsl(var(--sidebar-primary)/.2)]" />
                <div className="relative z-10">
                  <div className="mono-label text-[hsl(var(--primary-foreground)/.6)]">Up next</div>
                  {nextAlarm ? (
                    <>
                      <div className="mt-4 flex flex-wrap items-baseline gap-3">
                        <span className="display-font text-[clamp(3.5rem,8vw,6.2rem)] font-semibold leading-[.82] tracking-[-0.08em]" data-testid="text-next-alarm-time">
                          {displayTime(nextAlarm)}
                        </span>
                        <span className="display-font text-2xl font-semibold opacity-70" data-testid="text-next-alarm-meridiem">
                          {nextAlarm.meridiem}
                        </span>
                      </div>
                      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="text-[15px] font-extrabold" data-testid="text-next-alarm-label">
                          {nextAlarm.label}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-[hsl(var(--sidebar-primary))]" />
                        <span className="text-[13px] text-[hsl(var(--primary-foreground)/.6)]">{scheduleLabel(nextAlarm.days)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-5">
                      <div className="display-font text-4xl font-semibold tracking-[-0.05em]" data-testid="text-no-next-alarm">
                        Nothing pending
                      </div>
                      <p className="mt-3 max-w-[320px] text-sm leading-5 text-[hsl(var(--primary-foreground)/.62)]">
                        Your slate is quiet. Add a small ritual when you are ready.
                      </p>
                    </div>
                  )}
                  <div className="mt-8 flex items-center gap-2 text-xs text-[hsl(var(--primary-foreground)/.56)]">
                    <SunMedium size={15} /> A gentle start, whenever you need it.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[15px] border border-[hsl(var(--border))] bg-[hsl(var(--card)/.58)] p-5">
                  <div className="flex items-center justify-between">
                    <Flame size={17} className="text-[hsl(var(--accent))]" />
                    <span className="mono-label text-[hsl(var(--muted-foreground))]">active</span>
                  </div>
                  <div className="display-font mt-7 text-[40px] font-semibold leading-none tracking-[-0.06em]" data-testid="text-active-count">
                    {activeCount}
                  </div>
                  <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">of {alarms.length} rituals</div>
                </div>
                <div className="rounded-[15px] border border-[hsl(var(--border))] bg-[hsl(var(--card)/.58)] p-5">
                  <div className="flex items-center justify-between">
                    <Moon size={17} className="text-[hsl(var(--chart-3))]" />
                    <span className="mono-label text-[hsl(var(--muted-foreground))]">snooze</span>
                  </div>
                  <div className="display-font mt-7 text-[40px] font-semibold leading-none tracking-[-0.06em]" data-testid="text-average-snooze">
                    {averageSnooze}
                    <span className="ml-1 text-base tracking-normal">m</span>
                  </div>
                  <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">your average</div>
                </div>
                <div className="col-span-2 flex flex-col gap-4 rounded-[15px] border border-[hsl(var(--border))] bg-[hsl(var(--accent)/.12)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="mono-label text-[hsl(var(--accent))]">A tiny promise</div>
                    <p className="mt-1 text-sm font-bold">Keep the morning yours.</p>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      Closed-tab push: {serverPushStatus === 'ready' ? 'ready' : serverPushStatus.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      Native alarms: {nativeAlarmStatus === 'browser' ? 'web mode' : nativeAlarmStatus.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    {nativeApp && nativeAlarmStatus === 'ready' ? (
                      <button type="button" onClick={handleTestPush} className="quiet-button h-9 px-3 text-xs">
                        Test Native
                      </button>
                    ) : nativeApp ? (
                      <button type="button" onClick={handleEnablePermissions} className="quiet-button h-9 px-3 text-xs">
                        Enable Native
                      </button>
                    ) : serverPushStatus === 'ready' ? (
                      <button type="button" onClick={handleTestPush} className="quiet-button h-9 px-3 text-xs">
                        Test Push
                      </button>
                    ) : (
                      <button type="button" onClick={handleEnablePermissions} className="quiet-button h-9 px-3 text-xs">
                        Enable Push
                      </button>
                    )}
                    {pushTestMessage && <span className="max-w-[180px] text-right text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">{pushTestMessage}</span>}
                  </div>
                </div>
                <div className="col-span-2 flex flex-col gap-4 rounded-[15px] border border-[hsl(var(--border))] bg-[hsl(var(--card)/.74)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="mono-label text-[hsl(var(--accent))]">Android app</div>
                    <p className="mt-1 text-sm font-bold">Install Buzzer on your phone.</p>
                    <p className="mt-1 max-w-[360px] text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                      Includes native alarm notifications and the Marcus home-screen widget.
                    </p>
                  </div>
                  <a href="/downloads/buzzer-debug.apk" download className="primary-button min-h-11 px-4 text-sm" data-testid="link-download-android-apk">
                    <Download size={16} /> Download Android APK
                  </a>
                </div>
                <HomeChatWidget onOpenChat={() => setActiveTab('marcus')} />
              </div>
            </section>

            <section className="mt-12" aria-labelledby="alarm-list-title">
              <div className="flex flex-col justify-between gap-4 border-b border-[hsl(var(--border))] pb-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mono-label text-[hsl(var(--accent))]">Your collection</div>
                  <h2 id="alarm-list-title" className="display-font mt-1 text-[30px] font-semibold tracking-[-0.045em]">
                    All alarms
                  </h2>
                </div>
                <button type="button" onClick={openAdd} className="primary-button min-h-10 self-start px-4 sm:self-auto" data-testid="button-add-alarm">
                  <Plus size={16} /> Add alarm
                </button>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-[hsl(var(--secondary)/.65)] p-1">
                  {(['all', 'active', 'paused'] as Filter[]).map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setFilter(item)}
                      className={`rounded-md px-3 py-1.5 text-xs font-extrabold capitalize transition-colors ${
                        filter === item ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'
                      }`}
                      data-testid={`button-filter-${item}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <label className="relative block w-full sm:max-w-[245px]">
                  <Search size={15} className="pointer-events-none absolute left-3 top-3 text-[hsl(var(--muted-foreground))]" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search your rituals"
                    className="soft-input h-10 pl-9"
                    aria-label="Search alarms"
                    data-testid="input-search-alarms"
                  />
                </label>
              </div>

              <div className="mt-3">
                {visibleAlarms.length > 0 ? (
                  visibleAlarms.map((alarm, index) => (
                    <div key={alarm.id} style={{ animationDelay: `${index * 45}ms` }}>
                      <AlarmRow alarm={alarm} onToggle={() => toggleAlarm(alarm.id)} onEdit={() => setModalAlarm(alarm)} onDelete={() => deleteAlarm(alarm)} />
                    </div>
                  ))
                ) : (
                  <div className="my-8 rounded-[16px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.4)] px-6 py-14 text-center" data-testid="empty-alarm-state">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--accent)/.14)] text-[hsl(var(--accent))]">
                      <AlarmClock size={21} />
                    </div>
                    <h3 className="display-font mt-5 text-[25px] font-semibold tracking-[-0.04em]">
                      {alarms.length === 0 ? 'A quiet little blank slate' : 'No alarms match that'}
                    </h3>
                    <p className="mx-auto mt-2 max-w-[350px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                      {alarms.length === 0 ? 'Add your first ritual and give tomorrow a softer edge.' : 'Try a different word or clear the filter to find your alarms.'}
                    </p>
                    {alarms.length === 0 && (
                      <button type="button" onClick={openAdd} className="primary-button mt-6 min-h-10 px-4" data-testid="button-empty-add-alarm">
                        <Plus size={16} /> Add your first alarm
                      </button>
                    )}
                    {alarms.length > 0 && (
                      <button type="button" onClick={() => { setQuery(''); setFilter('all'); }} className="quiet-button mt-5 px-4 py-2" data-testid="button-clear-alarm-filters">
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        <footer className="mt-12 flex items-center justify-between border-t border-[hsl(var(--border)/.7)] pt-4 text-[11px] text-[hsl(var(--muted-foreground))]">
          <span>Changes save automatically on this device.</span>
          <span className="mono-label hidden sm:block">made for gentler mornings</span>
        </footer>
      </main>

      {(isAdding || modalAlarm) && <AlarmModal initial={modalAlarm} onClose={() => { setModalAlarm(null); setIsAdding(false); }} onSave={saveAlarm} />}

      {/* Ringing Alarm Alert Overlay Modal */}
      {ringingAlarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center border border-blue-100">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 animate-bounce">
              <BellRing size={32} />
            </div>

            <h2 className="mt-4 text-2xl font-extrabold text-slate-900">{ringingAlarm.label || 'Alarm Reminder'}</h2>
            <p className="mt-1 text-3xl font-black text-blue-600">
              {ringingAlarm.time} {ringingAlarm.meridiem}
            </p>

            {ringingAlarm.note && (
              <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
                📝 {ringingAlarm.note}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setRingingAlarm(null)}
                className="w-full rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 shadow-md transition-colors"
              >
                Dismiss Alarm
              </button>
              <button
                type="button"
                onClick={handleSnooze}
                className="w-full rounded-2xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Snooze (+{ringingAlarm.snooze || 5} min)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
