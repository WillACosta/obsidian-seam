import './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, PaletteItem, SPECIAL_SEARCH_PIN_LIMIT } from '../src/types';
import { orderSpecialSearches } from '../src/calendar/SpecialSearchOrder';

const builtin = (search: PaletteItem['specialSearch']): PaletteItem => ({ id: String(search), title: String(search), description: '', type: 'special', specialSearch: search });
const custom = (id: string): PaletteItem => ({ id, title: id, description: '', type: 'special', customSearchId: id });
const settings = () => ({ ...DEFAULT_SETTINGS,
    specialSearchPreferences: DEFAULT_SETTINGS.specialSearchPreferences.map(entry => ({ ...entry, pinned: entry.search === 'calendar' || entry.search === 'todo' })),
    customSpecialSearches: [{ id: 'bookshelf', pinned: true }] as typeof DEFAULT_SETTINGS.customSpecialSearches,
    specialSearchOrder: ['custom:bookshelf', 'builtin:todo', 'builtin:today', 'builtin:yesterday', 'builtin:calendar', 'builtin:thisWeek', 'builtin:thisYear', 'builtin:recent'],
});

describe('Special-query pin priority', () => {
    it('keeps a pinned calendar above unpinned daily queries from the same date group', () => {
        const items = [builtin('today'), builtin('yesterday'), builtin('calendar'), builtin('todo'), custom('bookshelf'), builtin('thisWeek'), builtin('thisYear')];
        assert.deepEqual(orderSpecialSearches(items, settings()).map(item => item.id), ['bookshelf', 'todo', 'calendar', 'today', 'yesterday', 'thisWeek', 'thisYear']);
    });
    it('keeps all five mixed built-in/custom pins above every unpinned query', () => {
        const config = settings();
        config.specialSearchPreferences = config.specialSearchPreferences.map(entry => ({ ...entry, pinned: ['calendar', 'todo', 'recent', 'thisYear'].includes(entry.search) }));
        const items = [builtin('today'), builtin('yesterday'), builtin('calendar'), builtin('todo'), custom('bookshelf'), builtin('thisWeek'), builtin('thisYear'), builtin('recent')];
        const ordered = orderSpecialSearches(items, config);
        assert.equal(SPECIAL_SEARCH_PIN_LIMIT, 5);
        assert.deepEqual(new Set(ordered.slice(0, 5).map(item => item.id)), new Set(['bookshelf', 'todo', 'calendar', 'thisYear', 'recent']));
        assert.ok(ordered.slice(5).every(item => ['today', 'yesterday', 'thisWeek'].includes(item.id)));
    });
    it('preserves configured custom order and groups dates independently within each pin section', () => {
        const config = settings();
        config.specialSearchPreferences = config.specialSearchPreferences.map(entry => ({ ...entry, pinned: ['today', 'calendar'].includes(entry.search) }));
        config.customSpecialSearches.push({ id: 'second', pinned: true } as typeof config.customSpecialSearches[number]);
        config.specialSearchOrder = ['custom:second', 'custom:bookshelf', 'builtin:calendar', 'builtin:today', 'builtin:thisYear', 'builtin:yesterday'];
        const items = [builtin('yesterday'), custom('bookshelf'), builtin('calendar'), builtin('thisYear'), builtin('today'), custom('second')];
        assert.deepEqual(orderSpecialSearches(items, config).map(item => item.id), ['second', 'bookshelf', 'today', 'calendar', 'yesterday', 'thisYear']);
        assert.deepEqual(items.map(item => item.id), ['yesterday', 'bookshelf', 'calendar', 'thisYear', 'today', 'second']);
    });
    it('does not promote an unknown order key ahead of explicitly ordered pinned searches', () => {
        const config = settings(); config.customSpecialSearches.push({ id: 'new', pinned: true } as typeof config.customSpecialSearches[number]);
        assert.deepEqual(orderSpecialSearches([custom('new'), custom('bookshelf'), builtin('today')], config).map(item => item.id), ['bookshelf', 'new', 'today']);
    });
});
