import { App, Component, normalizePath, Notice, MarkdownView, TFile } from 'obsidian'
import {
  ActivityChange,
  ActivityEvent,
  ActivityState,
  applyActivity,
  emptyActivity,
  localDay,
  parseActivity,
  parseActivityJournal,
  wordCount,
} from './WritingActivity'
import { t } from '../i18n'
import {
  STATISTICS_FOLDER,
  ensureStatisticsFolder,
  statisticsDeviceId,
  combineActivity,
  stableResourcePath,
} from './StatisticsStorage'

// Share only in-flight writes across module reloads, then release each queue entry.
const pendingWritesKey = Symbol.for('seam.statistics.pending-writes')
const runtime = globalThis as typeof globalThis & {
  [pendingWritesKey]?: Map<string, Promise<void>>
}
const pendingWrites = runtime[pendingWritesKey] ?? (runtime[pendingWritesKey] = new Map())
const initializationKey = Symbol.for('seam.statistics.initializations')
const initializationRuntime = globalThis as typeof globalThis & {
  [initializationKey]?: Map<string, Promise<void>>
}
const initializations =
  initializationRuntime[initializationKey] ?? (initializationRuntime[initializationKey] = new Map())

export interface GlobalStatisticsSnapshot {
  activity: ActivityState
  totalNotes: number
  totalWords: number
  loading: boolean
  error: boolean
  saveError: boolean
}

/** Background totals index plus an independent, local activity log. Never writes note contents. */
export class GlobalStatistics extends Component {
  private state = emptyActivity(localDay())
  private files = new Map<TFile, number>()
  private versions = new WeakMap<TFile, number>()
  private editorWords = new WeakMap<TFile, number>()
  private failedReads = new Set<TFile>()
  private listeners = new Set<() => void>()
  private seen = new WeakSet<object>()
  private initialized = false
  private stopped = false
  private historyReady = false
  private historyError = false
  private saveError = false
  private notifyTimer: number | null = null
  private saveTimer: number | null = null
  private saving: Promise<void> | null = null
  private savedSequence = 0
  private journal: ActivityEvent[] = []
  private buffered: ActivityChange[] = []
  private readyOperation: Promise<void> | null = null
  private remote = new Map<string, ActivityState>()
  private remoteError = false
  private remoteRefresh: Promise<void> | null = null
  private readonly path: string
  private readonly journalKey: string
  constructor(
    private app: App,
    pluginDirectory: string,
    deviceId = statisticsDeviceId(app, pluginDirectory),
  ) {
    super()
    this.path = normalizePath(`${STATISTICS_FOLDER}/${deviceId}.json`)
    this.journalKey = `seam-writing:${stableResourcePath(app.vault.adapter.getResourcePath(this.path))}`
  }
  onload(): void {
    this.app.workspace.onLayoutReady(() => {
      if (this.stopped) return
      this.registerEvent(
        this.app.vault.on('create', (file) => {
          this.refreshMetadata(file.path)
          if (!(file instanceof TFile) || file.extension !== 'md') return
          this.files.set(file, 0)
          this.record({
            kind: 'create',
            id: this.idFor(file.path),
            path: file.path,
            day: localDay(),
          })
          void this.refresh(file)
        }),
      )
      this.registerEvent(
        this.app.vault.on('modify', (file) => {
          this.refreshMetadata(file.path)
          if (file instanceof TFile && file.extension === 'md') void this.refresh(file)
        }),
      )
      this.registerEvent(
        this.app.vault.on('rename', (file, from) => {
          this.refreshMetadata(file.path)
          this.refreshMetadata(from)
          this.record({ kind: 'rename', from, to: file.path })
          if (file instanceof TFile) {
            if (file.extension === 'md') void this.refresh(file)
            else {
              this.files.delete(file)
              this.failedReads.delete(file)
              this.notify()
            }
          }
        }),
      )
      this.registerEvent(
        this.app.vault.on('delete', (file) => {
          this.refreshMetadata(file.path)
          this.record({ kind: 'delete', path: file.path })
          for (const note of this.files.keys())
            if (note.path === file.path || note.path.startsWith(file.path + '/')) {
              this.files.delete(note)
              this.failedReads.delete(note)
              this.versions.set(note, (this.versions.get(note) ?? 0) + 1)
            }
          this.notify()
        }),
      )
      this.registerDomEvent(document, 'visibilitychange', () => {
        if (document.hidden) void this.flush()
      })
      this.registerDomEvent(document, 'visibilitychange', () => {
        if (!document.hidden) void this.refreshRemote()
      })
      void this.initialize()
    })
  }
  onunload(): void {
    this.stopped = true
    if (this.notifyTimer !== null) window.clearTimeout(this.notifyTimer)
    this.listeners.clear()
    void this.flush()
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  snapshot(): GlobalStatisticsSnapshot {
    return {
      activity: this.remote.size
        ? combineActivity([this.state, ...this.remote.values()])
        : this.state,
      totalNotes: this.files.size,
      totalWords: [...this.files.values()].reduce((a, b) => a + b, 0),
      loading: !this.initialized,
      error: this.historyError || this.remoteError || this.failedReads.size > 0,
      saveError: this.saveError,
    }
  }
  initialize(): Promise<void> {
    if (this.readyOperation) return this.readyOperation
    const operation = (initializations.get(this.journalKey) ?? Promise.resolve()).then(() =>
      this.loadAndIndex(),
    )
    this.readyOperation = operation
    initializations.set(this.journalKey, operation)
    const finished = (): void => {
      if (this.readyOperation === operation) this.readyOperation = null
      if (initializations.get(this.journalKey) === operation)
        initializations.delete(this.journalKey)
    }
    void operation.then(finished, finished)
    return operation
  }
  private async loadAndIndex(): Promise<void> {
    this.initialized = false
    this.notify()
    if (!this.historyReady) {
      try {
        await pendingWrites.get(this.journalKey)
        await ensureStatisticsFolder(this.app)
        const exists = await this.app.vault.adapter.exists(this.path)
        this.state = exists
          ? parseActivity(JSON.parse(await this.app.vault.adapter.read(this.path)))
          : emptyActivity(localDay())
        this.savedSequence = exists ? this.state.sequence : -1
        // Recover a pending journal written with the former cache-busted resource URL.
        const legacyJournal = Object.keys(localStorage)
          .filter(
            (key) =>
              key.startsWith('seam-writing:') &&
              stableResourcePath(key.slice('seam-writing:'.length)) ===
                this.journalKey.slice('seam-writing:'.length),
          )
          .sort((a, b) => Number(b.split('?')[1] ?? 0) - Number(a.split('?')[1] ?? 0))
          .map((key) => localStorage.getItem(key))
          .find((value) => value !== null)
        const journal = parseActivityJournal(
          JSON.parse(localStorage.getItem(this.journalKey) ?? legacyJournal ?? '[]'),
        )
        // Validate replay by checking the resulting schema before accepting recovery.
        const recovered = JSON.parse(JSON.stringify(this.state)) as ActivityState
        for (const event of journal) applyActivity(recovered, event)
        this.state = parseActivity(recovered)
        this.journal = journal.filter((event) => event.sequence > this.savedSequence)
        this.historyReady = true
        this.historyError = false
        for (const event of this.buffered.splice(0))
          this.record(
            event.kind === 'edit' || event.kind === 'create'
              ? { ...event, id: this.idFor(event.path) }
              : event,
            true,
          )
        if (this.state.sequence > this.savedSequence) void this.flush()
      } catch {
        this.historyError = true
      }
    }
    const files = this.app.vault.getMarkdownFiles()
    // Limit startup I/O and preserve concurrent create/delete/editor updates through per-file versions.
    for (const file of files) if (!this.files.has(file)) this.files.set(file, 0)
    const queue = [...files]
    await Promise.all(
      Array.from({ length: Math.min(4, queue.length) }, async () => {
        let file: TFile | undefined
        while (!this.stopped && (file = queue.shift())) await this.refresh(file)
      }),
    )
    await this.flush()
    await this.refreshRemote()
    this.initialized = true
    this.notify()
  }
  private async refresh(file: TFile): Promise<void> {
    if (this.app.vault.getAbstractFileByPath(file.path) !== file) return
    if (!this.files.has(file)) this.files.set(file, 0)
    const version = (this.versions.get(file) ?? 0) + 1
    this.versions.set(file, version)
    try {
      const text = await this.app.vault.cachedRead(file)
      if (this.stopped || this.versions.get(file) !== version || !this.files.has(file)) return
      const editorOpen = this.app.workspace
        .getLeavesOfType('markdown')
        .some(
          (leaf) =>
            leaf.view instanceof MarkdownView &&
            leaf.view.file === file &&
            leaf.view.getMode() === 'source',
        )
      this.files.set(
        file,
        editorOpen ? (this.editorWords.get(file) ?? wordCount(text)) : wordCount(text),
      )
      this.failedReads.delete(file)
    } catch {
      if (this.files.has(file)) this.failedReads.add(file)
    }
    this.notify()
  }
  /** Called for every editor document update, including undo/redo, to keep current totals accurate. */
  updateEditor(file: TFile, text: string): void {
    if (file.extension !== 'md') return
    this.versions.set(file, (this.versions.get(file) ?? 0) + 1)
    const words = wordCount(text)
    this.editorWords.set(file, words)
    this.files.set(file, words)
    this.failedReads.delete(file)
    this.notify()
  }
  recordEdit(file: TFile, words: number, transaction: object, timestamp = Date.now()): void {
    if (this.stopped || this.seen.has(transaction) || file.extension !== 'md') return
    this.seen.add(transaction)
    this.record({
      kind: 'edit',
      id: this.idFor(file.path),
      path: file.path,
      words,
      timestamp,
      day: localDay(new Date(timestamp)),
    })
  }
  private idFor(path: string): string {
    const existing = Object.entries(this.state.notes).find(
      ([, note]) => !note.deleted && note.path === path,
    )?.[0]
    const buffered = this.buffered.find(
      (event) => (event.kind === 'edit' || event.kind === 'create') && event.path === path,
    )
    if (existing) return existing
    if (buffered && (buffered.kind === 'edit' || buffered.kind === 'create')) return buffered.id
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }
  private record(change: ActivityChange, recoveringBuffered = false): void {
    if (this.stopped && !recoveringBuffered) return
    if (!this.historyReady) {
      this.buffered.push(change)
      return
    }
    const event = { ...change, sequence: this.state.sequence + 1 }
    this.journal.push(event)
    try {
      localStorage.setItem(this.journalKey, JSON.stringify(this.journal))
    } catch {
      this.saveError = true
    }
    applyActivity(this.state, event)
    if (!this.stopped && this.saveTimer === null)
      this.saveTimer = window.setTimeout(() => {
        this.saveTimer = null
        void this.flush()
      }, 750)
    this.notify()
  }
  /** Serialized/coalesced writes; the small write-ahead journal survives immediate plugin reloads. */
  flush(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    if (this.saving) return this.saving
    if (!this.historyReady || this.savedSequence >= this.state.sequence) return Promise.resolve()
    const operation = (pendingWrites.get(this.journalKey) ?? Promise.resolve()).then(async () => {
      try {
        while (this.savedSequence < this.state.sequence) {
          const sequence = this.state.sequence
          await ensureStatisticsFolder(this.app)
          await this.app.vault.adapter.write(this.path, JSON.stringify(this.state))
          this.savedSequence = sequence
          this.journal = this.journal.filter((event) => event.sequence > sequence)
          if (this.journal.length)
            localStorage.setItem(this.journalKey, JSON.stringify(this.journal))
          else localStorage.removeItem(this.journalKey)
        }
        this.saveError = false
      } catch {
        if (!this.saveError) new Notice(t().globalSaveFailed)
        this.saveError = true
      } finally {
        this.notify()
      }
    })
    this.saving = operation
    pendingWrites.set(this.journalKey, operation)
    void operation.then(() => {
      if (this.saving === operation) this.saving = null
      if (pendingWrites.get(this.journalKey) === operation) pendingWrites.delete(this.journalKey)
    })
    return operation
  }
  private refreshMetadata(path: string): void {
    if (path === STATISTICS_FOLDER || path.startsWith(STATISTICS_FOLDER + '/'))
      void this.refreshRemote()
  }
  /** Replace remote snapshots on arrival; repeated sync notifications never add activity twice. */
  refreshRemote(): Promise<void> {
    const previous = this.remoteRefresh ?? Promise.resolve()
    const operation = previous.then(async () => {
      if (this.stopped) return
      try {
        const listing = await this.app.vault.adapter.list(STATISTICS_FOLDER)
        const next = new Map<string, ActivityState>()
        let error = false
        for (const path of listing.files) {
          if (path === this.path || !/\/[a-zA-Z0-9-]+\.json$/.test(path)) continue
          try {
            next.set(path, parseActivity(JSON.parse(await this.app.vault.adapter.read(path))))
          } catch {
            error = true
            const previous = this.remote.get(path)
            if (previous) next.set(path, previous)
          }
        }
        this.remote = next
        this.remoteError = error
      } catch {
        this.remoteError = true
      }
      this.notify()
    })
    this.remoteRefresh = operation
    return operation
  }
  private notify(): void {
    if (this.stopped || this.notifyTimer !== null) return
    this.notifyTimer = window.setTimeout(() => {
      this.notifyTimer = null
      for (const listener of this.listeners) listener()
    }, 100)
  }
}
