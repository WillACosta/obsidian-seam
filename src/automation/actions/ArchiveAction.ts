import { App, TFile, normalizePath } from 'obsidian';
import { SeamSettings, AutomationResult } from '../../types';

/**
 * Checks whether a file has a specific tag (frontmatter or inline).
 * Compares tag names without the # prefix, case-insensitively.
 */
export function hasTag(file: TFile, app: App, targetTag: string): boolean {
    const cache = app.metadataCache.getFileCache(file);
    if (!cache) return false;

    const normalizedTarget = targetTag.replace(/^#/, '').toLowerCase();

    // Check frontmatter tags
    const fmTags = cache.frontmatter?.tags;
    if (fmTags) {
        const tags: string[] = Array.isArray(fmTags)
            ? fmTags
            : typeof fmTags === 'string'
                ? fmTags.split(',').map(t => t.trim())
                : [];
        if (tags.some(t => t.replace(/^#/, '').toLowerCase() === normalizedTarget)) {
            return true;
        }
    }

    // Check inline tags
    if (cache.tags) {
        if (cache.tags.some(t => t.tag.replace(/^#/, '').toLowerCase() === normalizedTarget)) {
            return true;
        }
    }

    return false;
}

/**
 * Removes a tag from a file's frontmatter and inline content.
 * Uses processFrontMatter for YAML tags and vault.process for inline tags.
 */
export async function removeTag(file: TFile, app: App, tagToRemove: string): Promise<void> {
    const cache = app.metadataCache.getFileCache(file);
    if (!cache) return;

    const cleanTag = tagToRemove.replace(/^#/, '').toLowerCase();

    // Remove from frontmatter if present
    if (cache.frontmatter?.tags) {
        await app.fileManager.processFrontMatter(file, (fm) => {
            if (!fm.tags) return;
            if (Array.isArray(fm.tags)) {
                fm.tags = fm.tags.filter(
                    (t: string) => t.replace(/^#/, '').toLowerCase() !== cleanTag
                );
                if (fm.tags.length === 0) {
                    delete fm.tags;
                }
            } else if (typeof fm.tags === 'string') {
                const tags = fm.tags
                    .split(',')
                    .map((t: string) => t.trim())
                    .filter((t: string) => t.replace(/^#/, '').toLowerCase() !== cleanTag);
                if (tags.length === 0) {
                    delete fm.tags;
                } else {
                    fm.tags = tags;
                }
            }
        });
    }

    // Remove from inline content
    if (cache.tags?.some(t => t.tag.replace(/^#/, '').toLowerCase() === cleanTag)) {
        await app.vault.process(file, (content) => {
            const escapedTag = cleanTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(^|[ \\t])#${escapedTag}(?=[ \\t]|\\n|$)`, 'gmi');
            return content
                .replace(regex, '')
                .split('\n')
                .map((line) => line.trimEnd())
                .join('\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim() + '\n';
        });
    }
}

/**
 * Adds a tag to a file's frontmatter.
 * Creates the tags array if it doesn't exist.
 */
export async function addTag(file: TFile, app: App, tagToAdd: string): Promise<void> {
    const cleanTag = tagToAdd.replace(/^#/, '');
    await app.fileManager.processFrontMatter(file, (fm) => {
        if (!fm.tags) {
            fm.tags = [cleanTag];
        } else if (Array.isArray(fm.tags)) {
            if (!fm.tags.some((t: string) => t.toLowerCase() === cleanTag.toLowerCase())) {
                fm.tags.push(cleanTag);
            }
        } else if (typeof fm.tags === 'string') {
            const tags = fm.tags.split(',').map((t: string) => t.trim());
            if (!tags.some((t: string) => t.toLowerCase() === cleanTag.toLowerCase())) {
                tags.push(cleanTag);
            }
            fm.tags = tags;
        }
    });
}

export class ArchiveAction {
    canApply(file: TFile, app: App, settings: SeamSettings): boolean {
        const hasArchiveTag = hasTag(file, app, settings.archiveTag);
        const hasPermanentTag = hasTag(file, app, settings.permanentTag);
        // Conflict: both tags present → skip (handled by AutomationService)
        return hasArchiveTag && !hasPermanentTag;
    }

    async apply(file: TFile, app: App, settings: SeamSettings): Promise<AutomationResult> {
        try {
            // Re-verify file existence
            const currentFile = app.vault.getAbstractFileByPath(file.path);
            if (!currentFile || !(currentFile instanceof TFile)) {
                return {
                    status: 'skipped',
                    file,
                    action: 'archive',
                    message: 'File no longer exists',
                };
            }

            // Re-verify tag presence
            if (!this.canApply(currentFile, app, settings)) {
                return {
                    status: 'skipped',
                    file: currentFile,
                    action: 'archive',
                    message: 'Conditions no longer met',
                };
            }

            const newPath = normalizePath(`${settings.archiveFolder}/${currentFile.name}`);

            // If file is already in the destination, just clean up tags
            if (newPath === currentFile.path) {
                await removeTag(currentFile, app, settings.archiveTag);
                if (settings.addArchivedState) {
                    await addTag(currentFile, app, settings.archivedTag);
                }
                return {
                    status: 'success',
                    file: currentFile,
                    action: 'archive',
                    message: 'Tags updated (file already in destination)',
                    newPath,
                };
            }

            // Check for filename collision at destination
            const existing = app.vault.getAbstractFileByPath(newPath);
            if (existing) {
                return {
                    status: 'conflict',
                    file: currentFile,
                    action: 'archive',
                    message: `Destination file already exists: ${newPath}`,
                };
            }

            // Ensure destination folder exists
            const folderPath = normalizePath(settings.archiveFolder);
            if (!app.vault.getAbstractFileByPath(folderPath)) {
                try {
                    await app.vault.createFolder(folderPath);
                } catch {
                    // Folder may already exist (race condition)
                }
            }

            // Move file first (safe ordering: move before tag removal)
            await app.fileManager.renameFile(currentFile, newPath);

            // Only remove tag after successful move
            await removeTag(currentFile, app, settings.archiveTag);

            // Optionally add archived state tag
            if (settings.addArchivedState) {
                await addTag(currentFile, app, settings.archivedTag);
            }

            return {
                status: 'success',
                file: currentFile,
                action: 'archive',
                message: `Archived to ${newPath}`,
                newPath,
            };
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error during archive';
            return {
                status: 'error',
                file,
                action: 'archive',
                message,
            };
        }
    }
}
