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
    private selectedTags: string[] = [];
    private chipsContainerEl: HTMLElement | null = null;

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
            } else if (item?.type === 'tag') {
                this.selectSuggestion(item, evt);
            }
            return false;
        });
    }

    onOpen(): void {
        super.onOpen();
        this.setupChipsContainer();
    }

    onClose(): void {
        this.selectedTags = [];
    }

    /**
     * Sets up the chips container inside the prompt input container.
     */
    private setupChipsContainer(): void {
        const parent = this.inputEl.parentElement;
        if (!parent) return;

        parent.addClass('seam-palette-input-container');

        this.chipsContainerEl = createDiv({ cls: 'seam-palette-chips-container' });
        this.chipsContainerEl.style.display = 'none';
        parent.insertBefore(this.chipsContainerEl, this.inputEl);

        // Click anywhere in container focuses the input
        parent.addEventListener('click', (e) => {
            if (e.target === parent || e.target === this.chipsContainerEl) {
                this.inputEl.focus();
            }
        });

        // Keydown listener on inputEl for Backspace removal of chips
        this.inputEl.addEventListener('keydown', (evt: KeyboardEvent) => {
            if (
                evt.key === 'Backspace' &&
                this.inputEl.selectionStart === 0 &&
                this.inputEl.selectionEnd === 0
            ) {
                if (this.selectedTags.length > 0) {
                    evt.preventDefault();
                    this.removeSelectedTag(this.selectedTags[this.selectedTags.length - 1]);
                }
            }
        });

        // Also automatically convert a completed tag when user types space (e.g. "#ai ")
        this.inputEl.addEventListener('input', () => {
            const val = this.inputEl.value;
            const match = val.match(/^#([^\s#]+)\s+$/);
            if (match) {
                const tag = match[1];
                this.inputEl.value = '';
                this.addSelectedTag(tag);
            }
        });
    }

    /**
     * Renders the active tag chips in the input bar.
     */
    private renderChips(): void {
        if (!this.chipsContainerEl) return;
        this.chipsContainerEl.empty();

        if (this.selectedTags.length === 0) {
            this.chipsContainerEl.style.display = 'none';
            this.setPlaceholder('Search notes, #tags or run Seam commands...');
            return;
        }

        this.chipsContainerEl.style.display = 'flex';
        this.setPlaceholder('Type # to add tag, or search notes...');

        for (const tag of this.selectedTags) {
            const chipEl = this.chipsContainerEl.createSpan({ cls: 'seam-palette-chip' });

            const textEl = chipEl.createSpan({ cls: 'seam-palette-chip-text' });
            textEl.setText(`#${tag}`);

            const removeEl = chipEl.createSpan({ cls: 'seam-palette-chip-remove' });
            setIcon(removeEl, 'x');
            removeEl.setAttribute('aria-label', `Remove #${tag}`);
            removeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeSelectedTag(tag);
                this.inputEl.focus();
            });
        }
    }

    /**
     * Appends a tag to the active filter conditions and refreshes suggestions.
     */
    private addSelectedTag(tag: string): void {
        const normTag = tag.replace(/^#/, '').trim().toLowerCase();
        if (!normTag) return;

        if (!this.selectedTags.includes(normTag)) {
            this.selectedTags.push(normTag);
        }

        this.inputEl.value = '';
        this.renderChips();
        this.refreshSuggestions();
    }

    /**
     * Removes a tag from the active filter conditions and refreshes suggestions.
     */
    private removeSelectedTag(tag: string): void {
        const normTag = tag.replace(/^#/, '').trim().toLowerCase();
        this.selectedTags = this.selectedTags.filter((t) => t !== normTag);
        this.renderChips();
        this.refreshSuggestions();
    }

    /**
     * Programmatically re-triggers the SuggestModal's input handler to update suggestions.
     */
    private refreshSuggestions(): void {
        this.inputEl.dispatchEvent(new Event('input'));
    }

    /**
     * Intercept suggestion selection to keep the modal open when a tag is selected.
     */
    selectSuggestion(value: PaletteItem, evt: MouseEvent | KeyboardEvent): void {
        if (value.type === 'tag') {
            const tag = value.title.replace(/^#/, '');
            this.addSelectedTag(tag);
            return;
        }
        super.selectSuggestion(value, evt);
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
     * For text queries, returns a Promise to enable async in-note content search.
     * For tag queries, shows tag suggestions when '#' is present in the input.
     * When tags are selected in chips, shows notes matching those tags.
     */
    getSuggestions(query: string): PaletteItem[] | Promise<PaletteItem[]> {
        const trimmed = query.trim();
        this.lastQuery = trimmed;

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

        // Tag search mode: user has typed '#' in the current input
        if (query.includes('#')) {
            return this.handleTagQuery(query);
        }

        // Notes search mode when tags are selected
        if (this.selectedTags.length > 0) {
            if (!trimmed) {
                // Return all notes matching selected tags synchronously
                const results = this.searchService.searchBySelectedTags(this.selectedTags);
                return this.mapSearchResults(results, '');
            }
            // Additional text filter with selected tags: async with content
            return this.getAsyncSelectedTagsSuggestions(this.selectedTags, trimmed);
        }

        // No tags selected and empty query: show available commands
        if (!trimmed) {
            return this.commands;
        }

        // Plain text queries without tags: async (in-note content search)
        return this.getAsyncSuggestions(trimmed);
    }

    /**
     * Handles tag search queries when '#' is typed into the input.
     * Swaps the results listing for available vault tags.
     */
    private handleTagQuery(query: string): PaletteItem[] {
        // Extract the search prefix from the current token after '#'
        const lastToken = query.split(/\s+/).pop() || '';
        const prefix = lastToken.replace(/^#/, '');

        // Get matching tags, excluding already-selected tags
        const matchingTags = this.searchService.getTagsMatchingPrefix(prefix, this.selectedTags);

        if (matchingTags.length > 0) {
            return matchingTags.map((tag) => ({
                id: `tag-${tag}`,
                title: tag,
                description: '',
                type: 'tag' as const,
                icon: 'hash',
            }));
        }

        // If a prefix was typed but no matching tags exist in the vault, allow adding it as custom tag
        if (prefix.length > 0) {
            return [
                {
                    id: `tag-${prefix}`,
                    title: prefix,
                    description: 'Filter by tag',
                    type: 'tag' as const,
                    icon: 'hash',
                },
            ];
        }

        return [];
    }

    /**
     * Async content search for text queries matching selected tags.
     */
    private async getAsyncSelectedTagsSuggestions(
        tags: string[],
        textQuery: string,
    ): Promise<PaletteItem[]> {
        const results = await this.searchService.searchBySelectedTagsWithContent(tags, textQuery);

        if (this.lastQuery !== textQuery) {
            return [];
        }

        return this.mapSearchResults(results, textQuery);
    }

    /**
     * Async content search for plain text queries.
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

        // If no results found and query is plain text without tags, offer to create a new note
        if (
            items.length === 0 &&
            query.length > 0 &&
            !query.includes('#') &&
            !query.startsWith('>') &&
            this.selectedTags.length === 0
        ) {
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
     * If a template is configured, uses its content as the initial note body.
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

        // Read template content if configured
        let initialContent = '';
        if (this.settings.fleetingNoteTemplate) {
            initialContent = await this.readTemplate(this.settings.fleetingNoteTemplate);
        }

        try {
            const file = await this.app.vault.create(filePath, initialContent);
            await this.app.workspace.openLinkText(file.path, '', false);
            new Notice(`Created note: ${title}`);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            new Notice(`Failed to create note: ${message}`);
        }
    }

    /**
     * Reads the content of a template file from the vault.
     * Returns empty string if the template doesn't exist or can't be read.
     */
    private async readTemplate(templatePath: string): Promise<string> {
        const normalized = normalizePath(templatePath.replace(/\.md$/, '') + '.md');
        const file = this.app.vault.getAbstractFileByPath(normalized);
        if (!file || !(file instanceof TFile)) {
            return '';
        }
        try {
            return await this.app.vault.cachedRead(file);
        } catch {
            return '';
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
        } else if (item.type === 'tag') {
            el.addClass('seam-palette-tag-item');
            const rowEl = el.createDiv({ cls: 'seam-palette-title-row' });

            const iconEl = rowEl.createSpan({ cls: 'seam-palette-command-icon' });
            setIcon(iconEl, item.icon || 'hash');

            const titleEl = rowEl.createSpan({ cls: 'seam-palette-title' });
            renderHighlightedText(titleEl, item.title, highlightQuery);
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

            // Tags with highlighting for all active selected tags and search query
            if (item.tags && item.tags.length > 0) {
                const tagsEl = el.createDiv({ cls: 'seam-palette-tags' });
                const lowerHighlight = highlightQuery.toLowerCase();
                const selectedTagSet = new Set(this.selectedTags.map((t) => t.toLowerCase()));

                item.tags.forEach((tag, idx) => {
                    if (idx > 0) tagsEl.appendText(' ');

                    const lowerTag = tag.toLowerCase();
                    const isSelected = selectedTagSet.has(lowerTag) ||
                        Array.from(selectedTagSet).some((st) => lowerTag.startsWith(st + '/'));
                    const matchesQuery = lowerHighlight.length > 0 &&
                        (lowerTag.includes(lowerHighlight) || lowerTag.startsWith(lowerHighlight));

                    if (isSelected || matchesQuery) {
                        const span = tagsEl.createSpan({ cls: 'seam-palette-highlight' });
                        span.setText(`#${tag}`);
                    } else {
                        tagsEl.appendText(`#${tag}`);
                    }
                });
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

        // Tag query: extract tag value for highlighting
        if (query.includes('#')) {
            const lastToken = query.split(/\s+/).pop() || '';
            return lastToken.replace(/^#/, '');
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
