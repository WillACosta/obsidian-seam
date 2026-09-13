import { SeamSettings } from '../types';

/**
 * Resolves the tags to remove when moving a note to Permanent.
 * Always removes the permanent tag, the archive tag, and the predefined archive state tag (#archived),
 * plus any configured moveCleanupTags if enableMoveCleanup is true.
 */
export function getPermanentCleanupTags(settings: SeamSettings): string[] {
    const removeTagsList: string[] = [
        settings.permanentTag,
        settings.archiveTag,
        settings.archivedTag,
    ];

    if (settings.enableMoveCleanup && settings.moveCleanupTags) {
        const cleanupTags = settings.moveCleanupTags
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
        removeTagsList.push(...cleanupTags);
    }

    return Array.from(
        new Set(
            removeTagsList
                .map((t) => t.replace(/^#/, '').trim().toLowerCase())
                .filter((t) => t.length > 0),
        ),
    );
}

/**
 * Resolves the tags to remove when archiving a note.
 * Always removes the archive action tag and the permanent tag,
 * plus any configured moveCleanupTags if enableMoveCleanup is true.
 */
export function getArchiveCleanupTags(settings: SeamSettings): string[] {
    const removeTagsList: string[] = [
        settings.archiveTag,
        settings.permanentTag,
    ];

    if (settings.enableMoveCleanup && settings.moveCleanupTags) {
        const cleanupTags = settings.moveCleanupTags
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
        removeTagsList.push(...cleanupTags);
    }

    return Array.from(
        new Set(
            removeTagsList
                .map((t) => t.replace(/^#/, '').trim().toLowerCase())
                .filter((t) => t.length > 0),
        ),
    );
}

/**
 * Resolves the frontmatter properties to remove when moving or archiving a note.
 */
export function getMoveCleanupProperties(settings: SeamSettings): string[] {
    if (!settings.enableMoveCleanup || !settings.moveCleanupProperties) {
        return [];
    }
    return Array.from(
        new Set(
            settings.moveCleanupProperties
                .split(',')
                .map((p) => p.trim())
                .filter((p) => p.length > 0),
        ),
    );
}
