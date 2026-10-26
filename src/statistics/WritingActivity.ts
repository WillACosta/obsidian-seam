export interface TextChange { fromA: number; toA: number; fromB: number; toB: number }
const wordPattern = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’\-][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu;
const wordCharacter = /[\p{L}\p{M}\p{N}'’\-]/u;

function spans(text: string, from: number, to: number): { from: number; to: number }[] {
    const regex = new RegExp(wordPattern.source, 'gu');
    const result: { from: number; to: number }[] = [];
    const content = text.slice(from, to);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content))) result.push({ from: from + match.index, to: from + match.index + match[0].length });
    return result;
}
function windowFor(text: string, from: number, to: number): [number, number] {
    // Include both neighbours when inserting/removing a word boundary.
    from = Math.max(0, from - 1); to = Math.min(text.length, to + 1);
    while (from > 0 && wordCharacter.test(text[from - 1])) from--;
    while (to < text.length && wordCharacter.test(text[to])) to++;
    return [from, to];
}

/** Count newly introduced word tokens, including replacement text, without crediting each typed character. */
export function grossWordsAdded(before: string, after: string, changes: TextChange[], composing = false): number {
    if (before === after || !changes.length) return 0;
    const windows: { a: [number, number]; b: [number, number] }[] = [];
    for (const change of changes) {
        const a = windowFor(before, change.fromA, change.toA);
        const b = windowFor(after, change.fromB, change.toB);
        const previous = windows[windows.length - 1];
        if (previous && (a[0] <= previous.a[1] || b[0] <= previous.b[1])) {
            previous.a[1] = Math.max(previous.a[1], a[1]); previous.b[1] = Math.max(previous.b[1], b[1]);
        } else windows.push({ a, b });
    }
    const unchanged: { a: number; b: number; length: number }[] = [];
    let a = 0; let b = 0;
    for (const change of changes) {
        if (change.fromA > a) unchanged.push({ a, b, length: change.fromA - a });
        a = change.toA; b = change.toB;
    }
    if (a < before.length) unchanged.push({ a, b, length: before.length - a });
    let added = 0;
    for (const window of windows) {
        const oldWords = spans(before, ...window.a);
        const newWords = spans(after, ...window.b);
        if (composing) { added += Math.max(0, newWords.length - oldWords.length); continue; }
        const assignedOld = new Set<number>(); const assignedNew = new Set<number>();
        let segmentIndex = 0; let newIndex = 0;
        // Retained characters preserve token identity. Ordered intervals allow a linear greedy match.
        oldWords.forEach((old, oldIndex) => {
            while (segmentIndex < unchanged.length && unchanged[segmentIndex].a + unchanged[segmentIndex].length <= old.from) segmentIndex++;
            for (let i = segmentIndex; i < unchanged.length && unchanged[i].a < old.to; i++) {
                const segment = unchanged[i];
                const start = Math.max(old.from, segment.a); const end = Math.min(old.to, segment.a + segment.length);
                if (start >= end) continue;
                const from = segment.b + start - segment.a; const to = segment.b + end - segment.a;
                while (newIndex < newWords.length && (newWords[newIndex].to <= from || assignedNew.has(newIndex))) newIndex++;
                if (newIndex < newWords.length && newWords[newIndex].from < to) {
                    assignedOld.add(oldIndex); assignedNew.add(newIndex); break;
                }
            }
        });
        // Re-pasting/reordering unchanged words is not new writing, even when their characters were replaced.
        const retained = new Map<string, number>();
        oldWords.forEach((word, index) => {
            if (assignedOld.has(index)) return;
            const text = before.slice(word.from, word.to).toLowerCase(); retained.set(text, (retained.get(text) ?? 0) + 1);
        });
        newWords.forEach((word, index) => {
            if (assignedNew.has(index)) return;
            const text = after.slice(word.from, word.to).toLowerCase(); const count = retained.get(text) ?? 0;
            if (count > 0) { retained.set(text, count - 1); assignedNew.add(index); }
        });
        added += newWords.length - assignedNew.size;
    }
    return added;
}

export const SESSION_GAP_MS = 5 * 60 * 1000;
export interface DailyNoteActivity { words: number; sessions: number; lastEdit: number }
export interface ActivityState {
    version: 1;
    startedAt: string;
    sequence: number;
    notes: Record<string, { path: string; deleted?: boolean }>;
    days: Record<string, Record<string, DailyNoteActivity>>;
    created: Record<string, string>;
}
export type ActivityChange =
    | { kind: 'edit'; id: string; path: string; day: string; timestamp: number; words: number }
    | { kind: 'create'; id: string; path: string; day: string }
    | { kind: 'rename'; from: string; to: string }
    | { kind: 'delete'; path: string };
export type ActivityEvent = ActivityChange & { sequence: number };
export function emptyActivity(day: string): ActivityState { return { version: 1, startedAt: day, sequence: 0, notes: {}, days: {}, created: {} }; }
export function localDay(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const validDay = (day: unknown): day is string => {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const date = new Date(`${day}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Fail closed on corrupt history, rather than replacing it with invented zero activity. */
export function parseActivity(value: unknown): ActivityState {
    if (!record(value) || value.version !== 1 || !validDay(value.startedAt) || !nonnegative(value.sequence)
        || !record(value.notes) || !record(value.days) || !record(value.created)) throw new Error('Invalid statistics history');
    for (const note of Object.values(value.notes)) if (!record(note) || typeof note.path !== 'string' || !note.path.endsWith('.md')
        || (note.deleted !== undefined && typeof note.deleted !== 'boolean')) throw new Error('Invalid note reference');
    for (const [day, notes] of Object.entries(value.days)) {
        if (!validDay(day) || !record(notes)) throw new Error('Invalid activity day');
        for (const [id, activity] of Object.entries(notes)) if (!value.notes[id] || !record(activity)
            || !nonnegative(activity.words) || !nonnegative(activity.sessions) || !nonnegative(activity.lastEdit)) throw new Error('Invalid activity totals');
    }
    for (const [id, day] of Object.entries(value.created)) if (!value.notes[id] || !validDay(day)) throw new Error('Invalid creation date');
    return value as unknown as ActivityState;
}
export function parseActivityJournal(value: unknown): ActivityEvent[] {
    if (!Array.isArray(value)) throw new Error('Invalid recovery log');
    for (const event of value) {
        if (!record(event) || !nonnegative(event.sequence)) throw new Error('Invalid recovery event');
        if (event.kind === 'edit' || event.kind === 'create') {
            if (typeof event.id !== 'string' || typeof event.path !== 'string' || !event.path.endsWith('.md') || !validDay(event.day)) throw new Error('Invalid recovery note');
            if (event.kind === 'edit' && (!nonnegative(event.words) || !nonnegative(event.timestamp))) throw new Error('Invalid recovery contribution');
        } else if (event.kind === 'rename') {
            if (typeof event.from !== 'string' || typeof event.to !== 'string') throw new Error('Invalid recovery rename');
        } else if (event.kind !== 'delete' || typeof event.path !== 'string') throw new Error('Invalid recovery action');
    }
    return value as ActivityEvent[];
}
export function applyActivity(state: ActivityState, event: ActivityEvent): void {
    if (event.sequence <= state.sequence) return;
    if (event.kind === 'edit' || event.kind === 'create') {
        state.notes[event.id] = { path: event.path };
        if (event.kind === 'create') state.created[event.id] = event.day;
        else {
            const day = state.days[event.day] ?? (state.days[event.day] = {});
            const existing = day[event.id];
            day[event.id] = { words: (existing?.words ?? 0) + event.words,
                sessions: (existing?.sessions ?? 0) + (!existing || event.timestamp - existing.lastEdit > SESSION_GAP_MS ? 1 : 0),
                lastEdit: event.timestamp };
        }
    } else {
        const path = event.kind === 'rename' ? event.from : event.path;
        for (const note of Object.values(state.notes)) {
            if (note.deleted || (note.path !== path && !note.path.startsWith(path + '/'))) continue;
            if (event.kind === 'delete') note.deleted = true;
            else note.path = event.to + note.path.slice(path.length);
        }
    }
    state.sequence = event.sequence;
}
export function activityTotals(state: ActivityState, today: string): { activeDays: number; streak: number } {
    const days = new Set(Object.entries(state.days).filter(([day, notes]) => day <= today && Object.values(notes).some(note => note.sessions > 0)).map(([day]) => day));
    const cursor = new Date(`${today}T12:00:00`);
    if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (days.has(localDay(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
    return { activeDays: days.size, streak };
}
export function wordCount(text: string): number { return text.match(new RegExp(wordPattern.source, 'gu'))?.length ?? 0; }
