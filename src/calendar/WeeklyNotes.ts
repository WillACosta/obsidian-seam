import { App, TFile } from 'obsidian';
import type { Moment } from 'moment';
import { DailyNoteSettings } from '../daily/DailyNotes';
import { SeamSettings } from '../types';
import { periodNotePath, readPeriodicConfig, resolvePeriodNote } from './PeriodicNotes';

export interface WeeklyNoteSettings extends DailyNoteSettings { iso: boolean; source: 'seam' | 'periodic' }
/** Read weekly settings without depending on another plugin's runtime. */
export async function readWeeklyNoteSettings(app: App, settings: SeamSettings): Promise<WeeklyNoteSettings> {
    const periodic = await readPeriodicConfig(app, settings.calendarUsePeriodicNotes, 'weekly');
    const config: Record<string, unknown> = periodic ?? { folder: settings.calendarWeeklyFolder, format: settings.calendarWeeklyFormat, template: settings.calendarWeeklyTemplate };
    const source: WeeklyNoteSettings['source'] = periodic ? 'periodic' : 'seam';
    const format = typeof config.format === 'string' && config.format.trim() ? config.format.trim() : 'gggg-[W]ww';
    const tokens = format.replace(/\[[^\]]*\]|\\./g, '');
    if (!/[wWD]/.test(tokens)) throw new Error('Weekly format must include a week number or date.');
    const iso = /W/.test(tokens);
    if ((iso && /w|g/.test(tokens)) || (!iso && /G/.test(tokens)) || (/[wW]/.test(tokens) && /Y/.test(tokens))) {
        throw new Error('Weekly format must pair gggg with ww, or GGGG with WW, rather than YYYY.');
    }
    return { folder: typeof config.folder === 'string' ? config.folder : '', format,
        template: typeof config.templatePath === 'string' ? config.templatePath : typeof config.template === 'string' ? config.template : '', iso, source };
}

export function weekStart(date: Moment, settings: WeeklyNoteSettings): Moment { return date.clone().startOf(settings.iso ? 'isoWeek' : 'week').startOf('day'); }
export function weekKey(date: Moment, settings: WeeklyNoteSettings): string { return weekStart(date, settings).format('YYYY-MM-DD'); }
export function weeklyNotePath(date: Moment, settings: WeeklyNoteSettings): string {
    return periodNotePath(weekStart(date, settings), settings);
}

export function findWeeklyNote(app: App, date: Moment, settings: WeeklyNoteSettings): TFile | null {
    const file = app.vault.getAbstractFileByPath(weeklyNotePath(date, settings));
    return file instanceof TFile ? file : null;
}

export async function resolveWeeklyNote(app: App, date: Moment, settings: WeeklyNoteSettings): Promise<TFile> {
    return resolvePeriodNote(app, weekStart(date, settings), settings, 'Weekly');
}
