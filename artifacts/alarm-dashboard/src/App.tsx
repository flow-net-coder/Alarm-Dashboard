import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  AlarmClock,
  BellRing,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Edit3,
  Flame,
  Menu,
  Moon,
  Plus,
  Search,
  Sparkles,
  SunMedium,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

type Alarm = {
  id: string;
  label: string;
  time: string;
  meridiem: 'AM' | 'PM';
  days: string[];
  color: string;
  enabled: boolean;
  snooze: number;
  sound: string;
  note?: string;
};

type Filter = 'all' | 'active' | 'paused';

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
    note: 'A gentle nudge toward tomorrow.',
  },
  {
    id: 'call-mum',
    label: 'Call Mum',
    time: '8:00',
    meridiem: 'PM',
    days: ['su'],
    color: '#D6AE55',
    enabled: false,
    snooze: 5,
    sound: 'Soft chimes',
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

function Sidebar() {
  return (
    <aside className="sidebar flex flex-col px-7 py-8 md:px-6" data-testid="sidebar">
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] shadow-lg">
          <AlarmClock size={21} strokeWidth={2.2} />
        </div>
        <div>
          <div className="display-font text-[19px] leading-none tracking-[-0.03em]">Daymark</div>
          <div className="mono-label mt-1 text-[hsl(var(--sidebar-foreground)/.52)]">personal timekeeper</div>
        </div>
      </div>

      <div className="relative z-10 mt-14 hidden md:block">
        <div className="mono-label text-[hsl(var(--sidebar-foreground)/.42)]">Your rhythm</div>
        <div className="mt-4 space-y-1">
          <div className="flex items-center gap-3 rounded-lg bg-[hsl(var(--sidebar-accent))] px-3 py-2.5 text-sm font-bold">
            <BellRing size={16} className="text-[hsl(var(--sidebar-primary))]" />
            Alarms
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5 text-sm text-[hsl(var(--sidebar-foreground)/.55)]">
            <CalendarDaysIcon />
            Today
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-auto hidden md:block">
        <div className="rounded-xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.55)] p-4">
          <Sparkles size={16} className="text-[hsl(var(--sidebar-primary))]" />
          <p className="mt-3 text-[13px] leading-5 text-[hsl(var(--sidebar-foreground)/.72)]">
            Small rituals add up to a day that feels like yours.
          </p>
        </div>
        <div className="mono-label mt-7 text-[hsl(var(--sidebar-foreground)/.36)]">Local & private · v1.0</div>
      </div>
    </aside>
  );
}

function CalendarDaysIcon() {
  return <CalendarGlyph />;
}

function CalendarGlyph() {
  return <CalendarDays size={16} />;
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
      className={`alarm-row group flex items-center gap-4 border-b border-[hsl(var(--border)/.7)] py-5 transition-all duration-200 last:border-b-0 ${alarm.enabled ? '' : 'opacity-60'}`}
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
          <span className="inline-flex items-center gap-1.5"><Volume2 size={13} /> {alarm.sound}</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 size={13} /> {alarm.snooze} min snooze</span>
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
        <button type="button" onClick={onEdit} aria-label={`Edit ${alarm.label}`} title="Edit alarm" className="quiet-button h-9 w-9" data-testid={`button-edit-alarm-${alarm.id}`}>
          <Edit3 size={15} />
        </button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${alarm.label}`} title="Delete alarm" className="quiet-button h-9 w-9 hover:!text-[hsl(var(--destructive))]" data-testid={`button-delete-alarm-${alarm.id}`}>
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

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.label.trim() || !form.time || form.days.length === 0) return;
    onSave({ ...form, label: form.label.trim(), note: form.note?.trim() });
  };

  return (
    <div className="scrim fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card max-h-[94dvh] w-full overflow-y-auto rounded-t-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl sm:max-w-[560px] sm:rounded-[18px]" role="dialog" aria-modal="true" aria-labelledby="alarm-modal-title">
        <div className="flex items-start justify-between border-b border-[hsl(var(--border)/.7)] px-5 py-5 sm:px-7">
          <div>
            <div className="mono-label text-[hsl(var(--accent))]">{isEditing ? 'Refine a ritual' : 'Make room for one more'}</div>
            <h2 id="alarm-modal-title" className="display-font mt-1 text-[27px] font-semibold tracking-[-0.04em]">{isEditing ? 'Edit alarm' : 'New alarm'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close alarm form" className="quiet-button h-9 w-9" data-testid="button-close-alarm-modal"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="space-y-6 px-5 py-6 sm:px-7">
          <div className="grid gap-5 sm:grid-cols-[1fr_150px]">
            <label className="block">
              <span className="mono-label text-[hsl(var(--muted-foreground))]">Label</span>
              <input autoFocus value={form.label} onChange={(event) => update('label', event.target.value)} placeholder="e.g. Start softly" className="soft-input mt-2" data-testid="input-alarm-label" required />
            </label>
            <label className="block">
              <span className="mono-label text-[hsl(var(--muted-foreground))]">Time</span>
              <input type="time" value={toInputTime(form)} onChange={(event) => {
                const next = fromInputTime(event.target.value);
                setForm((current) => ({ ...current, ...next }));
              }} className="soft-input mt-2" data-testid="input-alarm-time" required />
            </label>
          </div>

          <fieldset>
            <legend className="mono-label text-[hsl(var(--muted-foreground))]">Repeats on</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {dayKeys.map((day, index) => (
                <button key={day} type="button" onClick={() => toggleDay(day)} className={`day-chip ${form.days.includes(day) ? 'is-selected' : ''}`} aria-pressed={form.days.includes(day)} data-testid={`button-day-${day}`}>
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
                <button key={color} type="button" onClick={() => update('color', color)} aria-label={`Choose color ${color}`} className={`color-swatch ${form.color === color ? 'is-selected' : ''}`} style={{ backgroundColor: color }} data-testid={`button-color-${color.replace('#', '')}`} />
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mono-label text-[hsl(var(--muted-foreground))]">Sound</span>
              <div className="relative mt-2">
                <select value={form.sound} onChange={(event) => update('sound', event.target.value)} className="soft-input appearance-none pr-9" data-testid="select-alarm-sound">
                  <option>Soft chimes</option>
                  <option>Woodland</option>
                  <option>Low tide</option>
                  <option>Night air</option>
                  <option>Morning birds</option>
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-[hsl(var(--muted-foreground))]" />
              </div>
            </label>
            <label className="block">
              <span className="mono-label text-[hsl(var(--muted-foreground))]">Snooze</span>
              <div className="relative mt-2">
                <select value={form.snooze} onChange={(event) => update('snooze', Number(event.target.value))} className="soft-input appearance-none pr-9" data-testid="select-alarm-snooze">
                  <option value={5}>5 minutes</option>
                  <option value={9}>9 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={20}>20 minutes</option>
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-[hsl(var(--muted-foreground))]" />
              </div>
            </label>
          </div>

          <label className="block">
            <span className="mono-label text-[hsl(var(--muted-foreground))]">A note for future you <span className="normal-case tracking-normal opacity-60">(optional)</span></span>
            <textarea value={form.note ?? ''} onChange={(event) => update('note', event.target.value)} placeholder="A little context makes a reminder kinder." rows={2} className="soft-input mt-2 resize-none" data-testid="textarea-alarm-note" />
          </label>

          <div className="flex flex-col-reverse gap-2 border-t border-[hsl(var(--border)/.7)] pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="quiet-button min-h-11 px-4" data-testid="button-cancel-alarm">Cancel</button>
            <button type="submit" className="primary-button min-h-11 px-5" data-testid="button-save-alarm"><Check size={15} /> {isEditing ? 'Save changes' : 'Add alarm'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Home() {
  const [alarms, setAlarms] = useState<Alarm[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) as Alarm[] : initialAlarms;
    } catch {
      return initialAlarms;
    }
  });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [modalAlarm, setModalAlarm] = useState<Alarm | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
  }, [alarms]);

  const nextAlarm = useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const today = todayKey();
    const todayAlarms = alarms.filter((alarm) => alarm.enabled && alarm.days.includes(today));
    const afterNow = todayAlarms.filter((alarm) => timeToMinutes(alarm) >= currentMinutes).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
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
    setAlarms((current) => current.map((alarm) => alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm));
  };

  const saveAlarm = (alarm: Alarm) => {
    setAlarms((current) => current.some((item) => item.id === alarm.id) ? current.map((item) => item.id === alarm.id ? alarm : item) : [...current, alarm]);
    setModalAlarm(null);
    setIsAdding(false);
  };

  const deleteAlarm = (alarm: Alarm) => {
    if (window.confirm(`Remove “${alarm.label || 'Untitled ritual'}”?`)) {
      setAlarms((current) => current.filter((item) => item.id !== alarm.id));
    }
  };

  const openAdd = () => {
    setModalAlarm(null);
    setIsAdding(true);
    setMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-canvas">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="mono-label text-[hsl(var(--accent))]" data-testid="text-date">{formatToday()}</div>
            <h1 className="display-font mt-2 text-[clamp(2rem,4vw,3.35rem)] font-semibold leading-[1.03] tracking-[-0.055em]" data-testid="text-page-title">
              Make time for <em className="not-italic text-[hsl(var(--accent))]">what matters.</em>
            </h1>
            <p className="mt-3 max-w-[520px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">Your alarms, tuned to the shape of your day.</p>
          </div>
          <div className="relative md:hidden">
            <button type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Open menu" className="quiet-button h-10 w-10 border border-[hsl(var(--border))]" data-testid="button-mobile-menu"><Menu size={18} /></button>
            {menuOpen && (
              <div className="absolute right-0 top-12 z-20 w-48 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-lg">
                <button type="button" onClick={openAdd} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-bold hover:bg-[hsl(var(--secondary))]" data-testid="button-mobile-add"><Plus size={16} /> Add an alarm</button>
              </div>
            )}
          </div>
        </header>

        <section className="mt-9 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.8fr)]">
          <div className="relative overflow-hidden rounded-[18px] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-lg sm:p-8">
            <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[30px] border-[hsl(var(--sidebar-primary)/.2)]" />
            <div className="absolute -bottom-24 right-20 h-44 w-44 rounded-full bg-[hsl(var(--accent)/.16)]" />
            <div className="relative">
              <div className="mono-label text-[hsl(var(--primary-foreground)/.6)]">Next up</div>
              {nextAlarm ? (
                <>
                  <div className="mt-5 flex items-end gap-3">
                    <span className="display-font text-[clamp(3.5rem,8vw,6.2rem)] font-semibold leading-[.82] tracking-[-0.08em]" data-testid="text-next-alarm-time">{displayTime(nextAlarm)}</span>
                    <span className="mono-label mb-1.5 text-[hsl(var(--primary-foreground)/.62)]">{nextAlarm.meridiem}</span>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-[15px] font-extrabold" data-testid="text-next-alarm-label">{nextAlarm.label}</span>
                    <span className="h-1 w-1 rounded-full bg-[hsl(var(--sidebar-primary))]" />
                    <span className="text-[13px] text-[hsl(var(--primary-foreground)/.6)]">{scheduleLabel(nextAlarm.days)}</span>
                  </div>
                </>
              ) : (
                <div className="mt-5">
                  <div className="display-font text-4xl font-semibold tracking-[-0.05em]" data-testid="text-no-next-alarm">Nothing pending</div>
                  <p className="mt-3 max-w-[320px] text-sm leading-5 text-[hsl(var(--primary-foreground)/.62)]">Your slate is quiet. Add a small ritual when you are ready.</p>
                </div>
              )}
              <div className="mt-8 flex items-center gap-2 text-xs text-[hsl(var(--primary-foreground)/.56)]">
                <SunMedium size={15} /> A gentle start, whenever you need it.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[15px] border border-[hsl(var(--border))] bg-[hsl(var(--card)/.58)] p-5">
              <div className="flex items-center justify-between"><Flame size={17} className="text-[hsl(var(--accent))]" /><span className="mono-label text-[hsl(var(--muted-foreground))]">active</span></div>
              <div className="display-font mt-7 text-[40px] font-semibold leading-none tracking-[-0.06em]" data-testid="text-active-count">{activeCount}</div>
              <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">of {alarms.length} rituals</div>
            </div>
            <div className="rounded-[15px] border border-[hsl(var(--border))] bg-[hsl(var(--card)/.58)] p-5">
              <div className="flex items-center justify-between"><Moon size={17} className="text-[hsl(var(--chart-3))]" /><span className="mono-label text-[hsl(var(--muted-foreground))]">snooze</span></div>
              <div className="display-font mt-7 text-[40px] font-semibold leading-none tracking-[-0.06em]" data-testid="text-average-snooze">{averageSnooze}<span className="ml-1 text-base tracking-normal">m</span></div>
              <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">your average</div>
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-[15px] border border-[hsl(var(--border))] bg-[hsl(var(--accent)/.12)] px-5 py-4">
              <div><div className="mono-label text-[hsl(var(--accent))]">A tiny promise</div><p className="mt-1 text-sm font-bold">Keep the morning yours.</p></div>
              <div className="flex -space-x-1.5" aria-hidden="true"><span className="h-7 w-7 rounded-full border-2 border-[hsl(var(--background))] bg-[hsl(var(--accent))]" /><span className="h-7 w-7 rounded-full border-2 border-[hsl(var(--background))] bg-[hsl(var(--chart-2))]" /><span className="h-7 w-7 rounded-full border-2 border-[hsl(var(--background))] bg-[hsl(var(--chart-3))]" /></div>
            </div>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="alarm-list-title">
          <div className="flex flex-col justify-between gap-4 border-b border-[hsl(var(--border))] pb-4 sm:flex-row sm:items-end">
            <div>
              <div className="mono-label text-[hsl(var(--accent))]">Your collection</div>
              <h2 id="alarm-list-title" className="display-font mt-1 text-[30px] font-semibold tracking-[-0.045em]">All alarms</h2>
            </div>
            <button type="button" onClick={openAdd} className="primary-button min-h-10 self-start px-4 sm:self-auto" data-testid="button-add-alarm"><Plus size={16} /> Add alarm</button>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-[hsl(var(--secondary)/.65)] p-1">
              {(['all', 'active', 'paused'] as Filter[]).map((item) => (
                <button type="button" key={item} onClick={() => setFilter(item)} className={`rounded-md px-3 py-1.5 text-xs font-extrabold capitalize transition-colors ${filter === item ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid={`button-filter-${item}`}>
                  {item}
                </button>
              ))}
            </div>
            <label className="relative block w-full sm:max-w-[245px]">
              <Search size={15} className="pointer-events-none absolute left-3 top-3 text-[hsl(var(--muted-foreground))]" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your rituals" className="soft-input h-10 pl-9" aria-label="Search alarms" data-testid="input-search-alarms" />
            </label>
          </div>

          <div className="mt-3">
            {visibleAlarms.length > 0 ? visibleAlarms.map((alarm, index) => (
              <div key={alarm.id} style={{ animationDelay: `${index * 45}ms` }}>
                <AlarmRow alarm={alarm} onToggle={() => toggleAlarm(alarm.id)} onEdit={() => setModalAlarm(alarm)} onDelete={() => deleteAlarm(alarm)} />
              </div>
            )) : (
              <div className="my-8 rounded-[16px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.4)] px-6 py-14 text-center" data-testid="empty-alarm-state">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--accent)/.14)] text-[hsl(var(--accent))]"><AlarmClock size={21} /></div>
                <h3 className="display-font mt-5 text-[25px] font-semibold tracking-[-0.04em]">{alarms.length === 0 ? 'A quiet little blank slate' : 'No alarms match that'}</h3>
                <p className="mx-auto mt-2 max-w-[350px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{alarms.length === 0 ? 'Add your first ritual and give tomorrow a softer edge.' : 'Try a different word or clear the filter to find your alarms.'}</p>
                {alarms.length === 0 && <button type="button" onClick={openAdd} className="primary-button mt-6 min-h-10 px-4" data-testid="button-empty-add-alarm"><Plus size={16} /> Add your first alarm</button>}
                {alarms.length > 0 && <button type="button" onClick={() => { setQuery(''); setFilter('all'); }} className="quiet-button mt-5 px-4 py-2" data-testid="button-clear-alarm-filters">Clear filters</button>}
              </div>
            )}
          </div>
        </section>

        <footer className="mt-12 flex items-center justify-between border-t border-[hsl(var(--border)/.7)] pt-4 text-[11px] text-[hsl(var(--muted-foreground))]">
          <span>Changes save automatically on this device.</span>
          <span className="mono-label hidden sm:block">made for gentler mornings</span>
        </footer>
      </main>
      {(isAdding || modalAlarm) && <AlarmModal initial={modalAlarm} onClose={() => { setModalAlarm(null); setIsAdding(false); }} onSave={saveAlarm} />}
    </div>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
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
