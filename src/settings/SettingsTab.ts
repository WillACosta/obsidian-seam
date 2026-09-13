import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type SeamPlugin from '../main';
import { t } from '../i18n';
import {
    getCommandHotkeyDisplay,
    parseHotkeyString,
    formatHotkey,
    setCommandHotkey,
    resetCommandHotkey,
    isMacPlatform,
} from '../utils/hotkey';

/**
 * Settings tab for the Seam plugin.
 * Intentionally small surface as specified by the SDD.
 */
export class SeamSettingsTab extends PluginSettingTab {
    plugin: SeamPlugin;

    constructor(app: App, plugin: SeamPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        const strings = t();

        containerEl.createEl('h2', { text: strings.settingsTitle });

        // --- Folders ---
        containerEl.createEl('h3', { text: strings.settingsFolderHeading });

        new Setting(containerEl)
            .setName(strings.settingsPermanentFolder)
            .setDesc(strings.settingsPermanentFolderDesc)
            .addText((text) =>
                text
                    .setPlaceholder('Permanent')
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
                    .setPlaceholder('Archive')
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
                    .setPlaceholder('Fleeting')
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
                    .setPlaceholder('Templates/Fleeting')
                    .setValue(this.plugin.settings.fleetingNoteTemplate)
                    .onChange(async (value) => {
                        this.plugin.settings.fleetingNoteTemplate = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // --- Automation ---
        containerEl.createEl('h3', { text: strings.settingsAutomationHeading });

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

        // --- Archive behavior ---
        containerEl.createEl('h3', { text: strings.settingsArchiveBehaviorHeading });

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
        containerEl.createEl('h3', { text: strings.settingsMovingHeading });

        new Setting(containerEl)
            .setName(strings.settingsEnableMoveCleanup)
            .setDesc(strings.settingsEnableMoveCleanupDesc)
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.enableMoveCleanup)
                    .onChange(async (value) => {
                        this.plugin.settings.enableMoveCleanup = value;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh to show/hide sub-settings
                    }),
            );

        if (this.plugin.settings.enableMoveCleanup) {
            new Setting(containerEl)
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

            new Setting(containerEl)
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
        }

        // --- Interface ---
        containerEl.createEl('h3', { text: strings.settingsInterfaceHeading });

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
        const currentDisplay = getCommandHotkeyDisplay(
            this.app,
            paletteCommandId,
            this.plugin.settings.paletteHotkey || 'Mod+K',
        );

        const hotkeySetting = new Setting(containerEl)
            .setName(strings.settingsPaletteHotkey)
            .setDesc(strings.settingsPaletteHotkeyDesc);

        // Append current shortcut badge next to setting name
        hotkeySetting.nameEl.createEl('kbd', {
            cls: 'seam-hotkey-badge',
            text: currentDisplay,
        });

        // Text input with live key capture
        hotkeySetting.addText((text) => {
            text.setPlaceholder('Mod+K')
                .setValue(this.plugin.settings.paletteHotkey || 'Mod+K')
                .onChange(async (value) => {
                    const trimmed = value.trim();
                    if (!trimmed) return;
                    const parsed = parseHotkeyString(trimmed);
                    if (parsed) {
                        this.plugin.settings.paletteHotkey = trimmed;
                        await this.plugin.saveSettings();
                        await setCommandHotkey(this.app, paletteCommandId, parsed);
                        new Notice(strings.noticeHotkeyUpdated(formatHotkey(parsed)));
                        this.display();
                    }
                });

            // Listen for key combinations directly in the input box
            text.inputEl.addEventListener('keydown', async (evt: KeyboardEvent) => {
                if (evt.key === 'Tab' || evt.key === 'Escape') return;
                if (['Control', 'Shift', 'Alt', 'Meta'].includes(evt.key)) return;

                evt.preventDefault();
                evt.stopPropagation();

                const isMac = isMacPlatform();
                const modifiers: string[] = [];
                if (evt.metaKey) modifiers.push(isMac ? 'Cmd' : 'Win');
                if (evt.ctrlKey) modifiers.push('Ctrl');
                if (evt.altKey) modifiers.push('Alt');
                if (evt.shiftKey) modifiers.push('Shift');

                if (modifiers.length === 0) {
                    modifiers.push('Mod');
                }

                const keyName = evt.key.length === 1 ? evt.key.toUpperCase() : evt.key;
                const shortcutString = `${modifiers.join('+')}+${keyName}`;

                const parsed = parseHotkeyString(shortcutString);
                if (parsed) {
                    text.setValue(shortcutString);
                    this.plugin.settings.paletteHotkey = shortcutString;
                    await this.plugin.saveSettings();
                    await setCommandHotkey(this.app, paletteCommandId, parsed);
                    new Notice(strings.noticeHotkeyUpdated(formatHotkey(parsed)));
                    this.display();
                }
            });
        });

        // Reset to default button (Mod+K)
        hotkeySetting.addButton((btn) => {
            btn.setButtonText(strings.settingsPaletteHotkeyReset)
                .setTooltip('Reset to Mod+K (Cmd+K / Ctrl+K)')
                .onClick(async () => {
                    const defaultHotkey = { modifiers: ['Mod'], key: 'K' } as const;
                    this.plugin.settings.paletteHotkey = 'Mod+K';
                    await this.plugin.saveSettings();
                    await resetCommandHotkey(
                        this.app,
                        paletteCommandId,
                        defaultHotkey as any,
                    );
                    new Notice(strings.noticeHotkeyUpdated(formatHotkey(defaultHotkey as any)));
                    this.display();
                });
        });

        // Button to open Obsidian's native Hotkeys settings tab filtered to Seam
        hotkeySetting.addExtraButton((btn) => {
            btn.setIcon('external-link')
                .setTooltip(strings.settingsPaletteHotkeyOpenObsidian)
                .onClick(() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const settingApp = this.app as any;
                    if (settingApp.setting?.openTabById) {
                        settingApp.setting.open();
                        const tab = settingApp.setting.openTabById('hotkeys');
                        if (tab?.searchComponent) {
                            tab.searchComponent.setValue('Seam');
                            tab.searchComponent.inputEl.dispatchEvent(new Event('input'));
                        }
                    }
                });
        });

        // --- Advanced ---
        containerEl.createEl('h3', { text: strings.settingsAdvancedHeading });

        new Setting(containerEl)
            .setName(strings.settingsReconInterval)
            .setDesc(strings.settingsReconIntervalDesc)
            .addSlider((slider) =>
                slider
                    .setLimits(5, 60, 5)
                    .setValue(this.plugin.settings.reconciliationIntervalMinutes)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.reconciliationIntervalMinutes = value;
                        await this.plugin.saveSettings();
                    }),
            );
    }
}
