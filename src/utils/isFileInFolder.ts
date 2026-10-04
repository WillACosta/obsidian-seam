import { normalizePath } from 'obsidian';

/** Checks whether a vault file is in the configured folder or one of its descendants. */
export function isFileInFolder(file: { path: string }, configuredFolder: string): boolean {
    const folder = configuredFolder.trim().replace(/^\/+|\/+$/g, '');
    const destination = folder ? normalizePath(folder) : '';
    const lastSeparator = file.path.lastIndexOf('/');
    const directory = lastSeparator < 0 ? '' : file.path.slice(0, lastSeparator);

    if (!destination) return directory === '';
    return directory === destination || directory.startsWith(`${destination}/`);
}
