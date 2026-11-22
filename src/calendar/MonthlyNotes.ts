import { App, TFile } from 'obsidian'
import type { Moment } from 'moment'
import { DailyNoteSettings } from '../daily/DailyNotes'
import { SeamSettings } from '../types'
import { periodNotePath, readPeriodicConfig, resolvePeriodNote } from './PeriodicNotes'

export interface MonthlyNoteSettings extends DailyNoteSettings {
  source: 'seam' | 'periodic'
}
export async function readMonthlyNoteSettings(
  app: App,
  settings: SeamSettings,
): Promise<MonthlyNoteSettings> {
  const periodic = await readPeriodicConfig(app, settings.calendarUsePeriodicNotes, 'monthly')
  const config: Record<string, unknown> = periodic ?? {
    folder: settings.calendarMonthlyFolder,
    format: settings.calendarMonthlyFormat,
    template: settings.calendarMonthlyTemplate,
  }
  const format =
    typeof config.format === 'string' && config.format.trim() ? config.format.trim() : 'YYYY-MM'
  const tokens = format.replace(/\[[^\]]*\]|\\./g, '')
  if (!/Y/.test(tokens) || !/M/.test(tokens) || /[gGwW]/.test(tokens))
    throw new Error('Monthly format must include the calendar year and month (YYYY-MM).')
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
export function monthlyNotePath(date: Moment, settings: MonthlyNoteSettings): string {
  return periodNotePath(date.clone().startOf('month'), settings)
}
export async function resolveMonthlyNote(
  app: App,
  date: Moment,
  settings: MonthlyNoteSettings,
): Promise<TFile> {
  return resolvePeriodNote(app, date.clone().startOf('month'), settings, 'Monthly')
}
