import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockTFile } from './mocks/obsidian';
import { parseQuery } from '../src/search/QueryParser';
import { findSearchMatches, SearchService } from '../src/search/SearchService';
import { DEFAULT_SETTINGS } from '../src/types';

describe('Directory filtering and match counts', () => {
    const files = ['Fleeting/AI.md', 'Fleeting/Nested/AI.md', 'Fleeting elsewhere/AI.md', 'Permanent/AI.md'].map(path => new MockTFile(path));
    const app = {
        vault: { getMarkdownFiles: () => files, cachedRead: async () => 'AI helps. ai helps again. #ai' },
        metadataCache: { getFileCache: () => ({ tags: [{ tag: '#ai' }] }) },
    } as never;
    it('parses quoted paths, exclusions and directory OR branches', () => {
        const parsed = parseQuery('/"My Notes" #ai !#archived OR /Permanent');
        assert.equal(parsed.isValid, true);
        assert.deepEqual(parsed.tokens[0], { type: 'directory', value: 'My Notes' });
        assert.equal(parseQuery('/').isValid, false);
        assert.deepEqual(parseQuery('dir:Permanent').tokens, [{ type: 'directory', value: 'Permanent' }]);
    });
    it('matches the folder and descendants without matching similarly named folders', async () => {
        const service = new SearchService(app, DEFAULT_SETTINGS);
        assert.deepEqual(service.search('/Fleeting #ai').map(result => result.path), files.slice(0, 2).map(file => file.path));
        const results = await service.searchFilteredWithContent('/Fleeting #ai !#archived', 'AI');
        assert.equal(results.length, 2);
        assert.equal(results[0].matchCount, 4);
        assert.deepEqual(results[0].searchTerms, ['AI']);
    });
    it('supports directory-only and OR queries', () => {
        const service = new SearchService(app, DEFAULT_SETTINGS);
        assert.equal(service.search('/Fleeting').length, 2);
        assert.equal(service.search('/Fleeting OR /Permanent').length, 3);
        assert.deepEqual(service.search('/"Fleeting elsewhere"').map(result => result.path), [files[2].path]);
        assert.equal(service.search('dir:Fleeting').length, 2);
    });
    it('counts literal case-insensitive matches even when the filename matches', async () => {
        const service = new SearchService(app, DEFAULT_SETTINGS);
        const results = await service.searchWithContent('AI');
        assert.equal(results[0].matchCount, 4);
        assert.deepEqual(findSearchMatches('a+b A+B', ['a+b']), [{ start: 0, end: 3 }, { start: 4, end: 7 }]);
        assert.deepEqual(findSearchMatches('anything', ['']), []);
    });
    it('finds attachments by name, extension and directory without reading them as text', async () => {
        const note = new MockTFile('Fleeting/Report.md');
        const pdf = new MockTFile('Fleeting/Report.pdf');
        const image = new MockTFile('Fleeting/image.png');
        const sheet = new MockTFile('Data/budget.xlsx');
        const readPaths: string[] = [];
        const vault = {
            getFiles: () => [note, pdf, image, sheet],
            getMarkdownFiles: () => [note],
            cachedRead: async (file: MockTFile) => {
                readPaths.push(file.path);
                return 'Report content';
            },
        };
        const service = new SearchService({ vault, metadataCache: { getFileCache: () => ({}) } } as never, DEFAULT_SETTINGS);
        assert.deepEqual((await service.searchWithContent('Report')).map(result => result.path), [note.path, pdf.path]);
        assert.deepEqual((await service.searchWithContent('.xlsx')).map(result => result.path), [sheet.path]);
        assert.deepEqual((await service.searchWithContent('/Fleeting')).map(result => result.path), [image.path, note.path, pdf.path]);
        assert.deepEqual(readPaths, [note.path, note.path, note.path]);
    });

    it('intersects multiple built-in and Seam special filters with tag additions', async () => {
        const todo = new MockTFile('Fleeting/electronics.md');
        const archived = new MockTFile('Fleeting/archived.md');
        const completed = new MockTFile('Permanent/completed.md');
        const vaultFiles = [todo, archived, completed];
        const app = {
            vault: { getFiles: () => vaultFiles, getMarkdownFiles: () => vaultFiles, cachedRead: async () => '' },
            metadataCache: {
                getFileCache: (file: MockTFile) => ({
                    tags: file.path === completed.path ? [{ tag: '#electronics' }, { tag: '#ai' }] : [{ tag: '#electronics' }, { tag: file.path === archived.path ? '#archived' : '#ai' }],
                    listItems: file.path === completed.path ? [{ task: 'x' }] : [{ task: ' ' }],
                }),
            },
        } as never;
        const service = new SearchService(app, DEFAULT_SETTINGS);

        const results = await service.searchCombinedSpecialWithContent(
            [{ search: 'task' }, { search: 'todo' }],
            ['#electronics', '#ai'],
            '!#archived',
            '',
        );
        assert.deepEqual(results.map(result => result.file.path), [todo.path]);

        const mixedBase = await service.searchCombinedSpecialWithContent(
            [{ search: 'task' }, { search: 'done' }],
            [],
            '',
            '',
        );
        assert.deepEqual(mixedBase.map(result => result.file.path), [completed.path]);
    });
});
