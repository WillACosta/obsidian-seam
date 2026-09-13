import { App, TFile, normalizePath } from 'obsidian';
import { SeamSettings, AutomationResult } from '../../types';
import { hasTag, updateNoteTagsAndProperties } from './ArchiveAction';
import { t } from '../../i18n';

export class PermanentAction {
    canApply(file: TFile, app: App, settings: SeamSettings): boolean {
        const hasPermanentTag = hasTag(file, app, settings.permanentTag);
        const hasArchiveTag = hasTag(file, app, settings.archiveTag);
        // Conflict: both tags present → skip (handled by AutomationService)
        return hasPermanentTag && !hasArchiveTag;
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
                    action: 'permanent',
                    message: t().msgFileNoLongerExists,
                };
            }

            // Re-verify tag presence (bypassed if force is true, e.g. from direct command)
            if (!options?.force && !this.canApply(currentFile, app, settings)) {
                return {
                    status: 'skipped',
                    file: currentFile,
                    action: 'permanent',
                    message: t().msgConditionsNoLongerMet,
                };
            }

            const newPath = normalizePath(`${settings.permanentFolder}/${currentFile.name}`);

            // If file is already in the destination, clean up tags and properties
            if (newPath === currentFile.path) {
                await this.performPostMoveCleanup(currentFile, app, settings);
                return {
                    status: 'success',
                    file: currentFile,
                    action: 'permanent',
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
                    action: 'permanent',
                    message: t().msgDestFileExists(newPath),
                };
            }

            // Ensure destination folder exists
            const folderPath = normalizePath(settings.permanentFolder);
            if (!app.vault.getAbstractFileByPath(folderPath)) {
                try {
                    await app.vault.createFolder(folderPath);
                } catch {
                    // Folder may already exist (race condition)
                }
            }

            // Move file first (safe ordering: move before tag removal)
            await app.fileManager.renameFile(currentFile, newPath);

            // Clean up action tags and configured cleanup items after successful move
            await this.performPostMoveCleanup(currentFile, app, settings);

            return {
                status: 'success',
                file: currentFile,
                action: 'permanent',
                message: t().msgMovedTo(newPath),
                newPath,
            };
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error during permanent move';
            return {
                status: 'error',
                file,
                action: 'permanent',
                message,
            };
        }
    }

    /**
     * Executes atomic tag removal and configured tag/property cleanups after permanent move.
     */
    private async performPostMoveCleanup(
        file: TFile,
        app: App,
        settings: SeamSettings,
    ): Promise<void> {
        const removeTagsList: string[] = [settings.permanentTag];
        const removePropertiesList: string[] = [];

        if (settings.enableMoveCleanup) {
            if (settings.moveCleanupTags) {
                const cleanupTags = settings.moveCleanupTags
                    .split(',')
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0);
                removeTagsList.push(...cleanupTags);
            }

            if (settings.moveCleanupProperties) {
                const cleanupProps = settings.moveCleanupProperties
                    .split(',')
                    .map((p) => p.trim())
                    .filter((p) => p.length > 0);
                removePropertiesList.push(...cleanupProps);
            }
        }

        await updateNoteTagsAndProperties(file, app, {
            removeTags: removeTagsList,
            removeProperties: removePropertiesList,
        });
    }
}
