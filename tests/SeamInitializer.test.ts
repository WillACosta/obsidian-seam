import './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { App } from 'obsidian';
import { MockTFile, MockTFolder } from './mocks/obsidian';
import { DEFAULT_SETTINGS, SeamSettings } from '../src/types';
import { BOOKSHELF_PATH, SETUP_FILES, SETUP_FOLDERS } from '../src/setup/SetupAssets';

// Native YAML/formula evaluation is covered in the real test-vault Base views.
Object.assign(require.cache['obsidian']!.exports, { requireApiVersion: () => true, parseYaml: (source: string) => source === SETUP_FILES[BOOKSHELF_PATH]
    ? { views: ['Bookshelf', 'Reading', 'Stopped', 'Unread'].map(name => ({ name, type: 'cards' })) } : JSON.parse(source) });
const { SeamInitializer } = require('../src/setup/SeamInitializer') as typeof import('../src/setup/SeamInitializer');

function fixture() {
    const storage = new Map<string, string | null>();
    const files = new Map<string, MockTFile | MockTFolder>();
    const writes: string[] = [];
    const configDir = '.alternate-config';
    const pluginDir = `${configDir}/plugins/seam`;
    for (const path of [configDir, `${configDir}/plugins`, pluginDir]) storage.set(path, null);
    let settings: SeamSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    const fail = new Set<string>();
    const write = (path: string, source: string | null) => {
        if (fail.has(path)) throw new Error('Read-only target');
        storage.set(path, source); writes.push(path);
    };
    const commands: Record<string, { hotkeys?: unknown[] }> = { 'seam:open-palette': {}, 'editor:insert-link': {} };
    const hotkeys: Record<string, unknown[]> = {};
    const core: Record<string, { enabled: boolean }> = { bases: { enabled: true }, templates: { enabled: true }, 'daily-notes': { enabled: true }, graph: { enabled: true } };
    const app = { vault: { configDir,
        getConfig: (key: string) => ['newFileLocation', 'newFileFolderPath', 'attachmentFolderPath', 'mobileQuickRibbonItem', 'mobilePullAction'].includes(key) ? '' : undefined,
        adapter: { exists: async (path: string) => storage.has(path), read: async (path: string) => { const content = storage.get(path); if (typeof content !== 'string') throw new Error('Not a file'); return content; },
            write: async (path: string, source: string) => write(path, source), mkdir: async (path: string) => write(path, null) },
        getAbstractFileByPath: (path: string) => files.get(path) ?? null,
        read: async (file: MockTFile) => storage.get(file.path) as string,
        createFolder: async (path: string) => { if (storage.has(path)) throw new Error('Exists'); write(path, null); const file = new MockTFolder(path); files.set(path, file); return file; },
        create: async (path: string, content: string) => { if (storage.has(path)) throw new Error('Exists'); write(path, content); const file = new MockTFile(path); files.set(path, file); return file; },
    }, internalPlugins: { plugins: core }, commands: { commands }, hotkeyManager: {
        getHotkeys: (id: string) => hotkeys[id], getDefaultHotkeys: (id: string) => commands[id]?.hotkeys,
    } } as unknown as App;
    const service = new SeamInitializer(app, pluginDir, () => settings, async next => {
        write(`${pluginDir}/data.json`, JSON.stringify(next)); settings = next;
    });
    function resource(path: string, content: string | null) { storage.set(path, content); files.set(path, content === null ? new MockTFolder(path) : new MockTFile(path)); }
    function config(file: string, content: unknown) { storage.set(`${configDir}/${file}`, typeof content === 'string' ? content : JSON.stringify(content)); }
    return { service, app, storage, files, writes, configDir, pluginDir, resource, config, fail, hotkeys, commands, core,
        get settings() { return settings; }, set settings(value) { settings = value; } };
}

describe('Initialize Seam safety and application', () => {
    it('previews without writes, applies only recommended resources/settings, and reruns without writes', async () => {
        const f = fixture(); f.resource('User note.md', '# untouched');
        const plan = await f.service.preview();
        assert.equal(f.writes.length, 0);
        const report = await f.service.apply(plan);
        assert.deepEqual(report.results.filter(item => item.outcome === 'failed'), []);
        for (const folder of SETUP_FOLDERS) assert.equal(f.storage.get(folder), null);
        for (const [path, source] of Object.entries(SETUP_FILES)) assert.equal(f.storage.get(path), source);
        assert.equal(f.storage.get('User note.md'), '# untouched');
        assert.deepEqual(f.settings.customSpecialSearches.map(item => [item.identifier, item.baseView]), [['@bookshelf', 'Bookshelf'], ['@reading', 'Reading']]);
        assert.equal(f.settings.fleetingNoteTemplate, 'Resources/Templates/Fleeting Note Template.md');
        assert.equal(f.settings.archiveFolder, 'Resources/Archive');
        assert.equal(f.storage.has('Archive'), false);
        assert.equal(JSON.parse(f.storage.get(`${f.configDir}/app.json`) as string).newFileFolderPath, 'Fleeting');
        assert.equal(JSON.parse(f.storage.get(`${f.configDir}/core-plugins.json`)! as string).graph, true);
        assert.equal(report.results.filter(item => item.restart).length, 6);
        const again = await f.service.preview(); const count = f.writes.length;
        assert.ok(again.items.every(item => item.status === 'existing'));
        await f.service.apply(again); assert.equal(f.writes.length, count);
    });
    it('preserves customized templates/Base content, unrelated config values, types, hotkeys, and unknown Seam settings', async () => {
        const f = fixture(); f.resource('Resources/Templates/Book Template.md', 'custom book');
        f.resource('Archive', null); f.resource('Archive/Original.md', 'Previously archived note');
        f.resource(BOOKSHELF_PATH, JSON.stringify({ views: [{ name: 'Bookshelf', type: 'cards' }, { name: 'Reading', type: 'cards' }], custom: true }));
        f.config('app.json', { unrelated: 42, attachmentFolderPath: 'Old' });
        f.config('types.json', { types: { rating: 'text', other: 'checkbox' }, other: 7 });
        f.config('hotkeys.json', { unrelated: [{ modifiers: ['Alt'], key: 'A' }] });
        f.storage.set(`${f.pluginDir}/data.json`, JSON.stringify({ ...f.settings, unknownSetting: { preserved: true } }));
        const plan = await f.service.preview();
        assert.ok(plan.items.find(item => item.target.endsWith('/types.json'))!.details!.some(detail => detail.includes('"text" → "number"')));
        const report = await f.service.apply(plan);
        assert.equal(report.results.filter(item => item.outcome === 'failed').length, 0);
        assert.equal(f.storage.get('Resources/Templates/Book Template.md'), 'custom book');
        assert.equal(f.settings.archiveFolder, 'Resources/Archive');
        assert.equal(f.storage.get('Archive/Original.md'), 'Previously archived note');
        assert.ok(f.files.get('Archive') instanceof MockTFolder);
        assert.ok(f.storage.get(BOOKSHELF_PATH)?.includes('"custom":true'));
        assert.equal(JSON.parse(f.storage.get(`${f.configDir}/app.json`) as string).unrelated, 42);
        assert.equal(JSON.parse(f.storage.get(`${f.configDir}/types.json`) as string).types.other, 'checkbox');
        assert.ok(JSON.parse(f.storage.get(`${f.configDir}/hotkeys.json`) as string).unrelated);
        assert.deepEqual(JSON.parse(f.storage.get(`${f.pluginDir}/data.json`) as string).unknownSetting, { preserved: true });
        assert.ok(report.backupDir);
        assert.equal(f.storage.get(`${report.backupDir}/app.json`), JSON.stringify({ unrelated: 42, attachmentFolderPath: 'Old' }));
    });
    for (const format of ['array', 'object']) it(`preserves ${format} core plugin format and unrelated enabled plugins`, async () => {
        const f = fixture(); f.config('core-plugins.json', format === 'array' ? ['graph', 'unknown-core'] : { graph: true, 'unknown-core': true, bases: false });
        await f.service.apply(await f.service.preview());
        const core = JSON.parse(f.storage.get(`${f.configDir}/core-plugins.json`) as string);
        assert.equal(Array.isArray(core), format === 'array');
        if (format === 'array') assert.deepEqual(core, ['graph', 'unknown-core', 'daily-notes', 'templates', 'bases']);
        else { assert.equal(core.graph, true); assert.equal(core['unknown-core'], true); assert.equal(core.bases, true); }
    });
    it('detects default and persisted hotkey conflicts without changing either binding', async () => {
        for (const source of ['default', 'custom']) {
            const f = fixture();
            if (source === 'default') f.commands['editor:insert-link'].hotkeys = [{ modifiers: ['Mod'], key: 'k' }];
            else f.config('hotkeys.json', { 'editor:insert-link': [{ modifiers: ['Mod'], key: 'K' }] });
            const plan = await f.service.preview();
            assert.equal(plan.items.find(item => item.target.endsWith('/hotkeys.json'))?.reason, 'hotkeyConflict');
            await f.service.apply(plan);
            assert.ok(!f.writes.includes(`${f.configDir}/hotkeys.json`));
        }
    });
    it('preserves alias collisions case-insensitively and never restores customized generated searches', async () => {
        const f = fixture();
        f.settings.customSpecialSearches.push({ id: 'user-search', identifier: '@BOOKSHELF', mode: 'tags', filterQuery: '#personal', basePath: '', baseView: '', icon: 'search', pinned: true, hidden: false });
        const plan = await f.service.preview(); assert.equal(plan.items.find(item => item.target === '@bookshelf')?.reason, 'aliasConflict');
        await f.service.apply(plan); assert.equal(f.settings.customSpecialSearches[0].filterQuery, '#personal');
        assert.equal(f.settings.customSpecialSearches.length, 2);
    });
    it('preserves corrupted or malformed JSON instead of replacing it', async () => {
        for (const source of ['{bad', '[]', 'null', '{"types": []}']) {
            const f = fixture(); f.config('types.json', source); const plan = await f.service.preview();
            assert.equal(plan.items.find(item => item.target.endsWith('/types.json'))?.reason, 'invalidJson');
            await f.service.apply(plan); assert.equal(f.storage.get(`${f.configDir}/types.json`), source);
        }
    });
    it('skips changed targets and catches independent write failures without overwriting notes', async () => {
        const f = fixture(); f.config('app.json', { original: true });
        const plan = await f.service.preview();
        f.config('app.json', { synced: true }); f.resource('Resources/Templates/Book Template.md', 'synced user content');
        f.fail.add(`${f.configDir}/types.json`);
        const report = await f.service.apply(plan);
        assert.equal(f.storage.get(`${f.configDir}/app.json`), '{"synced":true}');
        assert.equal(f.storage.get('Resources/Templates/Book Template.md'), 'synced user content');
        assert.ok(report.results.some(item => item.target.endsWith('/types.json') && item.outcome === 'failed'));
        assert.ok(f.settings.customSpecialSearches.length === 2);
    });
    it('blocks folder collisions and skips dependent settings and searches', async () => {
        const f = fixture(); f.resource('Resources', 'existing note');
        const plan = await f.service.preview();
        assert.ok(plan.items.filter(item => item.target.startsWith('Resources')).every(item => item.status === 'conflict'));
        const report = await f.service.apply(plan);
        assert.equal(f.storage.get('Resources'), 'existing note'); assert.equal(f.settings.customSpecialSearches.length, 0);
        assert.equal(f.settings.sourcesFolder, DEFAULT_SETTINGS.sourcesFolder);
        assert.ok(report.results.some(item => item.reason === 'dependency'));
    });
    it('reports unavailable capabilities and skips dependent searches while applying unrelated work', async () => {
        const f = fixture(); delete f.core.bases; delete f.commands['seam:open-palette'];
        const plan = await f.service.preview();
        assert.equal(plan.items.find(item => item.target === '@bookshelf')?.status, 'unsupported');
        await f.service.apply(plan); assert.ok(f.storage.has('Fleeting')); assert.equal(f.settings.customSpecialSearches.length, 0);
        assert.ok(!f.writes.includes(`${f.configDir}/hotkeys.json`));
    });
    it('blocks replay, stale config directories, disposed services, and previews from another initializer', async () => {
        const f = fixture(); const plan = await f.service.preview();
        await assert.rejects(fixture().service.apply(plan));
        await f.service.apply(plan); await assert.rejects(f.service.apply(plan));
        const other = fixture(); const stale = await other.service.preview(); other.app.vault.configDir = '.changed';
        await assert.rejects(other.service.apply(stale)); assert.equal(other.writes.length, 0);
        other.service.dispose(); await assert.rejects(other.service.preview());
    });
    it('requires a recoverable snapshot before overwriting configuration', async () => {
        const f = fixture(); f.config('app.json', { original: true });
        const plan = await f.service.preview(); f.fail.add(`${f.pluginDir}/setup-backups/${plan.id}/app.json`);
        const report = await f.service.apply(plan);
        assert.equal(f.storage.get(`${f.configDir}/app.json`), '{"original":true}');
        assert.ok(report.results.some(item => item.target.endsWith('/app.json') && item.outcome === 'failed'));
    });
    it('previews malformed Seam settings as conflicts and keeps dependent writes out of the plan', async () => {
        const f = fixture(); f.storage.set(`${f.pluginDir}/data.json`, '{bad');
        const plan = await f.service.preview();
        assert.ok(plan.items.filter(item => item.group === 'searches' && item.status !== 'existing').every(item => item.status === 'conflict' && item.reason === 'invalidJson'));
        await f.service.apply(plan); assert.equal(f.storage.get(`${f.pluginDir}/data.json`), '{bad');
    });
    it('rejects synced Seam settings and newly assigned runtime shortcuts after preview', async () => {
        const f = fixture(); const plan = await f.service.preview();
        f.storage.set(`${f.pluginDir}/data.json`, JSON.stringify({ synced: true }));
        f.hotkeys['editor:insert-link'] = [{ modifiers: ['Mod'], key: 'K' }];
        const report = await f.service.apply(plan);
        assert.equal(f.storage.get(`${f.pluginDir}/data.json`), '{"synced":true}');
        assert.equal(f.settings.customSpecialSearches.length, 0);
        assert.ok(report.results.some(item => item.target.endsWith('/hotkeys.json') && item.reason === 'changed'));
    });
    it('preserves an existing Base without required views and skips its aliases', async () => {
        const f = fixture(); const custom = '{"views":[{"name":"Custom","type":"table"}]}'; f.resource(BOOKSHELF_PATH, custom);
        const plan = await f.service.preview(); assert.equal(plan.items.find(item => item.target === '@reading')?.reason, 'missingView');
        await f.service.apply(plan); assert.equal(f.storage.get(BOOKSHELF_PATH), custom); assert.equal(f.settings.customSpecialSearches.length, 0);
    });
    it('honors explicitly removed default shortcuts and reports unverified app settings', async () => {
        const f = fixture(); f.commands['editor:insert-link'].hotkeys = [{ modifiers: ['Mod'], key: 'K' }];
        f.config('hotkeys.json', { 'editor:insert-link': [] });
        (f.app.vault as unknown as { getConfig: (key: string) => unknown }).getConfig = () => undefined;
        const plan = await f.service.preview();
        assert.ok(plan.items.filter(item => item.target.startsWith('app.json')).every(item => item.status === 'unsupported'));
        assert.equal(plan.items.find(item => item.target.endsWith('/hotkeys.json'))?.status, 'update');
        await f.service.apply(plan); assert.ok(!f.storage.has(`${f.configDir}/app.json`));
        assert.deepEqual(JSON.parse(f.storage.get(`${f.configDir}/hotkeys.json`) as string)['editor:insert-link'], []);
    });
});
