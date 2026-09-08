import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { db, actionItemsTable, marcusContextTable, heartbeatLogsTable } from '../db';
import { eq, desc } from 'drizzle-orm';

const STATE_DIR = process.env.MANAGER_STATE_DIR ?? join(process.cwd(), 'marcus-state');

async function ensureDir() {
  await mkdir(STATE_DIR, { recursive: true });
}

/**
 * Generate all .md state files.
 * Called after each heartbeat.
 */
export async function generateMarkdownFiles(): Promise<void> {
  await ensureDir();
  await Promise.all([
    writeMarcusMd(),
    writeActionsMd(),
    writeCalendarMd(),
  ]);
}

async function writeMarcusMd(): Promise<void> {
  const contextRows = await db.select().from(marcusContextTable);
  const [lastHeartbeat] = await db
    .select()
    .from(heartbeatLogsTable)
    .orderBy(desc(heartbeatLogsTable.ranAt))
    .limit(1);

  const contextLines = contextRows.length > 0
    ? contextRows.map((r) => `- **${r.key.replace(/_/g, ' ')}**: ${r.value}`).join('\n')
    : '_No context collected yet. Start chatting with the marcus._';

  const now = new Date().toISOString();

  const content = `# Marcus State
_Auto-generated — last updated ${now}_

## What I Know

${contextLines}

## Last Heartbeat
${lastHeartbeat
    ? `- **Ran at**: ${new Date(lastHeartbeat.ranAt).toISOString()}
- **Messages processed**: ${lastHeartbeat.conversationsProcessed}
- **New action items found**: ${lastHeartbeat.actionItemsCreated}
- **Summary**: ${lastHeartbeat.summary ?? 'N/A'}`
    : '_No heartbeat has run yet._'}

## Notes
This file is regenerated every heartbeat. Do not edit manually — changes will be overwritten.
`;

  await writeFile(join(STATE_DIR, 'MANAGER.md'), content, 'utf-8');
}

async function writeActionsMd(): Promise<void> {
  const pending = await db
    .select()
    .from(actionItemsTable)
    .where(eq(actionItemsTable.status, 'pending'))
    .orderBy(actionItemsTable.createdAt);

  const inProgress = await db
    .select()
    .from(actionItemsTable)
    .where(eq(actionItemsTable.status, 'in_progress'))
    .orderBy(actionItemsTable.createdAt);

  const done = await db
    .select()
    .from(actionItemsTable)
    .where(eq(actionItemsTable.status, 'done'))
    .orderBy(desc(actionItemsTable.updatedAt))
    .limit(10);

  const formatItem = (a: (typeof actionItemsTable.$inferSelect)) => {
    const details = a.details ? JSON.stringify(a.details, null, 2) : null;
    return `### [${a.type.toUpperCase()}] ${a.title}
- **ID**: \`${a.id}\`
- **Status**: ${a.status}
- **Created**: ${new Date(a.createdAt).toISOString()}
${a.dueDate ? `- **Due**: ${new Date(a.dueDate).toISOString()}\n` : ''
}${a.description ? `- **Description**: ${a.description}\n` : ''
}${details ? `- **Details**:\n\`\`\`json\n${details}\n\`\`\`\n` : ''}`;
  };

  const content = `# Action Items
_Auto-generated — last updated ${new Date().toISOString()}_

> These items are ready for the connected application to act on.
> Status values: \`pending\` → \`in_progress\` → \`done\` | \`cancelled\`

## ⏳ Pending (${pending.length})

${pending.length > 0 ? pending.map(formatItem).join('\n---\n\n') : '_No pending items._'}

## 🔄 In Progress (${inProgress.length})

${inProgress.length > 0 ? inProgress.map(formatItem).join('\n---\n\n') : '_None in progress._'}

## ✅ Recently Done (last 10)

${done.length > 0 ? done.map(formatItem).join('\n---\n\n') : '_Nothing completed yet._'}
`;

  await writeFile(join(STATE_DIR, 'ACTIONS.md'), content, 'utf-8');
}

async function writeCalendarMd(): Promise<void> {
  const meetings = await db
    .select()
    .from(actionItemsTable)
    .where(eq(actionItemsTable.type, 'meeting'))
    .orderBy(actionItemsTable.dueDate);

  const reminders = await db
    .select()
    .from(actionItemsTable)
    .where(eq(actionItemsTable.type, 'reminder'))
    .orderBy(actionItemsTable.dueDate);

  const formatEvent = (a: (typeof actionItemsTable.$inferSelect)) => {
    const det = a.details as Record<string, unknown> | null;
    return `- **${a.title}**${a.dueDate ? ` — ${new Date(a.dueDate).toLocaleString()}` : ' — date TBD'}
  ${det?.['people'] ? `  👥 ${det['people']}` : ''}
  ${det?.['location'] ? `  📍 ${det['location']}` : ''}
  ${a.description ? `  📝 ${a.description}` : ''}
  Status: \`${a.status}\``;
  };

  const content = `# Calendar & Reminders
_Auto-generated — last updated ${new Date().toISOString()}_

## 📅 Meetings (${meetings.length})

${meetings.length > 0 ? meetings.map(formatEvent).join('\n\n') : '_No meetings tracked yet._'}

## ⏰ Reminders (${reminders.length})

${reminders.length > 0 ? reminders.map(formatEvent).join('\n\n') : '_No reminders set yet._'}
`;

  await writeFile(join(STATE_DIR, 'CALENDAR.md'), content, 'utf-8');
}
