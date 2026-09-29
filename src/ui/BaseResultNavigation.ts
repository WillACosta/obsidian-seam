interface BaseResultEntry {
    element: HTMLElement;
    activationElement: HTMLElement;
    text: string;
    layout: 'cards' | 'table';
    cardGroup?: HTMLElement;
}

/** Adds search-result filtering and keyboard selection to rendered Bases results. */
export class BaseResultNavigation {
    private static nextId = 0;
    private entries: BaseResultEntry[] = [];
    private visibleEntries: BaseResultEntry[] = [];
    private activeIndex = -1;
    private filterText = '';
    private emptyMessage: HTMLElement | null = null;
    private layout: BaseResultEntry['layout'] | null = null;

    constructor(private readonly containerEl: HTMLElement, private readonly emptyMessageText: string) {}

    get isSupported(): boolean {
        return this.layout !== null;
    }

    get activeElementId(): string | null {
        return this.visibleEntries[this.activeIndex]?.element.id || null;
    }

    get activeFileRef(): string | null {
        const entry = this.visibleEntries[this.activeIndex];
        if (!entry) return null;
        if (entry.layout === 'table') {
            return entry.activationElement.getAttribute('data-href')
                || entry.activationElement.getAttribute('href')
                || entry.activationElement.textContent?.trim()
                || null;
        }
        return entry.element
            .querySelector<HTMLElement>('.bases-cards-property.mod-title .bases-cards-line')
            ?.textContent?.trim() || null;
    }

    refresh(filterText = this.filterText): void {
        const queryChanged = filterText.trim().toLowerCase() !== this.filterText;
        const previousActive = this.visibleEntries[this.activeIndex]?.element;
        this.filterText = filterText.trim().toLowerCase();
        this.collectEntries();

        const terms = this.filterText.split(/\s+/).filter(Boolean);
        this.visibleEntries = this.entries.filter((entry) => terms.every((term) => entry.text.includes(term)));
        this.applyVisibility();
        this.applyHighlights(terms, queryChanged);

        if (queryChanged) {
            this.activeIndex = this.visibleEntries.length > 0 ? 0 : -1;
        } else {
            this.activeIndex = this.visibleEntries.findIndex((entry) => entry.element === previousActive);
            if (this.activeIndex < 0 && this.visibleEntries.length > 0) this.activeIndex = 0;
        }
        this.renderSelection();
        this.renderEmptyMessage();
    }

    moveSelection(direction: -1 | 1): boolean {
        if (!this.isSupported || this.visibleEntries.length === 0) return false;
        if (this.activeIndex < 0) {
            this.activeIndex = direction > 0 ? 0 : this.visibleEntries.length - 1;
        } else {
            this.activeIndex = (this.activeIndex + direction + this.visibleEntries.length) % this.visibleEntries.length;
        }
        this.renderSelection(true);
        return true;
    }

    activateSelection(): boolean {
        const entry = this.visibleEntries[this.activeIndex];
        if (!entry) return false;
        entry.activationElement.click();
        return true;
    }

    destroy(): void {
        this.clearHighlights();
        const cardGroups = new Set<HTMLElement>();
        for (const entry of this.entries) {
            entry.element.removeClass('seam-palette-base-result-active', 'seam-palette-base-result-filtered');
            entry.element.removeAttribute('aria-selected');
            if (entry.element.id === entry.element.dataset.seamBaseGeneratedId) entry.element.removeAttribute('id');
            delete entry.element.dataset.seamBaseGeneratedId;
            entry.element.hidden = false;
            if (entry.layout === 'cards') {
                if (entry.cardGroup) cardGroups.add(entry.cardGroup);
                const originalPosition = entry.element.dataset.seamBaseOriginalStart;
                if (originalPosition !== undefined) entry.element.style.insetInlineStart = originalPosition;
                const originalEnd = entry.element.dataset.seamBaseOriginalEnd;
                if (originalEnd !== undefined) entry.element.style.insetInlineEnd = originalEnd;
                const originalTop = entry.element.dataset.seamBaseOriginalTop;
                if (originalTop !== undefined) entry.element.style.top = originalTop;
                delete entry.element.dataset.seamBaseOriginalStart;
                delete entry.element.dataset.seamBaseOriginalEnd;
                delete entry.element.dataset.seamBaseOriginalTop;
                delete entry.element.dataset.seamBaseOriginalWidth;
                delete entry.element.dataset.seamBaseOriginalHeight;
            } else {
                const originalPosition = entry.element.dataset.seamBaseOriginalTop;
                if (originalPosition !== undefined) entry.element.style.top = originalPosition;
                delete entry.element.dataset.seamBaseOriginalTop;
                delete entry.element.dataset.seamBaseOriginalHeight;
            }
        }
        for (const group of cardGroups) this.restoreCardGroup(group);
        this.emptyMessage?.remove();
        this.emptyMessage = null;
        this.entries = [];
        this.visibleEntries = [];
        this.activeIndex = -1;
        this.layout = null;
    }

    private collectEntries(): void {
        const cards = Array.from(this.containerEl.querySelectorAll<HTMLElement>('.bases-cards-item[draggable="true"]'));
        if (cards.length > 0) {
            this.layout = 'cards';
            this.entries = cards.flatMap((element, index) => {
                const title = element.querySelector<HTMLElement>('.bases-cards-property.mod-title');
                if (!title) return [];
                const cardGroup = element.parentElement;
                this.ensureId(element, index);
                if (element.dataset.seamBaseOriginalStart === undefined) {
                    element.dataset.seamBaseOriginalStart = element.style.insetInlineStart;
                    element.dataset.seamBaseOriginalEnd = element.style.insetInlineEnd;
                    element.dataset.seamBaseOriginalTop = element.style.top;
                    element.dataset.seamBaseOriginalWidth = String(element.getBoundingClientRect().width);
                    element.dataset.seamBaseOriginalHeight = String(element.getBoundingClientRect().height);
                }
                if (cardGroup && cardGroup.dataset.seamBaseOriginalHidden === undefined) {
                    cardGroup.dataset.seamBaseOriginalHidden = String(cardGroup.hidden);
                }
                const text = Array.from(element.querySelectorAll('.bases-cards-property .bases-cards-line'))
                    .map((property) => property.textContent ?? '').join(' ').toLowerCase();
                return [{ element, activationElement: element, text, layout: 'cards' as const, cardGroup: cardGroup ?? undefined }];
            });
            return;
        }

        const rows = Array.from(this.containerEl.querySelectorAll<HTMLElement>('.bases-tr'));
        const tableEntries = rows.flatMap((element, index) => {
            const nameCell = element.querySelector<HTMLElement>('.bases-td[data-property="file.name"]');
            const title = nameCell?.querySelector<HTMLElement>('[data-href], a.internal-link');
            if (!nameCell || !title) return [];
            this.ensureId(element, index);
            if (element.dataset.seamBaseOriginalTop === undefined) {
                element.dataset.seamBaseOriginalTop = element.style.top;
                element.dataset.seamBaseOriginalHeight = String(element.getBoundingClientRect().height);
            }
            const text = Array.from(element.querySelectorAll<HTMLElement>('.bases-td[data-property] .bases-table-cell'))
                .map((property) => property.textContent ?? '').join(' ').toLowerCase();
            return [{ element, activationElement: title, text, layout: 'table' as const }];
        });

        this.layout = tableEntries.length > 0 ? 'table' : null;
        this.entries = tableEntries;
    }

    private ensureId(element: HTMLElement, index: number): void {
        if (!element.id) {
            element.id = `seam-base-result-${BaseResultNavigation.nextId++}-${index}`;
            element.dataset.seamBaseGeneratedId = element.id;
        }
    }

    private applyVisibility(): void {
        const visible = new Set(this.visibleEntries.map((entry) => entry.element));
        for (const entry of this.entries) {
            const isVisible = visible.has(entry.element);
            entry.element.hidden = !isVisible;
            entry.element.toggleClass('seam-palette-base-result-filtered', !isVisible);
        }

        if (this.layout === 'cards') this.reflowCards();
        if (this.layout === 'table') this.reflowTableRows();
    }

    private applyHighlights(terms: string[], queryChanged: boolean): void {
        if (queryChanged || terms.length === 0) this.clearHighlights();
        if (terms.length === 0) return;

        const escapedTerms = [...new Set(terms)]
            .sort((a, b) => b.length - a.length)
            .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const matcher = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

        for (const entry of this.visibleEntries) {
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

    private reflowCards(): void {
        const all = this.entries.filter((entry) => entry.layout === 'cards');
        if (all.length === 0) return;

        const groups = [...new Set(all.map((entry) => entry.cardGroup).filter((group): group is HTMLElement => Boolean(group)))];
        if (!this.filterText) {
            for (const entry of all) this.restoreCardPosition(entry.element);
            for (const group of groups) this.restoreCardGroup(group);
            return;
        }

        const visible = new Set(this.visibleEntries.map((entry) => entry.element));

        for (const group of groups) {
            const allGroupEntries = all.filter((entry) => entry.cardGroup === group);
            const visibleGroupEntries = allGroupEntries.filter((entry) => visible.has(entry.element));
            group.hidden = visibleGroupEntries.length === 0;
            if (visibleGroupEntries.length === 0) continue;

            const rows = new Map<number, BaseResultEntry[]>();
            for (const entry of allGroupEntries) {
                const top = Number.parseFloat(entry.element.dataset.seamBaseOriginalTop ?? '0') || 0;
                const row = rows.get(top) ?? [];
                row.push(entry);
                rows.set(top, row);
            }
            const rowTops = [...rows.keys()].sort((a, b) => a - b);
            const firstRow = rows.get(rowTops[0]) ?? allGroupEntries;
            const columns = Math.max(1, firstRow.length);
            const firstCard = firstRow[0]?.element;
            const secondCard = firstRow[1]?.element;
            const firstStart = Number.parseFloat(firstCard?.dataset.seamBaseOriginalStart ?? '0') || 0;
            const secondStart = Number.parseFloat(secondCard?.dataset.seamBaseOriginalStart ?? '0') || 0;
            const cardWidth = Number.parseFloat(firstCard?.dataset.seamBaseOriginalWidth ?? '0') || firstCard?.getBoundingClientRect().width || 0;
            const cardHeight = Number.parseFloat(firstCard?.dataset.seamBaseOriginalHeight ?? '0') || firstCard?.getBoundingClientRect().height || 0;
            const columnGap = secondCard ? Math.max(0, secondStart - firstStart - cardWidth) : 0;
            const rowGap = rowTops[1] !== undefined ? Math.max(0, rowTops[1] - rowTops[0] - cardHeight) : 0;

            visibleGroupEntries.forEach((entry, index) => {
                const column = index % columns;
                const row = Math.floor(index / columns);
                const start = `${column * (cardWidth + columnGap)}px`;
                const top = `${row * (cardHeight + rowGap)}px`;
                if (entry.element.style.insetInlineStart !== start) entry.element.style.insetInlineStart = start;
                if (entry.element.style.insetInlineEnd !== 'auto') entry.element.style.insetInlineEnd = 'auto';
                if (entry.element.style.top !== top) entry.element.style.top = top;
            });
        }
    }

    private restoreCardPosition(element: HTMLElement): void {
        const originalStart = element.dataset.seamBaseOriginalStart;
        if (originalStart !== undefined && element.style.insetInlineStart !== originalStart) element.style.insetInlineStart = originalStart;
        const originalEnd = element.dataset.seamBaseOriginalEnd;
        if (originalEnd !== undefined && element.style.insetInlineEnd !== originalEnd) element.style.insetInlineEnd = originalEnd;
        const originalTop = element.dataset.seamBaseOriginalTop;
        if (originalTop !== undefined && element.style.top !== originalTop) element.style.top = originalTop;
    }

    private restoreCardGroup(group: HTMLElement): void {
        group.hidden = group.dataset.seamBaseOriginalHidden === 'true';
        delete group.dataset.seamBaseOriginalHidden;
    }

    private reflowTableRows(): void {
        if (this.visibleEntries.length === this.entries.length) return;
        const first = this.visibleEntries[0]?.element ?? this.entries[0]?.element;
        const rowHeight = Number.parseFloat(first?.dataset.seamBaseOriginalHeight ?? '0') || first?.getBoundingClientRect().height || 30;
        let rowIndex = 0;
        for (const entry of this.visibleEntries) {
            if (entry.layout !== 'table') continue;
            const top = `${rowIndex * rowHeight}px`;
            if (entry.element.style.top !== top) entry.element.style.top = top;
            rowIndex++;
        }
    }

    private renderSelection(scroll = false): void {
        for (const entry of this.entries) {
            const active = this.visibleEntries[this.activeIndex]?.element === entry.element;
            entry.element.toggleClass('seam-palette-base-result-active', active);
            if (active) entry.element.setAttribute('aria-selected', 'true');
            else entry.element.removeAttribute('aria-selected');
            if (active && scroll) entry.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }

    private renderEmptyMessage(): void {
        const shouldShow = this.filterText.length > 0 && this.isSupported && this.visibleEntries.length === 0;
        if (!shouldShow) {
            this.emptyMessage?.remove();
            this.emptyMessage = null;
            return;
        }
        if (!this.emptyMessage) this.emptyMessage = this.containerEl.createDiv({ cls: 'seam-palette-base-no-results' });
        if (this.emptyMessage.textContent !== this.emptyMessageText) {
            this.emptyMessage.setText(this.emptyMessageText);
        }
    }
}
