import { PaletteItem } from '../types';

/** Keep visible daily-note entries together at the first daily entry's ordered position. */
export function groupDailySearches(items: PaletteItem[]): PaletteItem[] {
    const order = ['today', 'yesterday', 'calendar'];
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
