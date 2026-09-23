import { App, getIcon, PluginSettingTab, setIcon, Setting, SettingDefinitionItem } from 'obsidian';
import type SeamPlugin from '../main';
import { AutomationDelayMode, QuickAddChoice, UpdateAnnouncementMode } from '../types';
import { t } from '../i18n';
import { QuickAddChoiceModal } from './QuickAddChoiceModal';
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
