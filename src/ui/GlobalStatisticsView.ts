import { App, Notice, setTooltip, TFile } from 'obsidian'
import { detectLocale, t } from '../i18n'
import { GlobalStatistics } from '../statistics/GlobalStatistics'
import { activityTotals, localDay } from '../statistics/WritingActivity'
import {
  ContributionMetric,
  ContributionPeriod,
  contribution,
  contributionWeeks,
  intensity,
  monthlyTrends,
  monthlyChartScale,
  overviewInsights,
  TrendMetric,
} from '../statistics/GlobalStatisticsModel'

/** An owned dashboard inside the Palette report region. Native controls remain keyboard/touch accessible. */
export class GlobalStatisticsView {
  private metric: ContributionMetric = 'words'
  private period: ContributionPeriod = 'year'
  private trend: TrendMetric = 'words'
  private selectedDay: string | null = null
  private focusDay = localDay()
  private unsubscribe: () => void
  private dayTimer: number
  private lastDay = localDay()
  private days: string[] = []
  constructor(
    private app: App,
    private host: HTMLElement,
    private statistics: GlobalStatistics,
    private open: (file: TFile) => Promise<void>,
  ) {
    this.unsubscribe = statistics.subscribe(() => this.render())
    this.dayTimer = window.setInterval(() => {
      const day = localDay()
      if (day !== this.lastDay) {
        this.lastDay = day
        this.render()
      }
    }, 30000)
    this.render()
  }
  destroy(): void {
    this.unsubscribe()
    window.clearInterval(this.dayTimer)
  }
  /** Capture report controls before SuggestModal can route keys to its hidden chooser. */
  handleKey(event: KeyboardEvent): boolean {
    const target = event.target as Node | null
    if (
      !target?.instanceOf(HTMLElement) ||
      !this.host.contains(target) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return false
    if (target.matches('[role="radio"]')) {
      const buttons = Array.from(
        target.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [],
      )
      const delta = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1 }[event.key]
      if (buttons.length && (delta !== undefined || event.key === 'Home' || event.key === 'End')) {
        event.preventDefault()
        event.stopImmediatePropagation()
        const index =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : (buttons.indexOf(target as HTMLButtonElement) + (delta ?? 0) + buttons.length) %
                buttons.length
        buttons[index].focus()
        buttons[index].click()
        return true
      }
    }
    if (target.instanceOf(HTMLButtonElement) && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!target.disabled) target.click()
      return true
    }
    const day = target.getAttribute('data-day')
    const index = day ? this.days.indexOf(day) : -1
    const delta = {
      ArrowUp: -1,
      ArrowDown: 1,
      ArrowLeft: -7,
      ArrowRight: 7,
      Home: -(index % 7),
      End: 6 - (index % 7),
    }[event.key]
    if (index < 0 || delta === undefined) return false
    event.preventDefault()
    event.stopImmediatePropagation()
    const next = this.days[Math.max(0, Math.min(this.days.length - 1, index + delta))]
    this.host.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus()
    return true
  }
  private chips<T extends string>(
    parent: HTMLElement,
    label: string,
    key: string,
    value: T,
    options: [T, string, string][],
    changed: (value: T) => void,
  ): void {
    const group = parent.createDiv({
      cls: 'seam-global-chips',
      attr: { role: 'radiogroup', 'aria-label': label, 'data-chip-group': key },
    })
    for (const [id, text, accessibleLabel] of options) {
      const selected = id === value
      const button = group.createEl('button', {
        cls: 'seam-global-chip',
        text,
        attr: {
          type: 'button',
          role: 'radio',
          'data-focus-key': `${key}-${id}`,
          'data-chip-value': id,
          'aria-label': accessibleLabel,
          'aria-checked': String(selected),
          tabindex: selected ? '0' : '-1',
        },
      })
      button.addEventListener('click', () => {
        if (id !== value) {
          changed(id)
          this.render()
        }
      })
    }
  }
  private render(): void {
    const active = this.host.ownerDocument.activeElement
    const focusKey =
      active && this.host.contains(active) ? active.getAttribute('data-focus-key') : null
    const scrollLeft = this.host.querySelector('.seam-global-heatmap-scroll')?.scrollLeft
    const scrollTop = this.host.scrollTop
    const snapshot = this.statistics.snapshot()
    const today = localDay()
    const state = snapshot.activity
    const number = new Intl.NumberFormat(detectLocale())
    const dateFormat = new Intl.DateTimeFormat(detectLocale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      weekday: 'long',
    })
    const monthFormat = new Intl.DateTimeFormat(detectLocale(), { month: 'short' })
    const formatDay = (day: string): string => dateFormat.format(new Date(`${day}T12:00:00`))
    this.host.empty()
    this.host.addClass('seam-global-statistics')
    const header = this.host.createEl('header', { cls: 'seam-note-statistics-header' })
    const titleLine = header.createDiv({ cls: 'seam-global-title-line' })
    titleLine.createEl('h2', { text: t().globalTitle })
    this.chips(
      titleLine,
      t().globalPeriod,
      'contribution-period',
      this.period,
      [
        ['year', t().globalYear, t().globalYear],
        ['quarter', t().globalQuarter, t().globalQuarter],
      ],
      (value) => {
        this.period = value
      },
    )
    header.createEl('p', { cls: 'seam-global-description', text: t().globalDescription })
    if (snapshot.error || snapshot.saveError) {
      const warning = this.host.createDiv({ cls: 'seam-global-warning', attr: { role: 'status' } })
      warning.createSpan({ text: snapshot.saveError ? t().globalSaveFailed : t().globalLoadFailed })
      const retry = warning.createEl('button', {
        text: t().calendarRetry,
        attr: { 'data-focus-key': 'retry' },
      })
      retry.addEventListener('click', () => {
        void this.statistics.initialize().then(() => this.statistics.flush())
      })
    }
    const overview = this.host.createEl('dl', {
      cls: 'seam-global-overview',
      attr: { 'aria-label': t().globalOverview },
    })
    const totals = activityTotals(state, today)
    const insights = overviewInsights(state, today)
    const percent = new Intl.NumberFormat(detectLocale(), {
      style: 'percent',
      maximumFractionDigits: 1,
      signDisplay: 'exceptZero',
    })
    const yearPercent = new Intl.NumberFormat(detectLocale(), {
      style: 'percent',
      maximumFractionDigits: 0,
    })
    const ready = !snapshot.loading && !snapshot.error
    for (const [key, label, value, insight] of [
      [
        'words',
        t().globalTotalWords,
        ready ? number.format(snapshot.totalWords) : '—',
        insights.monthlyWordChange === null
          ? t().globalNoMonthBaseline
          : t().globalWordsMonthChange(percent.format(insights.monthlyWordChange)),
      ],
      [
        'notes',
        t().globalTotalNotes,
        snapshot.loading ? '—' : number.format(snapshot.totalNotes),
        t().globalNotesThisMonth(number.format(insights.monthlyNotes)),
      ],
      [
        'days',
        t().globalActiveDays,
        ready ? number.format(totals.activeDays) : '—',
        t().globalActiveYear(yearPercent.format(insights.activeYearPercent)),
      ],
      [
        'streak',
        t().globalStreak,
        ready ? number.format(totals.streak) : '—',
        t().globalLongestStreak(number.format(insights.longestStreak)),
      ],
    ]) {
      const card = overview.createDiv({
        cls: 'seam-global-overview-card',
        attr: { 'data-global-metric': key },
      })
      card.createEl('dt', { text: label })
      card.createEl('dd', { text: value })
      if (ready) card.createEl('dd', { cls: 'seam-global-overview-insight', text: insight })
    }
    const contributions = this.host.createEl('section', {
      cls: 'seam-global-section',
      attr: { 'aria-label': t().globalContributions },
    })
    const activityHeader = contributions.createDiv({ cls: 'seam-global-section-header' })
    activityHeader.createEl('h3', { text: t().globalContributions })
    this.chips(
      activityHeader,
      t().globalMetric,
      'contribution-metric',
      this.metric,
      [
        ['words', t().globalChipWords, t().globalWordsWritten],
        ['notes', t().globalChipNotes, t().globalNotesEdited],
        ['sessions', t().globalChipActivity, t().globalWritingActivity],
      ],
      (value) => {
        this.metric = value
      },
    )
    const weeks = contributionWeeks(today, this.period)
    const days = weeks.flat().filter((day): day is string => day !== null)
    this.days = days
    if (!days.includes(this.focusDay)) this.focusDay = today
    const max = Math.max(0, ...days.map((day) => contribution(state, day, this.metric)))
    const activityGrid = contributions.createDiv({ cls: 'seam-global-activity-grid' })
    const weekdays = activityGrid.createDiv({
      cls: 'seam-global-week seam-global-weekdays',
      attr: { 'aria-hidden': 'true' },
    })
    weekdays.createSpan({ cls: 'seam-global-month-label' })
    const weekdayFormat = new Intl.DateTimeFormat(detectLocale(), { weekday: 'short' })
    for (let i = 0; i < 7; i++)
      weekdays.createSpan({
        cls: 'seam-global-weekday',
        text: i % 2 === 1 ? weekdayFormat.format(new Date(2026, 0, 4 + i)) : '',
      })
    const scroll = activityGrid.createDiv({ cls: 'seam-global-heatmap-scroll' })
    const heatmap = scroll.createDiv({
      cls: 'seam-global-heatmap',
      attr: { 'aria-label': t().globalContributions },
    })
    let previousMonth = ''
    for (const week of weeks) {
      const column = heatmap.createDiv({ cls: 'seam-global-week' })
      const month =
        week.find((day) => day?.slice(8) === '01')?.slice(0, 7) ??
        (previousMonth ? '' : (week[0]?.slice(0, 7) ?? ''))
      column.createSpan({
        cls: 'seam-global-month-label',
        text:
          month && month !== previousMonth
            ? monthFormat.format(new Date(`${month}-01T12:00:00`))
            : '',
        attr: { 'aria-hidden': 'true' },
      })
      if (month) previousMonth = month
      for (const day of week) {
        if (!day) {
          column.createSpan({ cls: 'seam-global-day-placeholder', attr: { 'aria-hidden': 'true' } })
          continue
        }
        const notes = state.days[day] ?? {}
        const words = contribution(state, day, 'words')
        const sessions = contribution(state, day, 'sessions')
        const label = `${formatDay(day)} · ${day < state.startedAt ? t().globalUntracked : t().globalDaySummary(number.format(words), number.format(Object.keys(notes).length), number.format(sessions))}`
        const button = column.createEl('button', {
          cls: 'seam-global-day',
          attr: {
            type: 'button',
            'data-day': day,
            'data-level': String(intensity(contribution(state, day, this.metric), max)),
            'data-focus-key': `day-${day}`,
            'aria-label': label,
            'aria-pressed': String(day === this.selectedDay),
            tabindex: day === this.focusDay ? '0' : '-1',
          },
        })
        setTooltip(button, label, { placement: 'top' })
        button.addEventListener('focus', () => {
          this.focusDay = day
          heatmap.querySelectorAll<HTMLButtonElement>('.seam-global-day').forEach((cell) => {
            cell.tabIndex = cell === button ? 0 : -1
          })
        })
        button.addEventListener('click', () => {
          this.selectedDay = this.selectedDay === day ? null : day
          this.focusDay = day
          this.render()
        })
      }
    }
    scroll.scrollLeft = scrollLeft ?? scroll.scrollWidth
    const legend = contributions.createDiv({
      cls: 'seam-global-legend',
      attr: { 'aria-label': t().globalIntensityLegend },
    })
    legend.createSpan({ text: t().globalLess })
    for (let level = 0; level <= 4; level++)
      legend.createSpan({
        cls: 'seam-global-day',
        attr: { 'data-level': String(level), 'aria-hidden': 'true' },
      })
    legend.createSpan({ text: t().globalMore })
    const status = contributions.createEl('p', {
      cls: 'seam-global-description',
      text: snapshot.loading
        ? t().statisticsLoading
        : totals.activeDays
          ? t().globalTrackingSince(formatDay(state.startedAt))
          : t().globalEmpty,
    })
    status.setAttribute('role', 'status')
    const detail = contributions.createDiv({
      cls: 'seam-global-day-detail',
      attr: { 'aria-label': t().globalDayDetails },
    })
    detail.hidden = this.selectedDay === null
    detail.createEl('h4', {
      text: this.selectedDay ? formatDay(this.selectedDay) : t().globalChooseDay,
    })
    if (this.selectedDay) {
      const notes = state.days[this.selectedDay] ?? {}
      if (!Object.keys(notes).length)
        detail.createEl('p', {
          cls: 'seam-global-description',
          text: this.selectedDay < state.startedAt ? t().globalUntracked : t().globalDayEmpty,
        })
      else
        for (const [id, activity] of Object.entries(notes).sort(
          (a, b) => b[1].words - a[1].words,
        )) {
          const note = state.notes[id]
          const file =
            note && !note.deleted ? this.app.vault.getAbstractFileByPath(note.path) : null
          const row = detail.createDiv({ cls: 'seam-global-note-row' })
          const button = row.createEl('button', {
            cls: 'seam-global-note-open',
            text: file instanceof TFile ? file.basename : (note?.path ?? t().globalUnavailable),
            attr: { 'data-focus-key': `note-${id}` },
          })
          button.disabled = !(file instanceof TFile)
          if (note) setTooltip(button, note.path, { placement: 'top' })
          if (file instanceof TFile)
            button.addEventListener('click', () => {
              void this.open(file).catch(() => new Notice(t().globalOpenFailed))
            })
          row.createSpan({
            cls: 'seam-global-description',
            text: t().globalWordContribution(number.format(activity.words)),
          })
        }
    }
    const trends = this.host.createEl('section', {
      cls: 'seam-global-section',
      attr: { 'aria-label': t().globalTrends },
    })
    const trendHeader = trends.createDiv({ cls: 'seam-global-section-header' })
    trendHeader.createEl('h3', { text: t().globalTrends })
    trendHeader.createSpan({ cls: 'seam-global-description', text: t().globalLastSixMonths })
    const trendControls = trends.createDiv({ cls: 'seam-global-chart-controls' })
    this.chips(
      trendControls,
      t().globalMetric,
      'trend-metric',
      this.trend,
      [
        ['words', t().globalChipWords, t().globalWordsWritten],
        ['created', t().globalChipNotes, t().globalNotesCreated],
      ],
      (value) => {
        this.trend = value
      },
    )
    const months = monthlyTrends(state, today, this.trend)
    const scale = monthlyChartScale(months.map((month) => month.value))
    const compact = new Intl.NumberFormat(detectLocale(), {
      notation: 'compact',
      maximumFractionDigits: 1,
    })
    const fullMonth = new Intl.DateTimeFormat(detectLocale(), { month: 'long', year: 'numeric' })
    const chart = trends.createDiv({
      cls: 'seam-global-monthly-chart',
      attr: { role: 'group', 'aria-label': t().globalTrends },
    })
    const axis = chart.createDiv({ cls: 'seam-global-chart-axis', attr: { 'aria-hidden': 'true' } })
    for (const tick of scale.ticks) axis.createSpan({ text: compact.format(tick) })
    const plot = chart.createDiv({ cls: 'seam-global-chart-plot' })
    const grid = plot.createDiv({ cls: 'seam-global-chart-grid', attr: { 'aria-hidden': 'true' } })
    scale.ticks.forEach(() => grid.createDiv({ cls: 'seam-global-chart-grid-line' }))
    const bars = plot.createDiv({ cls: 'seam-global-chart-bars' })
    chart.createDiv({ attr: { 'aria-hidden': 'true' } })
    const labels = chart.createDiv({ cls: 'seam-global-chart-months' })
    months.forEach((month, index) => {
      const date = new Date(`${month.month}-01T12:00:00`)
      const description = `${fullMonth.format(date)} · ${number.format(month.value)} ${this.trend === 'words' ? t().globalWordsWritten.toLowerCase() : t().globalNotesCreated.toLowerCase()}`
      const column = bars.createDiv({
        cls: 'seam-global-month-bar',
        attr: {
          role: 'button',
          tabindex: '0',
          'aria-label': description,
          'aria-pressed': 'false',
          'data-chart-month': month.month,
          'data-chart-value': String(month.value),
        },
      })
      setTooltip(column, description, { placement: 'top' })
      const value = column.createDiv({ cls: 'seam-global-bar-popover', text: description })
      value.style.bottom = `${scale.heights[index]}%`
      const toggle = (): void => {
        const selected = column.classList.contains('is-selected')
        bars.querySelectorAll('.seam-global-month-bar').forEach((bar) => {
          bar.classList.remove('is-selected')
          bar.setAttribute('aria-pressed', 'false')
        })
        if (!selected) {
          column.classList.add('is-selected')
          column.setAttribute('aria-pressed', 'true')
        }
      }
      column.addEventListener('click', toggle)
      column.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          toggle()
        }
      })
      const svg = column.createSvg('svg', {
        attr: { viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      })
      svg.createSvg('rect', {
        cls: 'seam-global-month-bar-fill',
        attr: {
          x: '8',
          width: '84',
          y: String(100 - scale.heights[index]),
          height: String(scale.heights[index]),
          rx: '5',
          ry: '3',
        },
      })
      const label = labels.createDiv({ cls: 'seam-global-chart-month' })
      label.createSpan({ text: monthFormat.format(date) })
      label.createSpan({ cls: 'seam-global-trend-value', text: compact.format(month.value) })
    })
    this.host.scrollTop = scrollTop
    if (focusKey)
      Array.from(this.host.querySelectorAll<HTMLElement>('[data-focus-key]'))
        .find((element) => element.getAttribute('data-focus-key') === focusKey)
        ?.focus({ preventScroll: true })
  }
}
