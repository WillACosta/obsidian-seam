import { App, Component, moment, normalizePath, Notice, TAbstractFile, TFile } from 'obsidian'
import type { Moment } from 'moment'
import { CalendarPin, SeamSettings } from '../types'
import { detectLocale, t } from '../i18n'
import { readWeeklyNoteSettings, weekKey, weeklyNotePath, WeeklyNoteSettings } from './WeeklyNotes'

export function normalizeCalendarPins(value: unknown): CalendarPin[] {
  if (!Array.isArray(value)) return []
  const pins: CalendarPin[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const pin = item as Record<string, unknown>
    if (pin.kind === 'weekly' && !pins.some((p) => p.kind === 'weekly')) {
      pins.push({
        kind: 'weekly',
        ...(typeof pin.week === 'string' && typeof pin.path === 'string'
          ? { week: pin.week, path: normalizePath(pin.path) }
          : {}),
      })
    } else if (pin.kind === 'file' && typeof pin.path === 'string' && pin.path.endsWith('.md')) {
      const path = normalizePath(pin.path)
      if (!pins.some((p) => p.kind === 'file' && p.path === path)) pins.push({ kind: 'file', path })
    }
    if (pins.length === 3) break
  }
  return pins
}

/** References only: never modifies notes. Serialize persisted pin changes and roll back failed saves. */
export class CalendarPins extends Component {
  private queue: Promise<void> = Promise.resolve()
  private listeners = new Set<() => void>()
  private weeklySettings: WeeklyNoteSettings | null = null
  constructor(
    private app: App,
    private settings: () => SeamSettings,
    private save: () => Promise<void>,
  ) {
    super()
  }
  get pins(): readonly CalendarPin[] {
    return this.settings().calendarPins
  }
  get full(): boolean {
    return this.pins.length >= 3
  }
  get rolling(): boolean {
    return this.pins.some((pin) => pin.kind === 'weekly')
  }
  hasFile(path: string): boolean {
    return this.pins.some((pin) => pin.kind === 'file' && pin.path === path)
  }
  pinForFile(path: string): CalendarPin | undefined {
    const fixed = this.pins.find((pin) => pin.kind === 'file' && pin.path === path)
    if (fixed) return fixed
    const rolling = this.pins.find(
      (pin): pin is Extract<CalendarPin, { kind: 'weekly' }> => pin.kind === 'weekly',
    )
    if (!rolling || !this.weeklySettings) return undefined
    return this.weeklyTarget(rolling, this.weeklySettings, moment().locale(detectLocale())) === path
      ? rolling
      : undefined
  }
  resolvedPaths(): ReadonlySet<string> {
    const now = moment().locale(detectLocale())
    return new Set(
      this.pins.flatMap((pin) =>
        pin.kind === 'file'
          ? [pin.path]
          : this.weeklySettings
            ? [this.weeklyTarget(pin, this.weeklySettings, now)]
            : [],
      ),
    )
  }
  setWeeklySettings(settings: WeeklyNoteSettings): void {
    this.weeklySettings = settings
  }
  async refreshWeeklySettings(): Promise<void> {
    this.weeklySettings = null
    this.weeklySettings = await readWeeklyNoteSettings(this.app, this.settings())
  }
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  onload(): void {
    // Command visibility uses cached paths; calendar loading reports invalid configuration on demand.
    if (this.rolling) void this.refreshWeeklySettings().catch(() => {})
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        void this.onFileChange(file, oldPath).catch((error) => this.report(error))
      }),
    )
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        void this.onFileChange(null, file.path).catch((error) => this.report(error))
      }),
    )
  }
  onunload(): void {
    this.listeners.clear()
  }
  private report(error: unknown): void {
    new Notice(
      `${t().calendarPinFailed}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  private update(
    change: (pins: CalendarPin[]) => CalendarPin[] | Promise<CalendarPin[]>,
  ): Promise<void> {
    const operation = this.queue.then(async () => {
      const settings = this.settings()
      const previous = settings.calendarPins
      const next = await change(previous)
      if (JSON.stringify(next) === JSON.stringify(previous)) return
      settings.calendarPins = next
      try {
        await this.save()
      } catch (error) {
        settings.calendarPins = previous
        throw error
      }
      for (const notify of this.listeners) notify()
    })
    this.queue = operation.catch(() => {})
    return operation
  }
  pinFile(file: TFile): Promise<void> {
    return this.update(async (pins) => {
      if (file.extension !== 'md' || this.app.vault.getAbstractFileByPath(file.path) !== file)
        throw new Error(t().calendarPinUnavailable)
      if (pins.some((pin) => pin.kind === 'file' && pin.path === file.path)) return pins
      const rolling = pins.find(
        (pin): pin is Extract<CalendarPin, { kind: 'weekly' }> => pin.kind === 'weekly',
      )
      if (rolling) {
        const weekly = await readWeeklyNoteSettings(this.app, this.settings())
        if (this.weeklyTarget(rolling, weekly, moment().locale(detectLocale())) === file.path)
          return pins
      }
      if (pins.length >= 3) throw new Error(t().calendarPinLimit)
      return [...pins, { kind: 'file', path: file.path }]
    })
  }
  pinWeek(settings: WeeklyNoteSettings, now = moment().locale(detectLocale())): Promise<void> {
    this.weeklySettings = settings
    return this.update((pins) => {
      if (pins.some((pin) => pin.kind === 'weekly')) return pins
      const path = weeklyNotePath(now, settings)
      const rolling: CalendarPin = { kind: 'weekly' }
      if (pins.some((pin) => pin.kind === 'file' && pin.path === path)) {
        return pins.map((pin) => (pin.kind === 'file' && pin.path === path ? rolling : pin))
      }
      if (pins.length >= 3) throw new Error(t().calendarPinLimit)
      return [...pins, rolling]
    })
  }
  unpin(pin: CalendarPin): Promise<void> {
    return this.update((pins) =>
      pins.filter(
        (item) =>
          item.kind !== pin.kind ||
          (item.kind === 'file' && pin.kind === 'file' && item.path !== pin.path),
      ),
    )
  }
  weeklyTarget(
    pin: Extract<CalendarPin, { kind: 'weekly' }>,
    settings: WeeklyNoteSettings,
    now: Moment,
  ): string {
    return pin.week === weekKey(now, settings) && pin.path
      ? pin.path
      : weeklyNotePath(now, settings)
  }
  async reconcile(): Promise<void> {
    await this.update((pins) =>
      pins.filter(
        (pin) =>
          pin.kind === 'weekly' || this.app.vault.getAbstractFileByPath(pin.path) instanceof TFile,
      ),
    )
  }
  private onFileChange(file: TAbstractFile | null, oldPath: string): Promise<void> {
    const movedPath = file?.path ?? null
    const now = moment().locale(detectLocale())
    const matches = (path: string): boolean => path === oldPath || path.startsWith(oldPath + '/')
    // Enqueue immediately so a simultaneous calendar reconciliation cannot discard a moving reference.
    return this.update(async (pins) => {
      if (!pins.length) return pins
      let weekly: WeeklyNoteSettings | null = null
      if (pins.some((pin) => pin.kind === 'weekly')) {
        try {
          weekly = await readWeeklyNoteSettings(this.app, this.settings())
        } catch (error) {
          this.report(error)
        }
      }
      return pins.flatMap((pin): CalendarPin[] => {
        const path =
          pin.kind === 'file' ? pin.path : weekly ? this.weeklyTarget(pin, weekly, now) : ''
        if (!matches(path)) return [pin]
        if (movedPath === null) return []
        const next = movedPath + path.slice(oldPath.length)
        if (!next.endsWith('.md')) return []
        return pin.kind === 'file'
          ? [{ kind: 'file', path: next }]
          : [{ kind: 'weekly', week: weekKey(now, weekly!), path: next }]
      })
    })
  }
}
