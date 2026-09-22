import { App, Modal } from 'obsidian';
import { QuickAddConflictBehavior } from '../types';
import { registerModalShortcut } from '../utils/modalShortcuts';

/** Asks how Quick Add should handle a title collision. */
export class NoteConflictModal extends Modal {
    constructor(app: App, private onChoose: (behavior: QuickAddConflictBehavior) => void) {
        super(app);
    }

    onOpen(): void {
        this.modalEl.addClass('seam-note-conflict-modal');
        this.setTitle('Note already exists');
        this.contentEl.createEl('p', {
            cls: 'seam-note-conflict-description',
            text: 'A note with this title already exists. Choose how to continue.',
        });

        const actions = this.contentEl.createDiv({ cls: 'seam-note-conflict-actions' });
        this.addAction(actions, 'Create new', 'N', () => this.choose('create-new'));
        this.addAction(actions, 'Replace existing', 'R', () => this.choose('replace'));
        this.addAction(actions, 'Cancel', 'Esc', () => this.close(), true);

        registerModalShortcut(this.modalEl, 'n', () => this.choose('create-new'));
        registerModalShortcut(this.modalEl, 'r', () => this.choose('replace'));
        this.modalEl.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            this.close();
        });
    }

    private addAction(parent: HTMLElement, label: string, shortcut: string, onClick: () => void, cancel = false): void {
        const button = parent.createEl('button', {
            cls: cancel ? 'seam-note-conflict-cancel' : '',
            attr: { 'aria-label': `${label} (${shortcut})`, 'aria-keyshortcuts': shortcut },
        });
        button.createSpan({ text: label });
        button.createEl('kbd', { text: shortcut });
        button.addEventListener('click', onClick);
    }

    private choose(behavior: QuickAddConflictBehavior): void {
        this.onChoose(behavior);
        this.close();
    }
}
