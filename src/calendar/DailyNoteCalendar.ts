import { App, Component, Modifier, moment, Notice, Scope, setIcon, TFile } from 'obsidian'
import { DailyNoteSettings, dailyNoteDate } from '../daily/DailyNotes'
import { detectLocale, t } from '../i18n'
import { CalendarPins } from './CalendarPins'
import { CalendarPinModal } from './CalendarPinModal'
import { CalendarPin } from '../types'
import {
  findWeeklyNote,
  resolveWeeklyNote,
  weekKey,
  weekStart,
  WeeklyNoteSettings,
  weeklyNotePath,
} from './WeeklyNotes'
import type { Moment } from 'moment'
import { confirmPeriodicNote } from '../ui/PeriodicNoteConfirmation'
import { dailyNotePath } from '../daily/DailyNotes'
import { CalendarModel, findCalendarNote, resolveCalendarNote } from './CalendarModel'

export type CalendarOpenTarget = false | 'tab' | 'split'

interface CalendarCallbacks {
  changed: () => void
  open: (file: TFile, target: CalendarOpenTarget) => Promise<void>
}

/** A scoped, disposable calendar using native buttons and a roving grid focus. */
export class DailyNoteCalendar extends Component {
  readonly model: CalendarModel
  private destroyed = false
  private busy = false
  private navigationScope: Scope
  private scopeActive = false
  private noteActions = new Map<string, (target: CalendarOpenTarget) => void>()

  constructor(
    private app: App,
    readonly host: HTMLElement,
    private input: HTMLInputElement,
    private settings: DailyNoteSettings,
    private callbacks: CalendarCallbacks,
    parentScope: Scope,
    private pins: CalendarPins | undefined,
    private weekly: WeeklyNoteSettings,
    private askBeforeCreation = true,
  ) {
    super()
    const file = app.workspace.getActiveFile()
    this.pins?.setWeeklySettings(weekly)
    this.model = new CalendarModel(
      file ? (dailyNoteDate(file, settings) ?? moment()) : moment(),
      detectLocale(),
      weekly.iso,
    )
    this.navigationScope = new Scope(parentScope)
    for (const key of [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'PageUp',
      'PageDown',
      'Home',
      'End',
      'Enter',
      ' ',
    ]) {
      this.navigationScope.register([], key, (event) => (this.handleKey(event) ? false : true))
    }
    for (const key of ['PageUp', 'PageDown']) {
      this.navigationScope.register(['Shift'], key, (event) =>
        this.handleKey(event) ? false : true,
      )
    }
    const openingModifiers: Modifier[][] = [['Mod'], ['Shift'], ['Mod', 'Shift']]
    for (const modifiers of openingModifiers) {
      this.navigationScope.register(modifiers, 'Enter', (event) =>
        this.handleKey(event) ? false : true,
      )
    }
    this.navigationScope.register([], 'Escape', (event) => {
      this.consume(event)
      this.exitNavigation()
      return false
    })
  }

  get hasNote(): boolean {
    return Boolean(findCalendarNote(this.app, this.model.selected, this.settings))
  }
  get picking(): boolean {
    return this.model.page !== 'days'
  }
  get navigationActive(): boolean {
    return this.scopeActive
  }
  get openingAction(): 'open' | 'create' | null {
    const active = this.host.ownerDocument.activeElement
    if (active && this.host.contains(active) && active.matches('[data-calendar-control]')) {
      const action = active.getAttribute('data-calendar-action')
      return action === 'open' || action === 'create' ? action : null
    }
    return this.picking ? null : this.hasNote ? 'open' : 'create'
  }
  get footerAction(): string {
    const active = this.host.ownerDocument.activeElement
    const action =
      active && this.host.contains(active) ? active.getAttribute('data-calendar-action') : null
    if (action === 'open') return t().paletteHelpOpen
    if (action === 'create') return t().paletteHelpCreate
    if (action === 'pin') return t().calendarHelpPin
    if (action === 'unpin') return t().calendarHelpUnpin
    if (action === 'select') return t().paletteHelpSelect
    return this.picking
      ? t().paletteHelpSelect
      : this.hasNote
        ? t().paletteHelpOpen
        : t().paletteHelpCreate
  }
  private now(): Moment {
    return moment().locale(detectLocale())
  }
  private weekRange(date: Moment): string {
    const start = weekStart(date, this.weekly)
    const end = start.clone().add(6, 'days')
    return `${start.format(start.isSame(end, 'month') ? 'D' : start.year() === end.year() ? 'D MMM' : 'D MMM YYYY')} – ${end.format('D MMM YYYY')}`
  }

  onload(): void {
    this.registerDomEvent(this.host, 'focusin', () => {
      if (!this.scopeActive) {
        this.app.keymap.pushScope(this.navigationScope)
        this.scopeActive = true
      }
      this.callbacks.changed()
    })
    this.registerDomEvent(this.host, 'focusout', (event) => {
      const next = event.relatedTarget as Node | null
      if (next && !this.host.contains(next)) this.exitNavigation(false)
    })
    this.registerDomEvent(this.input, 'focus', () => {
      this.exitNavigation(false)
      this.callbacks.changed()
    })
    this.render()
    const refresh = (): void => {
      if (!this.busy) this.render()
    }
    this.registerEvent(this.app.vault.on('create', refresh))
    this.registerEvent(this.app.vault.on('delete', refresh))
    this.registerEvent(this.app.vault.on('rename', refresh))
    if (this.pins) {
      this.register(this.pins.subscribe(() => this.render()))
      void this.pins.reconcile().catch((error: unknown) => this.report(error))
    }
    let day = this.now().format('YYYY-MM-DD')
    const checkDay = (): void => {
      const current = this.now().format('YYYY-MM-DD')
      if (current !== day) {
        day = current
        this.render()
      }
    }
    this.registerInterval(window.setInterval(checkDay, 30000))
    this.registerDomEvent(this.host.ownerDocument, 'visibilitychange', checkDay)
  }

  onunload(): void {
    this.destroyed = true
    this.noteActions.clear()
    this.exitNavigation(false)
    this.host.remove()
  }

  private exitNavigation(focusInput = true): void {
    if (this.scopeActive) {
      this.app.keymap.popScope(this.navigationScope)
      this.scopeActive = false
    }
    if (focusInput) this.input.focus()
  }

  /** Capture before SuggestModal's default handlers so Escape first leaves the grid. */
  handleKey(event: KeyboardEvent): boolean {
    const target = event.target as Node | null
    const inCalendar = Boolean(target && this.host.contains(target))
    if (event.isComposing || event.altKey) return false
    if ((event.ctrlKey || event.metaKey) && event.key !== 'Enter') return false
    const modified = event.ctrlKey || event.metaKey || event.shiftKey
    const openTarget: CalendarOpenTarget = event.shiftKey
      ? 'split'
      : event.metaKey || event.ctrlKey
        ? 'tab'
        : false
    if (target === this.input) {
      if (modified && event.key !== 'Enter') return false
      if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
        this.consume(event)
        if (event.key === 'Enter' && !this.picking) void this.activate(openTarget)
        else if (!modified) this.focusSelected()
        return true
      }
      return false
    }
    if (!inCalendar) return false
    if (event.key === 'Escape') {
      this.consume(event)
      this.exitNavigation()
      return true
    }
    const element = target?.instanceOf(HTMLElement) ? target : null
    if (
      element?.matches('button[data-calendar-control]') &&
      (event.key === 'Enter' || event.key === ' ')
    ) {
      this.consume(event)
      if (modified) {
        const id = element.getAttribute('data-calendar-control') ?? ''
        const action = element.getAttribute('data-calendar-action')
        if (event.key === 'Enter' && (action === 'open' || action === 'create'))
          this.noteActions.get(id)?.(openTarget)
      } else element.click()
      return true
    }
    if (!element?.matches('[data-calendar-cell]')) return false
    if (event.key === 'Enter' || event.key === ' ') {
      this.consume(event)
      if (modified && (this.picking || event.key !== 'Enter')) return true
      if (this.model.page === 'years') {
        this.model.chooseYear(this.model.selected.year())
        this.render(true)
      } else if (this.model.page === 'months') {
        this.model.chooseMonth(this.model.selected.month())
        this.render(true)
      } else void this.activate(openTarget)
      return true
    }
    if (
      ![
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'PageUp',
        'PageDown',
        'Home',
        'End',
      ].includes(event.key)
    )
      return false
    this.consume(event)
    if (this.busy) return true
    this.model.move(event.key, event.shiftKey)
    this.render(true)
    return true
  }

  private consume(event: KeyboardEvent): void {
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  private focusSelected(): void {
    this.host.querySelector<HTMLElement>('[data-calendar-cell][tabindex="0"]')?.focus()
  }

  private button(
    parent: HTMLElement,
    label: string,
    action: () => void,
    cls = '',
  ): HTMLButtonElement {
    const button = parent.createEl('button', { cls, text: label, attr: { type: 'button' } })
    button.addEventListener('click', action)
    return button
  }

  private render(focus = false): void {
    if (this.destroyed) return
    const active = this.host.ownerDocument.activeElement
    const activeControl = active?.getAttribute('data-calendar-control')
    const wasCell = active?.hasAttribute('data-calendar-cell')
    this.noteActions.clear()
    this.host.empty()
    this.renderPins()
    const body = this.host.createDiv({ cls: 'seam-calendar-scroll' })
    const header = body.createDiv({ cls: 'seam-calendar-header' })
    const selected = this.model.selected
    const page = this.model.page
    const title =
      page === 'years'
        ? `${this.model.yearStart}–${this.model.yearStart + 11}`
        : page === 'months'
          ? selected.format('YYYY')
          : selected.format('MMMM YYYY')
    const titleButton = this.button(
      header,
      title,
      () => {
        this.model.page = page === 'years' ? 'days' : 'years'
        this.render(true)
      },
      'seam-calendar-title',
    )
    titleButton.setAttribute(
      'aria-label',
      `${title}: ${page === 'years' ? t().calendarShowDays : t().calendarChooseYear}`,
    )
    this.control(titleButton, 'title', 'select')
    for (const direction of [-1, 1]) {
      if (direction === 1) {
        const today = this.button(
          header,
          t().calendarToday,
          () => {
            this.model.selected = moment().locale(detectLocale()).startOf('day')
            this.model.page = 'days'
            this.render(true)
          },
          'seam-calendar-today',
        )
        this.control(today, 'today', 'select')
      }
      const label = direction < 0 ? t().calendarPrevious : t().calendarNext
      const button = this.button(
        header,
        '',
        () => {
          this.model.shift(direction)
          this.render()
        },
        'clickable-icon',
      )
      button.setAttribute('aria-label', label)
      this.control(button, direction < 0 ? 'previous' : 'next', 'select')
      setIcon(button, direction < 0 ? 'chevron-left' : 'chevron-right')
    }
    const grid = body.createDiv({
      cls: `seam-calendar-grid seam-calendar-${page}`,
      attr: { role: 'grid', 'aria-label': title },
    })
    if (page === 'days') this.renderDays(grid)
    else this.renderPicker(grid)
    const hint = body.createDiv({ cls: 'seam-calendar-hint', text: t().calendarKeyboardHint })
    hint.setAttribute('aria-live', 'polite')
    if (page === 'days') {
      const label = `${this.hasNote ? t().calendarOpenNote : t().calendarCreateNote} · ${selected.format('LL')}`
      const action = this.button(
        body,
        label,
        () => {
          void this.activate()
        },
        'seam-calendar-action',
      )
      action.disabled = this.busy
      this.control(action, 'action', this.hasNote ? 'open' : 'create')
      this.noteActions.set('action', (target) => {
        void this.activate(target)
      })
      this.renderWeeklyAction(body)
    }
    if (focus || wasCell) this.focusSelected()
    else if (activeControl) {
      const previous = Array.from(
        this.host.querySelectorAll<HTMLElement>('[data-calendar-control]'),
      ).find((element) => element.getAttribute('data-calendar-control') === activeControl)
      if (previous && !previous.matches(':disabled')) previous.focus()
      else this.input.focus()
    }
    this.callbacks.changed()
  }

  private control(button: HTMLButtonElement, id: string, action: string): void {
    button.setAttribute('data-calendar-control', id)
    button.setAttribute('data-calendar-action', action)
  }
  private report(error: unknown): void {
    new Notice(
      `${t().calendarActionFailed}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  private async perform(action: () => Promise<void>): Promise<void> {
    if (this.busy || this.destroyed) return
    this.busy = true
    try {
      await action()
    } catch (error) {
      this.report(error)
    } finally {
      this.busy = false
      if (!this.destroyed) this.render()
    }
  }

  private renderPins(): void {
    if (!this.pins) return
    const pins = this.pins
    const shelf = this.host.createDiv({
      cls: 'seam-calendar-pins',
      attr: { 'aria-label': t().calendarPinnedHeading },
    })
    const heading = shelf.createDiv({ cls: 'seam-calendar-pins-heading' })
    heading.createSpan({ text: `${t().calendarPinnedHeading} · ${pins.pins.length}/3` })
    const add = this.button(heading, t().calendarAddPin, () =>
      new CalendarPinModal(this.app, pins).open(),
    )
    this.control(add, 'add-pin', 'select')
    add.disabled = pins.full
    for (const pin of pins.pins) {
      const now = this.now()
      const path = pin.kind === 'file' ? pin.path : pins.weeklyTarget(pin, this.weekly, now)
      const file = this.app.vault.getAbstractFileByPath(path)
      const exists = file instanceof TFile
      const row = shelf.createDiv({ cls: 'seam-calendar-pin-row' })
      const label =
        pin.kind === 'weekly'
          ? `${t().calendarThisWeek} · ${this.weekRange(now)}`
          : file instanceof TFile
            ? file.basename
            : path
      const open = this.button(
        row,
        label,
        () => {
          void this.openPin(pin)
        },
        'seam-calendar-pin-open',
      )
      this.control(
        open,
        `open-pin-${pin.kind === 'file' ? pin.path : 'weekly'}`,
        exists ? 'open' : pin.kind === 'weekly' ? 'create' : 'select',
      )
      this.noteActions.set(`open-pin-${pin.kind === 'file' ? pin.path : 'weekly'}`, (target) => {
        void this.openPin(pin, target)
      })
      open.setAttribute(
        'aria-label',
        `${label}: ${pin.kind === 'weekly' && !exists ? t().calendarCreateWeekly : path}`,
      )
      if (pin.kind === 'weekly' && !exists)
        open.createEl('small', { text: t().calendarCreateWeekly })
      const unpin = this.button(
        row,
        '',
        () => {
          void this.perform(() => pins.unpin(pin))
        },
        'clickable-icon',
      )
      unpin.setAttribute('aria-label', `${t().calendarUnpin}: ${label}`)
      this.control(unpin, `unpin-${pin.kind === 'file' ? pin.path : 'weekly'}`, 'unpin')
      setIcon(unpin, 'pin-off')
    }
  }
  private async openPin(pin: CalendarPin, target: CalendarOpenTarget = false): Promise<void> {
    await this.perform(async () => {
      if (!this.pins) return
      const now = this.now()
      const path = pin.kind === 'file' ? pin.path : this.pins.weeklyTarget(pin, this.weekly, now)
      let file = this.app.vault.getAbstractFileByPath(path)
      if (!(file instanceof TFile) && pin.kind === 'weekly') {
        if (!(await confirmPeriodicNote(this.app, path, this.askBeforeCreation)) || this.destroyed)
          return
        file = await resolveWeeklyNote(this.app, now, this.weekly)
      }
      if (!(file instanceof TFile)) {
        await this.pins.reconcile()
        throw new Error(t().calendarPinUnavailable)
      }
      if (!this.destroyed) await this.callbacks.open(file, target)
    })
  }
  private renderWeeklyAction(parent: HTMLElement): void {
    const currentWeek =
      weekKey(this.model.selected, this.weekly) === weekKey(this.now(), this.weekly)
    if (currentWeek && this.pins?.rolling) return
    const file = findWeeklyNote(this.app, this.model.selected, this.weekly)
    const row = parent.createDiv({ cls: 'seam-calendar-weekly-action' })
    const open = this.button(
      row,
      `${file ? t().calendarOpenWeekly : t().calendarCreateWeekly} · ${this.weekRange(this.model.selected)}`,
      () => {
        void this.openWeekly()
      },
      'seam-calendar-action',
    )
    this.control(open, 'weekly-action', file ? 'open' : 'create')
    this.noteActions.set('weekly-action', (target) => {
      void this.openWeekly(target)
    })
    open.disabled = this.busy
    if (!this.pins) return
    const pins = this.pins
    if (currentWeek || file) {
      const pinned = file ? pins.hasFile(file.path) : false
      const pin = this.button(
        row,
        '',
        () => {
          void this.perform(async () => {
            if (currentWeek) await pins.pinWeek(this.weekly)
            else if (file) {
              const existing = pins.pins.find(
                (item) => item.kind === 'file' && item.path === file.path,
              )
              if (existing) await pins.unpin(existing)
              else await pins.pinFile(file)
            }
          })
        },
        'clickable-icon',
      )
      pin.disabled = pins.full && !pinned
      pin.setAttribute(
        'aria-label',
        currentWeek ? t().calendarKeepWeekPinned : pinned ? t().calendarUnpin : t().calendarHelpPin,
      )
      this.control(pin, 'weekly-pin', pinned && !currentWeek ? 'unpin' : 'pin')
      setIcon(pin, pinned && !currentWeek ? 'pin-off' : 'pin')
    }
  }

  private async openWeekly(target: CalendarOpenTarget = false): Promise<void> {
    const date = this.model.selected.clone()
    await this.perform(async () => {
      if (
        !(await confirmPeriodicNote(
          this.app,
          weeklyNotePath(date, this.weekly),
          this.askBeforeCreation,
        )) ||
        this.destroyed
      )
        return
      const file = await resolveWeeklyNote(this.app, date, this.weekly)
      if (!this.destroyed) await this.callbacks.open(file, target)
    })
  }

  private renderDays(grid: HTMLElement): void {
    const weekdays = grid.createDiv({ cls: 'seam-calendar-weekdays', attr: { role: 'row' } })
    const start = this.model.selected.clone().startOf(this.weekly.iso ? 'isoWeek' : 'week')
    for (let index = 0; index < 7; index++) {
      const day = start.clone().add(index, 'days')
      weekdays.createSpan({
        text: day.format('ddd'),
        attr: { role: 'columnheader', 'aria-label': day.format('dddd') },
      })
    }
    const days = this.model.days()
    for (let week = 0; week < 6; week++) {
      const row = grid.createDiv({ cls: 'seam-calendar-week', attr: { role: 'row' } })
      for (const day of days.slice(week * 7, week * 7 + 7)) {
        const hasNote = Boolean(findCalendarNote(this.app, day, this.settings))
        const selected = day.isSame(this.model.selected, 'day')
        const cell = row.createDiv({
          attr: { role: 'gridcell', 'aria-selected': String(selected) },
        })
        const button = this.button(
          cell,
          '',
          () => {
            if (this.busy) return
            this.model.selected = day.clone()
            this.render(true)
            if (hasNote) void this.activate()
          },
          'seam-calendar-day',
        )
        button.setAttribute('data-calendar-cell', day.format('YYYY-MM-DD'))
        button.setAttribute('tabindex', selected ? '0' : '-1')
        button.setAttribute(
          'aria-label',
          `${day.format('LL')}: ${hasNote ? t().calendarOpenNote : t().calendarCreateNote}`,
        )
        button.toggleClass('is-other-month', !day.isSame(this.model.selected, 'month'))
        button.toggleClass('is-selected', selected)
        if (day.isSame(moment(), 'day')) button.setAttribute('aria-current', 'date')
        button.createSpan({ text: day.format('D') })
        const dots = button.createSpan({
          cls: 'seam-calendar-dots',
          attr: { 'aria-hidden': 'true' },
        })
        if (hasNote) dots.createSpan({ cls: 'seam-calendar-dot' })
      }
    }
  }

  private renderPicker(grid: HTMLElement): void {
    for (let rowIndex = 0; rowIndex < 4; rowIndex++) {
      const row = grid.createDiv({ cls: 'seam-calendar-picker-row', attr: { role: 'row' } })
      for (let column = 0; column < 3; column++) {
        const index = rowIndex * 3 + column
        const year = this.model.yearStart + index
        const years = this.model.page === 'years'
        const label = years ? String(year) : this.model.selected.clone().month(index).format('MMM')
        const selected = years
          ? year === this.model.selected.year()
          : index === this.model.selected.month()
        const cell = row.createDiv({
          attr: { role: 'gridcell', 'aria-selected': String(selected) },
        })
        const button = this.button(
          cell,
          label,
          () => {
            if (years) this.model.chooseYear(year)
            else this.model.chooseMonth(index)
            this.render(true)
          },
          'seam-calendar-period',
        )
        button.setAttribute('data-calendar-cell', String(index))
        button.setAttribute('tabindex', selected ? '0' : '-1')
        button.toggleClass('is-selected', selected)
      }
    }
  }

  private async activate(target: CalendarOpenTarget = false): Promise<void> {
    if (this.busy || this.destroyed || this.picking) return
    this.busy = true
    const date = this.model.selected.clone()
    this.render()
    try {
      if (
        !(await confirmPeriodicNote(
          this.app,
          dailyNotePath(date, this.settings),
          this.askBeforeCreation,
        )) ||
        this.destroyed
      )
        return
      const file = await resolveCalendarNote(this.app, date, this.settings)
      if (!this.destroyed) await this.callbacks.open(file, target)
    } catch (error) {
      this.report(error)
    } finally {
      this.busy = false
      if (!this.destroyed) this.render()
    }
  }
}
