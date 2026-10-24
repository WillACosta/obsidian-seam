import { App, Component, moment, Notice, Scope, setIcon, TFile } from 'obsidian';
import { DailyNoteSettings, dailyNoteDate } from '../daily/DailyNotes';
import { detectLocale, t } from '../i18n';
import { CalendarModel, findCalendarNote, resolveCalendarNote } from './CalendarModel';

interface CalendarCallbacks {
    changed: () => void;
    open: (file: TFile) => Promise<void>;
}

/** A scoped, disposable calendar using native buttons and a roving grid focus. */
export class DailyNoteCalendar extends Component {
    readonly model: CalendarModel;
    private destroyed = false;
    private busy = false;
    private navigationScope: Scope;
    private scopeActive = false;

    constructor(
        private app: App,
        readonly host: HTMLElement,
        private input: HTMLInputElement,
        private settings: DailyNoteSettings,
        private callbacks: CalendarCallbacks,
        parentScope: Scope,
    ) {
        super();
        const file = app.workspace.getActiveFile();
        this.model = new CalendarModel(file ? dailyNoteDate(file, settings) ?? moment() : moment(), detectLocale());
        this.navigationScope = new Scope(parentScope);
        for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Enter', ' ']) {
            this.navigationScope.register([], key, event => this.handleKey(event) ? false : true);
        }
        for (const key of ['PageUp', 'PageDown']) {
            this.navigationScope.register(['Shift'], key, event => this.handleKey(event) ? false : true);
        }
        this.navigationScope.register([], 'Escape', event => {
            this.consume(event);
            this.exitNavigation();
            return false;
        });
    }

    get hasNote(): boolean { return Boolean(findCalendarNote(this.app, this.model.selected, this.settings)); }
    get picking(): boolean { return this.model.page !== 'days'; }

    onload(): void {
        this.registerDomEvent(this.host, 'focusin', () => {
            if (!this.scopeActive) { this.app.keymap.pushScope(this.navigationScope); this.scopeActive = true; }
        });
        this.registerDomEvent(this.host, 'focusout', event => {
            const next = event.relatedTarget as Node | null;
            if (next && !this.host.contains(next)) this.exitNavigation(false);
        });
        this.registerDomEvent(this.input, 'focus', () => this.exitNavigation(false));
        this.render();
        const refresh = (): void => { if (!this.busy) this.render(); };
        this.registerEvent(this.app.vault.on('create', refresh));
        this.registerEvent(this.app.vault.on('delete', refresh));
        this.registerEvent(this.app.vault.on('rename', refresh));
    }

    onunload(): void { this.destroyed = true; this.exitNavigation(false); this.host.remove(); }

    private exitNavigation(focusInput = true): void {
        if (this.scopeActive) { this.app.keymap.popScope(this.navigationScope); this.scopeActive = false; }
        if (focusInput) this.input.focus();
    }

    /** Capture before SuggestModal's default handlers so Escape first leaves the grid. */
    handleKey(event: KeyboardEvent): boolean {
        const target = event.target as Node | null;
        const inCalendar = Boolean(target && this.host.contains(target));
        if (event.altKey || event.ctrlKey || event.metaKey) return false;
        if (target === this.input) {
            if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
                this.consume(event);
                if (event.key === 'Enter' && !this.picking) void this.activate();
                else this.focusSelected();
                return true;
            }
            return false;
        }
        if (!inCalendar) return false;
        if (event.key === 'Escape') {
            this.consume(event);
            this.exitNavigation();
            return true;
        }
        const element = target?.instanceOf(HTMLElement) ? target : null;
        if (element?.matches('button[data-calendar-control]') && (event.key === 'Enter' || event.key === ' ')) {
            this.consume(event);
            element.click();
            return true;
        }
        if (!element?.matches('[data-calendar-cell]')) return false;
        if (event.key === 'Enter' || event.key === ' ') {
            this.consume(event);
            if (this.model.page === 'years') { this.model.chooseYear(this.model.selected.year()); this.render(true); }
            else if (this.model.page === 'months') { this.model.chooseMonth(this.model.selected.month()); this.render(true); }
            else void this.activate();
            return true;
        }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return false;
        this.consume(event);
        if (this.busy) return true;
        this.model.move(event.key, event.shiftKey);
        this.render(true);
        return true;
    }

    private consume(event: KeyboardEvent): void { event.preventDefault(); event.stopImmediatePropagation(); }

    private focusSelected(): void { this.host.querySelector<HTMLElement>('[data-calendar-cell][tabindex="0"]')?.focus(); }

    private button(parent: HTMLElement, label: string, action: () => void, cls = ''): HTMLButtonElement {
        const button = parent.createEl('button', { cls, text: label, attr: { type: 'button' } });
        button.addEventListener('click', action);
        return button;
    }

    private render(focus = false): void {
        if (this.destroyed) return;
        const active = this.host.ownerDocument.activeElement;
        const activeControl = active?.getAttribute('data-calendar-control');
        const wasCell = active?.hasAttribute('data-calendar-cell');
        this.host.empty();
        const header = this.host.createDiv({ cls: 'seam-calendar-header' });
        const selected = this.model.selected;
        const page = this.model.page;
        const title = page === 'years' ? `${this.model.yearStart}–${this.model.yearStart + 11}`
            : page === 'months' ? selected.format('YYYY') : selected.format('MMMM YYYY');
        const titleButton = this.button(header, title, () => { this.model.page = page === 'years' ? 'days' : 'years'; this.render(true); }, 'seam-calendar-title');
        titleButton.setAttribute('aria-label', `${title}: ${page === 'years' ? t().calendarShowDays : t().calendarChooseYear}`);
        titleButton.setAttribute('data-calendar-control', 'title');
        for (const direction of [-1, 1]) {
            if (direction === 1) {
                const today = this.button(header, t().calendarToday, () => {
                    this.model.selected = moment().locale(detectLocale()).startOf('day'); this.model.page = 'days'; this.render(true);
                }, 'seam-calendar-today');
                today.setAttribute('data-calendar-control', 'today');
            }
            const label = direction < 0 ? t().calendarPrevious : t().calendarNext;
            const button = this.button(header, '', () => { this.model.shift(direction); this.render(); }, 'clickable-icon');
            button.setAttribute('aria-label', label);
            button.setAttribute('data-calendar-control', direction < 0 ? 'previous' : 'next');
            setIcon(button, direction < 0 ? 'chevron-left' : 'chevron-right');
        }
        const grid = this.host.createDiv({ cls: `seam-calendar-grid seam-calendar-${page}`, attr: { role: 'grid', 'aria-label': title } });
        if (page === 'days') this.renderDays(grid);
        else this.renderPicker(grid);
        const hint = this.host.createDiv({ cls: 'seam-calendar-hint', text: t().calendarKeyboardHint });
        hint.setAttribute('aria-live', 'polite');
        if (page === 'days') {
            const label = `${this.hasNote ? t().calendarOpenNote : t().calendarCreateNote} · ${selected.format('LL')}`;
            const action = this.button(this.host, label, () => { void this.activate(); }, 'seam-calendar-action');
            action.disabled = this.busy;
            action.setAttribute('data-calendar-control', 'action');
        }
        if (focus || wasCell) this.focusSelected();
        else if (activeControl) this.host.querySelector<HTMLElement>(`[data-calendar-control="${activeControl}"]`)?.focus();
        this.callbacks.changed();
    }

    private renderDays(grid: HTMLElement): void {
        const weekdays = grid.createDiv({ cls: 'seam-calendar-weekdays', attr: { role: 'row' } });
        const start = this.model.selected.clone().startOf('week');
        for (let index = 0; index < 7; index++) {
            const day = start.clone().add(index, 'days');
            weekdays.createSpan({ text: day.format('ddd'), attr: { role: 'columnheader', 'aria-label': day.format('dddd') } });
        }
        const days = this.model.days();
        for (let week = 0; week < 6; week++) {
            const row = grid.createDiv({ cls: 'seam-calendar-week', attr: { role: 'row' } });
            for (const day of days.slice(week * 7, week * 7 + 7)) {
                const hasNote = Boolean(findCalendarNote(this.app, day, this.settings));
                const selected = day.isSame(this.model.selected, 'day');
                const cell = row.createDiv({ attr: { role: 'gridcell', 'aria-selected': String(selected) } });
                const button = this.button(cell, '', () => {
                    if (this.busy) return;
                    this.model.selected = day.clone(); this.render(true);
                    if (hasNote) void this.activate();
                }, 'seam-calendar-day');
                button.setAttribute('data-calendar-cell', day.format('YYYY-MM-DD'));
                button.setAttribute('tabindex', selected ? '0' : '-1');
                button.setAttribute('aria-label', `${day.format('LL')}: ${hasNote ? t().calendarOpenNote : t().calendarCreateNote}`);
                button.toggleClass('is-other-month', !day.isSame(this.model.selected, 'month'));
                button.toggleClass('is-selected', selected);
                if (day.isSame(moment(), 'day')) button.setAttribute('aria-current', 'date');
                button.createSpan({ text: day.format('D') });
                const dots = button.createSpan({ cls: 'seam-calendar-dots', attr: { 'aria-hidden': 'true' } });
                if (hasNote) dots.createSpan({ cls: 'seam-calendar-dot' });
            }
        }
    }

    private renderPicker(grid: HTMLElement): void {
        for (let rowIndex = 0; rowIndex < 4; rowIndex++) {
            const row = grid.createDiv({ cls: 'seam-calendar-picker-row', attr: { role: 'row' } });
            for (let column = 0; column < 3; column++) {
                const index = rowIndex * 3 + column;
                const year = this.model.yearStart + index;
                const years = this.model.page === 'years';
                const label = years ? String(year) : this.model.selected.clone().month(index).format('MMM');
                const selected = years ? year === this.model.selected.year() : index === this.model.selected.month();
                const cell = row.createDiv({ attr: { role: 'gridcell', 'aria-selected': String(selected) } });
                const button = this.button(cell, label, () => {
                    if (years) this.model.chooseYear(year); else this.model.chooseMonth(index);
                    this.render(true);
                }, 'seam-calendar-period');
                button.setAttribute('data-calendar-cell', String(index));
                button.setAttribute('tabindex', selected ? '0' : '-1');
                button.toggleClass('is-selected', selected);
            }
        }
    }

    private async activate(): Promise<void> {
        if (this.busy || this.destroyed || this.picking) return;
        this.busy = true;
        const date = this.model.selected.clone();
        this.render();
        try {
            const file = await resolveCalendarNote(this.app, date, this.settings);
            if (!this.destroyed) await this.callbacks.open(file);
        } catch (error) {
            new Notice(`${t().noticeCreateDailyFailed}: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            this.busy = false;
            if (!this.destroyed) this.render();
        }
    }
}
