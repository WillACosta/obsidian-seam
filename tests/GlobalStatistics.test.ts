import './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, Transaction } from '@codemirror/state';
import type { App, TFile } from 'obsidian';
import { MockTFile, MockTFolder } from './mocks/obsidian';
import { ActivityState, applyActivity, activityTotals, emptyActivity, grossWordsAdded, localDay, parseActivity, parseActivityJournal, SESSION_GAP_MS } from '../src/statistics/WritingActivity';
import { contribution, contributionWeeks, intensity, monthlyTrends, monthlyChartScale } from '../src/statistics/GlobalStatisticsModel';
import { observeWritingTransactions } from '../src/statistics/WritingActivityExtension';
import { GlobalStatistics } from '../src/statistics/GlobalStatistics';

class MarkdownViewHost {}
Object.assign(require.cache['obsidian']!.exports, { Notice: class {}, MarkdownView: MarkdownViewHost });
const storage = new Map<string, string>();
Object.assign(globalThis, { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key),
}, document: { hidden: false } });
function edit(before: string, from: number, to: number, insert: string) {
    const transaction = EditorState.create({ doc: before }).update({ changes: { from, to, insert } });
    const changes: { fromA: number; toA: number; fromB: number; toB: number }[] = [];
    transaction.changes.iterChanges((fromA, toA, fromB, toB) => changes.push({ fromA, toA, fromB, toB }));
    return grossWordsAdded(before, transaction.newDoc.toString(), changes);
}
describe('Gross words added', () => {
    it('credits a typed word once, including growing prefixes and trailing separators', () => {
        assert.equal(edit('', 0, 0, 'h'), 1);
        assert.equal(edit('h', 1, 1, 'ello'), 0);
        assert.equal(edit('hello', 5, 5, ' '), 0);
        assert.equal(edit('hello ', 6, 6, 'world'), 1);
        assert.equal(edit('hello world', 11, 11, 's'), 0);
    });
    it('counts replacement words even when net count stays constant or falls', () => {
        assert.equal(edit('one two', 0, 7, 'three four'), 2);
        assert.equal(edit('one two three', 0, 13, 'new'), 1);
        assert.equal(edit('one two', 0, 3, 'one'), 0);
        assert.equal(edit('one two', 0, 7, 'one two three'), 1);
        assert.equal(edit('one two', 0, 7, 'two one'), 0);
        assert.equal(edit('hello', 1, 4, 'ipp'), 0);
    });
    it('counts splits, merges, deletion, punctuation and Unicode consistently', () => {
        assert.equal(edit('helloworld', 5, 5, ' '), 1);
        assert.equal(edit('hello world', 5, 6, ''), 0);
        assert.equal(edit('hello world', 0, 6, ''), 0);
        assert.equal(edit('café', 4, 4, ' déjà vu'), 2);
        assert.equal(edit('word', 4, 4, '!'), 0);
        assert.equal(edit('', 0, 0, '😀 ** café well-known'), 2);
    });
    it('credits only new words when a large repeated passage is pasted over itself', () => {
        const before = 'repeated word '.repeat(2000);
        assert.equal(edit(before, 0, before.length, before + 'addition'), 1);
    });
    it('does not double-count overlapping neighbourhoods of multiple changes', () => {
        const before = 'one two three';
        const transaction = EditorState.create({ doc: before }).update({ changes: [{ from: 0, to: 3, insert: 'new' }, { from: 8, to: 13, insert: 'fresh' }] });
        const changes: { fromA: number; toA: number; fromB: number; toB: number }[] = []; transaction.changes.iterChanges((fromA, toA, fromB, toB) => changes.push({ fromA, toA, fromB, toB }));
        assert.equal(grossWordsAdded(before, transaction.newDoc.toString(), changes), 2);
    });
});

describe('Editor transaction provenance', () => {
    for (const event of ['input.type', 'input.type.compose', 'input.paste', 'input.complete', 'delete.backward', 'undo', 'redo', undefined]) {
        it(`handles ${event ?? 'programmatic'} updates without fabricating writing`, () => {
            const edits: number[] = []; let updated = '';
            const tr = EditorState.create({ doc: 'old' }).update({ changes: { from: 0, to: 3, insert: 'new words' }, userEvent: event });
            observeWritingTransactions({ updateEditor: (_file, text) => { updated = text; }, recordEdit: (_file, words) => { edits.push(words); } }, new MockTFile('A.md') as TFile, [tr], true, tr.newDoc.toString());
            assert.equal(updated, 'new words');
            assert.deepEqual(edits, event?.startsWith('input') || event?.startsWith('delete') ? [2] : []);
        });
    }
    it('credits IME composition once when the entire provisional word is repeatedly replaced', () => {
        let state = EditorState.create({ doc: '' }); const words: number[] = []; let continuing = false;
        for (const text of ['n', 'ni', '你']) {
            const tr = state.update({ changes: { from: 0, to: state.doc.length, insert: text }, userEvent: 'input.type.compose' });
            continuing = observeWritingTransactions({ updateEditor() {}, recordEdit: (_file, count) => { words.push(count); } }, new MockTFile('A.md') as TFile, [tr], true, text, continuing);
            state = tr.state;
        }
        assert.deepEqual(words, [1, 0, 0]);
    });
    it('credits the first IME replacement of existing text before coalescing provisional updates', () => {
        const state = EditorState.create({ doc: 'replace these' });
        const tr = state.update({ changes: { from: 0, to: state.doc.length, insert: 'n' }, userEvent: 'input.type.compose' });
        const words: number[] = [];
        const continuing = observeWritingTransactions({ updateEditor() {}, recordEdit: (_file, count) => { words.push(count); } }, new MockTFile('A.md') as TFile, [tr], true, 'n');
        const second = tr.state.update({ changes: { from: 0, to: 1, insert: '你' }, userEvent: 'input.type.compose' });
        observeWritingTransactions({ updateEditor() {}, recordEdit: (_file, count) => { words.push(count); } }, new MockTFile('A.md') as TFile, [second], true, '你', continuing);
        assert.deepEqual(words, [1, 0]);
    });
    it('counts a direct move as an edit without crediting reordered words', () => {
        const state = EditorState.create({ doc: 'one two' });
        const tr = state.update({ changes: { from: 0, to: 7, insert: 'two one' }, userEvent: 'move.drop' });
        const words: number[] = [];
        observeWritingTransactions({ updateEditor() {}, recordEdit: (_file, count) => { words.push(count); } }, new MockTFile('A.md') as TFile, [tr], true, 'two one');
        assert.deepEqual(words, [0]);
    });
    it('excludes remote, unfocused, identical replacements and selection-only transactions', () => {
        const state = EditorState.create({ doc: 'text' });
        const service = { updateEditor() {}, recordEdit() { assert.fail('Not direct writing'); } };
        observeWritingTransactions(service, new MockTFile('A.md') as TFile, [state.update({ changes: { from: 4, insert: ' synced' }, userEvent: 'input', annotations: Transaction.remote.of(true) })], true, 'text synced');
        observeWritingTransactions(service, new MockTFile('A.md') as TFile, [state.update({ changes: { from: 4, insert: ' offscreen' }, userEvent: 'input' })], false, 'text offscreen');
        observeWritingTransactions(service, new MockTFile('A.md') as TFile, [state.update({ changes: { from: 0, to: 4, insert: 'text' }, userEvent: 'input' }), state.update({ selection: { anchor: 0 } })], true, 'text');
    });
});

function record(state: ActivityState, id: string, day: string, words: number, timestamp: number) {
    applyActivity(state, { kind: 'edit', sequence: state.sequence + 1, id, path: `${id}.md`, day, words, timestamp });
}
describe('Local activity ledger and calendar aggregates', () => {
    it('deduplicates replayed events and groups sessions per note/day across reloads', () => {
        const state = emptyActivity('2026-10-26'); record(state, 'A', '2026-10-26', 2, 1000);
        const restored = parseActivity(JSON.parse(JSON.stringify(state)));
        record(restored, 'A', '2026-10-26', 1, 2000);
        record(restored, 'A', '2026-10-26', 3, 2000 + SESSION_GAP_MS + 1);
        applyActivity(restored, { kind: 'edit', sequence: 1, id: 'A', path: 'A.md', day: '2026-10-26', words: 1000, timestamp: 1000 });
        assert.equal(contribution(restored, '2026-10-26', 'words'), 6);
        assert.equal(contribution(restored, '2026-10-26', 'sessions'), 2);
        assert.equal(contribution(restored, '2026-10-26', 'notes'), 1);
    });
    it('tracks renames, folder moves, deletion and future days without rewriting past totals', () => {
        const state = emptyActivity('2026-10-24'); record(state, 'A', '2026-10-24', 2, 1000);
        applyActivity(state, { kind: 'rename', sequence: 2, from: 'A.md', to: 'Folder/A.md' });
        applyActivity(state, { kind: 'rename', sequence: 3, from: 'Folder', to: 'Moved' });
        assert.equal(state.notes.A.path, 'Moved/A.md');
        applyActivity(state, { kind: 'delete', sequence: 4, path: 'Moved' });
        assert.equal(state.notes.A.deleted, true);
        record(state, 'B', '2026-10-25', 0, 2000); record(state, 'C', '2026-10-27', 999, 3000);
        assert.deepEqual(activityTotals(state, '2026-10-26'), { activeDays: 2, streak: 2 });
        assert.deepEqual(activityTotals(state, '2026-10-29'), { activeDays: 3, streak: 0 });
    });
    it('uses local calendar dates and treats midnight as a new session even within five minutes', () => {
        const state = emptyActivity('2026-10-25');
        const a = new Date(2026, 9, 25, 23, 59); const b = new Date(2026, 9, 26, 0, 1);
        record(state, 'A', localDay(a), 1, a.getTime()); record(state, 'A', localDay(b), 1, b.getTime());
        assert.equal(contribution(state, '2026-10-25', 'sessions'), 1); assert.equal(contribution(state, '2026-10-26', 'sessions'), 1);
        assert.deepEqual(activityTotals(state, '2026-10-26'), { activeDays: 2, streak: 2 });
    });
    it('builds 52 weekly columns, a three-month range, and never exposes future dates', () => {
        const weeks = contributionWeeks('2026-10-26', 'year'); assert.equal(weeks.length, 52);
        assert.equal(weeks[51][1], '2026-10-26'); assert.equal(weeks[51][2], null);
        assert.ok(weeks.flat().every(day => day === null || day <= '2026-10-26'));
        assert.ok(contributionWeeks('2024-05-31', 'quarter').flat().includes('2024-02-29'));
        assert.deepEqual([0, 1, 2, 3, 4].map(value => intensity(value, 4)), [0, 1, 2, 3, 4]);
    });
    it('aggregates six months across New Year and excludes future contributions and creations', () => {
        const state = emptyActivity('2025-09-01'); record(state, 'A', '2025-12-31', 4, 1000); record(state, 'A', '2026-01-01', 3, 2000); record(state, 'B', '2026-01-03', 99, 3000);
        applyActivity(state, { kind: 'create', sequence: 4, id: 'A', path: 'A.md', day: '2025-12-31' });
        applyActivity(state, { kind: 'create', sequence: 5, id: 'B', path: 'B.md', day: '2026-01-03' });
        const words = monthlyTrends(state, '2026-01-02', 'words');
        assert.equal(words.length, 6); assert.equal(words[0].month, '2025-08');
        assert.deepEqual(words.slice(-2).map(month => month.value), [4, 3]);
        assert.deepEqual(monthlyTrends(state, '2026-01-02', 'created').slice(-2).map(month => month.value), [1, 0]);
    });
    it('keeps recorded local dates stable after timezone changes and excludes days that become future dates', () => {
        const previous = process.env.TZ;
        try {
            process.env.TZ = 'Pacific/Auckland';
            const timestamp = new Date('2026-10-26T12:30:00Z').getTime();
            const state = emptyActivity(localDay(new Date(timestamp)));
            record(state, 'A', localDay(new Date(timestamp)), 1, timestamp);
            assert.ok(state.days['2026-10-27']);
            process.env.TZ = 'America/Los_Angeles';
            assert.equal(localDay(new Date(timestamp)), '2026-10-26');
            assert.deepEqual(activityTotals(state, localDay(new Date(timestamp))), { activeDays: 0, streak: 0 });
            process.env.TZ = 'America/New_York';
            const spring = emptyActivity('2026-03-07');
            record(spring, 'A', '2026-03-07', 1, new Date(2026, 2, 7, 12).getTime());
            record(spring, 'A', '2026-03-08', 1, new Date(2026, 2, 8, 12).getTime());
            assert.deepEqual(activityTotals(spring, '2026-03-08'), { activeDays: 2, streak: 2 });
        } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
    });
    it('rejects malformed recovery events before applying them', () => {
        for (const journal of [[{ kind: 'unknown', sequence: 1 }], [{ kind: 'edit', sequence: 1, id: 'A', path: 'A.md', day: '2026-10-26', words: -1, timestamp: 0 }]]) assert.throws(() => parseActivityJournal(journal));
    });
    it('rejects corrupt, unsupported and negative activity data', () => {
        for (const value of [null, { version: 2 }, { ...emptyActivity('2026-10-26'), days: { bad: {} } },
            { ...emptyActivity('2026-10-26'), notes: { A: { path: 'A.md' } }, days: { '2026-10-26': { A: { words: -1, sessions: 1, lastEdit: 0 } } } }]) assert.throws(() => parseActivity(value));
    });
});

let fixtureNumber = 0;
function fixture(existing?: ActivityState, seed: [string, string][] = [['A.md', 'one two'], ['B.md', 'three']]) {
    const path = `.obsidian/plugins/seam-${fixtureNumber++}/statistics.json`;
    const files = new Map<string, MockTFile>(); const texts = new Map<string, string>(seed);
    for (const [path] of seed) files.set(path, new MockTFile(path));
    const disk = new Map<string, string>(); if (existing) disk.set(path, JSON.stringify(existing));
    const events = new Map<string, Function>(); let reads = 0; let fail = false;
    const app = { vault: { adapter: { getResourcePath: (path: string) => path, exists: async (path: string) => disk.has(path), read: async (path: string) => disk.get(path),
        write: async (path: string, text: string) => { if (fail) throw Error('Storage unavailable'); disk.set(path, text); } },
        on: (name: string, handler: Function) => { events.set(name, handler); },
        getAbstractFileByPath: (path: string) => files.get(path) ?? null, getMarkdownFiles: () => [...files.values()],
        cachedRead: async (file: TFile) => { reads++; return texts.get(file.path) ?? ''; } },
        workspace: { onLayoutReady: (ready: () => void) => ready(), getLeavesOfType: () => [] } } as unknown as App;
    const service = new GlobalStatistics(app, path.slice(0, -'/statistics.json'.length));
    Object.assign(service, { registerEvent() {}, registerDomEvent() {} });
    return { app, service, files, texts, disk, path, events, reads: () => reads, fail: (value: boolean) => { fail = value; } };
}
describe('Background global statistics and persistence', () => {
    it('supports an empty vault without fabricated activity', async () => {
        const f = fixture(undefined, []); await f.service.initialize();
        assert.equal(f.service.snapshot().totalNotes, 0); assert.equal(f.service.snapshot().totalWords, 0);
        assert.deepEqual(activityTotals(f.service.snapshot().activity, localDay()), { activeDays: 0, streak: 0 }); f.service.onunload();
    });
    it('indexes existing notes without inventing history and never scans on snapshot/open', async () => {
        const f = fixture(); await f.service.initialize();
        assert.equal(f.service.snapshot().totalNotes, 2); assert.equal(f.service.snapshot().totalWords, 3);
        assert.deepEqual(f.service.snapshot().activity.days, {}); assert.deepEqual(f.service.snapshot().activity.created, {});
        const reads = f.reads(); for (let i = 0; i < 10; i++) f.service.snapshot(); assert.equal(f.reads(), reads);
        await f.service.flush(); assert.ok(f.disk.has(f.path)); f.service.onunload();
    });
    it('uses stored totals during initial editor loading and keeps unsaved editor totals during a later refresh', async () => {
        const f = fixture();
        const view = Object.assign(new MarkdownViewHost(), { file: f.files.get('A.md'), getMode: () => 'source', editor: { getValue: () => '' } });
        f.app.workspace.getLeavesOfType = () => [{ view }] as never;
        f.service.onload(); await f.service.initialize();
        assert.equal(f.service.snapshot().totalWords, 3);
        f.service.updateEditor(f.files.get('A.md')! as TFile, 'unsaved content has four');
        f.events.get('modify')!(f.files.get('A.md'));
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(f.service.snapshot().totalWords, 5); f.service.onunload();
    });
    it('keeps a note identity when typing arrives before persisted history has loaded', async () => {
        const state = emptyActivity(localDay()); record(state, 'A', localDay(), 3, Date.now() - 1000);
        const f = fixture(state); f.service.recordEdit(f.files.get('A.md')! as TFile, 2, {});
        await f.service.initialize(); await f.service.flush();
        assert.equal(contribution(f.service.snapshot().activity, localDay(), 'words'), 5);
        assert.equal(contribution(f.service.snapshot().activity, localDay(), 'notes'), 1);
        f.service.onunload();
    });
    it('preserves early buffered input through a reload while history is still loading', async () => {
        const f = fixture(emptyActivity(localDay()));
        let release!: () => void; const blocked = new Promise<void>(resolve => { release = resolve; });
        const read = f.app.vault.adapter.read; let first = true;
        f.app.vault.adapter.read = async path => { if (first) { first = false; await blocked; } return read(path); };
        const firstInitialization = f.service.initialize(); await new Promise(resolve => setImmediate(resolve));
        f.service.recordEdit(f.files.get('A.md')! as TFile, 1, {}); f.service.onunload();
        const restored = new GlobalStatistics(f.app, f.path.slice(0, -'/statistics.json'.length));
        const secondInitialization = restored.initialize(); release();
        await firstInitialization; await secondInitialization;
        assert.equal(contribution(restored.snapshot().activity, localDay(), 'words'), 1); restored.onunload();
    });
    it('waits for the previous service writer during reload before loading or saving new edits', async () => {
        const f = fixture(emptyActivity(localDay())); await f.service.initialize();
        let release!: () => void; const blocked = new Promise<void>(resolve => { release = resolve; });
        const write = f.app.vault.adapter.write; let first = true;
        f.app.vault.adapter.write = async (path, data) => { if (first) { first = false; await blocked; } return write(path, data); };
        const file = f.files.get('A.md')! as TFile;
        f.service.recordEdit(file, 1, {}); await new Promise(resolve => setImmediate(resolve)); f.service.onunload();
        const restored = new GlobalStatistics(f.app, f.path.slice(0, -'/statistics.json'.length));
        let ready = false; const initialization = restored.initialize().then(() => { ready = true; });
        await new Promise(resolve => setImmediate(resolve)); assert.equal(ready, false);
        release(); await initialization;
        restored.recordEdit(file, 2, {}); await restored.flush();
        assert.equal(contribution(parseActivity(JSON.parse(f.disk.get(f.path)!)), localDay(), 'words'), 3);
        restored.onunload();
    });
    it('stores user activity once and recovers a journal after an immediate failed-save reload', async () => {
        const f = fixture(); await f.service.initialize(); await f.service.flush(); f.fail(true);
        const file = f.files.get('A.md')! as TFile; const transaction = {};
        f.service.recordEdit(file, 3, transaction); f.service.recordEdit(file, 3, transaction);
        await f.service.flush(); assert.equal(f.service.snapshot().saveError, true);
        assert.equal(contribution(f.service.snapshot().activity, localDay(), 'words'), 3);
        f.service.onunload(); await f.service.flush(); f.fail(false);
        const restored = new GlobalStatistics(f.app, f.path.slice(0, -'/statistics.json'.length));
        await restored.initialize(); await restored.flush();
        assert.equal(contribution(restored.snapshot().activity, localDay(), 'words'), 3);
        assert.equal(contribution(restored.snapshot().activity, localDay(), 'sessions'), 1);
        restored.onunload();
    });
    it('updates totals for imports/programmatic changes and counts growth without creating writing activity', async () => {
        const f = fixture(); f.service.onload(); await f.service.initialize();
        const file = new MockTFile('Imported.md'); f.files.set(file.path, file); f.texts.set(file.path, 'imported words');
        f.events.get('create')!(file);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(f.service.snapshot().totalNotes, 3); assert.equal(f.service.snapshot().totalWords, 5);
        assert.deepEqual(f.service.snapshot().activity.days, {});
        f.texts.set(file.path, 'programmatic update with more words'); f.events.get('modify')!(file);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(f.service.snapshot().totalWords, 8); assert.deepEqual(f.service.snapshot().activity.days, {});
        f.service.onunload();
    });
    it('preserves history through file/folder renames and deletion while updating current totals', async () => {
        const f = fixture(); f.service.onload(); await f.service.initialize();
        const file = f.files.get('A.md')!; f.service.recordEdit(file as TFile, 4, {});
        f.files.delete(file.path); file.path = 'Folder/A.md'; f.files.set(file.path, file); f.texts.set(file.path, 'one two');
        f.events.get('rename')!(file, 'A.md'); await new Promise(resolve => setImmediate(resolve));
        const history = f.service.snapshot().activity; const id = Object.keys(history.days[localDay()])[0];
        assert.equal(history.notes[id].path, 'Folder/A.md');
        f.files.delete(file.path); f.events.get('delete')!(new MockTFolder('Folder'));
        assert.equal(f.service.snapshot().totalNotes, 1); assert.equal(history.notes[id].deleted, true);
        assert.equal(contribution(history, localDay(), 'words'), 4); f.service.onunload();
    });
    it('reports corrupt stored history and does not overwrite it', async () => {
        const f = fixture(); f.disk.set(f.path, '{bad json'); await f.service.initialize();
        assert.equal(f.service.snapshot().error, true); await f.service.flush();
        assert.equal(f.disk.get(f.path), '{bad json'); f.service.onunload();
    });
});


describe('Linear monthly chart', () => {
    it('uses the same zero baseline and proportional heights for all six months', () => {
        const scale = monthlyChartScale([0, 1000, 2000, 3000, 4000, 8000]);
        assert.equal(scale.max, 8000);
        assert.deepEqual(scale.heights, [0, 12.5, 25, 37.5, 50, 100]);
        assert.deepEqual(scale.ticks, [8000, 6000, 4000, 2000, 0]);
    });
    it('keeps empty and sparse note-creation charts finite with readable integer intervals', () => {
        for (const values of [[0, 0, 0, 0, 0, 0], [0, 0, 0, 1, 0, 2]]) {
            const scale = monthlyChartScale(values);
            assert.equal(scale.max, 4); assert.deepEqual(scale.ticks, [4, 3, 2, 1, 0]);
            assert.ok(scale.heights.every(height => Number.isFinite(height) && height >= 0 && height <= 100));
        }
    });
});
