interface BaseResultEntry {
    element: HTMLElement;
    activationElement: HTMLElement;
    identity: string;
    layout: 'cards' | 'table';
    top: number;
    left: number;
    height: number;
}

type BaseNavigationDirection = 'up' | 'down';

/** Selects native Bases results without changing their virtualized layout. */
export class BaseResultNavigation {
    private static nextId = 0;
    private entries: BaseResultEntry[] = [];
    private activeIdentity: string | null = null;
    private pendingPosition: { top: number; left: number } | null = null;
    private filterText = '';
    private emptyMessage: HTMLElement | null = null;
    private layout: BaseResultEntry['layout'] | null = null;

    constructor(private readonly containerEl: HTMLElement, private readonly emptyMessageText: string) {}

    get isSupported(): boolean {
        return this.layout !== null;
    }

    get activeElementId(): string | null {
        return this.activeEntry?.element.id || null;
    }

    private get activeEntry(): BaseResultEntry | undefined {
        return this.entries.find((entry) => entry.identity === this.activeIdentity);
    }

    get activeFileRef(): string | null {
        return this.activeEntry?.identity || null;
    }

    refresh(filterText = this.filterText): void {
        const queryChanged = filterText !== this.filterText;
        this.filterText = filterText;
        // The native search evaluates the full Base, including entries that have
        // no DOM node yet. Hiding/repositioning those nodes breaks virtualization.
        const search = this.containerEl.querySelector<HTMLInputElement>('.bases-search-row input');
        if (search && search.value !== filterText) {
            search.value = filterText;
            search.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (queryChanged) {
            this.activeIdentity = null;
            this.pendingPosition = null;
            this.containerEl.scrollTop = 0;
        }
        this.collectEntries();
        if (this.pendingPosition) {
            const target = this.pendingPosition;
            const row = this.entries.filter((entry) => Math.abs(entry.top - target.top) < 8);
            const nearest = row.sort((a, b) => Math.abs(a.left - target.left) - Math.abs(b.left - target.left))[0];
            if (nearest) {
                this.activeIdentity = nearest.identity;
                this.pendingPosition = null;
                this.scrollEntryIntoView(nearest.element);
            }
        }
        if (!this.activeEntry && !this.pendingPosition && this.entries.length > 0) this.activeIdentity = this.entries[0].identity;
        this.applyHighlights(filterText.toLowerCase().split(/\s+/).filter(Boolean), queryChanged);
        this.renderSelection();
        const empty = Boolean(filterText) && this.isSupported && this.entries.length === 0;
        if (empty && !this.emptyMessage) {
            this.emptyMessage = this.containerEl.createDiv({ cls: 'seam-palette-base-no-results', text: this.emptyMessageText });
        } else if (!empty && this.emptyMessage) {
            this.emptyMessage.remove();
            this.emptyMessage = null;
        }
    }

    private collectEntries(): void {
        const viewport = this.containerEl.getBoundingClientRect();
        const cards = Array.from(this.containerEl.querySelectorAll<HTMLElement>('.bases-cards-item[draggable="true"]'));
        this.layout = this.containerEl.querySelector('.bases-view[data-view-type="cards"]') ? 'cards'
            : this.containerEl.querySelector('.bases-view[data-view-type="table"]') ? 'table' : null;
        const elements = this.layout === 'cards' ? cards
            : Array.from(this.containerEl.querySelectorAll<HTMLElement>('.bases-tr'));
        this.entries = elements.flatMap((element) => {
            const title = this.layout === 'cards'
                ? element.querySelector<HTMLElement>('.bases-cards-property.mod-title .bases-cards-line')
                : element.querySelector<HTMLElement>('.bases-td[data-property="file.name"] [data-href], .bases-td[data-property="file.name"] a.internal-link');
            const identity = title?.getAttribute('data-href') || title?.getAttribute('href') || title?.textContent?.trim();
            const rect = element.getBoundingClientRect();
            if (!identity || !title || !this.layout || rect.height <= 0) return [];
            if (!element.id) {
                element.id = `seam-base-result-${BaseResultNavigation.nextId++}`;
                element.dataset.seamBaseGeneratedId = element.id;
            }
            return [{ element, activationElement: this.layout === 'cards' ? element : title,
                identity, layout: this.layout, top: rect.top - viewport.top + this.containerEl.scrollTop,
                left: rect.left - viewport.left, height: rect.height }];
        }).sort((a, b) => a.top - b.top || a.left - b.left);
    }

    moveSelection(direction: BaseNavigationDirection): boolean {
        if (!this.isSupported) return false;
        // Coordinates must be read again: native Bases may have recycled nodes.
        this.collectEntries();
        const active = this.activeEntry;
        if (!active) {
            this.activeIdentity = this.entries[0]?.identity ?? null;
            this.renderSelection(true);
            return true;
        }
        this.pendingPosition = null;
        const offset = direction === 'down' ? 1 : -1;
        const rows = [...new Set(this.entries.map((entry) => entry.top))].sort((a, b) => a - b);
        const activeIndex = this.entries.indexOf(active);
        const target = this.entries[activeIndex + offset];
        if (target) {
            this.activeIdentity = target.identity;
            this.renderSelection(true);
            return true;
        }
        // The next row may not exist in the DOM yet. Scroll the native viewport
        // to materialize it, then resolve selection when the observer refreshes.
        const pitch = rows.length > 1 ? rows[1] - rows[0] : active.height + (this.layout === 'cards' ? 12 : 0);
        const top = active.top + offset * pitch;
        const contentHeight = this.containerEl.scrollHeight;
        if (top >= 0 && top < contentHeight - 1) {
            this.pendingPosition = { top, left: direction === 'down' ? 0 : this.containerEl.clientWidth };
            this.containerEl.scrollTop = Math.max(0, top - (direction === 'up' ? 0 : this.containerEl.clientHeight - active.height));
        }
        return true;
    }

    activateSelection(): boolean {
        const entry = this.activeEntry;
        if (!entry) return false;
        entry.activationElement.click();
        return true;
    }

    destroy(): void {
        this.emptyMessage?.remove();
        this.emptyMessage = null;
        this.clearHighlights();
        for (const entry of this.entries) {
            entry.element.removeClass('seam-palette-base-result-active');
            entry.element.removeAttribute('aria-selected');
            if (entry.element.id === entry.element.dataset.seamBaseGeneratedId) entry.element.removeAttribute('id');
            delete entry.element.dataset.seamBaseGeneratedId;
        }
        this.entries = [];
        this.activeIdentity = null;
        this.pendingPosition = null;
        this.layout = null;
    }

    private applyHighlights(terms: string[], queryChanged: boolean): void {
        if (queryChanged || terms.length === 0) this.clearHighlights();
        if (terms.length === 0) return;

        const escapedTerms = [...new Set(terms)]
            .sort((a, b) => b.length - a.length)
            .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const matcher = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

        for (const entry of this.entries) {
            const cells = entry.layout === 'cards'
                ? entry.element.querySelectorAll<HTMLElement>('.bases-cards-property .bases-cards-line')
                : entry.element.querySelectorAll<HTMLElement>('.bases-td[data-property] .bases-table-cell');
            for (const cell of Array.from(cells)) this.highlightTextNodes(cell, matcher);
        }
    }

    private highlightTextNodes(root: HTMLElement, matcher: RegExp): void {
        const ownerDocument = root.ownerDocument;
        const nodeFilter = ownerDocument.defaultView?.NodeFilter ?? NodeFilter;
        const walker = ownerDocument.createTreeWalker(root, nodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                if (!node.textContent?.trim()) return nodeFilter.FILTER_REJECT;
                if (node.parentElement?.closest('.seam-palette-base-highlight')) return nodeFilter.FILTER_REJECT;
                return nodeFilter.FILTER_ACCEPT;
            },
        });
        const textNodes: Text[] = [];
        let current = walker.nextNode();
        while (current) {
            textNodes.push(current as Text);
            current = walker.nextNode();
        }

        for (const textNode of textNodes) {
            const text = textNode.data;
            matcher.lastIndex = 0;
            if (!matcher.test(text)) continue;
            matcher.lastIndex = 0;
            const fragment = ownerDocument.createDocumentFragment();
            let lastIndex = 0;
            for (const match of text.matchAll(matcher)) {
                const index = match.index ?? 0;
                if (index > lastIndex) fragment.appendText(text.slice(lastIndex, index));
                const highlight = ownerDocument.createElement('span');
                highlight.addClass('seam-palette-base-highlight');
                highlight.setText(match[0]);
                fragment.appendChild(highlight);
                lastIndex = index + match[0].length;
            }
            if (lastIndex < text.length) fragment.appendText(text.slice(lastIndex));
            textNode.replaceWith(fragment);
        }
    }

    private clearHighlights(): void {
        const highlights = this.containerEl.querySelectorAll<HTMLElement>('.seam-palette-base-highlight');
        for (const highlight of Array.from(highlights)) {
            const parent = highlight.parentNode;
            highlight.replaceWith(highlight.ownerDocument.createTextNode(highlight.textContent ?? ''));
            parent?.normalize();
        }
    }

    private renderSelection(scroll = false): void {
        for (const entry of this.entries) {
            const active = entry.identity === this.activeIdentity;
            entry.element.toggleClass('seam-palette-base-result-active', active);
            if (active) entry.element.setAttribute('aria-selected', 'true');
            else entry.element.removeAttribute('aria-selected');
            if (active && scroll) this.scrollEntryIntoView(entry.element);
        }
    }

    private scrollEntryIntoView(element: HTMLElement): void {
        const viewport = this.containerEl.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        if (rect.height <= 0) return;
        // Tall cards align at the top, rather than jumping between their edges.
        if (rect.height > this.containerEl.clientHeight || rect.top < viewport.top) {
            this.containerEl.scrollTop += rect.top - viewport.top;
        } else if (rect.bottom > viewport.bottom) {
            this.containerEl.scrollTop += rect.bottom - viewport.bottom;
        }
    }
}
