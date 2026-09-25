import { AbstractInputSuggest, App, setIcon } from 'obsidian';
import { SearchService } from '../search/SearchService';

interface TagSuggestion {
    tag: string;
    excluded: boolean;
}

export function getTagInputContext(query: string): { prefix: string; excluded: boolean } | null {
    const token = query.split(/\s+/).pop() ?? '';
    const excluded = token.startsWith('!#');
    if (!token.startsWith('#') && !excluded) return null;
    return { prefix: excluded ? token.slice(2) : token.slice(1), excluded };
}

export function getTagSuggestions(searchService: SearchService, query: string, excludedTags: string[] = []): TagSuggestion[] {
    const context = getTagInputContext(query);
    if (!context) return [];
    const selected = query.split(/\s+/)
        .filter((part) => part.startsWith('#') || part.startsWith('!#'))
        .map((part) => part.replace(/^!?#/, '').toLowerCase())
        .filter((tag) => tag !== context.prefix.toLowerCase());
    return searchService.getTagsMatchingPrefix(context.prefix, [...selected, ...excludedTags]).map((tag) => ({ tag, excluded: context.excluded }));
}

/** Reusable tag-query completion for palette and settings inputs. */
export class TagFilterSuggest extends AbstractInputSuggest<TagSuggestion> {
    constructor(
        app: App,
        inputEl: HTMLInputElement,
        private readonly searchService: SearchService,
        private readonly onChange?: (value: string) => void,
        private readonly showIcons = true,
    ) {
        super(app, inputEl);
        this.limit = 100;
    }

    getSuggestions(query: string): TagSuggestion[] {
        return getTagSuggestions(this.searchService, query);
    }

    renderSuggestion(value: TagSuggestion, el: HTMLElement): void {
        if (this.showIcons) {
            const icon = el.createSpan({ cls: 'seam-path-suggest-icon' });
            setIcon(icon, 'hash');
        }
        el.createSpan({ text: `${value.excluded ? '!' : ''}${value.tag}` });
    }

    selectSuggestion(value: TagSuggestion, evt: MouseEvent | KeyboardEvent): void {
        const current = this.getValue();
        const parts = current.split(/(\s+)/);
        let index = parts.length - 1;
        while (index >= 0 && /^\s+$/.test(parts[index])) index--;
        parts[index] = `${value.excluded ? '!' : ''}#${value.tag}`;
        const next = `${parts.join('')} `;
        this.setValue(next);
        this.onChange?.(next);
        super.selectSuggestion(value, evt);
    }
}
