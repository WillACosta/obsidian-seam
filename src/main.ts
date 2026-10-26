import { Notice, Platform, Plugin, TAbstractFile, TFile, TFolder, normalizePath } from 'obsidian';
import { DailyTaskTransfer } from './daily/DailyTaskTransfer';
import { CalendarPins, normalizeCalendarPins } from './calendar/CalendarPins';
import { PalettePins, normalizePalettePins } from './notes/PalettePins';
import { confirmPeriodicNote } from './ui/PeriodicNoteConfirmation';
import { GlobalStatistics } from './statistics/GlobalStatistics';
import { writingActivityExtension } from './statistics/WritingActivityExtension';
import { currentNoteCompletion } from './statistics/NoteCompletion';
import { NoteDeletion } from './notes/NoteDeletion';
import { isFileInFolder } from './utils/isFileInFolder';
import { CustomSpecialSearch, DEFAULT_SETTINGS, PaletteItem, SeamSettings } from './types';
import { AutomationQueue } from './automation/AutomationQueue';
import { AutomationService } from './automation/AutomationService';
import { SourceAttachmentModal } from './ui/SourceAttachmentModal';
import { Reconciler } from './automation/Reconciler';
import { SearchService } from './search/SearchService';
import { UniversalPalette } from './ui/UniversalPalette';
import { SeamSettingsTab } from './settings/SettingsTab';
import { t } from './i18n';
import { getSeamReleaseNotesAfter, getSeamReleaseNotesForVersion, UpdateModal } from './ui/UpdateModal';

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
    searchService!: SearchService;
    private dailyTaskTransfer!: DailyTaskTransfer;
    private noteDeletion!: NoteDeletion;
    calendarPins!: CalendarPins;
    palettePins!: PalettePins;
    globalStatistics!: GlobalStatistics;
    private reconciliationIntervalId: number | null = null;
    private paletteRibbonEl: HTMLElement | null = null;
    private activePalettes = new Set<UniversalPalette>();

    async onload(): Promise<void> {
        // 1. Load persisted settings
        await this.loadSettings();

        // 2. Instantiate lightweight services
        this.automationService = new AutomationService(this.app, this.settings);
        this.automationQueue = new AutomationQueue(
            this.app,
            async (file: TFile) => {
                if (file.extension === 'md' && !this.settings.automaticProcessing) return;
                await this.automationService.processFile(file);
            },
            this.settings.automationDelay,
        );
        this.reconciler = new Reconciler(this.app, this.settings, this.automationQueue, this.automationService);
        this.searchService = new SearchService(this.app, this.settings);
        this.dailyTaskTransfer = new DailyTaskTransfer(this.app, path => confirmPeriodicNote(this.app, path, this.settings.confirmPeriodicNoteCreation));
        this.noteDeletion = new NoteDeletion(this.app);
        this.calendarPins = this.addChild(new CalendarPins(this.app, () => this.settings, () => this.saveData(this.settings)));

        this.paletteRibbonEl = this.addRibbonIcon('sparkles', t().ribbonOpenSeam, () => this.openPalette());
        this.refreshPaletteRibbon();

        this.palettePins = this.addChild(new PalettePins(this.app, () => this.settings, () => this.saveData(this.settings)));

        this.globalStatistics = this.addChild(new GlobalStatistics(this.app,
            this.manifest.dir ?? normalizePath(`${this.app.vault.configDir}/plugins/${this.manifest.id}`)));
        this.registerEditorExtension(writingActivityExtension(this.globalStatistics));

        // 3. Register commands
        this.addCommand({
            id: 'show-global-statistics', name: t().cmdShowGlobalStatistics,
            callback: () => { void this.openGlobalStatistics(); },
        });
        this.addCommand({
            id: 'create-quick-note',
            name: t().cmdCreateQuickNote,
            callback: () => { void this.createQuickNote(); },
        });

        this.addCommand({
            id: 'create-new-note',
            name: t().cmdCreateNewNote,
            callback: () => this.openQuickAdd(),
        });

        this.addCommand({
            id: 'create-note-from-attachment',
            name: t().cmdCreateNoteFromAttachment,
            callback: () => new SourceAttachmentModal(this.app, this.automationService).open(),
        });

        this.addCommand({
            id: 'open-palette',
            name: t().cmdOpenPalette,
            callback: () => this.openPalette(),
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

        for (const pinned of [false, true]) {
            this.addCommand({
                id: pinned ? 'unpin-current-note-from-calendar' : 'pin-current-note-to-calendar',
                name: pinned ? t().cmdUnpinCalendarNote : t().cmdPinCalendarNote,
                checkCallback: (checking: boolean) => {
                    const file = this.app.workspace.getActiveFile();
                    if (!file || file.extension !== 'md' || Boolean(this.calendarPins.pinForFile(file.path)) !== pinned) return false;
                    if (!checking) void this.toggleCalendarPin(file);
                    return true;
                },
            });
        }

        // Commands that operate on the current open note
        this.addCommand({
            id: 'delete-current-note',
            name: t().cmdDeleteCurrentNote,
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (!file || file.extension !== 'md') return false;
                if (!checking) void this.deleteCurrentNote(file);
                return true;
            },
        });

        this.addCommand({
            id: 'show-note-outline',
            name: t().cmdShowNoteOutline,
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (!file || file.extension !== 'md') return false;
                if (!checking) void this.openNoteOutline(file);
                return true;
            },
        });

        for (const pinned of [false, true]) {
            this.addCommand({
                id: pinned ? 'unpin-note' : 'pin-note',
                name: pinned ? t().cmdUnpinNote : t().cmdPinNote,
                checkCallback: checking => {
                    const file = this.app.workspace.getActiveFile();
                    if (!file || file.extension !== 'md' || this.palettePins.has(file.path) !== pinned) return false;
                    if (!checking) void this.togglePalettePin(file);
                    return true;
                },
            });
        }
        this.addCommand({
            id: 'show-note-completion', name: t().cmdShowNoteCompletion,
            checkCallback: checking => {
                const file = this.app.workspace.getActiveFile();
                if (!file || file.extension !== 'md' || !currentNoteCompletion(this.app, file).total) return false;
                if (!checking) void this.openNoteStatistics(file, true);
                return true;
            },
        });

        this.addCommand({
            id: 'show-note-statistics',
            name: t().cmdShowNoteStatistics,
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (!file || file.extension !== 'md') return false;
                if (!checking) void this.openNoteStatistics(file);
                return true;
            },
        });

        this.addCommand({
            id: 'archive-current-note',
            name: t().cmdArchiveCurrentNote,
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (!file || file.extension !== 'md' || isFileInFolder(file, this.settings.archiveFolder)) return false;
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
                if (!file || file.extension !== 'md' || isFileInFolder(file, this.settings.permanentFolder)) return false;
                if (checking) return true;
                void this.moveCurrentNoteToPermanent(file);
                return true;
            },
        });

        this.addCommand({
            id: 'move-to-fleeting',
            name: t().cmdMoveToFleeting,
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (!file || file.extension !== 'md' || isFileInFolder(file, this.settings.fleetingFolder)) return false;
                if (checking) return true;
                void this.moveCurrentNoteToFleeting(file);
                return true;
            },
        });

        for (const direction of ['tomorrow', 'yesterday'] as const) {
            this.addCommand({
                id: direction === 'tomorrow' ? 'move-daily-todos' : 'pull-daily-todos',
                name: direction === 'tomorrow' ? t().cmdMoveDailyTodos : t().cmdPullDailyTodos,
                checkCallback: checking => {
                    const file = this.app.workspace.getActiveFile();
                    if (!file || !this.dailyTaskTransfer.canTransfer(file, direction, this.searchService.getDailyNoteSettings())) return false;
                    if (!checking) void this.transferDailyTasks(file, direction);
                    return true;
                },
            });
        }

        // 4. Register settings tab
        this.addSettingTab(new SeamSettingsTab(this.app, this));

        // 5. Defer heavy initialization until layout is ready
        this.app.workspace.onLayoutReady(() => {
            void this.initializeAfterLayout();
        });
    }

    onunload(): void {
        for (const palette of this.activePalettes) palette.close();
        this.activePalettes.clear();
        if (this.reconciliationIntervalId !== null) {
            window.clearInterval(this.reconciliationIntervalId);
            this.reconciliationIntervalId = null;
        }
        this.automationQueue.destroy();
        this.automationService.destroy();
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
                if (file instanceof TFile && (file.extension === 'md' || this.automationService.isSourceAttachment(file))) {
                    this.automationQueue.enqueue(file);
                }
            }),
        );

        this.registerEvent(
            this.app.vault.on('modify', (file: TAbstractFile) => {
                if (file instanceof TFile && (file.extension === 'md' || this.automationService.isSourceAttachment(file))) {
                    this.automationQueue.enqueue(file);
                }
            }),
        );

        this.registerEvent(
            this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
                if (file instanceof TFile && file.extension !== 'md') this.automationService.onSourceRename(file, oldPath);
                if (file instanceof TFile && (file.extension === 'md' || this.automationService.isSourceAttachment(file))) {
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

        // Announce plugin updates after Obsidian's layout is ready.
        void this.announceUpdateIfNeeded();
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
                if (this.settings.automaticProcessing || this.settings.sourceAutomation) {
                    void this.reconciler.scan();
                }
            }, intervalMs),
        );
    }

    // ---- Commands ----

    private openTrackedPalette(palette: UniversalPalette): void {
        this.activePalettes.add(palette);
        palette.onClosed = () => this.activePalettes.delete(palette);
        palette.open();
    }

    private async openPalette(): Promise<void> {
        await this.searchService.refreshDailyNoteSettings();
        const commands = await this.getPaletteCommands();
        const palette = new UniversalPalette(
            this.app,
            this.settings,
            this.searchService,
            commands,
            this.calendarPins,
            this.globalStatistics,
        );
        this.openTrackedPalette(palette);
    }

    private async openQuickAdd(): Promise<void> {
        const palette = new UniversalPalette(
            this.app,
            this.settings,
            this.searchService,
            await this.getPaletteCommands(),
            this.calendarPins,
            this.globalStatistics,
        );
        this.openTrackedPalette(palette);
        window.setTimeout(() => palette.showQuickAdd(), 0);
    }

    private async openNoteOutline(file: TFile): Promise<void> {
        await this.searchService.refreshDailyNoteSettings();
        const palette = new UniversalPalette(this.app, this.settings, this.searchService, await this.getPaletteCommands(), this.calendarPins, this.globalStatistics);
        this.openTrackedPalette(palette);
        palette.showNoteOutline(file);
    }

    private async openGlobalStatistics(): Promise<void> {
        const palette = new UniversalPalette(this.app, this.settings, this.searchService, await this.getPaletteCommands(), this.calendarPins, this.globalStatistics);
        this.openTrackedPalette(palette);
        palette.showGlobalStatistics();
    }

    private async openNoteStatistics(file: TFile, completion = false): Promise<void> {
        const commands = await this.getPaletteCommands();
        const palette = new UniversalPalette(this.app, this.settings, this.searchService, commands, this.calendarPins, this.globalStatistics);
        this.openTrackedPalette(palette);
        void palette.showNoteStatistics(file, completion);
    }

    private async ensureQuickNoteFolder(path: string): Promise<string> {
        const folderPath = normalizePath(path.trim().replace(/^\/+|\/+$/g, ''));
        if (!folderPath) return '';

        const existing = this.app.vault.getAbstractFileByPath(folderPath);
        if (existing instanceof TFolder) return folderPath;
        if (existing) throw new Error(`A file already exists at "${folderPath}".`);

        const parentPath = folderPath.split('/').slice(0, -1).join('/');
        if (parentPath) await this.ensureQuickNoteFolder(parentPath);
        await this.app.vault.createFolder(folderPath);
        return folderPath;
    }

    private async createQuickNote(): Promise<void> {
        try {
            const folderPath = await this.ensureQuickNoteFolder(this.settings.fleetingFolder);
            let content = '';
            const templatePath = this.settings.fleetingNoteTemplate.trim();
            if (templatePath) {
                const normalizedTemplatePath = normalizePath(templatePath.replace(/\.md$/i, '') + '.md');
                const template = this.app.vault.getAbstractFileByPath(normalizedTemplatePath);
                if (template instanceof TFile) {
                    try {
                        content = await this.app.vault.cachedRead(template);
                    } catch {
                        // Continue with an empty note if the configured template cannot be read.
                    }
                }
            }

            let file: TFile | null = null;
            for (let attempt = 0; attempt < 10 && !file; attempt++) {
                const filename = `${crypto.randomUUID()}.md`;
                const path = normalizePath(`${folderPath ? `${folderPath}/` : ''}${filename}`);
                if (this.app.vault.getAbstractFileByPath(path)) continue;
                try {
                    file = await this.app.vault.create(path, content);
                } catch (error) {
                    // A collision between the existence check and create is retried with a new name.
                    if (this.app.vault.getAbstractFileByPath(path)) continue;
                    throw error;
                }
            }

            if (!file) throw new Error('Could not generate an unused filename.');
            await this.app.workspace.getLeaf(false).openFile(file);
            new Notice(t().noticeQuickAddCreated(file.basename));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            new Notice(t().noticeQuickAddFailed(message));
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

    /** Moves the current active note to the configured Fleeting folder. */
    private async moveCurrentNoteToFleeting(file: TFile): Promise<void> {
        const result = await this.automationService.moveFileToFleeting(file);
        if (result.status === 'success') {
            new Notice(t().noticeMovedToFleeting(this.settings.fleetingFolder, file.basename));
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

    private async toggleCalendarPin(file: TFile): Promise<void> {
        if (this.app.workspace.getActiveFile() !== file) return;
        try {
            const pin = this.calendarPins.pinForFile(file.path);
            if (pin) await this.calendarPins.unpin(pin); else await this.calendarPins.pinFile(file);
        } catch (error) {
            new Notice(`${t().calendarPinFailed}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async deleteCurrentNote(file: TFile): Promise<void> {
        try {
            await this.noteDeletion.delete(file);
        } catch (error) {
            new Notice(`${t().noticeDeleteNoteFailed}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async transferDailyTasks(file: TFile, direction: 'tomorrow' | 'yesterday'): Promise<void> {
        try {
            const count = await this.dailyTaskTransfer.transfer(file, direction);
            if (count === null) return;
            new Notice(count ? t().noticeDailyTransferDone : t().noticeDailyTransferEmpty);
        } catch (error) {
            new Notice(`${t().noticeDailyTransferFailed}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async togglePalettePin(file: TFile): Promise<void> {
        try { await this.palettePins.toggle(file); }
        catch { new Notice(t().palettePinFailed); }
    }

    /** Returns the commands available for the current note. */
    private async getPaletteCommands(): Promise<PaletteItem[]> {
        const commands: PaletteItem[] = [
            { id: 'cmd-global-statistics', title: t().cmdShowGlobalStatistics, description: t().globalDescription,
                type: 'command', icon: 'chart-no-axes-combined', action: () => this.openGlobalStatistics() },
            {
                id: 'cmd-quick-note',
                title: t().cmdCreateQuickNote,
                description: t().cmdCreateQuickNote,
                type: 'command',
                icon: 'file-plus-2',
                action: () => this.createQuickNote(),
            },
            {
                id: 'cmd-quick-add',
                title: t().paletteQuickAddTitle,
                description: t().paletteQuickAddDesc,
                type: 'command',
                icon: 'file-plus',
            },
            {
                id: 'cmd-source-note',
                title: t().cmdCreateNoteFromAttachment,
                description: t().sourceCommandDesc,
                type: 'command',
                icon: 'files',
                action: () => new SourceAttachmentModal(this.app, this.automationService).open(),
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
            const pinned = Boolean(this.calendarPins.pinForFile(activeFile.path));
            const palettePinned = this.palettePins.has(activeFile.path);
            const actions: PaletteItem[] = [{
                id: 'cmd-palette-pin', title: palettePinned ? t().cmdUnpinNote : t().cmdPinNote,
                description: activeFile.basename, type: 'command', icon: palettePinned ? 'pin-off' : 'pin',
                action: () => this.togglePalettePin(activeFile),
            }, {
                id: 'cmd-calendar-pin', title: pinned ? t().cmdUnpinCalendarNote : t().cmdPinCalendarNote,
                description: activeFile.basename, type: 'command', icon: pinned ? 'pin-off' : 'pin',
                action: () => this.toggleCalendarPin(activeFile),
            }, {
                id: 'cmd-note-outline',
                title: t().cmdShowNoteOutline,
                description: activeFile.basename,
                type: 'command',
                icon: 'list-tree',
                file: activeFile,
                action: () => this.openNoteOutline(activeFile),
            }, {
                id: 'cmd-note-statistics',
                title: t().cmdShowNoteStatistics,
                description: activeFile.basename,
                type: 'command',
                icon: 'chart-no-axes-column',
                file: activeFile,
                action: () => this.openNoteStatistics(activeFile),
            }, {
                id: 'cmd-delete-current-note',
                title: t().cmdDeleteCurrentNote,
                description: activeFile.basename,
                type: 'command',
                icon: 'trash-2',
                action: () => this.deleteCurrentNote(activeFile),
            }];
            if (currentNoteCompletion(this.app, activeFile).total > 0) {
                actions.push({ id: 'cmd-note-completion', title: t().cmdShowNoteCompletion,
                    description: activeFile.basename, type: 'command', icon: 'chart-no-axes-combined', file: activeFile,
                    action: () => this.openNoteStatistics(activeFile, true) });
            }
            if (!isFileInFolder(activeFile, this.settings.archiveFolder)) {
                actions.push({
                    id: 'cmd-archive-current',
                    title: t().paletteArchiveCurrentTitle(activeFile.basename),
                    description: t().paletteArchiveCurrentDesc(
                        this.settings.archiveFolder,
                        activeFile.basename,
                    ),
                    type: 'action',
                    action: () => this.archiveCurrentNote(activeFile),
                });
            }
            if (!isFileInFolder(activeFile, this.settings.permanentFolder)) {
                actions.push({
                    id: 'cmd-move-permanent',
                    title: t().palettePermanentCurrentTitle(activeFile.basename),
                    description: t().palettePermanentCurrentDesc(
                        this.settings.permanentFolder,
                        activeFile.basename,
                    ),
                    type: 'action',
                    action: () => this.moveCurrentNoteToPermanent(activeFile),
                });
            }
            if (!isFileInFolder(activeFile, this.settings.fleetingFolder)) {
                actions.push({
                    id: 'cmd-move-fleeting',
                    title: t().paletteFleetingCurrentTitle(activeFile.basename),
                    description: t().paletteFleetingCurrentDesc(
                        this.settings.fleetingFolder,
                        activeFile.basename,
                    ),
                    type: 'action',
                    action: () => this.moveCurrentNoteToFleeting(activeFile),
                });
            }
            const availability = await this.dailyTaskTransfer.getAvailability(activeFile);
            for (const direction of ['tomorrow', 'yesterday'] as const) {
                if (!availability[direction]) continue;
                actions.push({
                    id: `cmd-daily-todos-${direction}`,
                    title: direction === 'tomorrow' ? t().cmdMoveDailyTodos : t().cmdPullDailyTodos,
                    description: '',
                    type: 'action',
                    icon: 'calendar-days',
                    action: () => this.transferDailyTasks(activeFile, direction),
                });
            }
            commands.splice(3, 0, ...actions);
        }

        return commands;
    }

    // ---- Settings ----

    async loadSettings(): Promise<void> {
        const raw: unknown = await this.loadData();
        if (typeof raw === 'object' && raw !== null) {
            const data = raw as Record<string, unknown>;
            const persistedData = { ...data };
            delete persistedData.sourceApp;
            delete persistedData.specialSearchPipelines;
            delete persistedData.enableQueryPipelines;
            this.settings = Object.assign({}, DEFAULT_SETTINGS, persistedData);

            this.settings.customSpecialSearches = Array.isArray(this.settings.customSpecialSearches)
                ? this.settings.customSpecialSearches.map((search) => {
                    const normalized = { ...search } as CustomSpecialSearch & { enableBaseResultNavigation?: unknown; showBaseToolbar?: unknown };
                    delete normalized.enableBaseResultNavigation;
                    delete normalized.showBaseToolbar;
                    return {
                        ...normalized,
                        icon: typeof search.icon === 'string' && search.icon.trim() ? search.icon : 'search',
                        description: typeof search.description === 'string' ? search.description : '',
                        mode: search.mode === 'base' || search.basePath ? 'base' as const : 'tags' as const,
                        hidden: Boolean(search.hidden),
                        pinned: Boolean(search.pinned) && !search.hidden,
                        basePath: typeof search.basePath === 'string' ? search.basePath : '',
                        baseView: typeof search.baseView === 'string' ? search.baseView : '',
                        filterQuery: typeof search.filterQuery === 'string' ? search.filterQuery : '',
                        expandModal: Boolean(search.expandModal),
                    };
                })
                : [];
            this.settings.showPaletteDescriptions = persistedData.showPaletteDescriptions === undefined
                ? persistedData.showSpecialSearchDescriptions !== false
                : Boolean(persistedData.showPaletteDescriptions);
            delete (this.settings as SeamSettings & { showSpecialSearchDescriptions?: boolean }).showSpecialSearchDescriptions;
            this.settings.showFileExtensionAndMatchCount = Boolean(this.settings.showFileExtensionAndMatchCount);
            this.settings.showCommandsByDefault = Boolean(this.settings.showCommandsByDefault);
            const defaultPreferences = DEFAULT_SETTINGS.specialSearchPreferences;
            const storedPreferences = Array.isArray(this.settings.specialSearchPreferences) ? this.settings.specialSearchPreferences : [];
            this.settings.specialSearchPreferences = defaultPreferences.map((entry) => {
                const stored = storedPreferences.find((item) => item?.search === entry.search);
                return { search: entry.search, pinned: Boolean(stored?.pinned) && !stored?.hidden, hidden: Boolean(stored?.hidden) };
            });
            const validSearchOrderKeys = [
                ...this.settings.customSpecialSearches.map((search) => `custom:${search.id}`),
                ...this.settings.specialSearchPreferences.map((preference) => `builtin:${preference.search}`),
            ];
            const storedSearchOrder = Array.isArray(data.specialSearchOrder) ? data.specialSearchOrder as string[] : [];
            this.settings.specialSearchOrder = [...new Set([
                ...storedSearchOrder.filter((key) => validSearchOrderKeys.includes(key)),
                ...validSearchOrderKeys,
            ])];
            this.settings.showTodoCompletionPercent = Boolean(this.settings.showTodoCompletionPercent);
            this.settings.paletteRibbonMode = ['both', 'mobile', 'hidden'].includes(this.settings.paletteRibbonMode)
                ? this.settings.paletteRibbonMode
                : 'both';

            // Migration: the public Workspace API cannot place a split explicitly on the left.
            this.settings.quickAddChoices = Array.isArray(this.settings.quickAddChoices) ? this.settings.quickAddChoices.map((choice) => {
                const storedBehavior = (choice as { openBehavior: string }).openBehavior;
                return {
                    ...choice,
                    openBehavior: storedBehavior === 'split-left' ? 'split' : (choice.openBehavior || 'tab'),
                    conflictBehavior: choice.conflictBehavior || 'ask',
                };
            }) : [];

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
        this.settings.palettePinnedNotes = normalizePalettePins(this.settings.palettePinnedNotes);
        this.settings.showPaletteGroups = this.settings.showPaletteGroups !== false;
        this.settings.confirmPeriodicNoteCreation = this.settings.confirmPeriodicNoteCreation !== false;
        this.settings.calendarPins = normalizeCalendarPins(this.settings.calendarPins);
        this.settings.calendarUsePeriodicNotes = this.settings.calendarUsePeriodicNotes !== false;
        for (const key of ['calendarWeeklyFolder', 'calendarWeeklyFormat', 'calendarWeeklyTemplate', 'calendarYearlyFolder', 'calendarYearlyFormat', 'calendarYearlyTemplate'] as const) {
            if (typeof this.settings[key] !== 'string') this.settings[key] = DEFAULT_SETTINGS[key];
        }
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        this.onSettingsChange();
    }

    private async announceUpdateIfNeeded(): Promise<void> {
        const currentVersion = this.manifest.version;
        const previousVersion = this.settings.lastAnnouncedVersion;

        if (!previousVersion) {
            this.settings.lastAnnouncedVersion = currentVersion;
            await this.saveSettings();
            return;
        }

        const versionChanged = previousVersion !== currentVersion;
        const shouldAnnounce = this.settings.updateAnnouncementMode === 'all'
            ? versionChanged
            : this.settings.updateAnnouncementMode === 'major'
                ? this.isMajorReleaseChange(previousVersion, currentVersion)
                : false;

        this.settings.lastAnnouncedVersion = currentVersion;
        if (shouldAnnounce) {
            try {
                const releases = await getSeamReleaseNotesAfter(previousVersion);
                if (releases.length > 0) {
                    new UpdateModal(this.app, previousVersion, releases).open();
                } else {
                    new Notice(t().noticeUpdateAvailable(currentVersion));
                }
            } catch {
                // Update notices must never interfere with normal plugin startup.
                new Notice(t().noticeUpdateAvailable(currentVersion));
            }
        }
        if (versionChanged) await this.saveSettings();
    }

    /** Opens the release notes for the currently installed Seam version. */
    async openCurrentReleaseNotes(): Promise<void> {
        try {
            const currentRelease = await getSeamReleaseNotesForVersion(this.manifest.version);
            if (!currentRelease) {
                new Notice(t().noticeNoReleaseNotesAvailable);
                return;
            }
            new UpdateModal(this.app, null, [currentRelease]).open();
        } catch {
            new Notice(t().noticeReleaseNotesFailed);
        }
    }

    private isMajorReleaseChange(previousVersion: string, currentVersion: string): boolean {
        const previousParts = previousVersion.split('.').map(Number);
        const currentParts = currentVersion.split('.').map(Number);
        if (previousParts.some((part) => !Number.isFinite(part)) || currentParts.some((part) => !Number.isFinite(part))) return false;

        const [previousMajor, previousMinor] = previousParts;
        const [currentMajor, currentMinor] = currentParts;
        return currentMajor > previousMajor || (currentMajor === previousMajor && currentMinor > previousMinor);
    }

    /**
     * Called when settings change. Propagates new settings to all services.
     */
    onSettingsChange(): void {
        if (this.calendarPins?.rolling) void this.calendarPins.refreshWeeklySettings().catch(() => {});
        this.refreshPaletteRibbon();
        this.automationService?.updateSettings(this.settings);
        this.automationQueue?.setDelayMode(this.settings.automationDelay);
        this.reconciler?.updateSettings(this.settings);
        this.searchService?.updateSettings(this.settings);
        for (const palette of this.activePalettes) palette.refreshSpecialSearchChoices();
        this.startPeriodicReconciliation();

        // Re-seed tag suggestions when settings change
        void this.seedTagSuggestions();
    }

    private refreshPaletteRibbon(): void {
        // addRibbonIcon is registered once during load; its element is updated
        // by the settings toggle so changes take effect immediately.
        const ribbon = this.paletteRibbonEl;
        if (ribbon) {
            const shouldShow = this.settings.paletteRibbonMode === 'both'
                || (this.settings.paletteRibbonMode === 'mobile' && Platform.isMobile);
            ribbon.toggleClass('seam-ribbon-hidden', !shouldShow);
        }
    }
}
