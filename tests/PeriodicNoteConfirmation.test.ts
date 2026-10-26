import './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockTFile, MockTFolder } from './mocks/obsidian';
import { DEFAULT_SETTINGS } from '../src/types';

class NodeHost {
    children: NodeHost[] = [];
    text: string;
    events = new Map<string, () => void>();
    constructor(text = '') { this.text = text; }
    createEl(_tag: string, options: { text?: string } = {}) { const node = new NodeHost(options.text); this.children.push(node); return node; }
    createDiv() { return this.createEl('div'); }
    addEventListener(event: string, callback: () => void) { this.events.set(event, callback); }
    focus() {}
    empty() { this.children = []; }
    addClass() {}
}
const modals: ModalHost[] = [];
class ModalHost {
    contentEl = new NodeHost(); modalEl = new NodeHost();
    inputEl = { value: '', closest: () => null };
    scope = { register() {} };
    constructor(public app: unknown) {}
    setTitle() {} setPlaceholder() {} setInstructions() {}
    onOpen() {} onClose() {}
    open() { modals.push(this); this.onOpen(); }
    close() { this.onClose(); }
    click(text: string) {
        const find = (node: NodeHost): NodeHost | undefined => node.text === text ? node : node.children.map(find).find(Boolean);
        const button = find(this.contentEl); assert.ok(button, `Missing button ${text}`); button.events.get('click')!();
    }
}
Object.assign(require.cache['obsidian']!.exports, { Modal: ModalHost, SuggestModal: ModalHost, AbstractInputSuggest: class {} });
const { confirmPeriodicNote } = require('../src/ui/PeriodicNoteConfirmation');
const { UniversalPalette } = require('../src/ui/UniversalPalette');

describe('Periodic-note confirmations', () => {
    it('bypasses confirmation for existing notes or when disabled', async () => {
        const before = modals.length;
        assert.equal(await confirmPeriodicNote({ vault: { getAbstractFileByPath: () => new MockTFile('A.md') } }, 'A.md', true), true);
        assert.equal(await confirmPeriodicNote({ vault: { getAbstractFileByPath: () => null } }, 'A.md', false), true);
        assert.equal(modals.length, before);
    });
    it('resolves cancellation on button, Escape/close, or outside dismissal, and accepts only Create note', async () => {
        const app = { vault: { getAbstractFileByPath: () => null } };
        for (const action of ['Cancel', 'close', 'Create note']) {
            const result = confirmPeriodicNote(app, 'A.md', true);
            const modal = modals[modals.length - 1];
            if (action === 'close') modal.close(); else modal.click(action);
            assert.equal(await result, action === 'Create note');
        }
    });
    for (const query of ['@today', '@yesterday', '@thisWeek', '@thisYear']) {
        for (const accept of [false, true]) {
            it(`${query} ${accept ? 'creates after acceptance' : 'cancels without a note or folder write'}`, async () => {
                const files = new Map<string, MockTFile | MockTFolder>(); let writes = 0; let opens = 0;
                let leafArguments: unknown[] = [];
                const app = { vault: { configDir: '.obsidian', adapter: { exists: async () => false },
                    getAbstractFileByPath: (path: string) => files.get(path) ?? null,
                    createFolder: async (path: string) => { writes++; files.set(path, new MockTFolder(path)); },
                    create: async (path: string) => { writes++; const file = new MockTFile(path); files.set(path, file); return file; } },
                    workspace: { getLeaf: (...args: unknown[]) => { leafArguments = args; return { openFile: async () => { opens++; } }; } } };
                const palette = new UniversalPalette(app, { ...DEFAULT_SETTINGS, calendarUsePeriodicNotes: false }, { searchCombinedSpecialWithContent: async () => [] }, []);
                palette.disposeBaseRender = () => {}; palette.renderActiveSpecialQueryInput = () => {};
                const items = await palette.getSuggestions(query);
                const creation = items[0].action('split');
                assert.equal(writes, 0); assert.equal(opens, 0);
                modals[modals.length - 1].click(accept ? 'Create note' : 'Cancel');
                await creation;
                assert.equal(opens, accept ? 1 : 0);
                if (!accept) assert.equal(writes, 0);
                else { assert.ok(files.get(items[0].description) instanceof MockTFile); assert.deepEqual(leafArguments, ['split', 'vertical']); }
            });
        }
    }
});
