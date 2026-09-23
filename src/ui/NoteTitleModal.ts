import { App, Modal, Setting } from 'obsidian';
import { registerModalShortcut } from '../utils/modalShortcuts';

/** Small title prompt used by Quick Add; drafts live only for this app session. */
export class NoteTitleModal extends Modal {
    private value: string;

    constructor(
        app: App,
        initialValue: string,
        modalTitle: string,
        private onSubmit: (title: string) => Promise<void>,
        private onDraft: (title: string) => void,
    ) {
        super(app);
        this.value = initialValue;
        this.modalTitle = modalTitle;
    }

    private modalTitle: string;

    onOpen(): void {
        this.modalEl.addClass('seam-note-title-modal');
        this.setTitle(this.modalTitle);
        let input!: HTMLInputElement;
        new Setting(this.contentEl).setName('Title').then((setting) => setting.settingEl.addClass('seam-note-title-setting')).addText((text) => {
            input = text.inputEl;
            text.setPlaceholder('Untitled').setValue(this.value).onChange((value) => { this.value = value; this.onDraft(value); });
        });
        const submit = (): void => {
            const title = this.value.trim();
            if (!title) return;
            void this.onSubmit(title).then(() => this.close());
        };
        input.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            submit();
        });
        new Setting(this.contentEl).addButton((button) => button.setButtonText('Create').setCta().onClick(submit));
        registerModalShortcut(this.modalEl, 'c', submit);
        window.setTimeout(() => input.focus(), 0);
    }

    onClose(): void { this.onDraft(this.value); }
}
