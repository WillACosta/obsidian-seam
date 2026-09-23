import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockTFile } from './mocks/obsidian';
import { DEFAULT_SETTINGS, SeamSettings } from '../src/types';
import {
    SearchService,
    tagMatches,
    noteHasTag,
    extractMatchSnippet,
    matchesSpecialSearch,
} from '../src/search/SearchService';
import {
    getPermanentCleanupTags,
    getArchiveCleanupTags,
    getMoveCleanupProperties,
} from '../src/automation/TagCleanup';

describe('Settings & Defaults', () => {
    it('has default settings per specification including iteration 03 options', () => {
        assert.equal(DEFAULT_SETTINGS.permanentFolder, 'Permanent');
        assert.equal(DEFAULT_SETTINGS.archiveFolder, 'Archive');
        assert.equal(DEFAULT_SETTINGS.fleetingFolder, 'Fleeting');
        assert.equal(DEFAULT_SETTINGS.fleetingNoteTemplate, '');
        assert.equal(DEFAULT_SETTINGS.archiveTag, 'archive');
        assert.equal(DEFAULT_SETTINGS.permanentTag, 'permanent');
        assert.equal(DEFAULT_SETTINGS.archivedTag, 'archived');
        assert.equal(DEFAULT_SETTINGS.automaticProcessing, true);
        assert.equal(DEFAULT_SETTINGS.automationDelay, 'on-switch');
        assert.equal(DEFAULT_SETTINGS.addArchivedState, true);
        assert.equal(DEFAULT_SETTINGS.enableMoveCleanup, true);
        assert.equal(DEFAULT_SETTINGS.moveCleanupTags, '#permanent, #todo');
        assert.equal(DEFAULT_SETTINGS.moveCleanupProperties, 'status');
        assert.equal(DEFAULT_SETTINGS.showIcons, true);
        assert.deepEqual(DEFAULT_SETTINGS.quickAddChoices, []);
        assert.equal(DEFAULT_SETTINGS.persistQuickAddDrafts, false);
        assert.equal(DEFAULT_SETTINGS.reconciliationIntervalMinutes, 15);
        assert.equal(DEFAULT_SETTINGS.updateAnnouncementMode, 'major');
        assert.equal(DEFAULT_SETTINGS.lastAnnouncedVersion, '');
    });
});

describe('Selected tag exclusion', () => {
    it('excludes matching notes while retaining required positive tags', () => {
        const includedFile = { path: 'included.md', basename: 'included', parent: null };
        const excludedFile = { path: 'excluded.md', basename: 'excluded', parent: null };
        const app = {
            vault: { getMarkdownFiles: () => [includedFile, excludedFile] },
            metadataCache: {
                getFileCache: (file: { path: string }) => ({
                    tags: file.path === includedFile.path
                        ? [{ tag: '#projects/seam' }, { tag: '#todo' }]
                        : [{ tag: '#projects/seam' }, { tag: '#todo' }, { tag: '#archived' }],
                }),
            },
        } as never;

        const service = new SearchService(app, DEFAULT_SETTINGS);
        const results = service.searchBySelectedTags(['projects/seam', 'todo'], ['archived']);
        assert.deepEqual(results.map((result) => result.file.path), ['included.md']);

        const queryResults = service.search('#projects/seam #todo !#archived');
        assert.deepEqual(queryResults.map((result) => result.file.path), ['included.md']);
    });
});

describe('Tag & Conflict Logic', () => {
    function detectAction(
        tags: string[],
        settings: SeamSettings,
    ): 'archive' | 'permanent' | 'conflict' | 'none' {
        const normalizedTags = tags.map((t) => t.replace(/^#/, '').toLowerCase());
        const hasArchive = normalizedTags.includes(settings.archiveTag.toLowerCase());
        const hasPermanent = normalizedTags.includes(settings.permanentTag.toLowerCase());

        if (hasArchive && hasPermanent) return 'conflict';
        if (hasArchive) return 'archive';
        if (hasPermanent) return 'permanent';
        return 'none';
    }

    it('identifies archive action tag', () => {
        assert.equal(detectAction(['#archive', '#electronics'], DEFAULT_SETTINGS), 'archive');
    });

    it('identifies permanent action tag', () => {
        assert.equal(detectAction(['#permanent', '#zmk'], DEFAULT_SETTINGS), 'permanent');
    });

    it('detects conflict when both archive and permanent tags exist', () => {
        assert.equal(detectAction(['#archive', '#permanent'], DEFAULT_SETTINGS), 'conflict');
    });

    it('returns none when no action tags exist', () => {
        assert.equal(detectAction(['#electronics', '#zmk'], DEFAULT_SETTINGS), 'none');
    });
});

describe('Tag Prefix Filtering (tagMatches)', () => {
    it('matches exact tag', () => {
        assert.equal(tagMatches('electronics', 'electronics'), true);
    });

    it('matches prefix tag (#ele -> #electronics)', () => {
        assert.equal(tagMatches('electronics', 'ele'), true);
        assert.equal(tagMatches('electricity', 'ele'), true);
    });

    it('matches nested tags with prefix (#ele -> #electronics/components)', () => {
        assert.equal(tagMatches('electronics/components', 'ele'), true);
        assert.equal(tagMatches('hardware/electronics', 'ele'), true);
    });

    it('does not match non-matching tags', () => {
        assert.equal(tagMatches('programming', 'ele'), false);
        assert.equal(tagMatches('kicad', 'ele'), false);
    });
});

describe('Tag Filter Matching (noteHasTag)', () => {
    it('matches exact tag', () => {
        assert.equal(noteHasTag('ai', 'ai'), true);
        assert.equal(noteHasTag('#ai', '#ai'), true);
    });

    it('matches nested sub-tags of target tag', () => {
        assert.equal(noteHasTag('ai/sdd', 'ai'), true);
        assert.equal(noteHasTag('ai/sdd/spec', 'ai'), true);
        assert.equal(noteHasTag('ai/sdd', 'ai/sdd'), true);
    });

    it('does not match parent tag when sub-tag is targeted', () => {
        assert.equal(noteHasTag('ai', 'ai/sdd'), false);
    });

    it('does not match distinct tags with prefix overlap', () => {
        assert.equal(noteHasTag('airplane', 'ai'), false);
        assert.equal(noteHasTag('electronics-store', 'electronics'), false);
    });
});

describe('Match Snippet Extraction (extractMatchSnippet)', () => {
    it('extracts snippet with match highlighted', () => {
        const content = 'This is a note about recommendation systems and their applications.';
        const result = extractMatchSnippet(content, 'recommendation');
        assert.ok(result);
        assert.ok(result.text.toLowerCase().includes('recommendation'));
        assert.equal(
            result.text.slice(result.matchStart, result.matchEnd).toLowerCase(),
            'recommendation',
        );
    });

    it('returns null when no match found', () => {
        const content = 'This note is about electronics.';
        const result = extractMatchSnippet(content, 'quantum');
        assert.equal(result, null);
    });

    it('handles match at the beginning of content', () => {
        const content = 'Recommendation systems are fascinating.';
        const result = extractMatchSnippet(content, 'Recommendation');
        assert.ok(result);
        assert.ok(result.matchStart >= 0);
    });

    it('handles match at the end of content', () => {
        const content = 'I studied recommendation';
        const result = extractMatchSnippet(content, 'recommendation');
        assert.ok(result);
        assert.ok(result.text.toLowerCase().includes('recommendation'));
    });

    it('adds ellipsis for long content', () => {
        const longContent =
            'A'.repeat(100) +
            ' recommendation systems ' +
            'B'.repeat(100);
        const result = extractMatchSnippet(longContent, 'recommendation');
        assert.ok(result);
        assert.ok(result.text.startsWith('…'));
        assert.ok(result.text.endsWith('…'));
    });

    it('handles case-insensitive matching', () => {
        const content = 'RECOMMENDATION systems are great.';
        const result = extractMatchSnippet(content, 'recommendation');
        assert.ok(result);
        assert.ok(result.matchStart >= 0);
    });
});

describe('Special Search Filters', () => {
    function makeApp(cache: Record<string, unknown>) {
        const file = { path: 'Notes/example.md', basename: 'example' };
        return {
            file,
            app: {
                metadataCache: {
                    getFileCache: () => cache,
                },
            } as never,
        };
    }

    it('matches untagged notes', () => {
        const { app, file } = makeApp({});
        assert.equal(matchesSpecialSearch(app, file as never, 'untagged'), true);
        const tagged = makeApp({ tags: [{ tag: '#project' }] });
        assert.equal(matchesSpecialSearch(tagged.app, tagged.file as never, 'untagged'), false);
    });

    it('matches document and image attachments', () => {
        const { app, file } = makeApp({
            links: [{ link: 'Attachments/report.pdf', original: '[report](Attachments/report.pdf)' }],
            embeds: [{ link: 'Attachments/diagram.png', original: '![[Attachments/diagram.png]]' }],
        });
        assert.equal(matchesSpecialSearch(app, file as never, 'docs'), true);
        assert.equal(matchesSpecialSearch(app, file as never, 'images'), true);
        assert.equal(matchesSpecialSearch(app, file as never, 'ocr'), true);
    });

    it('matches task, todo, done, and code metadata', () => {
        const incomplete = makeApp({ listItems: [{ task: ' ' }] });
        assert.equal(matchesSpecialSearch(incomplete.app, incomplete.file as never, 'task'), true);
        assert.equal(matchesSpecialSearch(incomplete.app, incomplete.file as never, 'todo'), true);
        assert.equal(matchesSpecialSearch(incomplete.app, incomplete.file as never, 'done'), false);

        const complete = makeApp({
            listItems: [{ task: 'x' }, { task: 'X' }],
            sections: [{ type: 'code' }],
        });
        assert.equal(matchesSpecialSearch(complete.app, complete.file as never, 'task'), true);
        assert.equal(matchesSpecialSearch(complete.app, complete.file as never, 'todo'), false);
        assert.equal(matchesSpecialSearch(complete.app, complete.file as never, 'done'), true);
        assert.equal(matchesSpecialSearch(complete.app, complete.file as never, 'code'), true);
    });

    it('searches an exact quoted phrase in note content', async () => {
        const file = { path: 'Notes/kicad.md', basename: 'kicad' };
        const app = {
            vault: {
                getMarkdownFiles: () => [file],
                cachedRead: async () => 'KiCad is a PCB editor app for electronics.',
            },
            metadataCache: {
                getFileCache: () => ({}),
            },
        } as never;
        const service = new SearchService(app, DEFAULT_SETTINGS);
        const results = await service.searchWithContent('"KiCad is a PCB editor app"');
        assert.deepEqual(results.map((result) => result.file.path), ['Notes/kicad.md']);
    });

    it('searches @ocr text in attachment content without searching the note body', async () => {
        const note = new MockTFile('Notes/reference.md');
        const attachment = new MockTFile('Attachments/reference.txt');
        const app = {
            vault: {
                getMarkdownFiles: () => [note],
                cachedRead: async (file: MockTFile) => file.path === attachment.path
                    ? 'text extracted from the attachment'
                    : 'text in the note body',
            },
            metadataCache: {
                getFileCache: () => ({ embeds: [{ link: attachment.path }] }),
                getFirstLinkpathDest: () => attachment,
            },
        } as never;
        const service = new SearchService(app, DEFAULT_SETTINGS);

        const attachmentResults = await service.searchWithContent('@ocr "text extracted"');
        const noteResults = await service.searchWithContent('@ocr "text in the note body"');
        assert.deepEqual(attachmentResults.map((result) => result.file.path), ['Notes/reference.md']);
        assert.deepEqual(noteResults, []);
    });
});

describe('Inline Tag Removal Regex', () => {
    function removeInlineTag(content: string, tagToRemove: string): string {
        const cleanTag = tagToRemove.replace(/^#/, '').toLowerCase();
        const escapedTag = cleanTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|[ \\t])#${escapedTag}(?=[ \\t]|\\n|$)`, 'gmi');
        return (
            content
                .replace(regex, '')
                .split('\n')
                .map((line) => line.trimEnd())
                .join('\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim() + '\n'
        );
    }

    it('removes inline action tag while preserving other tags and content', () => {
        const input = '#electronics #archive\n\nSome note content.';
        const result = removeInlineTag(input, 'archive');
        assert.equal(result, '#electronics\n\nSome note content.\n');
    });

    it('removes inline tag on its own line', () => {
        const input = '#electronics\n#archive\n\nNote.';
        const result = removeInlineTag(input, 'archive');
        assert.equal(result, '#electronics\n\nNote.\n');
    });

    it('does not remove partial tag matches', () => {
        const input = '#permanent_marker\n\nNote.';
        const result = removeInlineTag(input, 'permanent');
        assert.equal(result, '#permanent_marker\n\nNote.\n');
    });

    it('removes multiple cleanup tags sequentially', () => {
        let content = '#electronics #permanent #todo\n\nNote.';
        content = removeInlineTag(content, '#permanent');
        content = removeInlineTag(content, 'todo');
        assert.equal(content, '#electronics\n\nNote.\n');
    });
});

describe('Post-Move Tag & Property Cleanup (Iteration 05)', () => {
    it('always includes #permanent, #archive, and #archived when moving to Permanent', () => {
        const tags = getPermanentCleanupTags(DEFAULT_SETTINGS);
        assert.ok(tags.includes('permanent'), 'must remove #permanent');
        assert.ok(tags.includes('archive'), 'must remove #archive');
        assert.ok(tags.includes('archived'), 'must remove #archived');
        assert.ok(tags.includes('todo'), 'must remove configured cleanup tag #todo');
    });

    it('removes #archived even when enableMoveCleanup is false', () => {
        const settings: SeamSettings = {
            ...DEFAULT_SETTINGS,
            enableMoveCleanup: false,
        };
        const tags = getPermanentCleanupTags(settings);
        assert.deepEqual(tags.sort(), ['archive', 'archived', 'permanent']);
    });

    it('strips leading # and deduplicates tags for permanent cleanup', () => {
        const settings: SeamSettings = {
            ...DEFAULT_SETTINGS,
            moveCleanupTags: '#permanent, #todo, todo, #custom',
        };
        const tags = getPermanentCleanupTags(settings);
        assert.deepEqual(tags.sort(), ['archive', 'archived', 'custom', 'permanent', 'todo']);
    });

    it('always includes #archive and #permanent when moving to Archive', () => {
        const tags = getArchiveCleanupTags(DEFAULT_SETTINGS);
        assert.ok(tags.includes('archive'), 'must remove #archive');
        assert.ok(tags.includes('permanent'), 'must remove #permanent');
        assert.ok(tags.includes('todo'), 'must remove configured cleanup tag #todo');
        assert.equal(tags.includes('archived'), false, 'must not remove #archived when archiving');
    });

    it('extracts cleanup properties correctly', () => {
        const props = getMoveCleanupProperties(DEFAULT_SETTINGS);
        assert.deepEqual(props, ['status']);

        const disabledProps = getMoveCleanupProperties({
            ...DEFAULT_SETTINGS,
            enableMoveCleanup: false,
        });
        assert.deepEqual(disabledProps, []);

        const customProps = getMoveCleanupProperties({
            ...DEFAULT_SETTINGS,
            moveCleanupProperties: 'status, draft, review, status',
        });
        assert.deepEqual(customProps.sort(), ['draft', 'review', 'status']);
    });

    it('cleans frontmatter tags and removes #archived when un-archiving to Permanent', () => {
        const cleanupTags = getPermanentCleanupTags(DEFAULT_SETTINGS);
        const frontmatterTags = ['archived', 'todo', 'electronics'];

        const remainingTags = frontmatterTags.filter(
            (t) => !cleanupTags.includes(t.replace(/^#/, '').toLowerCase()),
        );
        assert.deepEqual(remainingTags, ['electronics']);
    });
});
