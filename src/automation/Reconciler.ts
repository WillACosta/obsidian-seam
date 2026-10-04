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
    // Settings are mutated in place by the UI, so retain scalar snapshots.
    private sourcesFolder: string;
    private sourceAutomation: boolean;

    constructor(
        private app: App,
        private settings: SeamSettings,
        private queue: AutomationQueue,
        private service: AutomationService,
    ) {
        this.sourcesFolder = settings.sourcesFolder;
        this.sourceAutomation = settings.sourceAutomation;
    }

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
        this.scanSources();
    }

    private scanSources(): void {
        if (!this.settings.sourceAutomation) return;
        for (const file of this.service.getSourceAttachments()) this.queue.enqueue(file);
    }

    updateSettings(settings: SeamSettings): void {
        const shouldScanSources = settings.sourceAutomation
            && (settings.sourcesFolder !== this.sourcesFolder || !this.sourceAutomation);
        this.settings = settings;
        this.sourcesFolder = settings.sourcesFolder;
        this.sourceAutomation = settings.sourceAutomation;
        if (shouldScanSources) this.scanSources();
    }
}
