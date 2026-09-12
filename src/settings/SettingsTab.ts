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

        new Setting(containerEl)
            .setName('Fleeting folder')
            .setDesc('Vault-relative path for new fleeting notes created from the palette.')
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
            .setName('Fleeting note template')
            .setDesc('Path to a template note (e.g. Templates/Fleeting). Leave empty for no template.')
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

        // --- Moving Notes Behavior ---
        containerEl.createEl('h3', { text: 'Moving Notes Behavior' });

        new Setting(containerEl)
            .setName('Remove tags and properties after moving a note')
            .setDesc('Automatically clean up temporary workflow tags and properties when archiving or moving to permanent.')
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
                .setName('Tags to remove after moving')
                .setDesc('Comma-separated list of tags to strip upon moving (e.g. #permanent, #todo).')
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
                .setName('Properties to remove after moving')
                .setDesc('Comma-separated list of frontmatter property keys to strip upon moving (e.g. status).')
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
        containerEl.createEl('h3', { text: 'Universal Palette' });

        new Setting(containerEl)
            .setName('Show icons in Universal Palette')
            .setDesc('Display folder and command icons in search and command listings.')
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showIcons)
                    .onChange(async (value) => {
                        this.plugin.settings.showIcons = value;
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
