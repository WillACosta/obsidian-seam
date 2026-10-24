import './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockTFile } from './mocks/obsidian';
import { DEFAULT_SETTINGS } from '../src/types';

// Keep the real Palette routing and async suggestion logic; stub only its UI host.
class ModalHost {
    inputEl = { value: '', closest: () => null };
    scope = { register: (mods: string[], key: string, callback: Function) => {
        this.handlers.set([...mods, key].join('+'), callback);
    } };
    handlers = new Map<string, Function>();
    instructions: { command: string; purpose: string }[] = [];
    constructor(public app: unknown) {}
    setPlaceholder() {}
    setInstructions(value: typeof this.instructions) { this.instructions = value; }
    close() {}
}
Object.assign(require.cache['obsidian']!.exports, {
    SuggestModal: ModalHost, Modal: ModalHost, AbstractInputSuggest: class {},
});
const { UniversalPalette } = require('../src/ui/UniversalPalette');

describe('Palette daily creation shortcuts', () => {
    for (const query of ['@today', '@yesterday']) {
        for (const [shortcut, target] of [['Enter', false], ['Mod+Enter', 'tab'], ['Shift+Enter', 'split'], ['Mod+Shift+Enter', 'split']] as const) {
            it(`${query} creates in the requested destination with ${shortcut}`, async () => {
                const files = new Map<string, MockTFile>();
                const opened: unknown[][] = [];
                const app = {
                    vault: {
                        configDir: '.obsidian',
                        adapter: { exists: async () => true, read: async () => JSON.stringify({ folder: 'Daily', format: 'YYYY-MM-DD' }) },
                        getAbstractFileByPath: (path: string) => files.get(path),
                        createFolder: async () => {},
                        create: async (path: string) => { const file = new MockTFile(path); files.set(path, file); return file; },
                    },
                    workspace: { getLeaf: (...args: unknown[]) => ({ openFile: async (file: MockTFile) => { opened.push([...args, file.path]); } }) },
                };
                const palette = new UniversalPalette(app, DEFAULT_SETTINGS, { searchCombinedSpecialWithContent: async () => [] }, []);
                palette.disposeBaseRender = () => {};
                palette.renderActiveSpecialQueryInput = () => {};
                palette.inputEl.value = query;
                const items = await palette.getSuggestions(query);
                assert.equal(items[0].type, 'create');
                assert.deepEqual(palette.instructions.map((entry: { purpose: string }) => entry.purpose),
                    ['create', 'create in a new tab', 'create in split view', 'dismiss']);
                palette.chooser = { values: items, selectedItem: 0 };
                if (shortcut === 'Enter') palette.onChooseSuggestion(items[0], {});
                else assert.equal(palette.handlers.get(shortcut)({ preventDefault() {} }), false);
                await new Promise(resolve => setImmediate(resolve));
                assert.equal(opened.length, 1);
                assert.deepEqual(opened[0].slice(0, -1), target === 'split' ? ['split', 'vertical'] : [target]);
                assert.equal(opened[0][opened[0].length - 1], items[0].description);

                // Refreshing the query after creation must restore the open labels.
                await palette.getSuggestions(query);
                assert.equal(palette.instructions[1].purpose, 'open in a new tab');
            });
        }
    }
});
