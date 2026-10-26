import { App, Modal, TFile } from 'obsidian';
import { t } from '../i18n';

class PeriodicNoteConfirmation extends Modal {
    private accepted = false;
    constructor(app: App, private path: string, private done: (accepted: boolean) => void) { super(app); }
    onOpen(): void {
        this.modalEl.addClass('seam-periodic-confirmation');
        this.setTitle(t().confirmPeriodicTitle);
        this.contentEl.createEl('p', { text: t().confirmPeriodicDescription });
        this.contentEl.createEl('p', { cls: 'seam-periodic-confirmation-path', text: this.path });
        const actions = this.contentEl.createDiv({ cls: 'seam-periodic-confirmation-actions' });
        const cancel = actions.createEl('button', { text: t().confirmPeriodicCancel });
        cancel.addEventListener('click', () => this.close());
        const create = actions.createEl('button', { text: t().confirmPeriodicCreate, cls: 'mod-cta' });
        create.addEventListener('click', () => { this.accepted = true; this.close(); });
        create.focus();
    }
    onClose(): void { this.contentEl.empty(); this.done(this.accepted); }
}

/** Existing notes never ask. Recheck inside the caller's creation service after acceptance. */
export async function confirmPeriodicNote(app: App, path: string, ask: boolean): Promise<boolean> {
    if (!ask || app.vault.getAbstractFileByPath(path) instanceof TFile) return true;
    return new Promise(resolve => new PeriodicNoteConfirmation(app, path, resolve).open());
}
