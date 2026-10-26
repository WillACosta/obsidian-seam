import { PaletteItem, SeamSettings } from '../types';

/** Keep visible daily-note entries together at the first daily entry's ordered position. */
export function groupDailySearches(items: PaletteItem[]): PaletteItem[] {
    const order = ['today', 'yesterday', 'calendar', 'thisWeek', 'thisYear'];
    const daily = items.filter(item => item.specialSearch && order.includes(item.specialSearch))
        .sort((a, b) => order.indexOf(a.specialSearch ?? '') - order.indexOf(b.specialSearch ?? ''));
    if (!daily.length) return items;
    const grouped: PaletteItem[] = [];
    for (const item of items) {
        if (!daily.includes(item)) grouped.push(item);
        else if (!grouped.includes(daily[0])) grouped.push(...daily);
    }
    return grouped;
}

/** Pin priority is absolute; group date queries only inside their own pin section. */
export function orderSpecialSearches(items: PaletteItem[], settings: SeamSettings): PaletteItem[] {
    const pinned = (item: PaletteItem): boolean => item.specialSearch
        ? Boolean(settings.specialSearchPreferences.find(entry => entry.search === item.specialSearch)?.pinned)
        : Boolean(settings.customSpecialSearches.find(entry => entry.id === item.customSearchId)?.pinned);
    const position = (item: PaletteItem): number => {
        const key = item.customSearchId ? `custom:${item.customSearchId}` : `builtin:${item.specialSearch}`;
        const index = settings.specialSearchOrder.indexOf(key);
        return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    const sorted = [...items].sort((a, b) => position(a) - position(b));
    return [...groupDailySearches(sorted.filter(pinned)), ...groupDailySearches(sorted.filter(item => !pinned(item)))];
}
