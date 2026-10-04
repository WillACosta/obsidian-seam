import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockTFile, MockTFolder } from './mocks/obsidian';
import { FleetingAction } from '../src/automation/actions/FleetingAction';
import { DEFAULT_SETTINGS, SeamSettings } from '../src/types';

function fixture(path: string, settings: SeamSettings = DEFAULT_SETTINGS) {
    const file = new MockTFile(path);
    const files = new Map<string, MockTFile | MockTFolder>([[path, file]]);
    const frontmatter: Record<string, unknown> = {
        tags: ['archived', 'permanent', 'todo', 'keep'],
        status: 'draft',
        keep: 'yes',
    };
    let content = '#archived #permanent #todo #keep\n\nBody';
    let failRename = false;
    const app = {
        vault: {
            getAbstractFileByPath: (target: string) => files.get(target) ?? null,
            createFolder: async (target: string) => { files.set(target, new MockTFolder(target)); },
            process: async (_file: MockTFile, change: (text: string) => string) => { content = change(content); },
        },
        fileManager: {
            renameFile: async (target: MockTFile, newPath: string) => {
                if (failRename) throw new Error('rename failed');
                files.delete(target.path);
                target.path = newPath;
                files.set(newPath, target);
            },
            processFrontMatter: async (_file: MockTFile, change: (fm: Record<string, unknown>) => void) => { change(frontmatter); },
        },
    } as never;
    return {
        app, file, files, frontmatter, settings,
        content: () => content,
        failNextRename: () => { failRename = true; },
    };
}

describe('Move to Fleeting', () => {
    it('moves before removing action and configured tags and properties', async () => {
        const f = fixture('Archive/Idea.md');
        const result = await new FleetingAction().apply(f.file as never, f.app, f.settings);

        assert.equal(result.status, 'success');
        assert.equal(result.newPath, 'Fleeting/Idea.md');
        assert.equal(f.files.get('Fleeting/Idea.md'), f.file);
        assert.deepEqual(f.frontmatter.tags, ['keep']);
        assert.equal(f.frontmatter.status, undefined);
        assert.equal(f.frontmatter.keep, 'yes');
        assert.equal(f.content(), '#keep\n\nBody\n');
    });

    it('keeps tags and properties when the destination is occupied or rename fails', async () => {
        for (const failRename of [false, true]) {
            const f = fixture('Archive/Idea.md');
            if (failRename) f.failNextRename();
            else f.files.set('Fleeting/Idea.md', new MockTFile('Fleeting/Idea.md'));

            const result = await new FleetingAction().apply(f.file as never, f.app, f.settings);
            assert.equal(result.status, failRename ? 'error' : 'conflict');
            assert.equal(f.file.path, 'Archive/Idea.md');
            assert.deepEqual(f.frontmatter.tags, ['archived', 'permanent', 'todo', 'keep']);
            assert.equal(f.frontmatter.status, 'draft');
        }
    });

    it('cleans an existing Fleeting note and respects disabled optional cleanup', async () => {
        const settings = { ...DEFAULT_SETTINGS, enableMoveCleanup: false };
        const f = fixture('Fleeting/Idea.md', settings);
        const result = await new FleetingAction().apply(f.file as never, f.app, f.settings);

        assert.equal(result.status, 'success');
        assert.deepEqual(f.frontmatter.tags, ['todo', 'keep']);
        assert.equal(f.frontmatter.status, 'draft');
    });

    it('uses the vault root when the Fleeting folder setting is blank', async () => {
        const f = fixture('Archive/Idea.md', { ...DEFAULT_SETTINGS, fleetingFolder: '' });
        const result = await new FleetingAction().apply(f.file as never, f.app, f.settings);
        assert.equal(result.status, 'success');
        assert.equal(result.newPath, 'Idea.md');
    });
});
