import { App, getIcon, Modal, Setting, normalizePath } from 'obsidian';
import { QuickAddChoice } from '../types';
import { VaultPathSuggest } from '../ui/VaultPathSuggest';

type SaveChoice = (choice: QuickAddChoice) => Promise<void>;

/** Edits one intentionally small, vault-local Quick Add choice. */
export class QuickAddChoiceModal extends Modal {
    private choice: QuickAddChoice;

    constructor(app: App, existing: QuickAddChoice | null, private onSave: SaveChoice) {
        super(app);
        this.choice = existing ? { ...existing } : {
            id: crypto.randomUUID(), name: '', templatePath: '', location: 'default', folderPath: '',
            open: true, openBehavior: 'tab', focus: true, icon: '',
            conflictBehavior: 'ask',
        };
    }

    onOpen(): void {
        this.modalEl.addClass('seam-choice-modal');
        this.setTitle(this.choice.name ? 'Edit choice' : 'New choice');
        new Setting(this.contentEl).setName('Name').then((setting) => setting.settingEl.addClass('seam-choice-modal-text-setting')).addText((text) => text.setValue(this.choice.name)
            .onChange((value) => { this.choice.name = value; }));
        new Setting(this.contentEl).setName('Template path').setDesc('Optional vault-relative template path.').then((setting) => setting.settingEl.addClass('seam-choice-modal-text-setting'))
            .addText((text) => this.pathInput(text.inputEl, 'file', this.choice.templatePath, (value) => { this.choice.templatePath = value; }));
        let folderSetting: Setting;
        new Setting(this.contentEl).setName('Location').addDropdown((dropdown) => dropdown
            .addOption('default', 'Obsidian default (Fleeting)')
            .addOption('specific', 'Specific folder')
            .setValue(this.choice.location)
            .onChange((value) => { this.choice.location = value as QuickAddChoice['location']; folderSetting.settingEl.toggle(value === 'specific'); }));
        folderSetting = new Setting(this.contentEl).setName('Folder').then((setting) => setting.settingEl.addClass('seam-choice-modal-text-setting')).addText((text) =>
            this.pathInput(text.inputEl, 'folder', this.choice.folderPath, (value) => { this.choice.folderPath = value; }));
        folderSetting.settingEl.toggle(this.choice.location === 'specific');
        let behaviorSetting: Setting;
        let focusSetting: Setting;
        new Setting(this.contentEl).setName('Open created file').addToggle((toggle) => toggle.setValue(this.choice.open)
            .onChange((value) => { this.choice.open = value; behaviorSetting.settingEl.toggle(value); focusSetting.settingEl.toggle(value); }));
        behaviorSetting = new Setting(this.contentEl).setName('Open behavior').addDropdown((dropdown) => dropdown
            .addOption('tab', 'New tab').addOption('current', 'Current tab').addOption('split', 'Split pane (right)')
            .setValue(this.choice.openBehavior).onChange((value) => { this.choice.openBehavior = value as QuickAddChoice['openBehavior']; }));
        behaviorSetting.settingEl.toggle(this.choice.open);
        focusSetting = new Setting(this.contentEl).setName('Focus created file').addToggle((toggle) => toggle.setValue(this.choice.focus)
            .onChange((value) => { this.choice.focus = value; }));
        focusSetting.settingEl.toggle(this.choice.open);
        new Setting(this.contentEl)
            .setName('If a note title already exists')
            .setDesc('Choose whether to be prompted, replace the existing note, or create a new note.')
            .addDropdown((dropdown) => dropdown
                .addOption('ask', 'Ask every time')
                .addOption('replace', 'Replace existing note')
                .addOption('create-new', 'Create a new note')
                .setValue(this.choice.conflictBehavior || 'ask')
                .onChange((value) => { this.choice.conflictBehavior = value as QuickAddChoice['conflictBehavior']; }));
        const iconSetting = new Setting(this.contentEl).setName('Icon').setDesc('Lucide/Obsidian icon id. Leave empty to use file-text.');
        iconSetting.settingEl.addClass('seam-choice-modal-text-setting', 'seam-choice-modal-icon-setting');
        iconSetting.addText((text) => {
            text.setValue(this.choice.icon).onChange((value) => {
                this.choice.icon = value;
                this.renderIconPreview(iconSetting.controlEl, value);
            });
            this.renderIconPreview(iconSetting.controlEl, this.choice.icon, text.inputEl);
        });
        new Setting(this.contentEl).addButton((button) => button.setButtonText('Save').setCta().onClick(() => {
            if (!this.choice.name.trim()) return;
            this.choice.name = this.choice.name.trim();
            this.choice.templatePath = normalizePath(this.choice.templatePath.trim());
            this.choice.folderPath = normalizePath(this.choice.folderPath.trim());
            void this.onSave(this.choice).then(() => this.close());
        }));
    }

    private pathInput(input: HTMLInputElement, kind: 'file' | 'folder', value: string, onChange: (value: string) => void): void {
        input.value = value;
        new VaultPathSuggest(this.app, input, kind).onSelect((item) => onChange(item.path));
        input.addEventListener('input', () => onChange(input.value));
    }

    private renderIconPreview(parent: HTMLElement, iconId: string, input?: HTMLInputElement): void {
        parent.querySelector('.seam-choice-icon-preview')?.remove();
        const preview = parent.createSpan({ cls: 'seam-choice-icon-preview' });
        const icon = getIcon(iconId.trim() || 'file-text');
        if (icon) preview.appendChild(icon);
        const textInput = input ?? parent.querySelector('input');
        if (textInput) parent.insertBefore(preview, textInput);
    }
}
