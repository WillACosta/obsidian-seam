import './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseHotkeyString,
    formatHotkey,
    getCommandHotkeyDisplay,
    openHotkeyAssignment,
} from '../src/utils/hotkey';

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

describe('getCommandHotkeyDisplay', () => {
    it('returns formatted hotkey string when printHotkeyForCommand is present', () => {
        const mockApp = {
            hotkeyManager: {
                printHotkeyForCommand: (id: string) => (id === 'seam:open-palette' ? '⌘ K' : ''),
            },
        } as unknown as import('obsidian').App;

        assert.equal(getCommandHotkeyDisplay(mockApp, 'seam:open-palette'), '⌘ K');
    });

    it('falls back to getHotkeys when printHotkeyForCommand is absent', () => {
        const mockApp = {
            hotkeyManager: {
                getHotkeys: (id: string) =>
                    id === 'seam:open-palette' ? [{ modifiers: ['Mod'], key: 'K' }] : [],
            },
        } as unknown as import('obsidian').App;

        assert.ok(getCommandHotkeyDisplay(mockApp, 'seam:open-palette'));
    });

    it('returns null when no hotkey is assigned', () => {
        const mockApp = {
            hotkeyManager: {
                printHotkeyForCommand: () => '',
                getHotkeys: () => [],
                getDefaultHotkeys: () => [],
            },
        } as unknown as import('obsidian').App;

        assert.equal(getCommandHotkeyDisplay(mockApp, 'seam:open-palette'), null);
    });

    it('returns null when hotkeyManager is missing', () => {
        const mockApp = {} as unknown as import('obsidian').App;
        assert.equal(getCommandHotkeyDisplay(mockApp, 'seam:open-palette'), null);
    });
});

describe('openHotkeyAssignment', () => {
    it('opens hotkeys tab and sets search query', () => {
        let openedTab: string | null = null;
        let searchSet: string | null = null;
        const mockApp = {
            setting: {
                open: () => {},
                openTabById: (id: string) => {
                    openedTab = id;
                    return {
                        setQuery: (q: string) => {
                            searchSet = q;
                        },
                    };
                },
            },
        } as unknown as import('obsidian').App;

        openHotkeyAssignment(mockApp, 'Seam: Open Universal Palette');
        assert.equal(openedTab, 'hotkeys');
        assert.equal(searchSet, 'Seam: Open Universal Palette');
    });
});
