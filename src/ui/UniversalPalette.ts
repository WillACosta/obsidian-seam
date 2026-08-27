import { App, SuggestModal } from 'obsidian';
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
        return results.map((r) => ({
            id: r.file.path,
            title: r.title,
            description: r.path !== r.title ? r.path.replace(`/${r.title}.md`, '').replace('.md', '') : '',
            type: 'note' as const,
            file: r.file,
            tags: r.tags,
        }));
    }

    renderSuggestion(item: PaletteItem, el: HTMLElement): void {
        const titleEl = el.createDiv({ cls: 'seam-palette-title' });
        titleEl.setText(item.title);

        if (item.description) {
            const descEl = el.createDiv({ cls: 'seam-palette-description' });
            descEl.setText(item.description);
        }

        if (item.tags && item.tags.length > 0) {
            const tagsEl = el.createDiv({ cls: 'seam-palette-tags' });
            tagsEl.setText(item.tags.map((t) => `#${t}`).join(' '));
        }

        if (item.type === 'command' || item.type === 'action') {
            el.addClass('seam-palette-command');
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
