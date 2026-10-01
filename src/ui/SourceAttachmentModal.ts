import { App, Notice, SuggestModal, TFile } from 'obsidian';
import { AutomationService } from '../automation/AutomationService';
import { t } from '../i18n';

export class SourceAttachmentModal extends SuggestModal<TFile> {
    constructor(app: App, private service: AutomationService) {
        super(app);
        this.setPlaceholder(t().sourcePickerPlaceholder);
        this.emptyStateText = t().sourcePickerEmpty;
    }

    getSuggestions(query: string): TFile[] {
        return this.service.getSourceAttachments().filter(file => file.path.toLowerCase().includes(query.toLowerCase()));
    }

    renderSuggestion(file: TFile, el: HTMLElement): void { el.setText(file.path); }

    onChooseSuggestion(file: TFile): void { void this.create(file); }

    private async create(file: TFile): Promise<void> {
        try {
            const result = await this.service.createSourceCompanion(file);
            new Notice(result.message);
            if (result.newPath) {
                const note = this.app.vault.getAbstractFileByPath(result.newPath);
                if (note instanceof TFile) await this.app.workspace.getLeaf(false).openFile(note);
            }
        } catch (error) {
            new Notice(error instanceof Error ? error.message : t().sourceCreationFailed);
        }
    }
}
