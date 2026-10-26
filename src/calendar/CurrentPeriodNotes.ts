import { App, moment, TFile } from 'obsidian';
import type { Moment } from 'moment';
import { SeamSettings } from '../types';
import { detectLocale } from '../i18n';
import { readWeeklyNoteSettings, resolveWeeklyNote, weeklyNotePath } from './WeeklyNotes';
import { readYearlyNoteSettings, resolveYearlyNote, yearlyNotePath } from './YearlyNotes';

export type CurrentPeriod = 'thisWeek' | 'thisYear';
/** Capture the period at suggestion time so activation cannot unexpectedly change its destination. */
export async function currentPeriodTarget(app: App, settings: SeamSettings, search: CurrentPeriod, now: Moment = moment().locale(detectLocale())): Promise<{ path: string; day: string; create: () => Promise<TFile> }> {
    const date = now.clone();
    if (search === 'thisWeek') {
        const config = await readWeeklyNoteSettings(app, settings);
        return { day: date.format('YYYY-MM-DD'), path: weeklyNotePath(date, config), create: () => resolveWeeklyNote(app, date, config) };
    }
    const config = await readYearlyNoteSettings(app, settings);
    return { day: date.format('YYYY-MM-DD'), path: yearlyNotePath(date, config), create: () => resolveYearlyNote(app, date, config) };
}
