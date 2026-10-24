import './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { App, TFile } from 'obsidian';
import { moment } from 'obsidian';
import { MockTFile, MockTFolder } from './mocks/obsidian';
import { CalendarModel, findCalendarNote, resolveCalendarNote } from '../src/calendar/CalendarModel';
import { groupDailySearches } from '../src/calendar/SpecialSearchOrder';
import type { PaletteItem } from '../src/types';

const settings = { folder: 'Calendar', format: 'YYYY/MM/YYYY-MM-DD', template: 'Templates/Daily' };
const date = () => moment('2024-02-29', 'YYYY-MM-DD', true);

describe('Calendar date navigation', () => {
    it('shows six locale-aligned weeks, including leap day and adjacent months', () => {
        const model = new CalendarModel(date(), 'en');
        const days = model.days();
        assert.equal(days.length, 42);
        assert.equal(days[0].format('YYYY-MM-DD'), '2024-01-28');
        assert.equal(days[41].format('YYYY-MM-DD'), '2024-03-09');
        assert.ok(days.some(day => day.isSame(date(), 'day')));
        assert.equal(model.selected.format('YYYY-MM-DD'), '2024-02-29');
    });
    it('moves by day and week across month and year boundaries', () => {
        const model = new CalendarModel(moment('2025-01-01'), 'en');
        model.move('ArrowLeft');
        assert.equal(model.selected.format('YYYY-MM-DD'), '2024-12-31');
        model.move('ArrowDown');
        assert.equal(model.selected.format('YYYY-MM-DD'), '2025-01-07');
        model.move('ArrowUp'); model.move('ArrowRight');
        assert.equal(model.selected.format('YYYY-MM-DD'), '2025-01-01');
    });
    it('clamps leap dates for month/year changes and supports week start/end', () => {
        const model = new CalendarModel(date(), 'en');
        model.move('PageDown', true);
        assert.equal(model.selected.format('YYYY-MM-DD'), '2025-02-28');
        model.move('PageUp');
        assert.equal(model.selected.format('YYYY-MM-DD'), '2025-01-28');
        model.move('Home'); assert.equal(model.selected.day(), 0);
        model.move('End'); assert.equal(model.selected.day(), 6);
    });
    it('navigates twelve-year pages and selects a year, month, then date', () => {
        const model = new CalendarModel(date(), 'en');
        model.page = 'years';
        const start = model.yearStart;
        model.shift(1); assert.equal(model.yearStart, start + 12);
        model.move('ArrowUp'); assert.equal(model.selected.year(), 2033);
        model.chooseYear(2028); assert.equal(model.page, 'months');
        model.chooseMonth(1); assert.equal(model.page, 'days');
        assert.equal(model.selected.format('YYYY-MM-DD'), '2028-02-28');
    });
});

describe('Calendar Daily Note actions', () => {
    it('finds and opens an existing configured path without reading a template or creating a note', async () => {
        const file = new MockTFile('Calendar/2024/02/2024-02-29.md');
        const app = { vault: { getAbstractFileByPath: (path: string) => path === file.path ? file : null,
            read: () => assert.fail('Existing note must not read a template'), create: () => assert.fail('Must not overwrite') } } as unknown as App;
        assert.equal(findCalendarNote(app, date(), settings), file);
        assert.equal(await resolveCalendarNote(app, date(), settings), file);
    });
    it('creates missing folders and expands the Daily Notes template for the selected date', async () => {
        const files = new Map<string, unknown>([['Templates/Daily.md', new MockTFile('Templates/Daily.md')]]);
        const writes: [string, string][] = [];
        const app = { vault: {
            getAbstractFileByPath: (path: string) => files.get(path),
            read: async () => '# {{date:YYYY-MM-DD}}\n{{title}}',
            createFolder: async (path: string) => { files.set(path, new MockTFolder(path)); },
            create: async (path: string, text: string) => { writes.push([path, text]); const file = new MockTFile(path); files.set(path, file); return file; },
        } } as unknown as App;
        await resolveCalendarNote(app, date(), settings);
        assert.deepEqual(writes, [['Calendar/2024/02/2024-02-29.md', '# 2024-02-29\n2024-02-29']]);
        assert.ok(files.has('Calendar/2024/02'));
        await resolveCalendarNote(app, date(), settings);
        assert.equal(writes.length, 1);
    });
    it('opens a concurrently created note and propagates template errors otherwise', async () => {
        const existing = new MockTFile('Calendar/2024/02/2024-02-29.md');
        let created = false;
        const app = { vault: {
            getAbstractFileByPath: (path: string) => created && path === existing.path ? existing : null,
            read: () => assert.fail('No template file'),
        } } as unknown as App;
        await assert.rejects(resolveCalendarNote(app, date(), settings), /template not found/);
        created = true;
        assert.equal(await resolveCalendarNote(app, date(), settings), existing);
        const concurrent = { vault: {
            getAbstractFileByPath: (path: string) => path === existing.path && created ? existing : null,
            createFolder: async () => {},
            create: async () => { created = true; throw Error('Already exists'); },
        } } as unknown as App;
        created = false;
        assert.equal(await resolveCalendarNote(concurrent, date(), { ...settings, template: '' }), existing);
    });
    it('does not overwrite a folder occupying the daily-note path', async () => {
        const folder = new MockTFolder('Calendar/2024/02/2024-02-29.md');
        const app = { vault: { getAbstractFileByPath: () => folder, create: () => assert.fail('Must not overwrite') } } as unknown as App;
        assert.equal(findCalendarNote(app, date(), settings), null);
        await assert.rejects(resolveCalendarNote(app, date(), settings), /occupied/);
    });
});

describe('Daily query grouping', () => {
    it('keeps today, yesterday, calendar together despite stored order or pinned custom entries', () => {
        const item = (id: string, specialSearch?: PaletteItem['specialSearch']): PaletteItem => ({ id, title: id, description: '', type: 'special', specialSearch });
        const items = [item('custom'), item('calendar', 'calendar'), item('recent', 'recent'), item('yesterday', 'yesterday'), item('today', 'today')];
        assert.deepEqual(groupDailySearches(items).map(entry => entry.id), ['custom', 'today', 'yesterday', 'calendar', 'recent']);
        assert.deepEqual(groupDailySearches(items.filter(entry => entry.id !== 'yesterday')).map(entry => entry.id), ['custom', 'today', 'calendar', 'recent']);
    });
});
