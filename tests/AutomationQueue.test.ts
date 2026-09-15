import './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AutomationQueue } from '../src/automation/AutomationQueue';
import { MockTFile } from './mocks/obsidian';
import type { App, TFile } from 'obsidian';

function createMockApp(activePath: string | null = null, files: Record<string, MockTFile> = {}): {
    app: App;
    setActiveFile: (path: string | null) => void;
} {
    let currentActivePath = activePath;

    const mockApp = {
        workspace: {
            getActiveFile: () => {
                if (!currentActivePath) return null;
                return files[currentActivePath] ?? new MockTFile(currentActivePath);
            },
        },
        vault: {
            getAbstractFileByPath: (path: string) => {
                return files[path] ?? new MockTFile(path);
            },
        },
    } as unknown as App;

    return {
        app: mockApp,
        setActiveFile: (path: string | null) => {
            currentActivePath = path;
        },
    };
}

describe('AutomationQueue', () => {
    it('holds processing while note is active in on-switch mode', async () => {
        const processed: string[] = [];
        const { app, setActiveFile } = createMockApp('Notes/Idea.md');

        const queue = new AutomationQueue(
            app,
            async (file: TFile) => {
                processed.push(file.path);
            },
            'on-switch',
        );

        const file = new MockTFile('Notes/Idea.md') as unknown as TFile;
        queue.enqueue(file);

        assert.equal(queue.isPending('Notes/Idea.md'), true);
        // Wait a short time to verify no timer fired
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.deepEqual(processed, [], 'Should not process active note while still editing it');

        // Switch note
        setActiveFile('Notes/Other.md');
        queue.onActiveFileChange(new MockTFile('Notes/Other.md') as unknown as TFile);

        assert.deepEqual(processed, ['Notes/Idea.md'], 'Should process note immediately when switched away');
        assert.equal(queue.isPending('Notes/Idea.md'), false);

        queue.destroy();
    });

    it('processes timed mode after specified duration', () => {
        const processed: string[] = [];
        const { app } = createMockApp('Notes/Idea.md');

        const queue = new AutomationQueue(
            app,
            async (file: TFile) => {
                processed.push(file.path);
            },
            '1000',
        );

        const file = new MockTFile('Notes/Idea.md') as unknown as TFile;
        queue.enqueue(file);

        assert.equal(queue.isPending('Notes/Idea.md'), true);
        assert.deepEqual(processed, []);

        // Switching away triggers it early for seamless transition
        queue.onActiveFileChange(new MockTFile('Notes/Other.md') as unknown as TFile);
        assert.deepEqual(processed, ['Notes/Idea.md']);

        queue.destroy();
    });

    it('processes all pending notes on flush()', async () => {
        const processed: string[] = [];
        const { app } = createMockApp('Notes/Active.md');

        const queue = new AutomationQueue(
            app,
            async (file: TFile) => {
                processed.push(file.path);
            },
            'on-switch',
        );

        queue.enqueue(new MockTFile('Notes/Active.md') as unknown as TFile);
        queue.enqueue(new MockTFile('Notes/Background.md') as unknown as TFile);

        assert.equal(queue.isPending('Notes/Active.md'), true);
        assert.equal(queue.isPending('Notes/Background.md'), true);

        await queue.flush();

        assert.equal(processed.includes('Notes/Active.md'), true);
        assert.equal(processed.includes('Notes/Background.md'), true);
        assert.equal(queue.isPending('Notes/Active.md'), false);
        assert.equal(queue.isPending('Notes/Background.md'), false);

        queue.destroy();
    });

    it('cancels all timers and pending items on destroy()', () => {
        const { app } = createMockApp('Notes/Active.md');

        const queue = new AutomationQueue(
            app,
            // eslint-disable-next-line @typescript-eslint/require-await
            async () => {},
            'on-switch',
        );

        queue.enqueue(new MockTFile('Notes/Active.md') as unknown as TFile);
        queue.enqueue(new MockTFile('Notes/Background.md') as unknown as TFile);

        queue.destroy();

        assert.equal(queue.isPending('Notes/Active.md'), false);
        assert.equal(queue.isPending('Notes/Background.md'), false);
    });
});
