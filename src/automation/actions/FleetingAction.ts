import { App, normalizePath, TFile } from 'obsidian';
import { AutomationResult, SeamSettings } from '../../types';
import { t } from '../../i18n';
import { getFleetingCleanupTags, getMoveCleanupProperties } from '../TagCleanup';
import { updateNoteTagsAndProperties } from './ArchiveAction';

/** Moves an open note back to the configured Fleeting folder. */
export class FleetingAction {
    async apply(file: TFile, app: App, settings: SeamSettings): Promise<AutomationResult> {
        const currentFile = app.vault.getAbstractFileByPath(file.path);
        if (!currentFile || !(currentFile instanceof TFile)) {
            return {
                status: 'skipped',
                file,
                action: 'fleeting',
                message: t().msgFileNoLongerExists,
            };
        }

        const folderPath = settings.fleetingFolder.trim()
            ? normalizePath(settings.fleetingFolder)
            : '';
        const newPath = folderPath ? normalizePath(`${folderPath}/${currentFile.name}`) : currentFile.name;
        const alreadyInDestination = newPath === currentFile.path;

        try {
            if (!alreadyInDestination) {
                if (app.vault.getAbstractFileByPath(newPath)) {
                    return {
                        status: 'conflict',
                        file: currentFile,
                        action: 'fleeting',
                        message: t().msgDestFileExists(newPath),
                    };
                }

                if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
                    try {
                        await app.vault.createFolder(folderPath);
                    } catch {
                        // Another action may have created the folder.
                    }
                }

                await app.fileManager.renameFile(currentFile, newPath);
            }

            await updateNoteTagsAndProperties(currentFile, app, {
                removeTags: getFleetingCleanupTags(settings),
                removeProperties: getMoveCleanupProperties(settings),
            });

            return {
                status: 'success',
                file: currentFile,
                action: 'fleeting',
                message: alreadyInDestination ? t().msgTagsUpdatedAlreadyInDest : t().msgMovedTo(newPath),
                newPath,
            };
        } catch (e: unknown) {
            return {
                status: 'error',
                file: currentFile,
                action: 'fleeting',
                message: e instanceof Error ? e.message : 'Unknown error during fleeting move',
            };
        }
    }
}
