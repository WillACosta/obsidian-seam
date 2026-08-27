import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, SeamSettings } from '../src/types';

describe('Settings & Defaults', () => {
    it('has default settings per specification', () => {
        assert.equal(DEFAULT_SETTINGS.permanentFolder, 'Permanent');
        assert.equal(DEFAULT_SETTINGS.archiveFolder, 'Archive');
        assert.equal(DEFAULT_SETTINGS.archiveTag, 'archive');
        assert.equal(DEFAULT_SETTINGS.permanentTag, 'permanent');
        assert.equal(DEFAULT_SETTINGS.archivedTag, 'archived');
        assert.equal(DEFAULT_SETTINGS.automaticProcessing, true);
        assert.equal(DEFAULT_SETTINGS.addArchivedState, true);
        assert.equal(DEFAULT_SETTINGS.reconciliationIntervalMinutes, 15);
    });
});

describe('Tag & Conflict Logic', () => {
    function evaluateAction(
        tags: string[],
        settings: SeamSettings,
    ): 'archive' | 'permanent' | 'conflict' | 'none' {
        const normalizedTags = tags.map(t => t.replace(/^#/, '').toLowerCase());
        const hasArchive = normalizedTags.includes(settings.archiveTag.toLowerCase());
        const hasPermanent = normalizedTags.includes(settings.permanentTag.toLowerCase());

        if (hasArchive && hasPermanent) {
            return 'conflict';
        }
        if (hasArchive) {
            return 'archive';
        }
        if (hasPermanent) {
            return 'permanent';
        }
        return 'none';
    }

    it('identifies archive action tag', () => {
        const action = evaluateAction(['electronics', 'archive'], DEFAULT_SETTINGS);
        assert.equal(action, 'archive');
    });

    it('identifies permanent action tag', () => {
        const action = evaluateAction(['#electronics', '#permanent'], DEFAULT_SETTINGS);
        assert.equal(action, 'permanent');
    });

    it('detects conflict when both archive and permanent tags exist', () => {
        const action = evaluateAction(['#electronics', '#archive', '#permanent'], DEFAULT_SETTINGS);
        assert.equal(action, 'conflict');
    });

    it('returns none when no action tags exist', () => {
        const action = evaluateAction(['#electronics', '#kicad', '#archived'], DEFAULT_SETTINGS);
        assert.equal(action, 'none');
    });
});

describe('Inline Tag Removal Regex', () => {
    function removeInlineTag(content: string, tagToRemove: string): string {
        const cleanTag = tagToRemove.replace(/^#/, '').toLowerCase();
        const escapedTag = cleanTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|[ \\t])#${escapedTag}(?=[ \\t]|\\n|$)`, 'gmi');
        return content
            .replace(regex, '')
            .split('\n')
            .map((line) => line.trimEnd())
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim() + '\n';
    }

    it('removes inline action tag while preserving other tags and content', () => {
        const input = '#electronics #permanent\n\nSome note content here.';
        const result = removeInlineTag(input, 'permanent');
        assert.equal(result, '#electronics\n\nSome note content here.\n');
    });

    it('removes inline tag on its own line', () => {
        const input = '#electronics\n#archive\n\nNote text.';
        const result = removeInlineTag(input, 'archive');
        assert.equal(result, '#electronics\n\nNote text.\n');
    });

    it('does not remove partial tag matches', () => {
        const input = '#permanent_marker #permanent\n\nNote.';
        const result = removeInlineTag(input, 'permanent');
        assert.equal(result, '#permanent_marker\n\nNote.\n');
    });
});
