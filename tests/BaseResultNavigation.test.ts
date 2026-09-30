import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BaseResultNavigation } from '../src/ui/BaseResultNavigation';

function fixture() {
    const attrs = new Map<string, string>();
    const classes = new Set<string>();
    let title = 'First';
    let top = 0;
    const card = {
        id: '', dataset: {} as Record<string, string>,
        style: { top: '0px', insetInlineStart: '0px' },
        querySelector: () => ({ textContent: title, getAttribute: () => null }),
        querySelectorAll: () => [],
        getBoundingClientRect: () => ({ top: top - container.scrollTop, bottom: top - container.scrollTop + 100, left: 0, height: 100 }),
        toggleClass: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name),
        removeClass: (name: string) => classes.delete(name),
        setAttribute: (name: string, value: string) => attrs.set(name, value),
        removeAttribute: (name: string) => attrs.delete(name),
    };
    const search = {
        value: '',
        dispatchEvent: () => {
            // Native Bases searches its data, then recycles this node for a match
            // which was never rendered before the search.
            title = 'Previously offscreen';
            top = 0;
            card.style.top = '0px';
        },
    };
    const container = {
        scrollTop: 0, scrollHeight: 500, clientHeight: 150, clientWidth: 100,
        getBoundingClientRect: () => ({ top: 0, bottom: 150, left: 0 }),
        querySelector: (selector: string) => selector.includes('input') ? search : selector.includes('cards') ? {} : null,
        querySelectorAll: (selector: string) => selector.includes('draggable') ? [card] : [],
    };
    const navigation = new BaseResultNavigation(container as unknown as HTMLElement, 'No results');
    return { navigation, card, container, attrs, search, recycle: (name: string, y: number) => {
        title = name;
        top = y;
        card.style.top = `${y}px`;
    } };
}

describe('Base result virtualization', () => {
    it('does not restore stale coordinates when a card node is recycled', () => {
        const f = fixture();
        f.navigation.refresh();
        f.recycle('Last', 400);
        f.container.scrollTop = 350;
        f.navigation.refresh();
        assert.equal(f.card.style.top, '400px');
        f.navigation.moveSelection('up');
        f.navigation.moveSelection('up');
        f.recycle('Previous', 288);
        f.navigation.refresh();
        assert.equal(f.navigation.activeFileRef, 'Previous');
        assert.equal(f.card.style.top, '288px');
        f.navigation.destroy();
        assert.equal(f.card.style.top, '288px');
    });

    it('selects the new first match after asynchronous native filtering', () => {
        const f = fixture();
        f.navigation.refresh();
        f.search.dispatchEvent = () => {};
        f.navigation.refresh('offscreen');
        f.recycle('Previously offscreen', 0);
        f.navigation.refresh();
        assert.equal(f.navigation.activeFileRef, 'Previously offscreen');
        assert.equal(f.attrs.get('aria-selected'), 'true');
    });

    it('delegates filtering to the complete native result set', () => {
        const f = fixture();
        f.navigation.refresh();
        f.navigation.refresh('Previously offscreen');
        assert.equal(f.search.value, 'Previously offscreen');
        assert.equal(f.navigation.activeFileRef, 'Previously offscreen');
        assert.equal(f.attrs.get('aria-selected'), 'true');
        assert.equal(f.container.scrollTop, 0);
    });
});
