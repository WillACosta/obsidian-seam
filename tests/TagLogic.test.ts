import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, SeamSettings } from '../src/types';
import { tagMatches, extractMatchSnippet } from '../src/search/SearchService';

describe('Settings & Defaults', () => {
    it('has default settings per specification including iteration 02 options', () => {
        assert.equal(DEFAULT_SETTINGS.permanentFolder, 'Permanent');
        assert.equal(DEFAULT_SETTINGS.archiveFolder, 'Archive');
        assert.equal(DEFAULT_SETTINGS.fleetingFolder, 'Fleeting');
        assert.equal(DEFAULT_SETTINGS.archiveTag, 'archive');
        assert.equal(DEFAULT_SETTINGS.permanentTag, 'permanent');
        assert.equal(DEFAULT_SETTINGS.archivedTag, 'archived');
        assert.equal(DEFAULT_SETTINGS.automaticProcessing, true);
        assert.equal(DEFAULT_SETTINGS.addArchivedState, true);
        assert.equal(DEFAULT_SETTINGS.enableMoveCleanup, true);
        assert.equal(DEFAULT_SETTINGS.moveCleanupTags, '#permanent, #todo');
        assert.equal(DEFAULT_SETTINGS.moveCleanupProperties, 'status');
        assert.equal(DEFAULT_SETTINGS.showIcons, true);
        assert.equal(DEFAULT_SETTINGS.reconciliationIntervalMinutes, 15);
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
