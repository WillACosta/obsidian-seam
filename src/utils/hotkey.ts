import { App, Hotkey, Modifier } from 'obsidian';

/**
 * Determines if the current environment is running on a Mac platform.
 */
export function isMacPlatform(): boolean {
    if (typeof navigator !== 'undefined') {
        return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    }
    return false;
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

/**
 * Retrieves the currently active hotkey representation for a command from Obsidian's HotkeyManager.
 */
export function getCommandHotkeyDisplay(
    app: App,
    commandId: string,
    fallbackString = 'Mod+K',
): string {
    const isMac = isMacPlatform();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hotkeyManager = (app as any).hotkeyManager;

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

    const parsed = parseHotkeyString(fallbackString);
    return parsed ? formatHotkey(parsed, isMac) : isMac ? '⌘ K' : 'Ctrl + K';
}

/**
 * Assigns a custom hotkey to a command in Obsidian and persists it to hotkeys.json.
 */
export async function setCommandHotkey(
    app: App,
    commandId: string,
    hotkey: Hotkey,
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hotkeyManager = (app as any).hotkeyManager;
    if (!hotkeyManager) return;

    if (typeof hotkeyManager.setHotkeys === 'function') {
        hotkeyManager.setHotkeys(commandId, [hotkey]);
    }
    if (typeof hotkeyManager.save === 'function') {
        await hotkeyManager.save();
    }
}

/**
 * Resets a command's hotkey back to its default or specified fallback.
 */
export async function resetCommandHotkey(
    app: App,
    commandId: string,
    defaultHotkey: Hotkey,
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hotkeyManager = (app as any).hotkeyManager;
    if (!hotkeyManager) return;

    if (typeof hotkeyManager.setHotkeys === 'function') {
        hotkeyManager.setHotkeys(commandId, [defaultHotkey]);
    } else if (typeof hotkeyManager.removeHotkeys === 'function') {
        hotkeyManager.removeHotkeys(commandId);
    }

    if (typeof hotkeyManager.save === 'function') {
        await hotkeyManager.save();
    }
}
