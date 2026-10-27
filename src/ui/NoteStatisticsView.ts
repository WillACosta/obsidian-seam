import { setIcon } from 'obsidian'
import { detectLocale, t } from '../i18n'
import { NoteStatistics } from '../statistics/NoteStatistics'

/** Static report content inside the Universal Palette, without selectable suggestions. */
export function renderNoteStatistics(
  container: HTMLElement,
  report: NoteStatistics,
  showIcons: boolean,
): void {
  container.empty()
  const header = container.createEl('header', { cls: 'seam-note-statistics-header' })
  header.createEl('h2', { text: t().statisticsTitle })
  header.createEl('h3', { cls: 'seam-note-statistics-title', text: report.title })
  header.createEl('p', { cls: 'seam-note-statistics-path', text: report.path })
  const counts = container.createEl('dl', { cls: 'seam-note-statistics-grid' })
  const number = new Intl.NumberFormat(detectLocale())
  const date = new Intl.DateTimeFormat(detectLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const block = (parent: HTMLElement, label: string, value: string, icon: string): HTMLElement => {
    const card = parent.createDiv({ cls: 'seam-note-statistics-block' })
    card.createEl('dt', { cls: 'seam-note-statistics-label', text: label })
    card.createEl('dd', { cls: 'seam-note-statistics-value', text: value })
    if (showIcons) {
      const glyph = card.createSpan({
        cls: 'seam-note-statistics-icon',
        attr: { 'aria-hidden': 'true' },
      })
      setIcon(glyph, icon)
    }
    return card
  }
  block(counts, t().statisticsWords, number.format(report.words), 'whole-word')
  block(counts, t().statisticsCharacters, number.format(report.characters), 'case-sensitive')
  block(counts, t().statisticsParagraphs, number.format(report.paragraphs), 'pilcrow')
  block(
    counts,
    t().statisticsReadTime,
    t().statisticsMinutes(number.format(report.readMinutes)),
    'clock',
  )
  const dates = container.createEl('dl', { cls: 'seam-note-statistics-dates' })
  for (const [label, timestamp] of [
    [t().statisticsModified, report.modified],
    [t().statisticsCreated, report.created],
  ] as const) {
    const card = block(dates, label, date.format(timestamp), 'calendar-days')
    const value = card.querySelector('dd')
    value?.empty()
    value?.createEl('time', {
      text: date.format(timestamp),
      attr: { datetime: new Date(timestamp).toISOString() },
    })
  }
}
