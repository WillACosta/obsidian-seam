import { App, PluginSettingTab, Setting, SettingDefinitionItem } from 'obsidian';
import type SeamPlugin from '../main';
import { AutomationDelayMode, DEFAULT_SETTINGS } from '../types';
import { t } from '../i18n';
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

    /**
     * Declarative settings definitions for Obsidian 1.13.0+ and settings search indexing.
     */
    override getSettingDefinitions(): SettingDefinitionItem[] {
        const strings = t();
        const paletteCommandId = `${this.plugin.manifest.id}:open-palette`;

        return [
            {
                type: 'group',
                heading: strings.settingsFolderHeading,
                items: [
                    {
                        name: strings.settingsPermanentFolder,
                        desc: strings.settingsPermanentFolderDesc,
                        control: {
                            type: 'text',
                            key: 'permanentFolder',
                            placeholder: 'Permanent',
                            defaultValue: DEFAULT_SETTINGS.permanentFolder,
                        },
                    },
                    {
                        name: strings.settingsArchiveFolder,
                        desc: strings.settingsArchiveFolderDesc,
                        control: {
                            type: 'text',
                            key: 'archiveFolder',
                            placeholder: 'Archive',
                            defaultValue: DEFAULT_SETTINGS.archiveFolder,
                        },
                    },
                    {
                        name: strings.settingsFleetingFolder,
                        desc: strings.settingsFleetingFolderDesc,
                        control: {
                            type: 'text',
                            key: 'fleetingFolder',
                            placeholder: 'Fleeting',
                            defaultValue: DEFAULT_SETTINGS.fleetingFolder,
                        },
                    },
                    {
                        name: strings.settingsFleetingTemplate,
                        desc: strings.settingsFleetingTemplateDesc,
                        control: {
                            type: 'text',
                            key: 'fleetingNoteTemplate',
                            placeholder: 'Templates/Fleeting',
                            defaultValue: DEFAULT_SETTINGS.fleetingNoteTemplate,
                        },
                    },
                ],
            },
            {
                type: 'group',
                heading: strings.settingsAutomationHeading,
                items: [
                    {
                        name: strings.settingsAutoProcessing,
                        desc: strings.settingsAutoProcessingDesc,
                        control: {
                            type: 'toggle',
                            key: 'automaticProcessing',
                            defaultValue: DEFAULT_SETTINGS.automaticProcessing,
                        },
                    },
                    {
                        name: strings.settingsAutomationDelay,
                        desc: strings.settingsAutomationDelayDesc,
                        control: {
                            type: 'dropdown',
                            key: 'automationDelay',
                            options: {
                                'on-switch': strings.settingsAutomationDelayOnSwitch,
                                '2000': strings.settingsAutomationDelay2s,
                                '5000': strings.settingsAutomationDelay5s,
                                '1000': strings.settingsAutomationDelay1s,
                            },
                            defaultValue: DEFAULT_SETTINGS.automationDelay,
                        },
                    },
                ],
            },
            {
                type: 'group',
                heading: strings.settingsArchiveBehaviorHeading,
                items: [
                    {
                        name: strings.settingsAddArchivedState,
                        desc: strings.settingsAddArchivedStateDesc,
                        control: {
                            type: 'toggle',
                            key: 'addArchivedState',
                            defaultValue: DEFAULT_SETTINGS.addArchivedState,
                        },
                    },
                ],
            },
            {
                type: 'group',
                heading: strings.settingsMovingHeading,
                items: [
                    {
                        name: strings.settingsEnableMoveCleanup,
                        desc: strings.settingsEnableMoveCleanupDesc,
                        control: {
                            type: 'toggle',
                            key: 'enableMoveCleanup',
                            defaultValue: DEFAULT_SETTINGS.enableMoveCleanup,
                        },
                    },
                    {
                        name: strings.settingsMoveCleanupTags,
                        desc: strings.settingsMoveCleanupTagsDesc,
                        visible: () => this.plugin.settings.enableMoveCleanup,
                        control: {
                            type: 'text',
                            key: 'moveCleanupTags',
                            placeholder: '#permanent, #todo',
                            defaultValue: DEFAULT_SETTINGS.moveCleanupTags,
                        },
                    },
                    {
                        name: strings.settingsMoveCleanupProps,
                        desc: strings.settingsMoveCleanupPropsDesc,
                        visible: () => this.plugin.settings.enableMoveCleanup,
                        control: {
                            type: 'text',
                            key: 'moveCleanupProperties',
                            placeholder: 'status',
                            defaultValue: DEFAULT_SETTINGS.moveCleanupProperties,
                        },
                    },
                ],
            },
            {
                type: 'group',
                heading: strings.settingsInterfaceHeading,
                items: [
                    {
                        name: strings.settingsShowIcons,
                        desc: strings.settingsShowIconsDesc,
                        control: {
                            type: 'toggle',
                            key: 'showIcons',
                            defaultValue: DEFAULT_SETTINGS.showIcons,
                        },
                    },
                    {
                        name: strings.settingsPaletteHotkey,
                        desc: strings.settingsPaletteHotkeyDesc,
                        render: (setting: Setting) => {
                            this.renderHotkeySetting(setting, paletteCommandId);
                        },
                    },
                ],
            },
            {
                type: 'group',
                heading: strings.settingsAdvancedHeading,
                items: [
                    {
                        name: strings.settingsReconInterval,
                        desc: strings.settingsReconIntervalDesc,
                        control: {
                            type: 'slider',
                            key: 'reconciliationIntervalMinutes',
                            min: 5,
                            max: 60,
                            step: 5,
                            defaultValue: DEFAULT_SETTINGS.reconciliationIntervalMinutes,
                        },
                    },
                ],
            },
        ];
    }

    override getControlValue(key: string): unknown {
        return (this.plugin.settings as unknown as Record<string, unknown>)[key];
    }

    override async setControlValue(key: string, value: unknown): Promise<void> {
        (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
        await this.plugin.saveSettings();
    }

    /**
     * Fallback imperative rendering for Obsidian versions older than 1.13.0.
     */
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
