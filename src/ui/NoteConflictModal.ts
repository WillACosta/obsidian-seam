import { App, Modal, Setting } from 'obsidian';
import { QuickAddConflictBehavior } from '../types';

/** Asks how Quick Add should handle a title collision. */
export class NoteConflictModal extends Modal {
    constructor(app: App, private onChoose: (behavior: QuickAddConflictBehavior) => void) {
        super(app);
    }

    onOpen(): void {
        this.setTitle('Note already exists');
        this.contentEl.createEl('p', { text: 'Choose what to do with the existing note.' });

        new Setting(this.contentEl).addButton((button) => button
            .setButtonText('Replace existing note')
            .onClick(() => this.choose('replace')));
        new Setting(this.contentEl).addButton((button) => button
            .setButtonText('Create a new note')
            .onClick(() => this.choose('create-new')));
        new Setting(this.contentEl).addButton((button) => button
            .setButtonText('Cancel')
            .onClick(() => this.close()));
    }

    private choose(behavior: QuickAddConflictBehavior): void {
        this.onChoose(behavior);
        this.close();
    }
}
