import { App, Hotkey, Modifier, Platform } from 'obsidian';

/**
 * Interface describing Obsidian's internal HotkeyManager API.
 */
interface HotkeyManager {
    printHotkeyForCommand(id: string): string;
    getHotkeys(id: string): Hotkey[] | undefined;
    getDefaultHotkeys(id: string): Hotkey[] | undefined;
    setHotkeys(id: string, hotkeys: Hotkey[]): void;
    removeHotkeys(id: string): void;
    save(): Promise<void>;
}

interface AppWithHotkeyManager extends App {
    hotkeyManager?: HotkeyManager;
}

/**
 * Determines if the current environment is running on a Mac platform.
 */
export function isMacPlatform(): boolean {
    return typeof Platform !== 'undefined' && Platform.isMacOS;
}

/**
 * Parses a human-readable shortcut string (e.g. 'Mod+K', 'Cmd+K', 'Ctrl+K', 'Ctrl+Shift+P')
 * into an Obsidian Hotkey object.
 */
export function parseHotkeyString(str: string): Hotkey | null {
    if (!str || !str.trim()) return null;

    const parts = str
        .split('+')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    if (parts.length === 0) return null;

    const rawKey = parts[parts.length - 1];
    if (!rawKey) return null;

    const key = rawKey.length === 1 ? rawKey.toUpperCase() : rawKey;
    const modifiers: Modifier[] = [];
    const isMac = isMacPlatform();

    for (let i = 0; i < parts.length - 1; i++) {
        const mod = parts[i].toLowerCase();
        if (mod === 'mod' || mod === 'cmd' || mod === 'command') {
            if (!modifiers.includes('Mod')) modifiers.push('Mod');
        } else if (mod === 'ctrl' || mod === 'control') {
            const resolvedMod = isMac ? 'Ctrl' : 'Mod';
            if (!modifiers.includes(resolvedMod)) modifiers.push(resolvedMod);
        } else if (mod === 'alt' || mod === 'opt' || mod === 'option') {
            if (!modifiers.includes('Alt')) modifiers.push('Alt');
        } else if (mod === 'shift') {
            if (!modifiers.includes('Shift')) modifiers.push('Shift');
        } else if (mod === 'meta' || mod === 'win') {
            if (!modifiers.includes('Meta')) modifiers.push('Meta');
        }
    }

    // Default to 'Mod' if no modifier was explicitly provided for a single key
    if (modifiers.length === 0) {
        modifiers.push('Mod');
    }

    return { modifiers, key };
}

/**
 * Formats an Obsidian Hotkey object into a clean, platform-native string.
 * Example on Mac: "⌘ K", on Windows: "Ctrl + K".
 */
export function formatHotkey(hotkey: Hotkey, isMac = isMacPlatform()): string {
    const parts: string[] = [];

    for (const mod of hotkey.modifiers) {
        if (mod === 'Mod') {
            parts.push(isMac ? '⌘' : 'Ctrl');
        } else if (mod === 'Ctrl') {
            parts.push(isMac ? '⌃' : 'Ctrl');
        } else if (mod === 'Alt') {
            parts.push(isMac ? '⌥' : 'Alt');
        } else if (mod === 'Shift') {
            parts.push(isMac ? '⇧' : 'Shift');
        } else if (mod === 'Meta') {
            parts.push(isMac ? '⌘' : 'Win');
        }
    }

    parts.push(hotkey.key.toUpperCase());
    return isMac ? parts.join(' ') : parts.join(' + ');
}

interface HotkeySettingTab {
    setQuery?: (q: string) => void;
    searchInputEl?: { value: string };
    searchComponent?: {
        inputEl?: { value: string; dispatchEvent: (e: Event) => boolean };
        setValue?: (val: string) => void;
    };
    updateHotkeyVisibility?: () => void;
    renderHotkeyList?: () => void;
}

interface SettingDialogLike {
    open(): void;
    openTabById(id: string): HotkeySettingTab | null | undefined;
    activeTab?: HotkeySettingTab;
}

interface AppWithSettingDialog extends App {
    setting?: SettingDialogLike;
}

/**
 * Retrieves the currently active hotkey representation for a command from Obsidian's HotkeyManager,
 * or null if no hotkey is assigned.
 */
export function getCommandHotkeyDisplay(
    app: App,
    commandId: string,
): string | null {
    const isMac = isMacPlatform();
    const hotkeyManager = (app as unknown as AppWithHotkeyManager).hotkeyManager;

    if (hotkeyManager) {
        if (typeof hotkeyManager.printHotkeyForCommand === 'function') {
            const printed = hotkeyManager.printHotkeyForCommand(commandId);
            if (printed && typeof printed === 'string' && printed.trim().length > 0) {
                return printed.trim();
            }
        }

        let hotkeys: Hotkey[] | undefined;
        if (typeof hotkeyManager.getHotkeys === 'function') {
            hotkeys = hotkeyManager.getHotkeys(commandId);
        }
        if (
            (!hotkeys || hotkeys.length === 0) &&
            typeof hotkeyManager.getDefaultHotkeys === 'function'
        ) {
            hotkeys = hotkeyManager.getDefaultHotkeys(commandId);
        }

        if (hotkeys && hotkeys.length > 0) {
            return formatHotkey(hotkeys[0], isMac);
        }
    }

    return null;
}

/**
 * Opens Obsidian's native Hotkeys settings tab and filters to the specified command.
 */
export function openHotkeyAssignment(app: App, searchQuery: string): void {
    try {
        const appWithSetting = app as unknown as AppWithSettingDialog;
        const setting = appWithSetting.setting;
        if (!setting) return;

        setting.open();
        const tab = setting.openTabById('hotkeys') ?? setting.activeTab;
        if (!tab) return;

        if (typeof tab.setQuery === 'function') {
            tab.setQuery(searchQuery);
            return;
        }

        if (tab.searchComponent && typeof tab.searchComponent.setValue === 'function') {
            tab.searchComponent.setValue(searchQuery);
            tab.searchComponent.inputEl?.dispatchEvent(new Event('input'));
            return;
        }

        const input =
            tab.searchInputEl ??
            (tab.searchComponent?.inputEl as { value: string } | undefined);
        if (input) {
            input.value = searchQuery;
            if (typeof tab.updateHotkeyVisibility === 'function') {
                tab.updateHotkeyVisibility();
            } else if (typeof tab.renderHotkeyList === 'function') {
                tab.renderHotkeyList();
            }
        }
    } catch {
        /* best-effort fallback */
    }
}
