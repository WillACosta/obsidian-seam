import './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHotkeyString, formatHotkey } from '../src/utils/hotkey';

describe('Hotkey Parsing & Formatting', () => {
    it('parses Mod+K correctly', () => {
        const result = parseHotkeyString('Mod+K');
        assert.ok(result);
        assert.deepEqual(result.modifiers, ['Mod']);
        assert.equal(result.key, 'K');
    });

    it('parses Cmd+K correctly', () => {
        const result = parseHotkeyString('Cmd+K');
        assert.ok(result);
        assert.deepEqual(result.modifiers, ['Mod']);
        assert.equal(result.key, 'K');
    });

    it('parses complex multi-modifier shortcuts (e.g. Mod+Shift+P)', () => {
        const result = parseHotkeyString('Mod+Shift+P');
        assert.ok(result);
        assert.deepEqual(result.modifiers, ['Mod', 'Shift']);
        assert.equal(result.key, 'P');
    });

    it('parses Alt / Option shortcuts', () => {
        const result = parseHotkeyString('Alt+K');
        assert.ok(result);
        assert.deepEqual(result.modifiers, ['Alt']);
        assert.equal(result.key, 'K');
    });

    it('defaults to Mod modifier if only a single key is given', () => {
        const result = parseHotkeyString('K');
        assert.ok(result);
        assert.deepEqual(result.modifiers, ['Mod']);
        assert.equal(result.key, 'K');
    });

    it('returns null for empty or invalid input', () => {
        assert.equal(parseHotkeyString(''), null);
        assert.equal(parseHotkeyString('   '), null);
    });

    it('formats Mod+K as ⌘ K on Mac', () => {
        const formatted = formatHotkey({ modifiers: ['Mod'], key: 'K' }, true);
        assert.equal(formatted, '⌘ K');
    });

    it('formats Mod+K as Ctrl + K on Windows/Linux', () => {
        const formatted = formatHotkey({ modifiers: ['Mod'], key: 'K' }, false);
        assert.equal(formatted, 'Ctrl + K');
    });

    it('formats multi-modifier shortcuts correctly', () => {
        const macFormatted = formatHotkey({ modifiers: ['Mod', 'Shift'], key: 'P' }, true);
        assert.equal(macFormatted, '⌘ ⇧ P');

        const winFormatted = formatHotkey({ modifiers: ['Mod', 'Shift'], key: 'P' }, false);
        assert.equal(winFormatted, 'Ctrl + Shift + P');
    });
});
