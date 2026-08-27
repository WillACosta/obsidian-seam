import { App, PluginSettingTab, Setting } from 'obsidian';
import type SeamPlugin from '../main';

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

        containerEl.createEl('h2', { text: 'Seam Settings' });

        // --- Folders ---
        new Setting(containerEl)
            .setName('Permanent folder')
            .setDesc('Vault-relative path for permanent notes.')
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
            .setName('Archive folder')
            .setDesc('Vault-relative path for archived notes.')
            .addText((text) =>
                text
                    .setPlaceholder('Archive')
                    .setValue(this.plugin.settings.archiveFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.archiveFolder = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // --- Automation ---
        containerEl.createEl('h3', { text: 'Automation' });

        new Setting(containerEl)
            .setName('Enable automatic processing')
            .setDesc('Automatically process notes when action tags are detected.')
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.automaticProcessing)
                    .onChange(async (value) => {
                        this.plugin.settings.automaticProcessing = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // --- Archive behavior ---
        containerEl.createEl('h3', { text: 'Archive Behavior' });

        new Setting(containerEl)
            .setName('Add #archived after archiving')
            .setDesc('Add a durable #archived state tag when a note is archived.')
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.addArchivedState)
                    .onChange(async (value) => {
                        this.plugin.settings.addArchivedState = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // --- Advanced ---
        containerEl.createEl('h3', { text: 'Advanced' });

        new Setting(containerEl)
            .setName('Reconciliation interval (minutes)')
            .setDesc('How often the plugin scans for missed action tags while Obsidian is running.')
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
