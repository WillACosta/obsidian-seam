import { App, SuggestModal, setIcon, normalizePath, Notice, TFile } from 'obsidian';
import { PaletteItem, QuickAddChoice, QuickAddConflictBehavior, SeamSettings } from '../types';
import { SearchService } from '../search/SearchService';
import { t } from '../i18n';
import { NoteTitleModal } from './NoteTitleModal';
import { NoteConflictModal } from './NoteConflictModal';

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
    private mode: 'search' | 'quick-add' | 'recent' = 'search';
    private quickAddDraft = '';

    constructor(
        app: App,
        private settings: SeamSettings,
        private searchService: SearchService,
        private commands: PaletteItem[],
    ) {
        super(app);
        this.setPlaceholder(t().palettePlaceholder);
        this.updateInstructions('');
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
                void leaf.openFile(item.file);
            } else if (item?.type === 'tag') {
                this.selectSuggestion(item, evt);
            }
            return false;
        });
        this.scope.register([], 'Escape', (evt: KeyboardEvent) => {
            if (this.mode === 'search') return true;
            evt.preventDefault();
            this.returnToSearch();
            return false;
        });
        this.scope.register([], 'Backspace', (evt: KeyboardEvent) => {
            if (this.mode === 'search' || this.inputEl.value.length > 0) return true;
            evt.preventDefault();
            this.returnToSearch();
            return false;
        });
    }

    onOpen(): void {
        void super.onOpen();
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

        this.chipsContainerEl = createDiv({ cls: 'seam-palette-chips-container is-hidden' });
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
            this.chipsContainerEl.addClass('is-hidden');
            this.setPlaceholder(t().palettePlaceholder);
            return;
        }

        this.chipsContainerEl.removeClass('is-hidden');
        this.setPlaceholder(t().paletteTagPlaceholder);

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
        if (value.id === 'cmd-quick-add') {
            this.showQuickAdd();
            return;
        }
        if (value.id === 'cmd-recent-files') {
            this.showRecentFiles();
            return;
        }
        if (value.id.startsWith('quick-add-choice-')) {
            const choice = this.settings.quickAddChoices.find((item) => item.id === value.id.slice('quick-add-choice-'.length));
            if (choice) this.promptQuickAdd(choice);
            return;
        }
        if (value.id === 'quick-add-fleeting') {
            this.promptQuickAdd(null);
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
        this.updateInstructions(trimmed);

        if (this.mode === 'quick-add') return this.getQuickAddChoices(trimmed);
        if (this.mode === 'recent') return this.getRecentFiles(trimmed);

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

        // Keep the default palette quiet; commands are deliberately opt-in via `>`.
        if (!trimmed) {
            return [];
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
                    description: t().paletteFilterByTag(prefix),
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
                title: t().paletteCreateNoteTitle(query),
                description: t().paletteCreateNoteDesc(this.settings.fleetingFolder),
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
        await this.createQuickAddNote(title, null);
    }

    private async createQuickAddNote(title: string, choice: QuickAddChoice | null, forcedConflictBehavior?: QuickAddConflictBehavior): Promise<boolean> {
        const selectedFolder = choice?.location === 'specific' ? choice.folderPath : this.settings.fleetingFolder;
        const folderPath = normalizePath(selectedFolder);

        // Ensure fleeting folder exists
        if (!this.app.vault.getAbstractFileByPath(folderPath)) {
            try {
                await this.app.vault.createFolder(folderPath);
            } catch {
                // Folder may already exist
            }
        }

        let finalTitle = title;
        let filePath = normalizePath(`${folderPath}/${finalTitle}.md`);
        let existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            const behavior = forcedConflictBehavior || choice?.conflictBehavior || 'ask';
            if (behavior === 'ask') {
                return new Promise((resolve) => {
                    new NoteConflictModal(this.app, (selectedBehavior) => {
                        void this.createQuickAddNote(title, choice, selectedBehavior)
                            .then(resolve);
                    }).open();
                });
            }
            if (behavior === 'create-new') {
                let suffix = 1;
                do {
                    finalTitle = `${title} ${suffix++}`;
                    filePath = normalizePath(`${folderPath}/${finalTitle}.md`);
                    existing = this.app.vault.getAbstractFileByPath(filePath);
                } while (existing);
            } else if (!(existing instanceof TFile)) {
                new Notice(`Cannot replace "${title}" because it is not a note.`);
                return false;
            }
        }

        // Read template content if configured
        let initialContent = '';
        const templatePath = choice ? choice.templatePath : this.settings.fleetingNoteTemplate;
        if (choice && !templatePath) new Notice(t().noticeQuickAddNoTemplate);
        if (templatePath) {
            initialContent = await this.readTemplate(templatePath);
        }

        try {
            const existingFile = existing instanceof TFile ? existing : null;
            const file = existingFile
                ? await this.app.vault.modify(existingFile, initialContent).then(() => existingFile)
                : await this.app.vault.create(filePath, initialContent);
            if (!choice || choice.open) {
                const leaf = choice?.openBehavior === 'split' ? this.app.workspace.getLeaf('split', 'vertical')
                    : this.app.workspace.getLeaf(choice?.openBehavior === 'tab' ? 'tab' : false);
                await leaf.openFile(file);
                if (choice && !choice.focus) this.app.workspace.setActiveLeaf(leaf, { focus: false });
            }
            new Notice(t().noticeQuickAddCreated(finalTitle));
            return true;
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            new Notice(t().noticeQuickAddFailed(message));
            return false;
        }
    }

    showQuickAdd(): void {
        this.mode = 'quick-add';
        this.inputEl.value = '';
        this.setPlaceholder(t().paletteSelectChoice);
        this.updateInstructions('');
        this.refreshSuggestions();
    }

    showRecentFiles(): void {
        this.mode = 'recent';
        this.inputEl.value = '';
        this.setPlaceholder(t().paletteRecentFilesTitle);
        this.updateInstructions('');
        this.refreshSuggestions();
    }

    private returnToSearch(): void {
        this.mode = 'search';
        this.inputEl.value = '';
        this.setPlaceholder(t().palettePlaceholder);
        this.updateInstructions('');
        this.refreshSuggestions();
    }

    private updateInstructions(query: string): void {
        if (this.mode === 'search' && !query) {
            this.setInstructions([
                { command: 'esc', purpose: t().paletteHelpDismiss },
                { command: '>', purpose: t().paletteHelpCommands },
            ]);
            return;
        }

        const instructions = [
            { command: '↑↓', purpose: t().paletteHelpNavigate },
            { command: '↵', purpose: t().paletteHelpSelect },
        ];
        if (this.mode !== 'search' && !query) {
            instructions.push({ command: '⌫', purpose: t().paletteHelpBack });
        }
        instructions.push({ command: 'esc', purpose: t().paletteHelpDismiss });
        this.setInstructions(instructions);
    }

    onNoSuggestion(): void {
        if (this.mode === 'search' && !this.inputEl.value.trim()) {
            this.resultContainerEl.empty();
            return;
        }
        super.onNoSuggestion();
    }

    private getQuickAddChoices(query: string): PaletteItem[] {
        const choices = this.settings.quickAddChoices;
        if (choices.length === 0) return [{ id: 'quick-add-fleeting', title: t().paletteAddFleeting, description: this.settings.fleetingFolder, type: 'action', icon: 'file-plus' }];
        return choices.filter((choice) => choice.name.toLowerCase().includes(query.toLowerCase())).map((choice) => ({
            id: `quick-add-choice-${choice.id}`, title: choice.name, description: choice.location === 'specific' ? choice.folderPath : this.settings.fleetingFolder,
            type: 'action' as const, icon: choice.icon || 'file-plus',
        }));
    }

    private getRecentFiles(query: string): PaletteItem[] {
        const needle = query.toLowerCase();
        return this.app.vault.getMarkdownFiles().sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, 10)
            .filter((file) => !needle || file.basename.toLowerCase().includes(needle) || file.path.toLowerCase().includes(needle))
            .map((file) => ({ id: file.path, title: file.basename, description: file.parent?.path || '', type: 'note' as const, file }));
    }

    private promptQuickAdd(choice: QuickAddChoice | null): void {
        const initial = this.settings.persistQuickAddDrafts ? this.quickAddDraft : '';
        new NoteTitleModal(this.app, initial, choice?.name ?? 'New note', async (title) => {
            this.quickAddDraft = this.settings.persistQuickAddDrafts ? title : '';
            const created = await this.createQuickAddNote(title, choice);
            if (created) this.close();
        }, (draft) => { this.quickAddDraft = this.settings.persistQuickAddDrafts ? draft : ''; }).open();
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

            if (this.settings.showIcons) {
                const iconEl = rowEl.createSpan({ cls: 'seam-palette-command-icon' });
                setIcon(iconEl, item.icon || 'hash');
            }

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
            void this.app.workspace.openLinkText(item.file.path, '', false);
        } else if (
            (item.type === 'command' || item.type === 'action' || item.type === 'create') &&
            item.action
        ) {
            void item.action();
        }
    }
}
