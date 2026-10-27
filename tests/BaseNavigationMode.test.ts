import './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { App, Scope } from 'obsidian';
import type { BaseResultNavigation } from '../src/ui/BaseResultNavigation';

class ScopeHost { register() {} }
Object.assign(require.cache['obsidian']!.exports, { Scope: ScopeHost });
const { BaseNavigationMode } = require('../src/ui/BaseNavigationMode') as typeof import('../src/ui/BaseNavigationMode');

function fixture() {
    const attributes = new Map<string, string>(); const handlers = new Map<string, () => void>(); const scopes: Scope[] = [];
    let focused: unknown; let opened: KeyboardEvent | null = null;
    const directions: string[] = [];
    const input = { value: 'find text', focus: () => { if (focused === host) handlers.get('blur')?.(); focused = input; }, setAttribute() {}, removeAttribute() {} };
    const host = { focus: () => { focused = host; handlers.get('focus')?.(); },
        setAttribute: (name: string, value: string) => attributes.set(name, value), removeAttribute: (name: string) => attributes.delete(name),
        addEventListener: (name: string, callback: () => void) => handlers.set(name, callback), removeEventListener: (name: string) => handlers.delete(name), addClass() {}, removeClass() {},
    };
    focused = input;
    const results = { isSupported: true, activeElementId: 'result-A', moveSelection: (direction: string) => directions.push(direction) };
    const app = { keymap: { pushScope: (scope: Scope) => scopes.push(scope), popScope: (scope: Scope) => { assert.equal(scopes.pop(), scope); } } };
    const mode = new BaseNavigationMode(app as unknown as App, host as unknown as HTMLElement, input as unknown as HTMLInputElement,
        results as unknown as BaseResultNavigation, new ScopeHost() as Scope, 'Base results', event => { opened = event; return true; }, () => {});
    function key(key: string, options: Partial<KeyboardEvent> = {}, target = focused) {
        let consumed = false;
        const event = { key, target, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false,
            preventDefault: () => { consumed = true; }, stopImmediatePropagation() {}, ...options } as KeyboardEvent;
        const handled = mode.handleKey(event); return { handled, consumed, event };
    }
    return { mode, host, input, attributes, handlers, scopes, directions, results, key, get focused() { return focused; }, get opened() { return opened; } };
}

describe('Base navigation focus and key routing', () => {
    it('enters from search with Up/Down, moves with all arrows, and returns to the unchanged input with Escape', () => {
        const f = fixture(); assert.equal(f.key('ArrowDown').handled, true);
        assert.equal(f.focused, f.host); assert.equal(f.scopes.length, 1); assert.equal(f.mode.active, true);
        for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) assert.equal(f.key(key).consumed, true);
        assert.deepEqual(f.directions, ['right', 'down', 'left', 'up']);
        assert.equal(f.key('Escape').consumed, true); assert.equal(f.focused, f.input);
        assert.equal(f.input.value, 'find text'); assert.equal(f.scopes.length, 0); assert.equal(f.mode.active, false);
        assert.equal(f.key('Escape').handled, false);
    });
    it('preserves caret arrows, modified arrows, composition, and native toolbar controls', () => {
        const f = fixture();
        for (const [key, options] of [['ArrowLeft', {}], ['ArrowRight', {}], ['ArrowDown', { shiftKey: true }], ['ArrowUp', { ctrlKey: true }], ['ArrowDown', { isComposing: true }], ['Enter', { isComposing: true }]] as const) {
            assert.equal(f.key(key, options).consumed, false);
        }
        f.key('ArrowUp');
        assert.equal(f.key('ArrowLeft', { shiftKey: true }).consumed, false);
        assert.equal(f.key('ArrowDown', {}, {}).handled, false);
    });
    for (const options of [{}, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { metaKey: true, shiftKey: true }]) {
        it(`preserves opening modifiers ${JSON.stringify(options)} from both input and navigation`, () => {
            const f = fixture();
            const first = f.key('Enter', options); assert.equal(f.opened, first.event); assert.equal(first.consumed, true);
            f.key('ArrowDown'); const second = f.key('Enter', options); assert.equal(f.opened, second.event); assert.equal(second.consumed, true);
        });
    }
    it('refreshes recycled active descendants and releases scope and listeners when destroyed', () => {
        const f = fixture(); f.key('ArrowDown'); f.host.focus(); assert.equal(f.scopes.length, 1);
        f.results.activeElementId = 'result-recycled'; f.mode.refresh(); assert.equal(f.attributes.get('aria-activedescendant'), 'result-recycled');
        f.mode.destroy(); assert.equal(f.scopes.length, 0); assert.equal(f.handlers.size, 0); assert.equal(f.attributes.size, 0);
    });
    it('does not enter navigation for unsupported layouts, and consumes Enter safely with no selected result', () => {
        const f = fixture(); f.results.isSupported = false; assert.equal(f.key('ArrowDown').handled, false);
        f.results.isSupported = true; f.results.activeElementId = ''; f.mode.refresh();
        assert.equal(f.key('Enter').handled, true); assert.equal(f.attributes.has('aria-activedescendant'), false);
    });
});
