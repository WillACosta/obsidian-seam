import './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { moment } from 'obsidian';
import type { App, TFile } from 'obsidian';
import { MockTFile, MockTFolder } from './mocks/obsidian';
import { DEFAULT_SETTINGS } from '../src/types';
import { currentPeriodTarget } from '../src/calendar/CurrentPeriodNotes';
import { readYearlyNoteSettings, resolveYearlyNote } from '../src/calendar/YearlyNotes';
import { parseSpecialSearch, SearchService } from '../src/search/SearchService';

const settings = { ...DEFAULT_SETTINGS, calendarUsePeriodicNotes: false, calendarWeeklyFolder: 'Weekly', calendarWeeklyFormat: 'GGGG-[W]WW', calendarYearlyFolder: 'Yearly' };
function fixture(periodic?: unknown) {
    const files = new Map<string, MockTFile | MockTFolder>();
    const contents = new Map<string, string>();
    const writes: string[] = [];
    const add = (path: string, text = '') => { const file = new MockTFile(path); files.set(path, file); contents.set(path, text); return file; };
    const app = { vault: {
        configDir: '.obsidian',
        adapter: { exists: async () => periodic !== undefined, read: async () => JSON.stringify(periodic) },
        getAbstractFileByPath: (path: string) => files.get(path) ?? null,
        getFiles: () => [...files.values()].filter(file => file instanceof MockTFile),
        getMarkdownFiles: () => [...files.values()].filter(file => file instanceof MockTFile && file.extension === 'md'),
        createFolder: async (path: string) => { const folder = new MockTFolder(path); files.set(path, folder); return folder; },
        create: async (path: string, text: string) => { if (files.has(path)) throw Error('Exists'); writes.push(path); return add(path, text); },
        read: async (file: TFile) => contents.get(file.path) ?? '', cachedRead: async (file: TFile) => contents.get(file.path) ?? '',
    }, metadataCache: { getFileCache: () => ({ tags: [{ tag: '#goals' }] }) }, workspace: { getLastOpenFiles: () => [] } } as unknown as App;
    return { app, files, contents, writes, add };
}

describe('Current-period queries', () => {
    it('recognizes complete queries case-insensitively without stealing incomplete names', () => {
        assert.deepEqual(parseSpecialSearch('@THISWEEK #goals'), { search: 'thisWeek', textQuery: '#goals' });
        assert.deepEqual(parseSpecialSearch('@thisYear text'), { search: 'thisYear', textQuery: 'text' });
        assert.equal(parseSpecialSearch('@thisY').search, null);
        assert.equal(parseSpecialSearch('@thisWeekLater').search, null);
    });
    it('keeps calendar-year identity separate from ISO week-year identity at New Year', async () => {
        const { app } = fixture(); const now = moment('2021-01-01').locale('en');
        assert.equal((await currentPeriodTarget(app, settings, 'thisWeek', now)).path, 'Weekly/2020-W53.md');
        assert.equal((await currentPeriodTarget(app, settings, 'thisYear', now)).path, 'Yearly/2021.md');
        assert.equal((await currentPeriodTarget(app, settings, 'thisYear', now.clone().year(2022))).path, 'Yearly/2022.md');
    });
    it('keeps an offered destination anchored if the clock moves into the next year before activation', async () => {
        const f = fixture(); const now = moment('2026-12-31');
        const target = await currentPeriodTarget(f.app, settings, 'thisYear', now);
        now.add(1, 'day');
        assert.equal(target.day, '2026-12-31');
        assert.equal((await target.create()).path, 'Yearly/2026.md');
        assert.equal((await currentPeriodTarget(f.app, settings, 'thisYear', now)).path, 'Yearly/2027.md');
    });
    it('supports configured yearly paths and templates with one creation per year', async () => {
        const f = fixture(); f.add('Templates/Year.md', '# {{title}}\n{{date:YYYY-MM-DD}}\n{{time:HH:mm}}');
        const config = await readYearlyNoteSettings(f.app, { ...settings, calendarYearlyFormat: 'YYYY/[Goals]', calendarYearlyTemplate: 'Templates/Year' });
        const results = await Promise.all([resolveYearlyNote(f.app, moment('2024-02-29'), config), resolveYearlyNote(f.app, moment('2024-12-31'), config)]);
        assert.equal(results[0], results[1]);
        assert.equal(f.contents.get('Yearly/2024/Goals.md'), '# Goals\n2024-01-01\n00:00');
        assert.deepEqual(f.writes, ['Yearly/2024/Goals.md']);
        assert.equal(await resolveYearlyNote(f.app, moment('2024-01-01'), { ...config, template: 'Missing' }), results[0]);
    });
    it('reads enabled yearly settings from legacy and active modern Periodic Notes configurations', async () => {
        for (const config of [
            { yearly: { enabled: true, folder: 'Journal', format: 'YYYY/[Annual]', template: 'Template' } },
            { activeCalendarSet: 'Work', calendarSets: [{ id: 'Other', year: { enabled: true, folder: 'Wrong' } }, { id: 'Work', year: { enabled: true, folder: 'Journal', format: 'YYYY/[Annual]', templatePath: 'Template' } }] },
        ]) {
            const result = await readYearlyNoteSettings(fixture(config).app, { ...settings, calendarUsePeriodicNotes: true });
            assert.equal(result.folder, 'Journal'); assert.equal(result.template, 'Template'); assert.equal(result.source, 'periodic');
        }
        const disabled = fixture({ yearly: { enabled: false, folder: 'Wrong' } });
        assert.equal((await readYearlyNoteSettings(disabled.app, { ...settings, calendarUsePeriodicNotes: true })).source, 'seam');
    });
    it('rejects invalid yearly formats and folder conflicts without writing anything', async () => {
        const f = fixture();
        await assert.rejects(readYearlyNoteSettings(f.app, { ...settings, calendarYearlyFormat: 'GGGG' }), /calendar year/);
        const config = await readYearlyNoteSettings(f.app, settings);
        f.files.set('Yearly/2026.md', new MockTFolder('Yearly/2026.md'));
        await assert.rejects(resolveYearlyNote(f.app, moment('2026-10-25'), config), /occupied/);
        await assert.rejects(resolveYearlyNote(f.app, moment('2027-01-01'), { ...config, template: 'Missing' }), /template not found/);
        assert.equal(f.writes.length, 0);
    });
    it('returns only the current note and composes with tags, text, and directory filters', async () => {
        const f = fixture();
        for (const period of ['thisWeek', 'thisYear'] as const) {
            const path = (await currentPeriodTarget(f.app, settings, period)).path;
            f.add(path, 'Focus on goals');
        }
        f.add('Unrelated.md', 'Focus on goals');
        const search = new SearchService(f.app, settings);
        for (const period of ['thisWeek', 'thisYear'] as const) {
            const expected = (await currentPeriodTarget(f.app, settings, period)).path;
            const results = await search.searchCombinedSpecialWithContent([{ search: period }], [], '#goals', 'Focus');
            assert.deepEqual(results.map(result => result.file.path), [expected]);
            assert.deepEqual(search.search('@' + period).map(result => result.file.path), [expected]);
            assert.deepEqual(await search.searchCombinedSpecialWithContent([{ search: period }], [], '#missing', ''), []);
            assert.deepEqual(await search.searchCombinedSpecialWithContent([{ search: period }], [], 'dir:Other', ''), []);
        }
    });
});
