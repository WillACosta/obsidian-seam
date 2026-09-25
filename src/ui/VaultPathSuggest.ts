import { AbstractInputSuggest, App, setIcon, TAbstractFile, TFile, TFolder } from 'obsidian';

/** Public-API vault path suggester for settings that must support Obsidian < 1.13. */
export class VaultPathSuggest extends AbstractInputSuggest<TAbstractFile> {
    constructor(
        app: App,
        inputEl: HTMLInputElement,
        private kind: 'file' | 'folder',
        private onPathSelect?: (path: string) => void,
        private fileFilter?: (file: TFile) => boolean,
    ) {
        super(app, inputEl);
    }

    getSuggestions(query: string): TAbstractFile[] {
        const normalizedQuery = query.toLowerCase();
        return this.app.vault.getAllLoadedFiles()
            .filter((item) => this.kind === 'file' ? item instanceof TFile : item instanceof TFolder)
            .filter((item) => !(item instanceof TFile) || !this.fileFilter || this.fileFilter(item))
            .filter((item) => item.path.toLowerCase().includes(normalizedQuery))
            .slice(0, this.limit);
    }

    renderSuggestion(item: TAbstractFile, el: HTMLElement): void {
        el.addClass('seam-path-suggest-item');
        const icon = el.createSpan({ cls: 'seam-path-suggest-icon' });
        setIcon(icon, item instanceof TFolder ? 'folder' : 'file-text');
        el.createSpan({ text: item.path });
    }

    selectSuggestion(item: TAbstractFile, _evt: MouseEvent | KeyboardEvent): void {
        this.setValue(item.path);
        this.onPathSelect?.(item.path);
        this.close();
    }
}
