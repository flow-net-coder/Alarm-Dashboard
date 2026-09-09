import { useEffect, useState } from 'react';
import ChatScreen from './ChatScreen';
import { getActions, getMarcusState, updateAction, type MarcusState, type ActionItem } from '../api';
import type { Alarm } from '@/App';
import type { NoteItem } from '@/lib/notes';
import type { WebsiteShortcut } from '@/lib/websites';

type TabKey = 'chat' | 'actions' | 'context';

export function AiChatBox({
  onCreateAlarm,
  onCreateNote,
  onScheduleReminder,
  onScheduleWebsiteOpen,
  onMarcusReply,
}: {
  onCreateAlarm?: (alarm: Alarm) => void;
  onCreateNote?: (note: NoteItem) => void;
  onScheduleReminder?: (reminder: { title: string; body: string; at: Date; timeLabel: string }) => Promise<boolean>;
  onScheduleWebsiteOpen?: (command: { query: string; site: WebsiteShortcut | null; at: Date; timeLabel: string }) => Promise<boolean>;
  onMarcusReply?: (reply: string) => void;
}) {
  const [marcus, setMarcus] = useState<MarcusState | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('chat');
  const [pendingActions, setPendingActions] = useState(0);

  useEffect(() => {
    getMarcusState()
      .then(setMarcus)
      .catch(() => setMarcus({ name: 'Marcus', context: {}, lastHeartbeat: null }));
  }, []);

  useEffect(() => {
    if (activeTab !== 'actions') {
      return;
    }

    let cancelled = false;
    const refresh = () => {
      getActions('pending')
        .then((actions) => {
          if (!cancelled) {
            setPendingActions(actions.length);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPendingActions(0);
          }
        });
    };

    refresh();
    const interval = window.setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeTab]);

  const refreshMarcus = () => {
    getMarcusState().then(setMarcus).catch(console.error);
  };

  const tabClass = (tab: TabKey) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      activeTab === tab
        ? 'bg-blue-600 text-white shadow-sm'
        : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900'
    }`;

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-50 text-slate-900">
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">AI Marcus</p>
          <h1 className="text-lg font-semibold text-slate-900">Marcus workspace</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setActiveTab('chat')} className={tabClass('chat')}>
            Chat
          </button>
          <button type="button" onClick={() => setActiveTab('actions')} className={tabClass('actions')}>
            Actions {pendingActions > 0 ? `(${pendingActions})` : ''}
          </button>
          <button type="button" onClick={() => setActiveTab('context')} className={tabClass('context')}>
            Context
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0">
        {activeTab === 'chat' && (
          <ChatScreen
            marcus={marcus}
            onMarcusUpdate={refreshMarcus}
            onCreateAlarm={onCreateAlarm}
            onCreateNote={onCreateNote}
            onScheduleReminder={onScheduleReminder}
            onScheduleWebsiteOpen={onScheduleWebsiteOpen}
            onMarcusReply={onMarcusReply}
          />
        )}

        {activeTab === 'actions' && (
          <section className="h-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-4">
              <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-blue-500">Pending actions</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-900">Items ready for the connected app</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      These are the action points Marcus extracted and is waiting to hand off.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Back to chat
                  </button>
                </div>
              </div>

              <ActionsSummary marcus={marcus} />
            </div>
          </section>
        )}

        {activeTab === 'context' && (
          <section className="h-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Marcus context</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-900">What the marcus remembers</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      This view shows the current profile and memory that Marcus is carrying between conversations.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={refreshMarcus}
                    className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Refresh
                  </button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {marcus?.context && Object.keys(marcus.context).length > 0 ? (
                    Object.entries(marcus.context).map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{key.replace(/_/g, ' ')}</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 sm:col-span-2">
                      No saved context yet. Start chatting to teach the marcus about your work.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Status</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">Current marcus state</h3>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <span className="block text-[11px] uppercase tracking-[0.2em] text-slate-400">Name</span>
                      <span className="mt-1 block font-medium text-slate-900">{marcus?.name ?? 'Marcus'}</span>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <span className="block text-[11px] uppercase tracking-[0.2em] text-slate-400">Last heartbeat</span>
                      <span className="mt-1 block font-medium text-slate-900">
                        {marcus?.lastHeartbeat ? new Date(marcus.lastHeartbeat.ranAt).toLocaleString() : 'Not yet run'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Next step</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Go back to chat to teach Marcus more context, then open Actions to review what it extracted.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Back to chat
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function ActionsSummary({ marcus }: { marcus: MarcusState | null }) {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getActions('pending')
        .then((rows: ActionItem[]) => {
          if (!cancelled) {
            setActions(rows);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setActions([]);
            setLoading(false);
          }
        });
    };

    refresh();
    const interval = window.setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const markDone = async (id: string) => {
    await updateAction(id, 'done');
    setActions((prev: ActionItem[]) => prev.filter((item: ActionItem) => item.id !== id));
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Pending items</p>
          <p className="text-sm text-slate-500">{actions.length} currently waiting on the connected app</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          {actions.length} open
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading actions...</p>
        ) : actions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            No pending actions yet. Send Marcus a message to create one.
          </div>
        ) : (
          actions.map((action: ActionItem) => (
            <article key={action.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{action.type}</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">{action.title}</h3>
                  {action.description && <p className="mt-2 text-sm text-slate-600">{action.description}</p>}
                  {action.dueDate && (
                    <p className="mt-2 text-xs text-slate-500">
                      Due {new Date(action.dueDate).toLocaleString()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => markDone(action.id)}
                  className="rounded-full bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Mark done
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {marcus?.lastHeartbeat && (
        <p className="mt-4 text-xs text-slate-400">
          Last heartbeat ran at {new Date(marcus.lastHeartbeat.ranAt).toLocaleString()}.
        </p>
      )}
    </div>
  );
}
