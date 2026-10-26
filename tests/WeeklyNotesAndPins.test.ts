import './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { moment } from 'obsidian';
import type { App, TFile } from 'obsidian';
import { MockTFile, MockTFolder } from './mocks/obsidian';
import { DEFAULT_SETTINGS, SeamSettings } from '../src/types';
import { CalendarPins, normalizeCalendarPins } from '../src/calendar/CalendarPins';
import { findWeeklyNote, readWeeklyNoteSettings, resolveWeeklyNote, weekKey, weekStart, weeklyNotePath, WeeklyNoteSettings } from '../src/calendar/WeeklyNotes';
import { CalendarModel } from '../src/calendar/CalendarModel';

const defaults = (): SeamSettings => ({ ...DEFAULT_SETTINGS, calendarPins: [], calendarUsePeriodicNotes: false });
const iso: WeeklyNoteSettings = { folder: 'Weekly', format: 'GGGG/[W]WW', template: '', iso: true, source: 'seam' };
const date = (value: string) => moment(value, 'YYYY-MM-DD', true).locale('en');
function vaultFixture(periodic?: unknown) {
    const files = new Map<string, MockTFile | MockTFolder>();
    const text = new Map<string, string>();
    const writes: string[] = [];
    const events = new Map<string, Function>();
    const app = { vault: {
        configDir: '.obsidian',
        adapter: { exists: async () => periodic !== undefined, read: async () => JSON.stringify(periodic) },
        getAbstractFileByPath: (path: string) => files.get(path) ?? null,
        read: async (file: MockTFile) => text.get(file.path) ?? '',
        createFolder: async (path: string) => { if (files.has(path)) throw Error('Exists'); const folder = new MockTFolder(path); files.set(path, folder); return folder; },
        create: async (path: string, content: string) => { if (files.has(path)) throw Error('Exists'); const file = new MockTFile(path); files.set(path, file); text.set(path, content); writes.push(path); return file; },
        on: (name: string, callback: Function) => { events.set(name, callback); return {}; },
    } } as unknown as App;
    const add = (path: string, content = '') => { const file = new MockTFile(path); files.set(path, file); text.set(path, content); return file as unknown as TFile; };
    return { app, files, text, writes, events, add };
}
function pinFixture(periodic?: unknown, save = async () => {}) {
    const fixture = vaultFixture(periodic);
    const settings = defaults();
    const service = new CalendarPins(fixture.app, () => settings, save);
    Object.assign(service, { registerEvent: () => {} });
    service.onload();
    return { ...fixture, settings, service };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

describe('Weekly configuration and boundaries', () => {
    it('uses Seam defaults without a Periodic Notes dependency', async () => {
        const { app } = vaultFixture();
        assert.deepEqual(await readWeeklyNoteSettings(app, defaults()), { folder: 'Weekly', format: 'gggg-[W]ww', template: '', iso: false, source: 'seam' });
    });
    it('reads enabled legacy Periodic Notes settings and respects opting out', async () => {
        const { app } = vaultFixture({ weekly: { enabled: true, folder: 'Journal', format: 'GGGG-[W]WW', template: 'Templates/Week' } });
        const settings = defaults(); settings.calendarUsePeriodicNotes = true;
        const result = await readWeeklyNoteSettings(app, settings);
        assert.equal(result.source, 'periodic'); assert.equal(result.iso, true); assert.equal(result.template, 'Templates/Week');
        settings.calendarUsePeriodicNotes = false;
        assert.equal((await readWeeklyNoteSettings(app, settings)).source, 'seam');
    });
    it('uses the active modern calendar set and its templatePath', async () => {
        const { app } = vaultFixture({ activeCalendarSet: 'Work', calendarSets: [{ id: 'Other', week: { enabled: true, folder: 'Other' } }, { id: 'Work', week: { enabled: true, folder: 'Work', format: 'gggg-[W]ww', templatePath: 'Template' } }] });
        const settings = defaults(); settings.calendarUsePeriodicNotes = true;
        const result = await readWeeklyNoteSettings(app, settings);
        assert.equal(result.folder, 'Work'); assert.equal(result.template, 'Template');
    });
    it('falls back for disabled weekly settings and rejects malformed configuration', async () => {
        const settings = { ...defaults(), calendarUsePeriodicNotes: true };
        assert.equal((await readWeeklyNoteSettings(vaultFixture({ weekly: { enabled: false } }).app, settings)).source, 'seam');
        await assert.rejects(readWeeklyNoteSettings(vaultFixture({ calendarSets: [], activeCalendarSet: 'Missing' }).app, settings), /active calendar set/);
        for (const format of ['YYYY-[W]WW', 'gggg-[W]WW', 'GGGG-[W]ww', 'YYYY']) {
            await assert.rejects(readWeeklyNoteSettings(vaultFixture().app, { ...settings, calendarWeeklyFormat: format }), /Weekly format/);
        }
    });
    it('uses week-years across New Year for ISO and locale weeks', () => {
        assert.equal(weeklyNotePath(date('2021-01-01'), iso), 'Weekly/2020/W53.md');
        assert.equal(weekKey(date('2021-01-03'), iso), '2020-12-28');
        assert.equal(weekKey(date('2021-01-04'), iso), '2021-01-04');
        const local = { ...iso, iso: false, format: 'gggg-[W]ww' };
        assert.equal(weeklyNotePath(date('2021-01-01'), local), 'Weekly/2021-W01.md');
        assert.equal(weekKey(date('2021-01-03'), local), '2021-01-03');
        assert.equal(weekStart(date('2024-02-29'), iso).format('YYYY-MM-DD'), '2024-02-26');
    });
    it('aligns the calendar grid and Home/End with ISO weekly notes', () => {
        const model = new CalendarModel(date('2021-01-01'), 'en', true);
        assert.equal(model.days()[0].day(), 1);
        model.move('Home'); assert.equal(model.selected.format('YYYY-MM-DD'), '2020-12-28');
        model.move('End'); assert.equal(model.selected.format('YYYY-MM-DD'), '2021-01-03');
    });
});

describe('Weekly creation', () => {
    it('creates one note per week with nested paths and weekday template tokens', async () => {
        const fixture = vaultFixture(); fixture.add('Templates/Weekly.md', '# {{title}}\n{{date:YYYY-MM-DD}}\n{{monday:YYYY-MM-DD}}–{{sunday:YYYY-MM-DD}}');
        const settings = { ...iso, template: 'Templates/Weekly' };
        const results = await Promise.all([resolveWeeklyNote(fixture.app, date('2021-01-01'), settings), resolveWeeklyNote(fixture.app, date('2021-01-02'), settings)]);
        assert.equal(results[0], results[1]);
        assert.equal(fixture.text.get('Weekly/2020/W53.md'), '# W53\n2020-12-28\n2020-12-28–2021-01-03');
        assert.equal(fixture.writes.length, 1);
        await resolveWeeklyNote(fixture.app, date('2021-01-04'), settings);
        assert.deepEqual(fixture.writes, ['Weekly/2020/W53.md', 'Weekly/2021/W01.md']);
    });
    it('never overwrites existing notes or folder conflicts and reports missing templates', async () => {
        const fixture = vaultFixture(); const existing = fixture.add('Weekly/2020/W53.md', 'Keep this');
        assert.equal(findWeeklyNote(fixture.app, date('2021-01-01'), iso), existing);
        assert.equal(await resolveWeeklyNote(fixture.app, date('2021-01-01'), { ...iso, template: 'Missing' }), existing);
        assert.equal(fixture.text.get(existing.path), 'Keep this');
        fixture.files.set('Weekly/2021/W01.md', new MockTFolder('Weekly/2021/W01.md'));
        await assert.rejects(resolveWeeklyNote(fixture.app, date('2021-01-04'), iso), /occupied/);
        await assert.rejects(resolveWeeklyNote(fixture.app, date('2021-01-11'), { ...iso, template: 'Missing' }), /template not found/);
        assert.equal(fixture.writes.length, 0);
    });
});

describe('Persistent calendar pins', () => {
    it('normalizes legacy or invalid input without duplicate pins or more than three entries', () => {
        assert.deepEqual(normalizeCalendarPins(null), []);
        const pins = normalizeCalendarPins([{ kind: 'file', path: 'Goals.md' }, { kind: 'file', path: 'Goals.md' }, { kind: 'weekly' }, { kind: 'weekly' }, { kind: 'file', path: 'Plan.md' }, { kind: 'file', path: 'Extra.md' }, { kind: 'file', path: 'Photo.png' }]);
        assert.deepEqual(pins, [{ kind: 'file', path: 'Goals.md' }, { kind: 'weekly' }, { kind: 'file', path: 'Plan.md' }]);
    });
    it('serializes additions so concurrent operations cannot exceed the three-slot limit', async () => {
        const fixture = pinFixture(); const files = ['A', 'B', 'C', 'D'].map(name => fixture.add(name + '.md'));
        const results = await Promise.allSettled(files.map(file => fixture.service.pinFile(file)));
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 3);
        assert.deepEqual(fixture.service.pins.map(pin => pin.path), ['A.md', 'B.md', 'C.md']);
        await fixture.service.pinFile(files[0]); assert.equal(fixture.service.pins.length, 3);
    });
    it('rolls back failed saves and permits retry without losing other pins', async () => {
        let fail = true;
        const fixture = pinFixture(undefined, async () => { if (fail) throw Error('Disk full'); });
        const file = fixture.add('Goals.md');
        await assert.rejects(fixture.service.pinFile(file), /Disk full/);
        assert.equal(fixture.service.pins.length, 0);
        fail = false; await fixture.service.pinFile(file); assert.equal(fixture.service.pins.length, 1);
    });
    it('counts the weekly slot and upgrades a fixed current-week pin without duplication', async () => {
        const fixture = pinFixture(); const now = date('2021-01-01');
        await fixture.service.pinFile(fixture.add(weeklyNotePath(now, iso)));
        await fixture.service.pinFile(fixture.add('Goals.md')); await fixture.service.pinFile(fixture.add('Plan.md'));
        await fixture.service.pinWeek(iso, now);
        assert.equal(fixture.service.pins.length, 3); assert.equal(fixture.service.rolling, true);
        assert.equal(fixture.service.hasFile(weeklyNotePath(now, iso)), false);
        await fixture.service.pinWeek(iso, now); assert.equal(fixture.service.pins.length, 3);
    });
    it('resolves the actual current week at rollover, without creating or replacing notes', async () => {
        const fixture = pinFixture(); await fixture.service.pinWeek(iso, date('2021-01-01'));
        const pin = fixture.service.pins[0]; assert.equal(pin.kind, 'weekly'); if (pin.kind !== 'weekly') return;
        assert.equal(fixture.service.weeklyTarget(pin, iso, date('2021-01-04')), 'Weekly/2021/W01.md');
        assert.equal(fixture.writes.length, 0);
    });
    it('follows file and folder renames and removes deleted references', async () => {
        const fixture = pinFixture(); const file = fixture.add('Goals/Annual.md'); await fixture.service.pinFile(file);
        fixture.files.delete(file.path); file.path = 'Plans/Annual.md'; fixture.files.set(file.path, file as unknown as MockTFile);
        fixture.events.get('rename')!(new MockTFolder('Plans'), 'Goals'); await settle();
        assert.equal(fixture.service.pins[0].path, 'Plans/Annual.md');
        fixture.files.delete(file.path); fixture.events.get('delete')!(new MockTFolder('Plans')); await settle();
        assert.equal(fixture.service.pins.length, 0);
    });
    it('does not discard a moving fixed pin when reconciliation runs during a weekly-settings read', async () => {
        const fixture = pinFixture(); const file = fixture.add('Goals.md');
        await fixture.service.pinFile(file);
        const weekly = await readWeeklyNoteSettings(fixture.app, fixture.settings);
        await fixture.service.pinWeek(weekly);
        fixture.files.delete(file.path); file.path = 'Renamed.md'; fixture.files.set(file.path, file as unknown as MockTFile);
        fixture.events.get('rename')!(file, 'Goals.md');
        await fixture.service.reconcile();
        assert.equal(fixture.service.hasFile('Renamed.md'), true);
        assert.equal(fixture.service.pins.length, 2);
    });
    it('follows a renamed rolling note during its week, and removes its pin when deleted', async () => {
        const fixture = pinFixture(); const now = moment().locale('en');
        const settings = await readWeeklyNoteSettings(fixture.app, fixture.settings);
        const original = weeklyNotePath(now, settings); const file = fixture.add(original);
        await fixture.service.pinWeek(settings, now);
        fixture.files.delete(original); file.path = 'Goals/This week.md'; fixture.files.set(file.path, file as unknown as MockTFile);
        fixture.events.get('rename')!(file, original); await settle();
        let pin = fixture.service.pins[0]; if (pin.kind !== 'weekly') return assert.fail('Expected weekly pin');
        assert.equal(fixture.service.weeklyTarget(pin, settings, now), 'Goals/This week.md');
        assert.notEqual(fixture.service.weeklyTarget(pin, settings, now.clone().add(7, 'days')), 'Goals/This week.md');
        fixture.files.delete(file.path); fixture.events.get('delete')!(file); await settle();
        assert.equal(fixture.service.pins.length, 0);
    });
    it('recognizes the rolling target for contextual unpin and does not duplicate it as a fixed pin', async () => {
        const fixture = pinFixture();
        fixture.settings.calendarWeeklyFormat = iso.format;
        const now = moment().locale('en');
        const file = fixture.add(weeklyNotePath(now, iso));
        await fixture.service.pinWeek(iso, now);
        const pin = fixture.service.pinForFile(file.path);
        assert.equal(pin?.kind, 'weekly');
        await fixture.service.pinFile(file);
        assert.equal(fixture.service.pins.length, 1);
        await fixture.service.unpin(pin!);
        assert.equal(fixture.service.pins.length, 0);
    });
    it('reconciles deleted fixed pins but keeps a rolling slot for a not-yet-created week', async () => {
        const fixture = pinFixture(); await fixture.service.pinFile(fixture.add('Gone.md')); await fixture.service.pinWeek(iso, date('2021-01-01'));
        fixture.files.delete('Gone.md'); await fixture.service.reconcile();
        assert.deepEqual(fixture.service.pins.map(pin => pin.kind), ['weekly']);
    });
});
