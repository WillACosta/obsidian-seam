import { App, SuggestModal, setIcon } from 'obsidian';
import { PaletteItem, SeamSettings } from '../types';
import { SearchService } from '../search/SearchService';

/**
 * Universal Palette — the primary UI for Seam.
 * Combines note search, tag search, and command execution
 * in a single floating modal built on Obsidian's SuggestModal.
 */
export class UniversalPalette extends SuggestModal<PaletteItem> {
    constructor(
        app: App,
        private settings: SeamSettings,
        private searchService: SearchService,
        private commands: PaletteItem[],
    ) {
        super(app);
        this.setPlaceholder('Search notes, #tags or run Seam commands...');
        this.emptyStateText = 'No results found.';
    }

    getSuggestions(query: string): PaletteItem[] {
        const trimmed = query.trim();

        // Empty query: show available commands
        if (!trimmed) {
            return this.commands;
        }

        // Command mode: > prefix
        if (trimmed.startsWith('>')) {
            const cmdQuery = trimmed.substring(1).trim().toLowerCase();
            if (!cmdQuery) return this.commands;
            return this.commands.filter(
                (c) =>
                    c.title.toLowerCase().includes(cmdQuery) ||
                    c.description.toLowerCase().includes(cmdQuery),
            );
        }

        // Search mode: delegate to SearchService
        const results = this.searchService.search(trimmed);
        return results.map((r) => {
            const parentPath = r.file.parent?.path && r.file.parent.path !== '/'
                ? r.file.parent.path
                : '';
            return {
                id: r.file.path,
                title: r.title,
                description: parentPath,
                type: 'note' as const,
                file: r.file,
                tags: r.tags,
            };
        });
    }

    renderSuggestion(item: PaletteItem, el: HTMLElement): void {
        if (item.type === 'command' || item.type === 'action') {
            el.addClass('seam-palette-command-item');
            const rowEl = el.createDiv({ cls: 'seam-palette-title-row' });

            if (this.settings.showIcons) {
                const iconEl = rowEl.createSpan({ cls: 'seam-palette-command-icon' });
                setIcon(iconEl, 'terminal');
            }

            const titleEl = rowEl.createSpan({ cls: 'seam-palette-title' });
            titleEl.setText(item.title);

            if (item.description) {
                const descEl = el.createDiv({ cls: 'seam-palette-description' });
                descEl.setText(item.description);
            }
        } else {
            el.addClass('seam-palette-note-item');
            const titleEl = el.createDiv({ cls: 'seam-palette-title' });
            titleEl.setText(item.title);

            if (item.description) {
                const folderEl = el.createDiv({ cls: 'seam-palette-folder' });
                if (this.settings.showIcons) {
                    const iconEl = folderEl.createSpan({ cls: 'seam-palette-folder-icon' });
                    setIcon(iconEl, 'folder');
                }
                const nameEl = folderEl.createSpan({ cls: 'seam-palette-folder-name' });
                nameEl.setText(item.description);
            }

            if (item.tags && item.tags.length > 0) {
                const tagsEl = el.createDiv({ cls: 'seam-palette-tags' });
                tagsEl.setText(item.tags.map((t) => `#${t}`).join(' '));
            }
        }
    }

    onChooseSuggestion(item: PaletteItem, _evt: MouseEvent | KeyboardEvent): void {
        if (item.type === 'note' && item.file) {
            this.app.workspace.openLinkText(item.file.path, '', false);
        } else if ((item.type === 'command' || item.type === 'action') && item.action) {
            item.action();
        }
    }
}
