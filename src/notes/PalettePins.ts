import { App, Component, normalizePath, Notice, TAbstractFile, TFile } from 'obsidian'
import { SeamSettings } from '../types'
import { t } from '../i18n'

export function normalizePalettePins(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value
        .filter((path): path is string => typeof path === 'string' && path.endsWith('.md'))
        .map((path) => normalizePath(path))
        .filter((path) => !path.split('/').some((part) => part === '..' || part === '.')),
    ),
  ]
}

/** Persistent references, serialized so a failed save cannot discard another pin change. */
export class PalettePins extends Component {
  private queue: Promise<void> = Promise.resolve()
  constructor(
    private app: App,
    private settings: () => SeamSettings,
    private save: () => Promise<void>,
  ) {
    super()
  }
  has(path: string): boolean {
    return this.settings().palettePinnedNotes.includes(path)
  }
  onload(): void {
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => this.changed(file, oldPath)))
    this.registerEvent(this.app.vault.on('delete', (file) => this.changed(null, file.path)))
  }
  private changed(file: TAbstractFile | null, oldPath: string): void {
    const newPath = file?.path
    void this.update((paths) =>
      paths.flatMap((path) =>
        path === oldPath || path.startsWith(oldPath + '/')
          ? newPath
            ? [newPath + path.slice(oldPath.length)]
            : []
          : [path],
      ),
    ).catch(() => new Notice(t().palettePinFailed))
  }
  private update(change: (paths: string[]) => string[]): Promise<void> {
    const operation = this.queue.then(async () => {
      const settings = this.settings()
      const previous = settings.palettePinnedNotes
      const next = normalizePalettePins(change(previous))
      if (JSON.stringify(next) === JSON.stringify(previous)) return
      settings.palettePinnedNotes = next
      try {
        await this.save()
      } catch (error) {
        settings.palettePinnedNotes = previous
        throw error
      }
    })
    this.queue = operation.catch(() => {})
    return operation
  }
  toggle(file: TFile): Promise<void> {
    return this.update((paths) => {
      if (this.app.vault.getAbstractFileByPath(file.path) !== file || file.extension !== 'md')
        throw new Error(t().palettePinFailed)
      return paths.includes(file.path)
        ? paths.filter((path) => path !== file.path)
        : [...paths, file.path]
    })
  }
}
