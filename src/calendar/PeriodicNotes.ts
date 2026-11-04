import { App, normalizePath, TFile, TFolder } from 'obsidian'
import type { Moment } from 'moment'
import { DailyNoteSettings, dailyNotePath } from '../daily/DailyNotes'

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null

/** Support the legacy configuration and the active modern calendar set without private plugin APIs. */
export async function readPeriodicConfig(
  app: App,
  enabled: boolean,
  period: 'weekly' | 'yearly',
): Promise<Record<string, unknown> | null> {
  const path = normalizePath(`${app.vault.configDir}/plugins/periodic-notes/data.json`)
  if (!enabled || !(await app.vault.adapter.exists(path))) return null
  const data = record(JSON.parse(await app.vault.adapter.read(path)))
  if (!data) throw new Error('Invalid Periodic Notes settings.')
  let config = record(data[period])
  if (Array.isArray(data.calendarSets)) {
    const active = data.calendarSets.map(record).find((set) => set?.id === data.activeCalendarSet)
    if (!active) throw new Error('Periodic Notes has no active calendar set.')
    config = record(active[period === 'weekly' ? 'week' : 'year'])
  }
  return config?.enabled === true ? config : null
}

export function periodNotePath(date: Moment, settings: DailyNoteSettings): string {
  const path = dailyNotePath(date, settings)
  if (path.split('/').some((part) => part === '..' || part === '.'))
    throw new Error('Note path must stay inside the vault.')
  return path
}

const pending = new WeakMap<App, Map<string, Promise<TFile>>>()
/** The caller anchors the date at the beginning of the requested period. */
export async function resolvePeriodNote(
  app: App,
  date: Moment,
  settings: DailyNoteSettings,
  period: 'Weekly' | 'Yearly',
): Promise<TFile> {
  const path = periodNotePath(date, settings)
  const current = app.vault.getAbstractFileByPath(path)
  if (current instanceof TFile) return current
  if (current) throw new Error(`${period} note path is occupied: ${path}`)
  let operations = pending.get(app)
  if (!operations) {
    operations = new Map()
    pending.set(app, operations)
  }
  const existing = operations.get(path)
  if (existing) return existing
  const operation = createPeriodNote(app, date, settings, path, period)
  operations.set(path, operation)
  try {
    return await operation
  } finally {
    operations.delete(path)
  }
}

async function createPeriodNote(
  app: App,
  date: Moment,
  settings: DailyNoteSettings,
  path: string,
  period: 'Weekly' | 'Yearly',
): Promise<TFile> {
  const find = (): TFile | null => {
    const file = app.vault.getAbstractFileByPath(path)
    return file instanceof TFile ? file : null
  }
  try {
    const start = date.clone().startOf('day')
    let content = ''
    if (settings.template.trim()) {
      const template = app.vault.getAbstractFileByPath(
        normalizePath(settings.template.replace(/\.md$/i, '') + '.md'),
      )
      if (!(template instanceof TFile))
        throw new Error(`${period} Note template not found: ${settings.template}`)
      content = await app.vault.read(template)
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      content = content.replace(
        /{{\s*(date|time|title|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*(?::([^}]+))?}}/gi,
        (match, token: string, format?: string) => {
          const name = token.toLowerCase()
          if (name === 'title') return path.split('/').pop()!.slice(0, -3)
          const index = days.indexOf(name)
          if (period === 'Yearly' && index >= 0) return match
          const target =
            index < 0 ? start : start.clone().add((index - start.day() + 7) % 7, 'days')
          return target.format(format?.trim() || (name === 'time' ? 'HH:mm' : settings.format))
        },
      )
    }
    let folder = ''
    for (const part of path.split('/').slice(0, -1)) {
      folder = folder ? `${folder}/${part}` : part
      const occupied = app.vault.getAbstractFileByPath(folder)
      if (occupied && !(occupied instanceof TFolder))
        throw new Error(`${period} note folder is occupied: ${folder}`)
      if (!occupied) {
        try {
          await app.vault.createFolder(folder)
        } catch (error) {
          if (!(app.vault.getAbstractFileByPath(folder) instanceof TFolder)) throw error
        }
      }
    }
    return find() ?? (await app.vault.create(path, content))
  } catch (error) {
    const existing = find()
    if (existing) return existing
    throw error
  }
}
