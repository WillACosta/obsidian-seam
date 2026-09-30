import { App, getIcon, Notice, PluginSettingTab, setIcon, Setting, SettingDefinitionItem } from 'obsidian';
import type SeamPlugin from '../main';
import { AutomationDelayMode, CustomSpecialSearch, QuickAddChoice, UpdateAnnouncementMode, SpecialSearch, PaletteRibbonMode, SPECIAL_SEARCH_ICONS, SPECIAL_SEARCH_LABELS } from '../types';
import { t } from '../i18n';
import { QuickAddChoiceModal } from './QuickAddChoiceModal';
import { CustomSpecialSearchModal } from './CustomSpecialSearchModal';
import { VaultPathSuggest } from '../ui/VaultPathSuggest';
import {
    getCommandHotkeyDisplay,
    openHotkeyAssignment,
} from '../utils/hotkey';

export class SeamSettingsTab extends PluginSettingTab {
    plugin: SeamPlugin;
    private moveCleanupTagsSetting: Setting | null = null;
    private moveCleanupPropertiesSetting: Setting | null = null;
    private latestNotesSetting: Setting | null = null;

    constructor(app: App, plugin: SeamPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.icon = 'feather';
    }

    /**
     * Uses Obsidian's declarative settings entry point so the tab participates in
     * settings search while retaining Seam's custom Quick Add editor.
     */
    getSettingDefinitions(): SettingDefinitionItem[] {
        const strings = t();
        return [{
            type: 'group',
            heading: strings.settingsFolderHeading,
            items: [
                this.folderDefinition(strings.settingsPermanentFolder, strings.settingsPermanentFolderDesc, 'Permanent', 'permanentFolder', 'folder'),
                this.folderDefinition(strings.settingsArchiveFolder, strings.settingsArchiveFolderDesc, 'Archive', 'archiveFolder', 'folder'),
                this.folderDefinition(strings.settingsFleetingFolder, strings.settingsFleetingFolderDesc, 'Fleeting', 'fleetingFolder', 'folder'),
                this.folderDefinition(strings.settingsFleetingTemplate, strings.settingsFleetingTemplateDesc, 'Templates/Fleeting', 'fleetingNoteTemplate', 'file'),
            ],
        }, {
            type: 'group',
            heading: strings.settingsQuickAddHeading,
            items: [
                { name: strings.settingsQuickAddChoices, desc: strings.settingsQuickAddChoicesDesc, render: (setting) => this.renderQuickAddSetting(setting) },
            ],
        }, {
            type: 'group',
            items: [{ name: strings.settingsQuickAddPersistDrafts, desc: strings.settingsQuickAddPersistDraftsDesc, render: (setting) => this.renderPersistDraftsSetting(setting) }],
        }, {
            type: 'group',
            heading: strings.settingsCustomSearchHeading,
            items: [
                { name: strings.settingsCustomSearches, desc: strings.settingsCustomSearchesDesc, render: (setting) => this.renderCustomSearchesSetting(setting) },
                { name: strings.settingsCustomSearchDescriptions, desc: strings.settingsCustomSearchDescriptionsDesc, render: (setting) => this.renderSpecialSearchDescriptionsSetting(setting) },
                { name: strings.settingsTodoCompletion, desc: strings.settingsTodoCompletionDesc, render: (setting) => this.renderTodoCompletionSetting(setting) },
            ],
        }, {
            type: 'group',
            heading: strings.settingsAutomationHeading,
            items: [
                { name: strings.settingsAutoProcessing, desc: strings.settingsAutoProcessingDesc, render: (setting) => this.renderAutomationSetting(setting) },
                { name: strings.settingsAutomationDelay, desc: strings.settingsAutomationDelayDesc, render: (setting) => this.renderAutomationDelaySetting(setting) },
            ],
        }, {
            type: 'group',
            heading: strings.settingsArchiveBehaviorHeading,
            items: [{ name: strings.settingsAddArchivedState, desc: strings.settingsAddArchivedStateDesc, render: (setting) => this.renderArchivedStateSetting(setting) }],
        }, {
            type: 'group',
            heading: strings.settingsMovingHeading,
            items: [
                { name: strings.settingsEnableMoveCleanup, desc: strings.settingsEnableMoveCleanupDesc, render: (setting) => this.renderMoveCleanupToggle(setting) },
                { name: strings.settingsMoveCleanupTags, desc: strings.settingsMoveCleanupTagsDesc, render: (setting) => this.renderMoveCleanupText(setting, 'tags') },
                { name: strings.settingsMoveCleanupProps, desc: strings.settingsMoveCleanupPropsDesc, render: (setting) => this.renderMoveCleanupText(setting, 'properties') },
            ],
        }, {
            type: 'group',
            heading: strings.settingsInterfaceHeading,
            items: [
                { name: strings.settingsShowIcons, desc: strings.settingsShowIconsDesc, render: (setting) => this.renderShowIconsSetting(setting) },
                { name: strings.settingsShowCommandsByDefault, desc: strings.settingsShowCommandsByDefaultDesc, render: (setting) => this.renderShowCommandsByDefaultSetting(setting) },
                { name: strings.settingsPaletteRibbon, desc: strings.settingsPaletteRibbonDesc, render: (setting) => this.renderPaletteRibbonSetting(setting) },
                { name: strings.settingsPaletteHotkey, desc: strings.settingsPaletteHotkeyDesc, render: (setting) => this.renderHotkeySetting(setting, `${this.plugin.manifest.id}:open-palette`) },
            ],
        }, {
            type: 'group',
            heading: strings.settingsAdvancedHeading,
            items: [{ name: strings.settingsReconInterval, desc: strings.settingsReconIntervalDesc, render: (setting) => this.renderReconciliationSetting(setting) }],
        }, {
            type: 'group',
            heading: strings.settingsUpdatesHeading,
            items: [
                { name: strings.settingsAnnounceUpdates, desc: strings.settingsAnnounceUpdatesDesc, render: (setting) => this.renderAnnounceUpdatesSetting(setting) },
                { name: strings.settingsCurrentReleaseNotes, desc: strings.settingsCurrentReleaseNotesDesc, render: (setting) => this.renderCurrentReleaseNotesSetting(setting) },
            ],
        }];
    }

    private folderDefinition(
        name: string,
        desc: string,
        placeholder: string,
        key: 'permanentFolder' | 'archiveFolder' | 'fleetingFolder' | 'fleetingNoteTemplate',
        pathType: 'folder' | 'file',
    ) {
        return {
            name,
            desc,
            render: (setting: Setting): void => {
                setting.addText((text) =>
                    text
                        .setPlaceholder(placeholder)
                        .then((component) => new VaultPathSuggest(this.app, component.inputEl, pathType, (path) => {
                            this.plugin.settings[key] = path;
                            void this.plugin.saveSettings();
                        }))
                        .setValue(this.plugin.settings[key])
                        .onChange(async (value) => {
                            this.plugin.settings[key] = value;
                            await this.plugin.saveSettings();
                        }),
                );
            },
        };
    }

    private renderQuickAddSetting(setting: Setting): void {
        setting.infoEl.remove();
        setting.settingEl.addClass('seam-quick-add-choices-setting');
        setting.controlEl.addClass('seam-quick-add-choices-control');
        const panel = setting.controlEl.createDiv({ cls: 'seam-quick-add-panel' });
        this.renderQuickAddChoices(panel);
    }

    private renderPersistDraftsSetting(setting: Setting): void {
        setting.addToggle((toggle) => toggle
            .setValue(this.plugin.settings.persistQuickAddDrafts)
            .onChange(async (value) => {
                this.plugin.settings.persistQuickAddDrafts = value;
                await this.plugin.saveSettings();
            }));
    }

    private renderCustomSearchesSetting(setting: Setting): void {
        setting.infoEl.remove();
        setting.settingEl.addClass('seam-custom-searches-setting');
        setting.controlEl.addClass('seam-custom-searches-control');
        const panel = setting.controlEl.createDiv({ cls: 'seam-custom-searches-panel' });
        const header = panel.createDiv({ cls: 'seam-custom-search-panel-header' });
        header.createDiv({ cls: 'seam-custom-search-panel-title', text: t().settingsCustomSearchListTitle });
        header.createDiv({ cls: 'setting-item-description', text: t().settingsCustomSearchListDesc });
        const filterContainer = panel.createDiv({ cls: 'search-input-container seam-quick-add-filter' });
        const filterInput = filterContainer.createEl('input', {
            type: 'search',
            placeholder: t().settingsCustomSearchFilter,
            attr: { autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' },
        });
        const list = panel.createDiv({ cls: 'seam-quick-add-choices seam-custom-searches-list' });
        let draggedSearchId: string | null = null;
        let dragArmedSearchId: string | null = null;
        let draggedOrderKey: string | null = null;
        const render = (): void => {
            list.empty();
            const query = filterInput.value.trim().toLowerCase();
            const searches = this.plugin.settings.customSpecialSearches
                .filter((search) => search.identifier.toLowerCase().includes(query))
                .sort((a, b) => Number(b.pinned) - Number(a.pinned));
            const builtins = this.plugin.settings.specialSearchPreferences.filter((preference) => SPECIAL_SEARCH_LABELS[preference.search].toLowerCase().includes(query));
            list.toggleClass('is-overflowing', searches.length + builtins.length > 5);
            if (searches.length === 0 && builtins.length === 0) {
                list.createDiv({ cls: 'seam-custom-searches-empty', text: query ? t().settingsCustomSearchNoMatches : t().settingsCustomSearchNone });
            } else if (searches.length > 0) {
                for (const search of searches) {
                    const row = list.createDiv({ cls: `seam-quick-add-choice seam-custom-search-choice${search.pinned ? ' seam-custom-search-pinned' : ''}${search.hidden ? ' seam-custom-search-hidden' : ''}` });
                    row.dataset.specialSearchOrderKey = `custom:${search.id}`;
                    row.draggable = query.length === 0;
                    const label = row.createDiv({ cls: 'seam-quick-add-choice-label seam-custom-search-label' });
                    if (this.plugin.settings.showIcons) {
                        const icon = label.createSpan({ cls: 'seam-quick-add-choice-icon' });
                        const iconSvg = getIcon(search.icon || 'search');
                        if (iconSvg) icon.appendChild(iconSvg);
                    }
                    label.createDiv({ cls: 'seam-custom-search-name', text: search.identifier });
                    const actions = row.createDiv({ cls: 'seam-quick-add-choice-actions seam-custom-search-actions' });
                    this.addChoiceButton(actions, 'pen', `${t().settingsCustomSearchEdit} ${search.identifier}`, () => this.openCustomSearchModal(search));
                    this.addChoiceButton(actions, 'copy', `${t().settingsCustomSearchDuplicate} ${search.identifier}`, () => {
                        const duplicate = { ...search, id: crypto.randomUUID(), identifier: `${search.identifier}Copy`, pinned: false, hidden: false };
                        this.plugin.settings.customSpecialSearches.push(duplicate);
                        void this.plugin.saveSettings().then(() => this.update());
                    });
                    this.addChoiceButton(actions, search.pinned ? 'pin-off' : 'pin', search.pinned ? `Unpin ${search.identifier}` : `Pin ${search.identifier}`, () => {
                        const pinnedCount = this.plugin.settings.customSpecialSearches.filter((item) => item.pinned && item.id !== search.id).length
                            + this.plugin.settings.specialSearchPreferences.filter((item) => item.pinned).length;
                        if (!search.pinned && pinnedCount >= 3) { new Notice(t().settingsCustomSearchPinnedLimit); return; }
                        search.pinned = !search.pinned;
                        void this.plugin.saveSettings().then(() => this.update());
                    });
                    this.addChoiceButton(actions, search.hidden ? 'eye' : 'eye-off', search.hidden ? `Show ${search.identifier}` : `Hide ${search.identifier}`, () => {
                        search.hidden = !search.hidden;
                        if (search.hidden) search.pinned = false;
                        void this.plugin.saveSettings().then(() => this.update());
                    });
                    this.addChoiceButton(actions, 'trash-2', `${t().settingsCustomSearchDelete} ${search.identifier}`, () => {
                        this.plugin.settings.customSpecialSearches = this.plugin.settings.customSpecialSearches.filter((item) => item.id !== search.id);
                        void this.plugin.saveSettings().then(() => this.update());
                    });
                    const handle = this.addChoiceButton(actions, 'grip-vertical', `${t().settingsCustomSearchReorder} ${search.identifier}`, () => undefined, 'seam-quick-add-drag-handle');
                    handle.toggleAttribute('disabled', query.length > 0);
                    handle.addEventListener('pointerdown', () => { dragArmedSearchId = search.id; });
                    handle.addEventListener('keydown', (event) => {
                        if (query || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
                        event.preventDefault();
                        event.stopPropagation();
                        this.moveSpecialSearchOrder(`custom:${search.id}`, event.key === 'ArrowUp' ? -1 : 1, list, render);
                    });
                    row.addEventListener('dragstart', (event) => {
                        if (query || dragArmedSearchId !== search.id) { event.preventDefault(); return; }
                        draggedSearchId = search.id;
                        row.addClass('is-dragging');
                        event.dataTransfer?.setData('text/plain', search.id);
                        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
                    });
                    row.addEventListener('dragover', (event) => {
                        if (!draggedSearchId || draggedSearchId === search.id || query) return;
                        event.preventDefault();
                        const rect = row.getBoundingClientRect();
                        row.toggleClass('is-drop-after', event.clientY >= rect.top + rect.height / 2);
                        row.toggleClass('is-drop-before', event.clientY < rect.top + rect.height / 2);
                    });
                    row.addEventListener('dragleave', () => row.removeClass('is-drop-before', 'is-drop-after'));
                    row.addEventListener('drop', (event) => {
                        event.preventDefault();
                        row.removeClass('is-drop-before', 'is-drop-after');
                        if (!draggedSearchId || draggedSearchId === search.id || query) return;
                        const rect = row.getBoundingClientRect();
                        this.reorderCustomSearch(draggedSearchId, search.id, event.clientY >= rect.top + rect.height / 2, render);
                    });
                    row.addEventListener('dragend', () => {
                        draggedSearchId = null;
                        dragArmedSearchId = null;
                        row.removeClass('is-dragging');
                        list.querySelectorAll('.is-drop-before, .is-drop-after').forEach((item) => item.removeClass('is-drop-before', 'is-drop-after'));
                    });
                }
            }
            for (const preference of builtins) this.renderBuiltinSpecialSearchRow(list, preference.search, query, render);
            const rows = Array.from(list.querySelectorAll<HTMLElement>('.seam-custom-search-choice'));
            for (const row of rows) {
                const key = row.dataset.specialSearchOrderKey;
                if (key && !this.plugin.settings.specialSearchOrder.includes(key)) this.plugin.settings.specialSearchOrder.push(key);
            }
            const rowOrder = new Map(rows.map((row, index) => [row, index]));
            rows.sort((a, b) => {
                const rank = (row: HTMLElement): number => row.hasClass('seam-custom-search-pinned')
                    ? 0
                    : row.hasClass('seam-custom-search-hidden') ? 2 : 1;
                const order = this.plugin.settings.specialSearchOrder;
                return rank(a) - rank(b)
                    || order.indexOf(a.dataset.specialSearchOrderKey ?? '') - order.indexOf(b.dataset.specialSearchOrderKey ?? '')
                    || (rowOrder.get(a) ?? 0) - (rowOrder.get(b) ?? 0);
            }).forEach((row) => list.appendChild(row));
        };
        list.addEventListener('pointerdown', (event) => {
            const handle = (event.target as HTMLElement).closest('.seam-quick-add-drag-handle');
            const row = handle?.closest<HTMLElement>('.seam-custom-search-choice');
            if (row) row.dataset.reorderArmed = 'true';
        }, true);
        list.addEventListener('dragstart', (event) => {
            const row = (event.target as HTMLElement).closest<HTMLElement>('.seam-custom-search-choice');
            if (!row || filterInput.value.trim() || row.dataset.reorderArmed !== 'true') {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            draggedOrderKey = row.dataset.specialSearchOrderKey ?? null;
            if (draggedOrderKey) event.dataTransfer?.setData('text/plain', draggedOrderKey);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
            row.addClass('is-dragging');
            event.stopImmediatePropagation();
        }, true);
        list.addEventListener('dragover', (event) => {
            const row = (event.target as HTMLElement).closest<HTMLElement>('.seam-custom-search-choice');
            const sourceRow = Array.from(list.querySelectorAll<HTMLElement>('.seam-custom-search-choice'))
                .find((item) => item.dataset.specialSearchOrderKey === draggedOrderKey);
            if (!row || !sourceRow || filterInput.value.trim()) return;
            const rank = (item: HTMLElement): string => item.classList.contains('seam-custom-search-pinned') ? 'pinned'
                : item.classList.contains('seam-custom-search-hidden') ? 'hidden' : 'normal';
            if (rank(row) !== rank(sourceRow)) return;
            event.preventDefault();
            row.addClass('is-drop-after');
            event.stopImmediatePropagation();
        }, true);
        list.addEventListener('drop', (event) => {
            const row = (event.target as HTMLElement).closest<HTMLElement>('.seam-custom-search-choice');
            const targetKey = row?.dataset.specialSearchOrderKey;
            if (!row || !draggedOrderKey || !targetKey || filterInput.value.trim()) return;
            const rect = row.getBoundingClientRect();
            this.reorderSpecialSearchOrder(draggedOrderKey, targetKey, event.clientY >= rect.top + rect.height / 2, list, render);
            row.removeClass('is-drop-after');
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);
        list.addEventListener('dragend', (event) => {
            const row = (event.target as HTMLElement).closest<HTMLElement>('.seam-custom-search-choice');
            if (row) row.removeClass('is-dragging', 'is-drop-after');
            draggedOrderKey = null;
            list.querySelectorAll<HTMLElement>('.seam-custom-search-choice').forEach((item) => { delete item.dataset.reorderArmed; });
            event.stopImmediatePropagation();
        }, true);
        filterInput.addEventListener('input', render);
        filterInput.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && filterInput.value) { event.stopPropagation(); filterInput.value = ''; render(); }
        });
        render();
        const footer = panel.createDiv({ cls: 'seam-quick-add-panel-footer seam-custom-search-panel-footer' });
        const buttons = new Setting(footer);
        buttons.addButton((button) => button.setButtonText(`+ ${t().settingsCustomSearchNew}`).setCta().onClick(() => this.openCustomSearchModal(null)));
    }

    private renderSpecialSearchDescriptionsSetting(setting: Setting): void {
        setting.addToggle((toggle) => toggle
            .setValue(this.plugin.settings.showSpecialSearchDescriptions)
            .onChange(async (value) => {
                this.plugin.settings.showSpecialSearchDescriptions = value;
                await this.plugin.saveSettings();
            }));
    }

    private renderTodoCompletionSetting(setting: Setting): void {
        setting.addToggle((toggle) => toggle
            .setValue(this.plugin.settings.showTodoCompletionPercent)
            .onChange(async (value) => {
                this.plugin.settings.showTodoCompletionPercent = value;
                await this.plugin.saveSettings();
            }));
    }

    private renderPaletteRibbonSetting(setting: Setting): void {
        setting.setDesc(t().settingsPaletteRibbonDesc);
        setting.descEl.createEl('div', {
            cls: 'setting-item-description seam-setting-reload-hint',
            text: t().settingsPaletteRibbonReloadHint,
        });
        setting.addDropdown((dropdown) => dropdown
            .addOption('both', t().settingsRibbonBoth)
            .addOption('mobile', t().settingsRibbonMobile)
            .addOption('hidden', t().settingsRibbonHidden)
            .setValue(this.plugin.settings.paletteRibbonMode)
            .onChange(async (value) => {
                this.plugin.settings.paletteRibbonMode = value as PaletteRibbonMode;
                await this.plugin.saveSettings();
            }));
    }

    private renderBuiltinSpecialSearchRow(list: HTMLElement, search: SpecialSearch, query: string, refresh: () => void): void {
        const preference = this.plugin.settings.specialSearchPreferences.find((item) => item.search === search);
        if (!preference) return;
        const label = SPECIAL_SEARCH_LABELS[search];
        const row = list.createDiv({ cls: `seam-quick-add-choice seam-custom-search-choice${preference.pinned ? ' seam-custom-search-pinned' : ''}${preference.hidden ? ' seam-custom-search-hidden' : ''}` });
        row.dataset.specialSearchOrderKey = `builtin:${search}`;
        row.draggable = query.length === 0;
        const content = row.createDiv({ cls: 'seam-quick-add-choice-label seam-custom-search-label' });
        if (this.plugin.settings.showIcons) {
            const icon = content.createSpan({ cls: 'seam-quick-add-choice-icon' });
            const iconSvg = getIcon(SPECIAL_SEARCH_ICONS[search]);
            if (iconSvg) icon.appendChild(iconSvg);
        }
        content.createDiv({ cls: 'seam-custom-search-name', text: label });
        const actions = row.createDiv({ cls: 'seam-quick-add-choice-actions seam-custom-search-actions' });
        this.addChoiceButton(actions, preference.pinned ? 'pin-off' : 'pin', `${preference.pinned ? 'Unpin' : 'Pin'} ${label}`, () => {
            const pinned = this.plugin.settings.specialSearchPreferences.filter((item) => item.pinned && item.search !== search).length
                + this.plugin.settings.customSpecialSearches.filter((item) => item.pinned).length;
            if (!preference.pinned && pinned >= 3) { new Notice(t().settingsCustomSearchPinnedLimit); return; }
            preference.pinned = !preference.pinned;
            void this.plugin.saveSettings().then(() => this.update());
        });
        this.addChoiceButton(actions, preference.hidden ? 'eye' : 'eye-off', `${preference.hidden ? 'Show' : 'Hide'} ${label}`, () => {
            preference.hidden = !preference.hidden;
            if (preference.hidden) preference.pinned = false;
            void this.plugin.saveSettings().then(() => this.update());
        });
        const handle = this.addChoiceButton(actions, 'grip-vertical', `Reorder ${label}`, () => undefined, 'seam-quick-add-drag-handle');
        handle.toggleAttribute('disabled', query.length > 0);
        let dragArmed = false;
        handle.addEventListener('pointerdown', () => { dragArmed = true; });
        handle.addEventListener('keydown', (event) => {
            if (query || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
            event.preventDefault();
            this.moveSpecialSearchOrder(`builtin:${search}`, event.key === 'ArrowUp' ? -1 : 1, list, refresh);
        });
        row.addEventListener('dragstart', (event) => {
            if (!dragArmed) { event.preventDefault(); return; }
            event.dataTransfer?.setData('text/plain', `special-search:${search}`);
            row.addClass('is-dragging');
        });
        row.addEventListener('dragover', (event) => { event.preventDefault(); row.addClass('is-drop-after'); });
        row.addEventListener('dragleave', () => row.removeClass('is-drop-after'));
        row.addEventListener('drop', (event) => {
            event.preventDefault();
            row.removeClass('is-drop-after');
            const source = event.dataTransfer?.getData('text/plain')?.replace('special-search:', '') as SpecialSearch | undefined;
            if (!source || source === search) return;
            const items = this.plugin.settings.specialSearchPreferences;
            const sourceIndex = items.findIndex((item) => item.search === source);
            let targetIndex = items.findIndex((item) => item.search === search);
            if (sourceIndex < 0 || targetIndex < 0) return;
            const [item] = items.splice(sourceIndex, 1);
            if (sourceIndex < targetIndex) targetIndex--;
            items.splice(targetIndex + 1, 0, item);
            void this.plugin.saveSettings().then(() => this.update());
        });
        row.addEventListener('dragend', () => { dragArmed = false; row.removeClass('is-dragging', 'is-drop-after'); });
    }

    private addCustomSearchButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): void {
        const button = parent.createEl('button', { cls: 'clickable-icon seam-custom-search-action', attr: { 'aria-label': label, title: label } });
        setIcon(button, icon);
        button.addEventListener('click', onClick);
    }

    private moveSpecialSearchOrder(sourceKey: string, delta: number, list: HTMLElement, refresh: () => void): void {
        const rows = Array.from(list.querySelectorAll<HTMLElement>('.seam-custom-search-choice'));
        const source = rows.find((row) => row.dataset.specialSearchOrderKey === sourceKey);
        if (!source) return;
        const group = (row: HTMLElement): string => row.hasClass('seam-custom-search-pinned')
            ? 'pinned'
            : row.hasClass('seam-custom-search-hidden') ? 'hidden' : 'normal';
        const peers = rows.filter((row) => group(row) === group(source));
        const sourceIndex = peers.indexOf(source);
        const target = peers[sourceIndex + delta];
        const targetKey = target?.dataset.specialSearchOrderKey;
        if (!targetKey) return;
        this.reorderSpecialSearchOrder(sourceKey, targetKey, delta > 0, list, refresh);
    }

    private reorderSpecialSearchOrder(sourceKey: string, targetKey: string, placeAfter: boolean, list: HTMLElement, refresh: () => void): void {
        if (sourceKey === targetKey) return;
        const rows = Array.from(list.querySelectorAll<HTMLElement>('.seam-custom-search-choice'));
        const source = rows.find((row) => row.dataset.specialSearchOrderKey === sourceKey);
        const target = rows.find((row) => row.dataset.specialSearchOrderKey === targetKey);
        if (!source || !target) return;
        const rank = (row: HTMLElement): string => row.hasClass('seam-custom-search-pinned')
            ? 'pinned'
            : row.hasClass('seam-custom-search-hidden') ? 'hidden' : 'normal';
        if (rank(source) !== rank(target)) return;

        const order = this.plugin.settings.specialSearchOrder;
        let sourceIndex = order.indexOf(sourceKey);
        let targetIndex = order.indexOf(targetKey);
        if (sourceIndex < 0 || targetIndex < 0) return;
        const [sourceOrderKey] = order.splice(sourceIndex, 1);
        targetIndex = order.indexOf(targetKey);
        if (targetIndex < 0) {
            order.splice(sourceIndex, 0, sourceOrderKey);
            return;
        }
        order.splice(targetIndex + (placeAfter ? 1 : 0), 0, sourceOrderKey);
        void this.plugin.saveSettings().then(refresh);
    }

    private moveCustomSearch(id: string, delta: number, refresh: () => void): void {
        const searches = this.plugin.settings.customSpecialSearches;
        const item = searches.find((search) => search.id === id);
        if (!item) return;
        const group = searches.filter((search) => search.pinned === item.pinned);
        const index = group.findIndex((search) => search.id === id);
        const next = index + delta;
        if (index < 0 || next < 0 || next >= group.length) return;
        [group[index], group[next]] = [group[next], group[index]];
        this.plugin.settings.customSpecialSearches = this.mergeCustomSearchGroups(item.pinned ? group : this.plugin.settings.customSpecialSearches.filter((search) => search.pinned), item.pinned ? this.plugin.settings.customSpecialSearches.filter((search) => !search.pinned) : group);
        void this.plugin.saveSettings().then(refresh);
    }

    private reorderCustomSearch(sourceId: string, targetId: string, placeAfter: boolean, refresh: () => void): void {
        const searches = this.plugin.settings.customSpecialSearches;
        const sourceIndex = searches.findIndex((search) => search.id === sourceId);
        let targetIndex = searches.findIndex((search) => search.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0) return;
        if (searches[sourceIndex].pinned !== searches[targetIndex].pinned) return;
        const [source] = searches.splice(sourceIndex, 1);
        if (sourceIndex < targetIndex) targetIndex--;
        searches.splice(targetIndex + (placeAfter ? 1 : 0), 0, source);
        this.plugin.settings.customSpecialSearches = this.mergeCustomSearchGroups(
            searches.filter((search) => search.pinned),
            searches.filter((search) => !search.pinned),
        );
        void this.plugin.saveSettings().then(refresh);
    }

    private mergeCustomSearchGroups(pinned: CustomSpecialSearch[], unpinned: CustomSpecialSearch[]): CustomSpecialSearch[] {
        return [...pinned, ...unpinned];
    }

    private openCustomSearchModal(search: CustomSpecialSearch | null): void {
        const originalIndex = search ? this.plugin.settings.customSpecialSearches.findIndex((item) => item.id === search.id) : -1;
        new CustomSpecialSearchModal(this.app, search, async (saved) => {
            const duplicate = this.plugin.settings.customSpecialSearches.some((item) => item.id !== saved.id && item.identifier.toLowerCase() === saved.identifier.toLowerCase());
            if (duplicate) {
                new Notice(`A custom search named ${saved.identifier} already exists.`);
                return;
            }
            const pinnedCount = this.plugin.settings.customSpecialSearches.filter((item) => item.pinned && item.id !== saved.id).length
                + this.plugin.settings.specialSearchPreferences.filter((item) => item.pinned).length;
            if (saved.pinned && pinnedCount >= 3) {
                new Notice(t().settingsCustomSearchPinnedLimit);
                return;
            }
            const searches = this.plugin.settings.customSpecialSearches.filter((item) => item.id !== saved.id);
            searches.splice(originalIndex < 0 ? searches.length : Math.min(originalIndex, searches.length), 0, saved);
            this.plugin.settings.customSpecialSearches = searches;
            await this.plugin.saveSettings();
            this.update();
        }, this.plugin.searchService, this.plugin.settings.showIcons).open();
    }

    private renderAutomationSetting(setting: Setting): void {
        setting.addToggle((toggle) => toggle
            .setValue(this.plugin.settings.automaticProcessing)
            .onChange(async (value) => {
                this.plugin.settings.automaticProcessing = value;
                await this.plugin.saveSettings();
            }));
    }

    private renderAutomationDelaySetting(setting: Setting): void {
        const strings = t();
        setting.addDropdown((dropdown) => dropdown
            .addOption('on-switch', strings.settingsAutomationDelayOnSwitch)
            .addOption('2000', strings.settingsAutomationDelay2s)
            .addOption('5000', strings.settingsAutomationDelay5s)
            .addOption('1000', strings.settingsAutomationDelay1s)
            .setValue(this.plugin.settings.automationDelay)
            .onChange(async (value) => {
                this.plugin.settings.automationDelay = value as AutomationDelayMode;
                await this.plugin.saveSettings();
            }));
    }

    private renderArchivedStateSetting(setting: Setting): void {
        setting.addToggle((toggle) => toggle
            .setValue(this.plugin.settings.addArchivedState)
            .onChange(async (value) => {
                this.plugin.settings.addArchivedState = value;
                await this.plugin.saveSettings();
            }));
    }

    private renderMoveCleanupToggle(setting: Setting): void {
        setting.addToggle((toggle) => toggle
            .setValue(this.plugin.settings.enableMoveCleanup)
            .onChange(async (value) => {
                this.plugin.settings.enableMoveCleanup = value;
                await this.plugin.saveSettings();
                this.moveCleanupTagsSetting?.settingEl.toggle(value);
                this.moveCleanupPropertiesSetting?.settingEl.toggle(value);
            }));
    }

    private renderMoveCleanupText(setting: Setting, kind: 'tags' | 'properties'): void {
        if (kind === 'tags') this.moveCleanupTagsSetting = setting;
        else this.moveCleanupPropertiesSetting = setting;
        const key = kind === 'tags' ? 'moveCleanupTags' : 'moveCleanupProperties';
        setting.addText((text) => text
            .setPlaceholder(kind === 'tags' ? '#permanent, #todo' : 'status')
            .setValue(this.plugin.settings[key])
            .onChange(async (value) => {
                this.plugin.settings[key] = value;
                await this.plugin.saveSettings();
            }));
        setting.settingEl.toggle(this.plugin.settings.enableMoveCleanup);
    }

    private renderShowIconsSetting(setting: Setting): void {
        setting.addToggle((toggle) => toggle
            .setValue(this.plugin.settings.showIcons)
            .onChange(async (value) => {
                this.plugin.settings.showIcons = value;
                await this.plugin.saveSettings();
            }));
    }

    private renderShowCommandsByDefaultSetting(setting: Setting): void {
        setting.addToggle((toggle) => toggle
            .setValue(this.plugin.settings.showCommandsByDefault)
            .onChange(async (value) => {
                this.plugin.settings.showCommandsByDefault = value;
                await this.plugin.saveSettings();
            }));
    }

    private renderReconciliationSetting(setting: Setting): void {
        setting.addSlider((slider) => slider
            .setLimits(5, 60, 5)
            .setValue(this.plugin.settings.reconciliationIntervalMinutes)
            .onChange(async (value) => {
                this.plugin.settings.reconciliationIntervalMinutes = value;
                await this.plugin.saveSettings();
            }));
    }

    private renderAnnounceUpdatesSetting(setting: Setting): void {
        const strings = t();
        setting.addDropdown((dropdown) => dropdown
            .addOption('major', strings.settingsAnnounceUpdatesMajor)
            .addOption('all', strings.settingsAnnounceUpdatesAll)
            .addOption('never', strings.settingsAnnounceUpdatesNever)
            .setValue(this.plugin.settings.updateAnnouncementMode)
            .onChange(async (value) => {
                this.plugin.settings.updateAnnouncementMode = value as UpdateAnnouncementMode;
                await this.plugin.saveSettings();
                this.latestNotesSetting?.settingEl.toggle(value !== 'never');
            }));
    }

    private renderCurrentReleaseNotesSetting(setting: Setting): void {
        this.latestNotesSetting = setting;
        setting.addButton((button) => button
            .setButtonText(t().settingsCurrentReleaseNotesButton)
            .onClick(() => { void this.plugin.openCurrentReleaseNotes(); }));
        setting.settingEl.toggle(this.plugin.settings.updateAnnouncementMode !== 'never');
    }

    private renderQuickAddChoices(parent: HTMLElement): void {
        const strings = t();
        const header = parent.createDiv({ cls: 'seam-quick-add-panel-header' });
        header.createDiv({ cls: 'seam-quick-add-panel-title', text: strings.settingsQuickAddChoices });
        header.createDiv({ cls: 'setting-item-description', text: strings.settingsQuickAddChoicesDesc });

        const filterContainer = parent.createDiv({ cls: 'search-input-container seam-quick-add-filter' });
        const filterInput = filterContainer.createEl('input', {
            type: 'search',
            placeholder: strings.settingsQuickAddFilter,
            attr: { autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' },
        });
        const list = parent.createDiv({ cls: 'seam-quick-add-choices' });
        let draggedChoiceId: string | null = null;
        let dragArmedChoiceId: string | null = null;

        const renderRows = (): void => {
            list.empty();
            const query = filterInput.value.trim().toLowerCase();
            const choices = this.plugin.settings.quickAddChoices.filter((choice) =>
                choice.name.toLowerCase().includes(query),
            );
            list.toggleClass('is-overflowing', choices.length > 5);

            if (choices.length === 0) {
                list.createDiv({
                    cls: 'seam-quick-add-empty',
                    text: query ? strings.settingsQuickAddNoMatches : strings.settingsQuickAddNoChoices,
                });
                return;
            }

            for (const choice of choices) {
            const row = list.createDiv({ cls: 'seam-quick-add-choice' });
            row.dataset.choiceId = choice.id;
            row.draggable = query.length === 0;
            const label = row.createSpan({ cls: 'seam-quick-add-choice-label' });
            const icon = label.createSpan({ cls: 'seam-quick-add-choice-icon' });
            const iconId = choice.icon.trim() || 'file-text';
            const iconSvg = getIcon(iconId);
            if (iconSvg) icon.appendChild(iconSvg);
            label.createSpan({ text: choice.name });
            const buttons = row.createSpan({ cls: 'seam-quick-add-choice-actions' });
            this.addChoiceButton(buttons, 'pen', `${strings.settingsQuickAddEdit} ${choice.name}`, () => this.openChoiceModal(choice));
            this.addChoiceButton(buttons, 'copy', `${strings.settingsQuickAddDuplicate} ${choice.name}`, () => {
                const duplicate: QuickAddChoice = { ...choice, id: crypto.randomUUID(), name: `${choice.name} copy` };
                this.plugin.settings.quickAddChoices.push(duplicate);
                void this.plugin.saveSettings().then(() => this.update());
            });
            this.addChoiceButton(buttons, 'trash-2', `${strings.settingsQuickAddDelete} ${choice.name}`, () => {
                this.plugin.settings.quickAddChoices = this.plugin.settings.quickAddChoices.filter((item) => item.id !== choice.id);
                void this.plugin.saveSettings().then(() => this.update());
            });
            const handle = this.addChoiceButton(
                buttons,
                'grip-vertical',
                `${strings.settingsQuickAddReorder} ${choice.name}`,
                () => undefined,
                'seam-quick-add-drag-handle',
            );
            handle.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown');
            handle.toggleAttribute('disabled', query.length > 0);
            handle.addEventListener('pointerdown', () => { dragArmedChoiceId = choice.id; });
            handle.addEventListener('keydown', (event) => {
                if (query || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
                event.preventDefault();
                event.stopPropagation();
                this.moveChoice(choice.id, event.key === 'ArrowUp' ? -1 : 1);
            });

            row.addEventListener('dragstart', (event) => {
                if (query || dragArmedChoiceId !== choice.id) {
                    event.preventDefault();
                    return;
                }
                draggedChoiceId = choice.id;
                row.addClass('is-dragging');
                event.dataTransfer?.setData('text/plain', choice.id);
                if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
            });
            row.addEventListener('dragover', (event) => {
                if (!draggedChoiceId || draggedChoiceId === choice.id || query) return;
                event.preventDefault();
                const rect = row.getBoundingClientRect();
                row.toggleClass('is-drop-after', event.clientY >= rect.top + rect.height / 2);
                row.toggleClass('is-drop-before', event.clientY < rect.top + rect.height / 2);
            });
            row.addEventListener('dragleave', () => row.removeClass('is-drop-before', 'is-drop-after'));
            row.addEventListener('drop', (event) => {
                event.preventDefault();
                row.removeClass('is-drop-before', 'is-drop-after');
                if (!draggedChoiceId || draggedChoiceId === choice.id || query) return;
                const rect = row.getBoundingClientRect();
                this.reorderChoice(draggedChoiceId, choice.id, event.clientY >= rect.top + rect.height / 2);
            });
            row.addEventListener('dragend', () => {
                draggedChoiceId = null;
                dragArmedChoiceId = null;
                row.removeClass('is-dragging');
                list.querySelectorAll('.is-drop-before, .is-drop-after').forEach((item) =>
                    item.removeClass('is-drop-before', 'is-drop-after'),
                );
            });
            }
        };

        filterInput.addEventListener('input', renderRows);
        filterInput.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && filterInput.value) {
                event.stopPropagation();
                filterInput.value = '';
                renderRows();
            }
        });
        renderRows();

        const footer = parent.createDiv({ cls: 'seam-quick-add-panel-footer' });
        new Setting(footer).addButton((button) => button
            .setButtonText(`+ ${strings.settingsQuickAddNewChoice}`)
            .setCta()
            .onClick(() => this.openChoiceModal(null)));
    }

    private openChoiceModal(choice: QuickAddChoice | null): void {
        const originalIndex = choice ? this.plugin.settings.quickAddChoices.findIndex((item) => item.id === choice.id) : -1;
        new QuickAddChoiceModal(this.app, choice, async (saved) => {
            const choices = this.plugin.settings.quickAddChoices.filter((item) => item.id !== saved.id);
            choices.splice(originalIndex < 0 ? choices.length : Math.min(originalIndex, choices.length), 0, saved);
            this.plugin.settings.quickAddChoices = choices;
            await this.plugin.saveSettings();
            this.update();
        }).open();
    }

    private addChoiceButton(parent: HTMLElement, icon: string, label: string, onClick: () => void, extraClass = ''): HTMLButtonElement {
        const button = parent.createEl('button', { cls: `clickable-icon seam-quick-add-choice-action ${extraClass}`.trim(), attr: { 'aria-label': label } });
        button.setAttribute('title', label);
        setIcon(button, icon);
        button.addEventListener('click', onClick);
        return button;
    }

    private moveChoice(id: string, offset: -1 | 1): void {
        const choices = this.plugin.settings.quickAddChoices;
        const index = choices.findIndex((choice) => choice.id === id);
        const nextIndex = index + offset;
        if (index < 0 || nextIndex < 0 || nextIndex >= choices.length) return;
        [choices[index], choices[nextIndex]] = [choices[nextIndex], choices[index]];
        void this.plugin.saveSettings().then(() => this.update());
    }

    private reorderChoice(sourceId: string, targetId: string, placeAfter: boolean): void {
        const choices = this.plugin.settings.quickAddChoices;
        const sourceIndex = choices.findIndex((choice) => choice.id === sourceId);
        let targetIndex = choices.findIndex((choice) => choice.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0) return;
        const [source] = choices.splice(sourceIndex, 1);
        if (sourceIndex < targetIndex) targetIndex--;
        choices.splice(targetIndex + (placeAfter ? 1 : 0), 0, source);
        void this.plugin.saveSettings().then(() => this.update());
    }

    /**
     * Renders the Universal Palette hotkey display and button to Obsidian's native hotkeys tab.
     * Inspired by Hilo's pattern: non-intrusive badge showing current hotkey (or '—')
     * with a keyboard button to jump directly to Obsidian's built-in Hotkeys configuration.
     */
    private renderHotkeySetting(setting: Setting, paletteCommandId: string): void {
        const strings = t();
        setting
            .setName(strings.settingsPaletteHotkey)
            .setDesc(strings.settingsPaletteHotkeyDesc);

        const hotkey = getCommandHotkeyDisplay(this.app, paletteCommandId);
        const isAssigned = hotkey !== null;
        const displayLabel = isAssigned ? hotkey : '—';
        const tooltipLabel = isAssigned
            ? strings.settingsPaletteHotkeyAssigned(hotkey)
            : strings.settingsPaletteHotkeyNone;

        const badgeEl = setting.controlEl.createSpan({
            cls: isAssigned ? 'seam-hotkey-badge' : 'seam-hotkey-badge seam-hotkey-empty',
            text: displayLabel,
        });
        badgeEl.title = tooltipLabel;

        setting.addExtraButton((btn) => {
            btn.setIcon('keyboard')
                .setTooltip(strings.settingsPaletteHotkeyConfigure)
                .onClick(() => {
                    openHotkeyAssignment(
                        this.app,
                        `${this.plugin.manifest.name}: ${strings.cmdOpenPalette}`,
                    );
                });
        });
    }
}
