import { App, TFile, normalizePath } from 'obsidian';
import { SeamSettings, AutomationResult } from '../../types';
import { t } from '../../i18n';

/**
 * Checks whether a file has a specific tag (frontmatter or inline).
 * Compares tag names without the # prefix, case-insensitively.
 */
export function hasTag(file: TFile, app: App, targetTag: string): boolean {
    const cache = app.metadataCache.getFileCache(file);
    if (!cache) return false;

    const normalizedTarget = targetTag.replace(/^#/, '').toLowerCase();

    // Check frontmatter tags
    const frontmatter = cache.frontmatter as Record<string, unknown> | undefined;
    const fmTags = frontmatter?.tags;
    if (fmTags) {
        let tags: string[] = [];
        if (Array.isArray(fmTags)) {
            tags = (fmTags as unknown[]).map((t) => String(t));
        } else if (typeof fmTags === 'string') {
            tags = fmTags.split(',').map((t) => t.trim());
        }
        if (tags.some((t) => t.replace(/^#/, '').toLowerCase() === normalizedTarget)) {
            return true;
        }
    }

    // Check inline tags
    if (cache.tags) {
        if (cache.tags.some((t) => t.tag.replace(/^#/, '').toLowerCase() === normalizedTarget)) {
            return true;
        }
    }

    return false;
}

import { getArchiveCleanupTags, getMoveCleanupProperties } from '../TagCleanup';
export { getArchiveCleanupTags, getMoveCleanupProperties };

/**
 * Atomically updates a note's frontmatter and inline content:
 * - Removes specified tags from frontmatter and inline text
 * - Adds specified tags to frontmatter
 * - Removes specified properties from frontmatter
 */
export async function updateNoteTagsAndProperties(
    file: TFile,
    app: App,
    options: {
        removeTags?: string[];
        addTags?: string[];
        removeProperties?: string[];
    },
): Promise<void> {
    const tagsToRemove = Array.from(
        new Set(
            (options.removeTags || [])
                .map((t) => t.replace(/^#/, '').trim().toLowerCase())
                .filter((t) => t.length > 0),
        ),
    );

    const tagsToAdd = Array.from(
        new Set(
            (options.addTags || [])
                .map((t) => t.replace(/^#/, '').trim())
                .filter((t) => t.length > 0),
        ),
    );

    const propsToRemove = Array.from(
        new Set(
            (options.removeProperties || [])
                .map((p) => p.trim())
                .filter((p) => p.length > 0),
        ),
    );

    // 1. Process Frontmatter
    await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        // Remove properties
        for (const prop of propsToRemove) {
            delete fm[prop];
        }

        // Handle frontmatter tags
        const rawTags = fm.tags;
        if (rawTags) {
            let existingTags: string[] = [];
            if (Array.isArray(rawTags)) {
                existingTags = (rawTags as unknown[]).map((t) => String(t));
            } else if (typeof rawTags === 'string') {
                existingTags = rawTags.split(',').map((t) => t.trim());
            }

            // Filter out tags to remove
            existingTags = existingTags.filter(
                (t) => !tagsToRemove.includes(t.replace(/^#/, '').toLowerCase()),
            );

            // Add new tags if not present
            for (const tagToAdd of tagsToAdd) {
                if (!existingTags.some((t) => t.toLowerCase() === tagToAdd.toLowerCase())) {
                    existingTags.push(tagToAdd);
                }
            }

            if (existingTags.length === 0) {
                delete fm.tags;
            } else {
                fm.tags = existingTags;
            }
        } else if (tagsToAdd.length > 0) {
            fm.tags = [...tagsToAdd];
        }
    });

    // 2. Remove inline tags from content
    if (tagsToRemove.length > 0) {
        await app.vault.process(file, (content) => {
            let updated = content;
            for (const cleanTag of tagsToRemove) {
                const escapedTag = cleanTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(^|[ \\t])#${escapedTag}(?=[ \\t]|\\n|$)`, 'gmi');
                updated = updated.replace(regex, '');
            }
            return (
                updated
                    .split('\n')
                    .map((line) => line.trimEnd())
                    .join('\n')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim() + '\n'
            );
        });
    }
}

/**
 * Removes a single tag from a file (frontmatter and inline).
 */
export async function removeTag(file: TFile, app: App, tagToRemove: string): Promise<void> {
    await updateNoteTagsAndProperties(file, app, { removeTags: [tagToRemove] });
}

/**
 * Adds a tag to a file's frontmatter.
 */
export async function addTag(file: TFile, app: App, tagToAdd: string): Promise<void> {
    await updateNoteTagsAndProperties(file, app, { addTags: [tagToAdd] });
}

export class ArchiveAction {
    canApply(file: TFile, app: App, settings: SeamSettings): boolean {
        const hasArchiveTag = hasTag(file, app, settings.archiveTag);
        const hasPermanentTag = hasTag(file, app, settings.permanentTag);
        // Conflict: both tags present → skip (handled by AutomationService)
        return hasArchiveTag && !hasPermanentTag;
    }

    async apply(
        file: TFile,
        app: App,
        settings: SeamSettings,
        options?: { force?: boolean },
    ): Promise<AutomationResult> {
        try {
            // Re-verify file existence
            const currentFile = app.vault.getAbstractFileByPath(file.path);
            if (!currentFile || !(currentFile instanceof TFile)) {
                return {
                    status: 'skipped',
                    file,
                    action: 'archive',
                    message: t().msgFileNoLongerExists,
                };
            }

            // Re-verify tag presence (bypassed if force is true, e.g. from direct command)
            if (!options?.force && !this.canApply(currentFile, app, settings)) {
                return {
                    status: 'skipped',
                    file: currentFile,
                    action: 'archive',
                    message: t().msgConditionsNoLongerMet,
                };
            }

            const newPath = normalizePath(`${settings.archiveFolder}/${currentFile.name}`);

            // If file is already in destination, clean up tags and properties
            if (newPath === currentFile.path) {
                await this.performPostArchiveCleanup(currentFile, app, settings);
                return {
                    status: 'success',
                    file: currentFile,
                    action: 'archive',
                    message: t().msgTagsUpdatedAlreadyInDest,
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
                    message: t().msgDestFileExists(newPath),
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

            // Clean up action tags, add durable state tag, and remove configured cleanup items
            await this.performPostArchiveCleanup(currentFile, app, settings);

            return {
                status: 'success',
                file: currentFile,
                action: 'archive',
                message: t().msgArchivedTo(newPath),
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

    /**
     * Executes atomic tag removal, state tag addition, and configured tag/property cleanups.
     */
    private async performPostArchiveCleanup(
        file: TFile,
        app: App,
        settings: SeamSettings,
    ): Promise<void> {
        const removeTagsList = getArchiveCleanupTags(settings);
        const removePropertiesList = getMoveCleanupProperties(settings);
        const addTagsList: string[] = [];

        if (settings.addArchivedState && settings.archivedTag) {
            addTagsList.push(settings.archivedTag);
        }

        await updateNoteTagsAndProperties(file, app, {
            removeTags: removeTagsList,
            addTags: addTagsList,
            removeProperties: removePropertiesList,
        });
    }
}
