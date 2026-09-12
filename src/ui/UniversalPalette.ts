import { App, SuggestModal, setIcon, normalizePath, Notice, TFile } from 'obsidian';
import { PaletteItem, SeamSettings } from '../types';
import { SearchService } from '../search/SearchService';

/**
 * Internal interface for the SuggestModal's chooser.
 * Not part of the public Obsidian API, but stable across versions
 * and commonly used by community plugins for modifier-key features.
 */
interface SuggestChooser<T> {
    values: T[] | null;
    selectedItem: number;
}

/**
 * Renders text into a parent element with highlighted portions matching the query.
 * Used for title, tags, and snippet highlighting.
 */
function renderHighlightedText(parent: HTMLElement, text: string, query: string): void {
    if (!query) {
        parent.appendText(text);
        return;
    }

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let lastIndex = 0;
    let index = lowerText.indexOf(lowerQuery);

    if (index === -1) {
        // No match found, render as plain text
        parent.appendText(text);
        return;
    }

    while (index !== -1) {
        // Text before match
        if (index > lastIndex) {
            parent.appendText(text.slice(lastIndex, index));
        }
        // Highlighted match
        parent.createSpan({
            cls: 'seam-palette-highlight',
            text: text.slice(index, index + query.length),
        });
        lastIndex = index + query.length;
        index = lowerText.indexOf(lowerQuery, lastIndex);
    }

    // Remaining text after last match
    if (lastIndex < text.length) {
        parent.appendText(text.slice(lastIndex));
    }
}

/**
 * Universal Palette — the primary UI for Seam.
 * Combines note search, tag search, and command execution
 * in a single floating modal built on Obsidian's SuggestModal.
 */
export class UniversalPalette extends SuggestModal<PaletteItem> {
    private lastQuery = '';

    constructor(
        app: App,
        private settings: SeamSettings,
        private searchService: SearchService,
        private commands: PaletteItem[],
    ) {
        super(app);
        this.setPlaceholder('Search notes, #tags or run Seam commands...');
        this.emptyStateText = 'No results found.';

        // Register Mod+Enter (Cmd on Mac, Ctrl on Win/Linux) to open in new tab.
        // SuggestModal's default Enter handler does not preserve modifier state
        // when calling onChooseSuggestion, so we intercept at the scope level.
        this.scope.register(['Mod'], 'Enter', (evt: KeyboardEvent) => {
            evt.preventDefault();
            const item = this.getSelectedItem();
            if (item?.type === 'note' && item.file) {
                this.close();
                const leaf = this.app.workspace.getLeaf('tab');
                leaf.openFile(item.file);
            }
            return false;
        });
    }

    /**
     * Gets the currently selected suggestion from the internal chooser.
     */
    private getSelectedItem(): PaletteItem | null {
        const chooser = (this as unknown as { chooser: SuggestChooser<PaletteItem> }).chooser;
        if (!chooser?.values || chooser.selectedItem < 0) return null;
        return chooser.values[chooser.selectedItem] ?? null;
    }

    /**
     * Returns suggestions for the given query.
     * For text queries, returns a Promise to enable async in-note content search
     * while preserving arrow-key navigation (Obsidian natively supports async getSuggestions).
     */
    getSuggestions(query: string): PaletteItem[] | Promise<PaletteItem[]> {
        const trimmed = query.trim();
        this.lastQuery = trimmed;

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

        // Tag queries: synchronous
        if (trimmed.includes('#')) {
            const results = this.searchService.search(trimmed);
            return this.mapSearchResults(results, trimmed);
        }

        // Text queries: async (in-note content search)
        return this.getAsyncSuggestions(trimmed);
    }

    /**
     * Async content search for text queries.
     * Uses vault.cachedRead for in-note searching.
     */
    private async getAsyncSuggestions(query: string): Promise<PaletteItem[]> {
        const results = await this.searchService.searchWithContent(query);

        // Guard against stale results
        if (this.lastQuery !== query) {
            return [];
        }

        return this.mapSearchResults(results, query);
    }

    /**
     * Maps SearchResults to PaletteItems, appending a "Create new note" action
     * when no results are found for a text query.
     */
    private mapSearchResults(
        results: ReturnType<SearchService['search']>,
        query: string,
    ): PaletteItem[] {
        const items: PaletteItem[] = results.map((r) => {
            const parentPath =
                r.file.parent?.path && r.file.parent.path !== '/' ? r.file.parent.path : '';
            return {
                id: r.file.path,
                title: r.title,
                description: parentPath,
                type: 'note' as const,
                file: r.file,
                tags: r.tags,
                matchSnippet: r.matchSnippet,
            };
        });

        // If no results found and query is plain text, offer to create a new note
        if (items.length === 0 && query.length > 0 && !query.includes('#') && !query.startsWith('>')) {
            items.push({
                id: 'create-note',
                title: `Create new note: ${query}`,
                description: `New note in ${this.settings.fleetingFolder}/`,
                type: 'create',
                icon: 'file-plus',
                action: () => this.createNote(query),
            });
        }

        return items;
    }

    /**
     * Creates a new note in the fleeting folder and opens it.
     */
    private async createNote(title: string): Promise<void> {
        const folderPath = normalizePath(this.settings.fleetingFolder);

        // Ensure fleeting folder exists
        if (!this.app.vault.getAbstractFileByPath(folderPath)) {
            try {
                await this.app.vault.createFolder(folderPath);
            } catch {
                // Folder may already exist
            }
        }

        const filePath = normalizePath(`${folderPath}/${title}.md`);

        // Check if file already exists
        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            new Notice(`Note "${title}" already exists in ${this.settings.fleetingFolder}.`);
            if (existing instanceof TFile) {
                await this.app.workspace.openLinkText(existing.path, '', false);
            }
            return;
        }

        try {
            const file = await this.app.vault.create(filePath, '');
            await this.app.workspace.openLinkText(file.path, '', false);
            new Notice(`Created note: ${title}`);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            new Notice(`Failed to create note: ${message}`);
        }
    }

    renderSuggestion(item: PaletteItem, el: HTMLElement): void {
        // Derive the plain search query for highlighting
        const highlightQuery = this.getHighlightQuery();

        if (item.type === 'command' || item.type === 'action' || item.type === 'create') {
            el.addClass('seam-palette-command-item');
            const rowEl = el.createDiv({ cls: 'seam-palette-title-row' });

            if (this.settings.showIcons) {
                const iconEl = rowEl.createSpan({ cls: 'seam-palette-command-icon' });
                setIcon(iconEl, item.icon || 'terminal');
            }

            const titleEl = rowEl.createSpan({ cls: 'seam-palette-title' });
            titleEl.setText(item.title);

            if (item.description) {
                const descEl = el.createDiv({ cls: 'seam-palette-description' });
                descEl.setText(item.description);
            }
        } else {
            el.addClass('seam-palette-note-item');

            // Title with highlighting
            const titleEl = el.createDiv({ cls: 'seam-palette-title' });
            renderHighlightedText(titleEl, item.title, highlightQuery);

            if (item.description) {
                const folderEl = el.createDiv({ cls: 'seam-palette-folder' });
                if (this.settings.showIcons) {
                    const iconEl = folderEl.createSpan({ cls: 'seam-palette-folder-icon' });
                    setIcon(iconEl, 'folder');
                }
                const nameEl = folderEl.createSpan({ cls: 'seam-palette-folder-name' });
                nameEl.setText(item.description);
            }

            // Render content match snippet with highlighting
            if (item.matchSnippet) {
                const snippetEl = el.createDiv({ cls: 'seam-palette-snippet' });
                const { text, matchStart, matchEnd } = item.matchSnippet;

                // Text before match
                if (matchStart > 0) {
                    snippetEl.createSpan({ text: text.slice(0, matchStart) });
                }

                // Highlighted match
                snippetEl.createSpan({
                    cls: 'seam-palette-highlight',
                    text: text.slice(matchStart, matchEnd),
                });

                // Text after match
                if (matchEnd < text.length) {
                    snippetEl.createSpan({ text: text.slice(matchEnd) });
                }
            }

            // Tags with highlighting
            if (item.tags && item.tags.length > 0) {
                const tagsEl = el.createDiv({ cls: 'seam-palette-tags' });
                const tagsText = item.tags.map((t) => `#${t}`).join(' ');
                renderHighlightedText(tagsEl, tagsText, highlightQuery);
            }
        }
    }

    /**
     * Extracts the plain text query to use for highlighting in results.
     * For tag queries (#tag), extracts the tag name without the # prefix.
     * For text queries, returns the query as-is.
     */
    private getHighlightQuery(): string {
        const query = this.lastQuery;
        if (!query) return '';

        // Command mode: no highlighting
        if (query.startsWith('>')) return '';

        // Tag query: extract tag values for highlighting
        if (query.includes('#')) {
            // Extract tag tokens without # prefix for highlighting
            const tagTokens = query
                .split(/\s+/)
                .filter((t) => t.startsWith('#') && !t.startsWith('-#'))
                .map((t) => t.substring(1))
                .filter((t) => t.length > 0);
            return tagTokens[0] || '';
        }

        return query;
    }

    onChooseSuggestion(item: PaletteItem, _evt: MouseEvent | KeyboardEvent): void {
        if (item.type === 'note' && item.file) {
            // Default Enter: open in current tab
            // Mod+Enter (new tab) is handled by the scope handler registered in the constructor
            this.app.workspace.openLinkText(item.file.path, '', false);
        } else if (
            (item.type === 'command' || item.type === 'action' || item.type === 'create') &&
            item.action
        ) {
            item.action();
        }
    }
}
