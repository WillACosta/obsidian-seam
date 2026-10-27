import { App, TFile } from 'obsidian'
import type { Moment } from 'moment'
import { DailyNoteSettings } from '../daily/DailyNotes'
import { SeamSettings } from '../types'
import { periodNotePath, readPeriodicConfig, resolvePeriodNote } from './PeriodicNotes'

export interface YearlyNoteSettings extends DailyNoteSettings {
  source: 'seam' | 'periodic'
}
export async function readYearlyNoteSettings(
  app: App,
  settings: SeamSettings,
): Promise<YearlyNoteSettings> {
  const periodic = await readPeriodicConfig(app, settings.calendarUsePeriodicNotes, 'yearly')
  const config: Record<string, unknown> = periodic ?? {
    folder: settings.calendarYearlyFolder,
    format: settings.calendarYearlyFormat,
    template: settings.calendarYearlyTemplate,
  }
  const format =
    typeof config.format === 'string' && config.format.trim() ? config.format.trim() : 'YYYY'
  const tokens = format.replace(/\[[^\]]*\]|\\./g, '')
  if (!/Y/.test(tokens) || /[gGwW]/.test(tokens))
    throw new Error('Yearly format must use the calendar year (YYYY), not a week-year.')
  return {
    folder: typeof config.folder === 'string' ? config.folder : '',
    format,
    template:
      typeof config.templatePath === 'string'
        ? config.templatePath
        : typeof config.template === 'string'
          ? config.template
          : '',
    source: periodic ? 'periodic' : 'seam',
  }
}
export function yearlyNotePath(date: Moment, settings: YearlyNoteSettings): string {
  return periodNotePath(date.clone().startOf('year'), settings)
}
export async function resolveYearlyNote(
  app: App,
  date: Moment,
  settings: YearlyNoteSettings,
): Promise<TFile> {
  return resolvePeriodNote(app, date.clone().startOf('year'), settings, 'Yearly')
}
