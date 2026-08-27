import { Notice, Plugin, TAbstractFile, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, PaletteItem, SeamSettings } from './types';
import { AutomationQueue } from './automation/AutomationQueue';
import { AutomationService } from './automation/AutomationService';
import { hasTag } from './automation/actions/ArchiveAction';
import { Reconciler } from './automation/Reconciler';
import { SearchService } from './search/SearchService';
import { UniversalPalette } from './ui/UniversalPalette';
import { SeamSettingsTab } from './settings/SettingsTab';

/**
 * Seam — Tag-driven note organization for Obsidian.
 *
 * The plugin adds a small behavioral layer over Obsidian:
 * - #archive → move to Archive/, remove tag, optionally add #archived
 * - #permanent → move to Permanent/, remove tag
 * - Universal Palette for search and commands
 * - Event-driven + reconciliation automation
 */
export default class SeamPlugin extends Plugin {
    settings: SeamSettings = DEFAULT_SETTINGS;

    private automationService!: AutomationService;
    private automationQueue!: AutomationQueue;
    private reconciler!: Reconciler;
    private searchService!: SearchService;
    private reconciliationIntervalId: number | null = null;

    async onload(): Promise<void> {
        // 1. Load persisted settings
        await this.loadSettings();

        // 2. Instantiate lightweight services
        this.automationService = new AutomationService(this.app, this.settings);
        this.automationQueue = new AutomationQueue(
            this.app,
            async (file: TFile) => {
                if (!this.settings.automaticProcessing) return;
                await this.automationService.processFile(file);
            },
        );
        this.reconciler = new Reconciler(this.app, this.settings, this.automationQueue);
        this.searchService = new SearchService(this.app, this.settings);

        // 3. Register commands
        this.addCommand({
            id: 'open-palette',
            name: 'Open Universal Palette',
            callback: () => this.openPalette(),
        });

        this.addCommand({
            id: 'archive-all',
            name: 'Archive all notes with #archive',
            callback: () => this.archiveAll(),
        });

        this.addCommand({
            id: 'process-pending',
            name: 'Process pending automations',
            callback: () => this.processPending(),
        });

        this.addCommand({
            id: 'show-status',
            name: 'Show automation status',
            callback: () => this.showStatus(),
        });

        // 4. Register settings tab
        this.addSettingTab(new SeamSettingsTab(this.app, this));

        // 5. Defer heavy initialization until layout is ready
        this.app.workspace.onLayoutReady(() => {
            this.initializeAfterLayout();
        });
    }

    onunload(): void {
        if (this.reconciliationIntervalId !== null) {
            window.clearInterval(this.reconciliationIntervalId);
            this.reconciliationIntervalId = null;
        }
        this.automationQueue.destroy();
    }

    /**
     * Called after workspace.onLayoutReady().
     * Registers vault event handlers and runs startup reconciliation.
     */
    private initializeAfterLayout(): void {
        // Register vault event handlers
        this.registerEvent(
            this.app.vault.on('create', (file: TAbstractFile) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.automationQueue.enqueue(file);
                }
            }),
        );

        this.registerEvent(
            this.app.vault.on('modify', (file: TAbstractFile) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.automationQueue.enqueue(file);
                }
            }),
        );

        this.registerEvent(
            this.app.vault.on('rename', (file: TAbstractFile) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.automationQueue.enqueue(file);
                }
            }),
        );

        // Run startup reconciliation
        this.reconciler.scan();

        // Set up periodic reconciliation (safety net)
        this.startPeriodicReconciliation();
    }

    /**
     * Starts or restarts the periodic reconciliation timer.
     * Registered so it's cleaned up on plugin unload.
     */
    private startPeriodicReconciliation(): void {
        if (this.reconciliationIntervalId !== null) {
            window.clearInterval(this.reconciliationIntervalId);
        }

        const intervalMs = this.settings.reconciliationIntervalMinutes * 60 * 1000;
        this.reconciliationIntervalId = this.registerInterval(
            window.setInterval(() => {
                if (this.settings.automaticProcessing) {
                    this.reconciler.scan();
                }
            }, intervalMs),
        );
    }

    // ---- Commands ----

    private openPalette(): void {
        const commands = this.getPaletteCommands();
        const palette = new UniversalPalette(
            this.app,
            this.settings,
            this.searchService,
            commands,
        );
        palette.open();
    }

    private async archiveAll(): Promise<void> {
        const files = this.app.vault.getMarkdownFiles();
        let archivedCount = 0;
        let errorCount = 0;

        for (const file of files) {
            if (hasTag(file, this.app, this.settings.archiveTag)) {
                const result = await this.automationService.processFile(file);
                if (result.status === 'success') {
                    archivedCount++;
                } else if (result.status === 'error' || result.status === 'conflict') {
                    errorCount++;
                }
            }
        }

        if (archivedCount > 0 || errorCount > 0) {
            let message = `Archived ${archivedCount} note${archivedCount !== 1 ? 's' : ''}`;
            if (errorCount > 0) {
                message += `. ${errorCount} error${errorCount !== 1 ? 's' : ''}.`;
            }
            new Notice(message);
        } else {
            new Notice('No notes with #archive found.');
        }
    }

    private async processPending(): Promise<void> {
        await this.automationQueue.flush();
        this.reconciler.scan();
        new Notice('Processed pending automations.');
    }

    private showStatus(): void {
        const status = this.automationService.getStatus();
        const message = [
            'Seam Automation',
            '',
            `Pending: ${status.pending}`,
            `Processed: ${status.processed}`,
            `Failed: ${status.failed}`,
        ].join('\n');
        new Notice(message, 5000);
    }

    /**
     * Returns the list of commands available in the Universal Palette.
     */
    private getPaletteCommands(): PaletteItem[] {
        return [
            {
                id: 'cmd-archive-all',
                title: 'Archive all notes with #archive',
                description: 'Process all notes tagged with #archive',
                type: 'command',
                action: () => this.archiveAll(),
            },
            {
                id: 'cmd-process-pending',
                title: 'Process pending automations',
                description: 'Manually trigger reconciliation',
                type: 'command',
                action: () => this.processPending(),
            },
            {
                id: 'cmd-show-status',
                title: 'Show automation status',
                description: 'Display pending, processed, and failed counts',
                type: 'command',
                action: () => this.showStatus(),
            },
        ];
    }

    // ---- Settings ----

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        this.onSettingsChange();
    }

    /**
     * Called when settings change. Propagates new settings to all services.
     */
    onSettingsChange(): void {
        this.automationService?.updateSettings(this.settings);
        this.reconciler?.updateSettings(this.settings);
        this.searchService?.updateSettings(this.settings);
        this.startPeriodicReconciliation();
    }
}
