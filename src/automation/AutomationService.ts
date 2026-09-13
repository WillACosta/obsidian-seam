import { App, TFile, Notice } from 'obsidian';
import { SeamSettings, AutomationResult, AutomationStatus, AutomationError } from '../types';
import { ArchiveAction, hasTag } from './actions/ArchiveAction';
import { PermanentAction } from './actions/PermanentAction';
import { t } from '../i18n';

/**
 * Single authoritative automation service.
 * All automation entry points (events, startup reconciliation, manual commands)
 * must route through this service.
 */
export class AutomationService {
    private archiveAction: ArchiveAction;
    private permanentAction: PermanentAction;

    private processedCount = 0;
    private failedCount = 0;
    private errors: AutomationError[] = [];

    constructor(
        private app: App,
        private settings: SeamSettings,
    ) {
        this.archiveAction = new ArchiveAction();
        this.permanentAction = new PermanentAction();
    }

    /**
     * Process a single file through the automation pipeline.
     * Determines which action (if any) applies and delegates.
     */
    async processFile(file: TFile): Promise<AutomationResult> {
        // Re-verify file still exists
        const currentFile = this.app.vault.getAbstractFileByPath(file.path);
        if (!currentFile || !(currentFile instanceof TFile)) {
            return {
                status: 'skipped',
                file,
                action: 'none',
                message: t().msgFileNoLongerExists,
            };
        }

        const hasArchiveTag = hasTag(currentFile, this.app, this.settings.archiveTag);
        const hasPermanentTag = hasTag(currentFile, this.app, this.settings.permanentTag);

        // Conflict: both action tags present → do not move (SDD v0.1 recommendation)
        if (hasArchiveTag && hasPermanentTag) {
            const result: AutomationResult = {
                status: 'conflict',
                file: currentFile,
                action: 'conflict',
                message: t().msgConflictBothTags,
            };
            this.recordFailure(currentFile.path, result);
            return result;
        }

        // Try archive action
        if (this.archiveAction.canApply(currentFile, this.app, this.settings)) {
            const result = await this.archiveAction.apply(currentFile, this.app, this.settings);
            this.recordResult(currentFile.path, result);
            return result;
        }

        // Try permanent action
        if (this.permanentAction.canApply(currentFile, this.app, this.settings)) {
            const result = await this.permanentAction.apply(currentFile, this.app, this.settings);
            this.recordResult(currentFile.path, result);
            return result;
        }

        // No action applicable
        return {
            status: 'skipped',
            file: currentFile,
            action: 'none',
            message: t().msgNoApplicableAutomation,
        };
    }

    private recordResult(path: string, result: AutomationResult): void {
        if (result.status === 'success') {
            this.processedCount++;
        } else if (result.status === 'error' || result.status === 'conflict') {
            this.recordFailure(path, result);
        }
    }

    private recordFailure(path: string, result: AutomationResult): void {
        this.failedCount++;
        this.errors.push({
            filePath: path,
            action: result.action,
            message: result.message,
            timestamp: Date.now(),
        });
    }

    getStatus(): AutomationStatus {
        return {
            pending: 0, // Queue tracks pending count separately
            processed: this.processedCount,
            failed: this.failedCount,
            errors: [...this.errors],
        };
    }

    /**
     * Directly archive a specific file (used by "Archive current note" command).
     * Bypasses tag precondition verification ({ force: true }) so manual archiving
     * succeeds immediately without race conditions or metadata cache delays.
     */
    async archiveFile(file: TFile): Promise<AutomationResult> {
        const currentFile = this.app.vault.getAbstractFileByPath(file.path);
        if (!currentFile || !(currentFile instanceof TFile)) {
            return {
                status: 'skipped',
                file,
                action: 'archive',
                message: t().msgFileNoLongerExists,
            };
        }

        const result = await this.archiveAction.apply(currentFile, this.app, this.settings, {
            force: true,
        });
        this.recordResult(currentFile.path, result);
        return result;
    }

    /**
     * Directly move a specific file to permanent folder (used by "Move to Permanent" command).
     * Bypasses tag precondition verification ({ force: true }) so manual moving
     * succeeds immediately without race conditions or metadata cache delays.
     */
    async moveFileToPermanent(file: TFile): Promise<AutomationResult> {
        const currentFile = this.app.vault.getAbstractFileByPath(file.path);
        if (!currentFile || !(currentFile instanceof TFile)) {
            return {
                status: 'skipped',
                file,
                action: 'permanent',
                message: t().msgFileNoLongerExists,
            };
        }

        const result = await this.permanentAction.apply(currentFile, this.app, this.settings, {
            force: true,
        });
        this.recordResult(currentFile.path, result);
        return result;
    }

    updateSettings(settings: SeamSettings): void {
        this.settings = settings;
    }
}
