import { App, FuzzySuggestModal, Notice, TFile } from 'obsidian';
import { t } from '../i18n';
import { CalendarPins } from './CalendarPins';

export class CalendarPinModal extends FuzzySuggestModal<TFile> {
    constructor(app: App, private pins: CalendarPins) { super(app); this.setPlaceholder(t().calendarChoosePin); }
    getItems(): TFile[] {
        const pinned = this.pins.resolvedPaths();
        return this.app.vault.getMarkdownFiles().filter(file => !pinned.has(file.path));
    }
    getItemText(file: TFile): string { return file.path; }
    onChooseItem(file: TFile): void {
        void this.pins.pinFile(file).catch((error: unknown) => new Notice(`${t().calendarPinFailed}: ${error instanceof Error ? error.message : String(error)}`));
    }
}
