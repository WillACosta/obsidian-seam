import { App, TFile, normalizePath } from 'obsidian';
import { SeamSettings, AutomationResult } from '../../types';
import { hasTag, removeTag } from './ArchiveAction';

export class PermanentAction {
    canApply(file: TFile, app: App, settings: SeamSettings): boolean {
        const hasPermanentTag = hasTag(file, app, settings.permanentTag);
        const hasArchiveTag = hasTag(file, app, settings.archiveTag);
        // Conflict: both tags present → skip (handled by AutomationService)
        return hasPermanentTag && !hasArchiveTag;
    }

    async apply(file: TFile, app: App, settings: SeamSettings): Promise<AutomationResult> {
        try {
            // Re-verify file existence
            const currentFile = app.vault.getAbstractFileByPath(file.path);
            if (!currentFile || !(currentFile instanceof TFile)) {
                return {
                    status: 'skipped',
                    file,
                    action: 'permanent',
                    message: 'File no longer exists',
                };
            }

            // Re-verify tag presence
            if (!this.canApply(currentFile, app, settings)) {
                return {
                    status: 'skipped',
                    file: currentFile,
                    action: 'permanent',
                    message: 'Conditions no longer met',
                };
            }

            const newPath = normalizePath(`${settings.permanentFolder}/${currentFile.name}`);

            // If file is already in the destination, just clean up tags
            if (newPath === currentFile.path) {
                await removeTag(currentFile, app, settings.permanentTag);
                return {
                    status: 'success',
                    file: currentFile,
                    action: 'permanent',
                    message: 'Tag removed (file already in destination)',
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
                    message: `Destination file already exists: ${newPath}`,
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

            // Only remove tag after successful move
            await removeTag(currentFile, app, settings.permanentTag);

            return {
                status: 'success',
                file: currentFile,
                action: 'permanent',
                message: `Moved to ${newPath}`,
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
}
