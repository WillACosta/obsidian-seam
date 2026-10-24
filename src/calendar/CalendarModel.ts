import { App, TFile } from 'obsidian';
import type { Moment } from 'moment';
import { createDailyNote, DailyNoteSettings, dailyNotePath } from '../daily/DailyNotes';

export type CalendarPage = 'days' | 'months' | 'years';

/** Date-only arithmetic through Moment avoids DST and month-length errors. */
export class CalendarModel {
    selected: Moment;
    page: CalendarPage = 'days';

    constructor(date: Moment, locale: string) {
        this.selected = date.clone().locale(locale).startOf('day');
    }

    get yearStart(): number { return Math.floor(this.selected.year() / 12) * 12; }

    days(): Moment[] {
        const start = this.selected.clone().startOf('month').startOf('week');
        return Array.from({ length: 42 }, (_, index) => start.clone().add(index, 'days'));
    }

    move(key: string, shift = false): void {
        if (key === 'PageUp' || key === 'PageDown') {
            this.shift(key === 'PageUp' ? -1 : 1, shift);
            return;
        }
        const direction = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : key === 'ArrowUp' ? -1 : 1;
        if (this.page === 'days') {
            if (key === 'Home') this.selected.startOf('week');
            else if (key === 'End') this.selected.endOf('week').startOf('day');
            else this.selected.add(direction * (key === 'ArrowUp' || key === 'ArrowDown' ? 7 : 1), 'days');
        } else {
            if (key === 'Home' || key === 'End') {
                const index = this.page === 'years' ? this.selected.year() - this.yearStart : this.selected.month();
                const destination = Math.floor(index / 3) * 3 + (key === 'End' ? 2 : 0);
                if (this.page === 'years') this.selected.year(this.yearStart + destination);
                else this.selected.month(destination);
                return;
            }
            const steps = key === 'ArrowUp' || key === 'ArrowDown' ? 3 : 1;
            this.selected.add(direction * steps, this.page === 'years' ? 'years' : 'months');
        }
    }

    shift(direction: number, years = false): void {
        this.selected.add(direction * (this.page === 'years' ? 12 : 1), years || this.page !== 'days' ? 'years' : 'months');
    }

    chooseYear(year: number): void { this.selected.year(year); this.page = 'months'; }
    chooseMonth(month: number): void { this.selected.month(month); this.page = 'days'; }
}

export function findCalendarNote(app: App, date: Moment, settings: DailyNoteSettings): TFile | null {
    const file = app.vault.getAbstractFileByPath(dailyNotePath(date, settings));
    return file instanceof TFile ? file : null;
}

/** Recheck the destination on activation and tolerate another actor creating it first. */
export async function resolveCalendarNote(app: App, date: Moment, settings: DailyNoteSettings): Promise<TFile> {
    const existing = findCalendarNote(app, date, settings);
    if (existing) return existing;
    try { return await createDailyNote(app, date, settings); }
    catch (error) {
        const created = findCalendarNote(app, date, settings);
        if (created) return created;
        throw error;
    }
}
