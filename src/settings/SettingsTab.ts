import { App, getIcon, PluginSettingTab, setIcon, Setting } from 'obsidian';
import type SeamPlugin from '../main';
import { AutomationDelayMode, QuickAddChoice } from '../types';
import { t } from '../i18n';
import { QuickAddChoiceModal } from './QuickAddChoiceModal';
import { VaultPathSuggest } from '../ui/VaultPathSuggest';
import {
    getCommandHotkeyDisplay,
    openHotkeyAssignment,
} from '../utils/hotkey';

export class SeamSettingsTab extends PluginSettingTab {
    plugin: SeamPlugin;

    constructor(app: App, plugin: SeamPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /** Imperative settings rendering keeps Seam compatible with its declared minimum version. */
    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        const strings = t();

        new Setting(containerEl).setName(strings.settingsTitle).setHeading();

        // --- Folders ---
        new Setting(containerEl).setName(strings.settingsFolderHeading).setHeading();

        new Setting(containerEl)
            .setName(strings.settingsPermanentFolder)
            .setDesc(strings.settingsPermanentFolderDesc)
            .addText((text) =>
                text
                    .setPlaceholder('Permanent').then((component) => new VaultPathSuggest(this.app, component.inputEl, 'folder', (path) => {
                        this.plugin.settings.permanentFolder = path;
                        void this.plugin.saveSettings();
                    }))
                    .setValue(this.plugin.settings.permanentFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.permanentFolder = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName(strings.settingsArchiveFolder)
            .setDesc(strings.settingsArchiveFolderDesc)
            .addText((text) =>
                text
                    .setPlaceholder('Archive').then((component) => new VaultPathSuggest(this.app, component.inputEl, 'folder', (path) => {
                        this.plugin.settings.archiveFolder = path;
                        void this.plugin.saveSettings();
                    }))
                    .setValue(this.plugin.settings.archiveFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.archiveFolder = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName(strings.settingsFleetingFolder)
            .setDesc(strings.settingsFleetingFolderDesc)
            .addText((text) =>
                text
                    .setPlaceholder('Fleeting').then((component) => new VaultPathSuggest(this.app, component.inputEl, 'folder', (path) => {
                        this.plugin.settings.fleetingFolder = path;
                        void this.plugin.saveSettings();
                    }))
                    .setValue(this.plugin.settings.fleetingFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.fleetingFolder = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName(strings.settingsFleetingTemplate)
            .setDesc(strings.settingsFleetingTemplateDesc)
            .addText((text) =>
                text
                    .setPlaceholder('Templates/Fleeting').then((component) => new VaultPathSuggest(this.app, component.inputEl, 'file', (path) => {
                        this.plugin.settings.fleetingNoteTemplate = path;
                        void this.plugin.saveSettings();
                    }))
                    .setValue(this.plugin.settings.fleetingNoteTemplate)
                    .onChange(async (value) => {
                        this.plugin.settings.fleetingNoteTemplate = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // --- Quick Add ---
        new Setting(containerEl).setName(strings.settingsQuickAddHeading).setHeading();
        const quickAddPanel = containerEl.createDiv({ cls: 'seam-quick-add-panel' });
        this.renderQuickAddChoices(quickAddPanel);
        new Setting(containerEl)
            .setName(strings.settingsQuickAddPersistDrafts)
            .setDesc(strings.settingsQuickAddPersistDraftsDesc)
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.persistQuickAddDrafts).onChange(async (value) => {
                this.plugin.settings.persistQuickAddDrafts = value;
                await this.plugin.saveSettings();
            }));

        // --- Automation ---
        new Setting(containerEl).setName(strings.settingsAutomationHeading).setHeading();

        new Setting(containerEl)
            .setName(strings.settingsAutoProcessing)
            .setDesc(strings.settingsAutoProcessingDesc)
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.automaticProcessing)
                    .onChange(async (value) => {
                        this.plugin.settings.automaticProcessing = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName(strings.settingsAutomationDelay)
            .setDesc(strings.settingsAutomationDelayDesc)
            .addDropdown((dropdown) =>
                dropdown
                    .addOption('on-switch', strings.settingsAutomationDelayOnSwitch)
                    .addOption('2000', strings.settingsAutomationDelay2s)
                    .addOption('5000', strings.settingsAutomationDelay5s)
                    .addOption('1000', strings.settingsAutomationDelay1s)
                    .setValue(this.plugin.settings.automationDelay)
                    .onChange(async (value) => {
                        this.plugin.settings.automationDelay = value as AutomationDelayMode;
                        await this.plugin.saveSettings();
                    }),
            );

        // --- Archive behavior ---
        new Setting(containerEl).setName(strings.settingsArchiveBehaviorHeading).setHeading();

        new Setting(containerEl)
            .setName(strings.settingsAddArchivedState)
            .setDesc(strings.settingsAddArchivedStateDesc)
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.addArchivedState)
                    .onChange(async (value) => {
                        this.plugin.settings.addArchivedState = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // --- Moving Notes Behavior ---
        new Setting(containerEl).setName(strings.settingsMovingHeading).setHeading();

        let tagsSetting: Setting | null = null;
        let propsSetting: Setting | null = null;

        new Setting(containerEl)
            .setName(strings.settingsEnableMoveCleanup)
            .setDesc(strings.settingsEnableMoveCleanupDesc)
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.enableMoveCleanup)
                    .onChange(async (value) => {
                        this.plugin.settings.enableMoveCleanup = value;
                        await this.plugin.saveSettings();
                        if (tagsSetting) tagsSetting.settingEl.toggle(value);
                        if (propsSetting) propsSetting.settingEl.toggle(value);
                    }),
            );

        tagsSetting = new Setting(containerEl)
            .setName(strings.settingsMoveCleanupTags)
            .setDesc(strings.settingsMoveCleanupTagsDesc)
            .addText((text) =>
                text
                    .setPlaceholder('#permanent, #todo')
                    .setValue(this.plugin.settings.moveCleanupTags)
                    .onChange(async (value) => {
                        this.plugin.settings.moveCleanupTags = value;
                        await this.plugin.saveSettings();
                    }),
            );
        tagsSetting.settingEl.toggle(this.plugin.settings.enableMoveCleanup);

        propsSetting = new Setting(containerEl)
            .setName(strings.settingsMoveCleanupProps)
            .setDesc(strings.settingsMoveCleanupPropsDesc)
            .addText((text) =>
                text
                    .setPlaceholder('status')
                    .setValue(this.plugin.settings.moveCleanupProperties)
                    .onChange(async (value) => {
                        this.plugin.settings.moveCleanupProperties = value;
                        await this.plugin.saveSettings();
                    }),
            );
        propsSetting.settingEl.toggle(this.plugin.settings.enableMoveCleanup);

        // --- Interface ---
        new Setting(containerEl).setName(strings.settingsInterfaceHeading).setHeading();

        new Setting(containerEl)
            .setName(strings.settingsShowIcons)
            .setDesc(strings.settingsShowIconsDesc)
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showIcons)
                    .onChange(async (value) => {
                        this.plugin.settings.showIcons = value;
                        await this.plugin.saveSettings();
                    }),
            );

        const paletteCommandId = `${this.plugin.manifest.id}:open-palette`;
        const hotkeySetting = new Setting(containerEl);
        this.renderHotkeySetting(hotkeySetting, paletteCommandId);

        // --- Advanced ---
        new Setting(containerEl).setName(strings.settingsAdvancedHeading).setHeading();

        new Setting(containerEl)
            .setName(strings.settingsReconInterval)
            .setDesc(strings.settingsReconIntervalDesc)
            .addSlider((slider) =>
                slider
                    .setLimits(5, 60, 5)
                    .setValue(this.plugin.settings.reconciliationIntervalMinutes)
                    .onChange(async (value) => {
                        this.plugin.settings.reconciliationIntervalMinutes = value;
                        await this.plugin.saveSettings();
                    }),
            );
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
                void this.plugin.saveSettings().then(() => this.display());
            });
            this.addChoiceButton(buttons, 'trash-2', `${strings.settingsQuickAddDelete} ${choice.name}`, () => {
                this.plugin.settings.quickAddChoices = this.plugin.settings.quickAddChoices.filter((item) => item.id !== choice.id);
                void this.plugin.saveSettings().then(() => this.display());
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
            this.display();
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
        void this.plugin.saveSettings().then(() => this.display());
    }

    private reorderChoice(sourceId: string, targetId: string, placeAfter: boolean): void {
        const choices = this.plugin.settings.quickAddChoices;
        const sourceIndex = choices.findIndex((choice) => choice.id === sourceId);
        let targetIndex = choices.findIndex((choice) => choice.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0) return;
        const [source] = choices.splice(sourceIndex, 1);
        if (sourceIndex < targetIndex) targetIndex--;
        choices.splice(targetIndex + (placeAfter ? 1 : 0), 0, source);
        void this.plugin.saveSettings().then(() => this.display());
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
