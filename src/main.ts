import { Notice, Plugin, TAbstractFile, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, PaletteItem, SeamSettings } from './types';
import { AutomationQueue } from './automation/AutomationQueue';
import { AutomationService } from './automation/AutomationService';
import { hasTag } from './automation/actions/ArchiveAction';
import { Reconciler } from './automation/Reconciler';
import { SearchService } from './search/SearchService';
import { UniversalPalette } from './ui/UniversalPalette';
import { SeamSettingsTab } from './settings/SettingsTab';
import { t } from './i18n';

/**
 * Tags and properties that Seam uses as action triggers.
 * We preserve these in the tag/property suggestion cache so Obsidian
 * continues to auto-suggest them even after Seam removes all occurrences.
 */
const SEAM_MANAGED_TAGS = ['archive', 'permanent', 'archived', 'todo'];
const SEAM_MANAGED_PROPERTIES = ['status'];

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
            this.settings.automationDelay,
        );
        this.reconciler = new Reconciler(this.app, this.settings, this.automationQueue);
        this.searchService = new SearchService(this.app, this.settings);

        // 3. Register commands
        this.addCommand({
            id: 'open-palette',
            name: t().cmdOpenPalette,
            callback: () => this.openPalette(),
        });

        this.addCommand({
            id: 'archive-all',
            name: t().cmdArchiveAll,
            callback: () => this.archiveAll(),
        });

        this.addCommand({
            id: 'process-pending',
            name: t().cmdProcessPending,
            callback: () => this.processPending(),
        });

        this.addCommand({
            id: 'show-status',
            name: t().cmdShowStatus,
            callback: () => this.showStatus(),
        });

        // Commands that operate on the current open note
        this.addCommand({
            id: 'archive-current-note',
            name: t().cmdArchiveCurrentNote,
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (!file || file.extension !== 'md') return false;
                if (checking) return true;
                void this.archiveCurrentNote(file);
                return true;
            },
        });

        this.addCommand({
            id: 'move-to-permanent',
            name: t().cmdMoveToPermanent,
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (!file || file.extension !== 'md') return false;
                if (checking) return true;
                void this.moveCurrentNoteToPermanent(file);
                return true;
            },
        });

        // 4. Register settings tab
        this.addSettingTab(new SeamSettingsTab(this.app, this));

        // 5. Defer heavy initialization until layout is ready
        this.app.workspace.onLayoutReady(() => {
            void this.initializeAfterLayout();
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
     * Registers vault event handlers, runs startup reconciliation,
     * and seeds the tag suggestion cache.
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

        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.automationQueue.onActiveFileChange(this.app.workspace.getActiveFile());
            }),
        );

        // Run startup reconciliation
        void this.reconciler.scan();

        // Set up periodic reconciliation (safety net)
        this.startPeriodicReconciliation();

        // Seed tag/property suggestions so Obsidian autocompletes them
        void this.seedTagSuggestions();
    }

    /**
     * Seeds Obsidian's tag suggestion cache with Seam-managed tags.
     *
     * Obsidian auto-suggests tags based on what exists in the vault's metadata cache.
     * When Seam removes all occurrences of an action tag (e.g., #permanent, #archive),
     * Obsidian stops suggesting it. We maintain a hidden registry note that preserves
     * these tags in the metadata cache so they continue to be suggested.
     */
    private async seedTagSuggestions(): Promise<void> {
        const pluginDir = this.manifest.dir || `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
        const registryPath = `${pluginDir}/.tag-registry.md`;

        // Collect all tags that should be preserved
        const tagsToPreserve = [
            ...SEAM_MANAGED_TAGS,
            this.settings.archiveTag,
            this.settings.permanentTag,
            this.settings.archivedTag,
        ];

        // Deduplicate
        const uniqueTags = [...new Set(tagsToPreserve.map((t) => t.replace(/^#/, '').toLowerCase()))];

        // Build frontmatter content
        const frontmatterTags = uniqueTags.map((t) => `  - ${t}`).join('\n');

        // Build properties to preserve
        const propertiesToPreserve = [...SEAM_MANAGED_PROPERTIES];
        if (this.settings.enableMoveCleanup && this.settings.moveCleanupProperties) {
            const cleanupProps = this.settings.moveCleanupProperties
                .split(',')
                .map((p) => p.trim())
                .filter((p) => p.length > 0);
            propertiesToPreserve.push(...cleanupProps);
        }
        const uniqueProps = [...new Set(propertiesToPreserve)];

        const propsYaml = uniqueProps.map((p) => `${p}: ""`).join('\n');

        const content = [
            '---',
            `tags:`,
            frontmatterTags,
            propsYaml,
            '---',
            '',
            '> This file is managed by the Seam plugin. It preserves tag and property suggestions in the vault.',
            '> Do not edit or delete this file manually.',
            '',
        ].join('\n');

        try {
            const existingFile = this.app.vault.getAbstractFileByPath(registryPath);
            if (existingFile && existingFile instanceof TFile) {
                await this.app.vault.modify(existingFile, content);
            } else {
                await this.app.vault.create(registryPath, content);
            }
        } catch {
            // Non-critical: if we can't create the registry, tag suggestions degrade gracefully
        }
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
                    void this.reconciler.scan();
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
            const message =
                errorCount > 0
                    ? t().noticeArchivedCountWithErrors(archivedCount, errorCount)
                    : t().noticeArchivedCount(archivedCount);
            new Notice(message);
        } else {
            new Notice(t().noticeNoNotesWithArchive);
        }
    }

    /**
     * Archives the current active note by processing it through automation.
     */
    private async archiveCurrentNote(file: TFile): Promise<void> {
        const result = await this.automationService.archiveFile(file);
        if (result.status === 'success') {
            new Notice(t().noticeArchived(file.basename));
        } else {
            new Notice(t().noticeArchiveFailed(result.message));
        }
    }

    /**
     * Moves the current active note to the Permanent folder.
     */
    private async moveCurrentNoteToPermanent(file: TFile): Promise<void> {
        const result = await this.automationService.moveFileToPermanent(file);
        if (result.status === 'success') {
            new Notice(t().noticeMovedToPermanent(this.settings.permanentFolder, file.basename));
        } else {
            new Notice(t().noticeMoveFailed(result.message));
        }
    }

    private async processPending(): Promise<void> {
        await this.automationQueue.flush();
        this.reconciler.scan();
        new Notice(t().noticeProcessedPending);
    }

    private showStatus(): void {
        const status = this.automationService.getStatus();
        const message = [
            t().statusTitle,
            '',
            t().statusPending(status.pending),
            t().statusProcessed(status.processed),
            t().statusFailed(status.failed),
        ].join('\n');
        new Notice(message, 5000);
    }

    /**
     * Returns the list of commands available in the Universal Palette.
     */
    private getPaletteCommands(): PaletteItem[] {
        const commands: PaletteItem[] = [
            {
                id: 'cmd-archive-all',
                title: t().paletteArchiveAllTitle,
                description: t().paletteArchiveAllDesc,
                type: 'command',
                action: () => this.archiveAll(),
            },
            {
                id: 'cmd-process-pending',
                title: t().cmdProcessPending,
                description: t().cmdProcessPending,
                type: 'command',
                action: () => this.processPending(),
            },
            {
                id: 'cmd-show-status',
                title: t().cmdShowStatus,
                description: t().cmdShowStatus,
                type: 'command',
                action: () => this.showStatus(),
            },
        ];

        // Contextual commands: only when a note is active
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === 'md') {
            commands.push(
                {
                    id: 'cmd-archive-current',
                    title: t().paletteArchiveCurrentTitle(activeFile.basename),
                    description: t().paletteArchiveCurrentDesc(
                        this.settings.archiveFolder,
                        activeFile.basename,
                    ),
                    type: 'action',
                    action: () => this.archiveCurrentNote(activeFile),
                },
                {
                    id: 'cmd-move-permanent',
                    title: t().palettePermanentCurrentTitle(activeFile.basename),
                    description: t().palettePermanentCurrentDesc(
                        this.settings.permanentFolder,
                        activeFile.basename,
                    ),
                    type: 'action',
                    action: () => this.moveCurrentNoteToPermanent(activeFile),
                },
            );
        }

        return commands;
    }

    // ---- Settings ----

    async loadSettings(): Promise<void> {
        const raw: unknown = await this.loadData();
        if (typeof raw === 'object' && raw !== null) {
            const data = raw as Record<string, unknown>;
            this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

            // Migration: rename old archive cleanup settings to move cleanup
            if ('enableArchiveCleanup' in data && !('enableMoveCleanup' in data)) {
                this.settings.enableMoveCleanup = Boolean(data.enableArchiveCleanup);
            }
            if ('archiveCleanupTags' in data && !('moveCleanupTags' in data)) {
                this.settings.moveCleanupTags = String(data.archiveCleanupTags);
            }
            if ('archiveCleanupProperties' in data && !('moveCleanupProperties' in data)) {
                this.settings.moveCleanupProperties = String(data.archiveCleanupProperties);
            }
        } else {
            this.settings = Object.assign({}, DEFAULT_SETTINGS);
        }
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
        this.automationQueue?.setDelayMode(this.settings.automationDelay);
        this.reconciler?.updateSettings(this.settings);
        this.searchService?.updateSettings(this.settings);
        this.startPeriodicReconciliation();

        // Re-seed tag suggestions when settings change
        void this.seedTagSuggestions();
    }
}
