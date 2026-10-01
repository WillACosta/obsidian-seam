import { App } from 'obsidian';
import { SeamSettings } from '../types';
import { AutomationQueue } from './AutomationQueue';
import { AutomationService } from './AutomationService';
import { hasTag } from './actions/ArchiveAction';

/**
 * Reconciler scans the vault for files with pending action tags and source attachments
 * and enqueues them for processing. Used at startup and periodically.
 */
export class Reconciler {
    constructor(
        private app: App,
        private settings: SeamSettings,
        private queue: AutomationQueue,
        private service: AutomationService,
    ) {}

    /**
     * Enqueue notes with action tags and supported source attachments.
     * Uses MetadataCache for efficient tag detection without reading file content.
     */
    scan(): void {
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            const hasArchiveTag = hasTag(file, this.app, this.settings.archiveTag);
            const hasPermanentTag = hasTag(file, this.app, this.settings.permanentTag);
            if (this.settings.automaticProcessing && (hasArchiveTag || hasPermanentTag)) {
                this.queue.enqueue(file);
            }
        }
        if (this.settings.sourceAutomation) {
            for (const file of this.service.getSourceAttachments()) this.queue.enqueue(file);
        }
    }

    updateSettings(settings: SeamSettings): void {
        this.settings = settings;
    }
}
