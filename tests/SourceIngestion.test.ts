import { MockTFile, MockTFolder } from './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { App, TFile } from 'obsidian';
import { SourceIngestion } from '../src/automation/SourceIngestion';
import { AutomationService } from '../src/automation/AutomationService';
import { Reconciler } from '../src/automation/Reconciler';
import { AutomationQueue } from '../src/automation/AutomationQueue';
import { DEFAULT_SETTINGS } from '../src/types';
import { matchesSpecialSearch, parseSpecialSearch, SearchService } from '../src/search/SearchService';

function fixture() {
    const settings = { ...DEFAULT_SETTINGS };
    const entries = new Map<string, MockTFile | MockTFolder>();
    const contents = new Map<string, string>();
    let failCreate = false;
    const add = (path: string, content = '') => {
        const file = new MockTFile(path);
        entries.set(path, file);
        contents.set(path, content);
        return file as TFile;
    };
    const app = {
        vault: {
            getFiles: () => [...entries.values()].filter(file => file instanceof MockTFile),
            getMarkdownFiles: () => [...entries.values()].filter(file => file instanceof MockTFile && file.extension === 'md'),
            getAbstractFileByPath: (path: string) => entries.get(path),
            cachedRead: async (file: TFile) => contents.get(file.path) ?? '',
            createFolder: async (path: string) => { entries.set(path, new MockTFolder(path)); },
            create: async (path: string, content: string) => {
                if (failCreate) throw new Error('Disk full');
                if (entries.has(path)) throw new Error('Already exists');
                return add(path, content);
            },
        },
        metadataCache: {
            getFileCache: () => null,
            fileToLinktext: (file: TFile) => file.path,
            getFirstLinkpathDest: (link: string, sourcePath: string) => {
                const exact = entries.get(link.replace(/^\//, ''));
                if (exact instanceof MockTFile) return exact;
                const relative = entries.get(sourcePath.split('/').slice(0, -1).concat(link).join('/'));
                if (relative instanceof MockTFile) return relative;
                return [...entries.values()].find(file => file instanceof MockTFile && file.name === link) ?? null;
            },
        },
    } as unknown as App;
    return { app, settings, entries, contents, add, service: new SourceIngestion(app, settings), fail: () => { failCreate = true; } };
}

describe('Source ingestion', () => {
    it('enqueues existing documents when an enabled source folder changes in place', async () => {
        const f = fixture();
        f.add('Sources/old.pdf');
        const first = f.add('Imports/class.pdf');
        const second = f.add('Imports/Nested/lecture.docx');
        f.add('Imports/app.exe');
        f.add('Imports elsewhere/outside.pdf');
        const service = new AutomationService(f.app, f.settings);
        const queued: TFile[] = [];
        const queue = { enqueue: (file: TFile) => queued.push(file) } as AutomationQueue;
        const reconciler = new Reconciler(f.app, f.settings, queue, service);

        f.settings.sourcesFolder = 'Imports';
        service.updateSettings(f.settings);
        reconciler.updateSettings(f.settings);
        assert.deepEqual(queued.map(file => file.path), [first.path, second.path]);
        for (const file of queued) assert.equal((await service.processFile(file)).status, 'success');
        assert.ok(f.app.vault.getAbstractFileByPath('Fleeting/class.md'));
        assert.ok(f.app.vault.getAbstractFileByPath('Fleeting/lecture.md'));

        queued.length = 0;
        f.settings.showIcons = !f.settings.showIcons;
        reconciler.updateSettings(f.settings);
        assert.deepEqual(queued, [], 'Unrelated settings must not restart source processing');
    });

    it('defers source scans while disabled and scans the current folder when enabled', () => {
        const f = fixture();
        f.settings.sourceAutomation = false;
        const source = f.add('Imports/class.pdf');
        const service = new AutomationService(f.app, f.settings);
        const queued: string[] = [];
        const queue = { enqueue: (file: TFile) => queued.push(file.path) } as AutomationQueue;
        const reconciler = new Reconciler(f.app, f.settings, queue, service);

        f.settings.sourcesFolder = 'Imports';
        service.updateSettings(f.settings);
        reconciler.updateSettings(f.settings);
        assert.deepEqual(queued, []);

        f.settings.sourceAutomation = true;
        service.updateSettings(f.settings);
        reconciler.updateSettings(f.settings);
        assert.deepEqual(queued, [source.path]);

        queued.length = 0;
        f.settings.sourceAutomation = false;
        reconciler.updateSettings(f.settings);
        assert.deepEqual(queued, []);
    });

    it('uses folder boundaries, subfolders and supported extensions', () => {
        const f = fixture();
        for (const path of ['Sources/a.pdf', 'Sources/nested/A.PNG', 'Sources/a.exe', 'Sources2/a.pdf', 'Elsewhere/a.png']) f.add(path);
        assert.deepEqual(f.service.getAttachments().map(file => file.path), ['Sources/a.pdf', 'Sources/nested/A.PNG']);
        f.settings.sourcesFolder = '';
        assert.equal(f.service.getAttachments().length, 4);
        f.settings.sourcesFolder = '../Sources';
        assert.equal(f.service.getAttachments().length, 0);
    });

    it('creates the minimal default layout in nested Fleeting folders', async () => {
        const f = fixture();
        f.settings.fleetingFolder = 'Notes/Fleeting';
        const result = await f.service.createCompanion(f.add('Sources/class.pdf'));
        assert.equal(result.status, 'success');
        assert.equal(result.newPath, 'Notes/Fleeting/class.md');
        const content = f.contents.get(result.newPath!)!;
        assert.match(content, /"source"/);
        assert.doesNotMatch(content, /source_app|source_attachment/);
        assert.match(content, /"captured": "\d{4}-\d{2}-\d{2}"/);
        assert.match(content, /"cssclasses": \[\n\s+"seam-source-pdf"\n\s*\]/);
        assert.match(content, /## Original\n\n!\[\[Sources\/class.pdf\]\]/);
    });

    it('creates source notes for common document formats with navigable original links', async () => {
        const f = fixture();
        for (const extension of ['doc', 'docx', 'odt', 'rtf', 'txt', 'csv', 'tsv', 'xlsx', 'ods', 'pptx', 'odp', 'epub', 'html', 'pages', 'numbers', 'key']) {
            const attachment = f.add(`Sources/document.${extension}`);
            assert.equal(f.service.isSource(attachment), true, extension);
            const result = await f.service.createCompanion(attachment);
            assert.equal(result.status, 'success', extension);
            const content = f.contents.get(result.newPath!)!;
            assert.ok(content.includes(`## Original\n\n[[${attachment.path}]]`), extension);
            assert.doesNotMatch(content, /!\[\[|source_app|source_attachment|seam-source-pdf/);
            const repeat = await f.service.createCompanion(attachment);
            assert.equal(repeat.newPath, result.newPath, extension);
            assert.equal(repeat.status, 'skipped', extension);
        }
    });

    it('uses Obsidian link text for the destination note while retaining embed detection', async () => {
        const f = fixture();
        const source = f.add('Sources/class.pdf');
        f.app.metadataCache.fileToLinktext = (file, sourcePath) => {
            assert.equal(sourcePath, 'Fleeting/class.md');
            return file.name;
        };
        const result = await f.service.createCompanion(source);
        assert.match(f.contents.get(result.newPath!)!, /## Original\n\n!\[\[class.pdf\]\]/);
        assert.equal((await f.service.createCompanion(source)).status, 'skipped');
    });

    it('serializes automatic and manual requests before metadata becomes available', async () => {
        const f = fixture();
        const source = f.add('Sources/class.pdf');
        const results = await Promise.all([f.service.createCompanion(source), f.service.createCompanion(source, true), f.service.createCompanion(source)]);
        assert.deepEqual(results.map(result => result.status), ['success', 'skipped', 'skipped']);
        assert.equal(f.app.vault.getMarkdownFiles().length, 1);
    });

    it('recognizes existing companions in Permanent and Archive, including Markdown links', async () => {
        for (const [folder, link] of [['Permanent', '![[class.pdf]]'], ['Archive', '[Original](<Sources/class.pdf>)']]) {
            const f = fixture();
            const source = f.add('Sources/class.pdf');
            f.add(`${folder}/notes.md`, link);
            const result = await f.service.createCompanion(source);
            assert.equal(result.status, 'skipped');
            assert.equal(result.newPath, `${folder}/notes.md`);
        }
    });

    it('disambiguates note names and same-named attachments without overwriting', async () => {
        const f = fixture();
        f.add('Fleeting/class.md', 'Keep me');
        const first = await f.service.createCompanion(f.add('Sources/one/class.pdf'));
        const second = await f.service.createCompanion(f.add('Sources/two/class.pdf'));
        assert.equal(first.newPath, 'Fleeting/class (1).md');
        assert.equal(second.newPath, 'Fleeting/class (2).md');
        assert.equal(f.contents.get('Fleeting/class.md'), 'Keep me');
    });

    it('supports custom templates while preserving tags, metadata and the original', async () => {
        const f = fixture();
        f.settings.sourceNoteTemplate = 'Templates/source';
        f.add('Templates/source.md', '---\n{"tags":["class"],"source_app":"GoodNotes","topic":"biology"}\n---\n# {{title}}\n{{date}} {{attachment_path}}');
        const result = await f.service.createCompanion(f.add('Sources/lecture.png'));
        const content = f.contents.get(result.newPath!)!;
        assert.match(content, /"class",\n\s+"source"/);
        assert.match(content, /"source_app": "GoodNotes"/);
        assert.match(content, /"topic": "biology"/);
        assert.match(content, /# lecture/);
        assert.match(content, /## Original\n\n!\[\[Sources\/lecture.png\]\]/);
        assert.doesNotMatch(content, /seam-source-pdf/);
        assert.equal((await f.service.createCompanion(f.app.vault.getAbstractFileByPath('Sources/lecture.png') as TFile)).status, 'skipped');
    });

    it('merges the PDF class with custom template classes without duplicates', async () => {
        for (const [rawClasses, expected] of [
            [['wide', 'reading'], ['wide', 'reading', 'seam-source-pdf']],
            ['wide reading', ['wide', 'reading', 'seam-source-pdf']],
            [['wide', 'seam-source-pdf'], ['wide', 'seam-source-pdf']],
        ]) {
            const f = fixture();
            f.settings.sourceNoteTemplate = 'Templates/source.md';
            f.add(f.settings.sourceNoteTemplate, `---\n${JSON.stringify({ cssclasses: rawClasses })}\n---\n{{attachment}}`);
            const result = await f.service.createCompanion(f.add('Sources/class.PDF'));
            assert.equal(result.status, 'success');
            const content = f.contents.get(result.newPath!)!;
            const frontmatter = JSON.parse(content.match(/^---\n([\s\S]*?)\n---/)![1]);
            assert.deepEqual(frontmatter.cssclasses, expected);
        }
    });

    it('allows manual creation when automation is disabled and falls back to vault root', async () => {
        const f = fixture();
        f.settings.sourceAutomation = false;
        f.settings.fleetingFolder = '';
        const source = f.add('Sources/class.pdf');
        assert.equal((await f.service.createCompanion(source)).status, 'skipped');
        assert.equal((await f.service.createCompanion(source, true)).newPath, 'class.md');
    });

    it('returns recoverable errors without partial notes or attachment mutation', async () => {
        const f = fixture();
        const source = f.add('Sources/class.pdf', 'Original bytes');
        f.settings.sourceNoteTemplate = 'Missing';
        assert.equal((await f.service.createCompanion(source)).status, 'error');
        assert.equal(f.app.vault.getMarkdownFiles().length, 0);
        f.settings.sourceNoteTemplate = '';
        f.fail();
        assert.equal((await f.service.createCompanion(source)).message, 'Disk full');
        assert.equal(f.contents.get(source.path), 'Original bytes');
    });

    it('rejects invalid template frontmatter without creating a partial companion', async () => {
        const f = fixture();
        f.settings.sourceNoteTemplate = 'Templates/invalid.md';
        f.add(f.settings.sourceNoteTemplate, '---\n["invalid"]\n---\nBody');
        const result = await f.service.createCompanion(f.add('Sources/class.pdf'));
        assert.equal(result.status, 'error');
        assert.equal(f.app.vault.getAbstractFileByPath('Fleeting/class.md'), undefined);
    });

    it('rechecks attachment existence after asynchronous template reads', async () => {
        const f = fixture();
        const source = f.add('Sources/class.pdf');
        f.settings.sourceNoteTemplate = 'Templates/source.md';
        f.add(f.settings.sourceNoteTemplate, 'Body');
        f.app.vault.cachedRead = async () => { f.entries.delete(source.path); return 'Body'; };
        assert.equal((await f.service.createCompanion(source)).status, 'skipped');
        assert.equal(f.app.vault.getAbstractFileByPath('Fleeting/class.md'), undefined);
    });

    it('does not start queued registrations after unload', async () => {
        const f = fixture();
        const pending = f.service.createCompanion(f.add('Sources/class.pdf'));
        f.service.destroy();
        assert.equal((await pending).status, 'skipped');
        assert.equal(f.app.vault.getMarkdownFiles().length, 0);
    });

    it('recognizes companions while attachment rename links are still stale', async () => {
        const f = fixture();
        const attachment = f.add('Sources/class.pdf');
        const note = f.add('Archive/class.md', '![[Sources/class.pdf]]');
        f.app.metadataCache.getFileCache = () => ({ embeds: [{ link: 'Sources/class.pdf' }] }) as never;
        f.entries.delete(attachment.path);
        f.service.onRename(attachment, attachment.path);
        attachment.path = 'Sources/renamed.pdf';
        f.entries.set(attachment.path, attachment as unknown as MockTFile);
        const result = await f.service.createCompanion(attachment);
        assert.equal(result.status, 'skipped');
        assert.equal(result.newPath, note.path);
        assert.equal(f.app.vault.getMarkdownFiles().length, 1);
    });

    it('routes sources through the automation service and reconciles independently of tag automation', async () => {
        const f = fixture();
        f.settings.automaticProcessing = false;
        const source = f.add('Sources/class.pdf');
        const service = new AutomationService(f.app, f.settings);
        const paths: string[] = [];
        const queue = { enqueue: (file: TFile) => paths.push(file.path) } as AutomationQueue;
        const reconciler = new Reconciler(f.app, f.settings, queue, service);
        reconciler.scan();
        assert.deepEqual(paths, [source.path]);
        assert.equal((await service.processFile(source)).status, 'success');
        f.settings.sourceAutomation = false;
        paths.length = 0;
        reconciler.scan();
        assert.deepEqual(paths, []);
    });

    it('parses and filters @sources across lifecycle folders, with additional filters', async () => {
        const f = fixture();
        const source = f.add('Permanent/class.md');
        const other = f.add('Permanent/other.md');
        f.app.metadataCache.getFileCache = file => ({ frontmatter: { tags: file === source ? ['source', 'class'] : ['sources'] } });
        assert.equal(parseSpecialSearch('@sources lecture').search, 'sources');
        assert.equal(matchesSpecialSearch(f.app, source, 'sources'), true);
        assert.equal(matchesSpecialSearch(f.app, other, 'sources'), false);
        const search = new SearchService(f.app, f.settings);
        assert.deepEqual((await search.searchCombinedSpecialWithContent([{ search: 'sources' }], ['#class'], '/Permanent', '')).map(result => result.path), [source.path]);
    });
});
