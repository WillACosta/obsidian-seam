import { App, parseYaml, Platform, TFile, TFolder, normalizePath } from 'obsidian'
import { CustomSpecialSearch, SeamSettings } from '../types'
import { t } from '../i18n'
import { BOOKSHELF_PATH, SETUP_FILES, SETUP_FOLDERS, SETUP_PROPERTY_TYPES } from './SetupAssets'
import { SetupCompatibility } from './SetupCompatibility'

export type SetupStatus = 'create' | 'update' | 'existing' | 'conflict' | 'unsupported'
export type SetupGroup = 'resources' | 'obsidian' | 'searches'
export type SetupReason =
  | 'preserved'
  | 'pathConflict'
  | 'invalidJson'
  | 'unsupported'
  | 'hotkeyConflict'
  | 'aliasConflict'
  | 'baseUnavailable'
  | 'missingView'
  | 'changed'
  | 'dependency'
  | 'applied'
  | 'restart'
type JsonObject = Record<string, unknown>
type Operation =
  | { kind: 'folder' }
  | { kind: 'file'; content: string }
  | { kind: 'config'; before: string | null; after: string; hotkeys?: string }
  | { kind: 'setting'; key: keyof SeamSettings; before: unknown; after: string }
  | { kind: 'search'; search: CustomSpecialSearch }
export interface SetupItem {
  target: string
  group: SetupGroup
  status: SetupStatus
  reason?: SetupReason
  details?: string[]
  operation?: Operation
}
export interface SetupPlan {
  id: string
  configDir: string
  items: SetupItem[]
  seamData?: string | null
}
export interface SetupResult {
  target: string
  outcome: 'applied' | 'skipped' | 'failed'
  reason?: SetupReason
  error?: string
  restart?: boolean
}
export interface SetupReport {
  results: SetupResult[]
  backupDir: string | null
}

function object(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
class HotkeyConflictError extends Error {}
function modK(value: unknown): boolean {
  if (
    !object(value) ||
    typeof value.key !== 'string' ||
    value.key.toUpperCase() !== 'K' ||
    !Array.isArray(value.modifiers)
  )
    return false
  const modifiers = value.modifiers.map((modifier) =>
    modifier === (Platform.isMacOS ? 'Meta' : 'Ctrl') ? 'Mod' : modifier,
  )
  return modifiers.length === 1 && modifiers[0] === 'Mod'
}

/** A preview is read-only. Applying consumes exactly that plan and checks for intervening changes. */
export class SeamInitializer {
  private plans = new WeakSet<SetupPlan>()
  private applying = false
  private disposed = false
  private readonly compatibility: SetupCompatibility
  constructor(
    private readonly app: App,
    private readonly pluginDir: string,
    private readonly getSettings: () => SeamSettings,
    private readonly saveSettings: (settings: SeamSettings) => Promise<void>,
    compatibility?: SetupCompatibility,
  ) {
    this.compatibility = compatibility ?? new SetupCompatibility(app)
  }

  async preview(): Promise<SetupPlan> {
    if (this.disposed) throw new Error('Setup is unavailable.')
    const plan: SetupPlan = {
      id: crypto.randomUUID(),
      configDir: this.app.vault.configDir,
      items: [],
    }
    const add = (item: SetupItem): void => {
      plan.items.push(item)
    }
    for (const target of SETUP_FOLDERS) {
      const existing = this.app.vault.getAbstractFileByPath(target)
      add({
        target,
        group: 'resources',
        status: existing ? (existing instanceof TFolder ? 'existing' : 'conflict') : 'create',
        reason: existing && !(existing instanceof TFolder) ? 'pathConflict' : undefined,
        operation: { kind: 'folder' },
      })
    }
    for (const [target, content] of Object.entries(SETUP_FILES)) {
      const existing = this.app.vault.getAbstractFileByPath(target)
      add({
        target,
        group: 'resources',
        status: existing ? (existing instanceof TFile ? 'existing' : 'conflict') : 'create',
        reason: existing instanceof TFile ? 'preserved' : existing ? 'pathConflict' : undefined,
        operation: { kind: 'file', content },
      })
    }
    // A file occupying a parent folder blocks all dependent resources in the preview.
    for (const item of plan.items) {
      if (
        item.status === 'create' &&
        plan.items.some(
          (parent) => parent.status === 'conflict' && item.target.startsWith(parent.target + '/'),
        )
      ) {
        item.status = 'conflict'
        item.reason = 'pathConflict'
      }
    }
    const appPatch: JsonObject = {}
    for (const [key, value] of Object.entries({
      newFileLocation: 'folder',
      newFileFolderPath: 'Fleeting',
      attachmentFolderPath: 'Resources/Attachments',
      mobileQuickRibbonItem: '',
      mobilePullAction: 'seam:open-palette',
    })) {
      if (
        !this.compatibility.supportsAppSetting(key, value) ||
        (key === 'mobilePullAction' && !this.compatibility.hasCommand(value))
      ) {
        add({
          target: `app.json · ${key}`,
          group: 'obsidian',
          status: 'unsupported',
          reason: 'unsupported',
        })
      } else appPatch[key] = value
    }
    if (Object.keys(appPatch).length)
      await this.config(
        plan,
        'app.json',
        (current) => ({ ...current, ...appPatch }),
        Object.keys(appPatch),
      )
    const coreIds = ['daily-notes', 'templates', 'bases'].filter((id) => {
      const available =
        id === 'bases' ? this.compatibility.basesSupported : this.compatibility.hasCorePlugin(id)
      if (!available)
        add({
          target: `core-plugins.json · ${id}`,
          group: 'obsidian',
          status: 'unsupported',
          reason: 'unsupported',
        })
      return available
    })
    if (coreIds.length) await this.coreConfig(plan, coreIds)
    if (coreIds.includes('daily-notes'))
      await this.config(
        plan,
        'daily-notes.json',
        (current) => ({
          ...current,
          folder: 'Resources/Daily',
          template: 'Resources/Templates/Daily Note Template.md',
        }),
        ['folder', 'template'],
      )
    if (coreIds.includes('templates'))
      await this.config(
        plan,
        'templates.json',
        (current) => ({ ...current, folder: 'Resources/Templates' }),
        ['folder'],
      )
    await this.config(
      plan,
      'types.json',
      (current) => {
        if (current.types !== undefined && !object(current.types)) throw new Error('types')
        return {
          ...current,
          types: { ...(current.types as JsonObject | undefined), ...SETUP_PROPERTY_TYPES },
        }
      },
      Object.keys(SETUP_PROPERTY_TYPES).map((key) => `types.${key}`),
    )
    await this.hotkeyConfig(plan)
    const settings = this.getSettings()
    const recommended = {
      permanentFolder: 'Permanent',
      archiveFolder: 'Resources/Archive',
      fleetingFolder: 'Fleeting',
      fleetingNoteTemplate: 'Resources/Templates/Fleeting Note Template.md',
      sourcesFolder: 'Resources/Sources',
    } as const
    const labels = {
      permanentFolder: t().settingsPermanentFolder,
      archiveFolder: t().settingsArchiveFolder,
      fleetingFolder: t().settingsFleetingFolder,
      fleetingNoteTemplate: t().settingsFleetingTemplate,
      sourcesFolder: t().settingsSourcesFolder,
    }
    for (const [key, after] of Object.entries(recommended) as [
      keyof typeof recommended,
      string,
    ][]) {
      add({
        target: `Seam · ${labels[key]}`,
        group: 'searches',
        status: settings[key] === after ? 'existing' : 'update',
        details:
          settings[key] === after
            ? undefined
            : [`${JSON.stringify(settings[key])} → ${JSON.stringify(after)}`],
        operation: { kind: 'setting', key, before: settings[key], after },
      })
    }
    const coreItem = plan.items.find(
      (item) => item.target === normalizePath(`${plan.configDir}/core-plugins.json`),
    )
    for (const [alias, view] of [
      ['bookshelf', 'Bookshelf'],
      ['reading', 'Reading'],
    ]) {
      const search: CustomSpecialSearch = {
        id: `seam-setup-${alias}`,
        identifier: `@${alias}`,
        icon: 'book-open',
        mode: 'base',
        basePath: BOOKSHELF_PATH,
        baseView: view,
        filterQuery: '',
        pinned: false,
        hidden: false,
      }
      const existing = settings.customSpecialSearches.find(
        (item) => item.identifier.toLowerCase() === search.identifier,
      )
      let status: SetupStatus = 'create'
      let reason: SetupReason | undefined
      if (existing) {
        status =
          existing.id === search.id &&
          existing.mode === 'base' &&
          existing.basePath === search.basePath &&
          existing.baseView === view
            ? 'existing'
            : 'conflict'
        reason = status === 'conflict' ? 'aliasConflict' : 'preserved'
      } else if (
        !this.compatibility.basesSupported ||
        !coreItem ||
        coreItem.status === 'conflict'
      ) {
        status = 'unsupported'
        reason = 'baseUnavailable'
      } else if (!(await this.baseHasView(view, plan))) {
        status = 'conflict'
        reason = 'missingView'
      }
      add({
        target: search.identifier,
        group: 'searches',
        status,
        reason,
        details: [`${BOOKSHELF_PATH} → ${view}`],
        operation: { kind: 'search', search },
      })
    }
    try {
      plan.seamData = await this.raw(normalizePath(`${this.pluginDir}/data.json`))
      if (plan.seamData !== null && !object(JSON.parse(plan.seamData)))
        throw new Error('Invalid Seam settings')
    } catch (error) {
      for (const item of plan.items)
        if (item.group === 'searches' && (item.status === 'create' || item.status === 'update')) {
          item.status = 'conflict'
          item.reason = 'invalidJson'
          item.details = [message(error)]
        }
    }
    for (const item of plan.items) {
      if ((item.status !== 'create' && item.status !== 'update') || !item.operation) continue
      const op = item.operation
      const dependencies =
        op.kind === 'setting'
          ? this.dependencyPaths(op.after)
          : op.kind === 'config'
            ? this.dependencyPaths(item.target)
            : []
      if (
        dependencies.some((path) =>
          plan.items.some(
            (resource) =>
              resource.group === 'resources' &&
              resource.target === path &&
              resource.status === 'conflict',
          ),
        )
      ) {
        item.status = 'conflict'
        item.reason = 'dependency'
      }
    }
    this.plans.add(plan)
    return plan
  }

  private async raw(path: string): Promise<string | null> {
    return (await this.app.vault.adapter.exists(path)) ? this.app.vault.adapter.read(path) : null
  }
  private async config(
    plan: SetupPlan,
    file: string,
    transform: (current: JsonObject) => JsonObject,
    keys: string[],
  ): Promise<void> {
    const target = normalizePath(`${plan.configDir}/${file}`)
    try {
      const before = await this.raw(target)
      const parsed: unknown = before === null ? {} : JSON.parse(before)
      if (!object(parsed)) throw new Error('Invalid JSON object')
      const next = transform(parsed)
      const changes = keys.filter(
        (key) => !equal(this.valueAt(parsed, key), this.valueAt(next, key)),
      )
      plan.items.push({
        target,
        group: 'obsidian',
        status: changes.length ? (before === null ? 'create' : 'update') : 'existing',
        details: changes.map(
          (key) =>
            `${key}: ${JSON.stringify(this.valueAt(parsed, key)) ?? '∅'} → ${JSON.stringify(this.valueAt(next, key))}`,
        ),
        operation: { kind: 'config', before, after: JSON.stringify(next, null, 2) + '\n' },
      })
    } catch (error) {
      plan.items.push({
        target,
        group: 'obsidian',
        status: 'conflict',
        reason: error instanceof HotkeyConflictError ? 'hotkeyConflict' : 'invalidJson',
        details: [message(error)],
      })
    }
  }
  private valueAt(value: JsonObject, key: string): unknown {
    return key
      .split('.')
      .reduce<unknown>((current, part) => (object(current) ? current[part] : undefined), value)
  }
  private async coreConfig(plan: SetupPlan, ids: string[]): Promise<void> {
    const target = normalizePath(`${plan.configDir}/core-plugins.json`)
    try {
      const before = await this.raw(target)
      const parsed: unknown =
        before === null ? this.compatibility.corePluginStates() : JSON.parse(before)
      if (
        !object(parsed) &&
        !(Array.isArray(parsed) && parsed.every((id) => typeof id === 'string'))
      )
        throw new Error('Invalid core plugin configuration')
      const missing = ids.filter((id) =>
        Array.isArray(parsed) ? !parsed.includes(id) : parsed[id] !== true,
      )
      const next = Array.isArray(parsed)
        ? [...parsed, ...missing]
        : { ...parsed, ...Object.fromEntries(ids.map((id) => [id, true])) }
      plan.items.push({
        target,
        group: 'obsidian',
        status: before === null ? 'create' : missing.length ? 'update' : 'existing',
        details: missing.map((id) => `${id}: → true`),
        operation: { kind: 'config', before, after: JSON.stringify(next, null, 2) + '\n' },
      })
    } catch (error) {
      plan.items.push({
        target,
        group: 'obsidian',
        status: 'conflict',
        reason: 'invalidJson',
        details: [message(error)],
      })
    }
  }
  private async hotkeyConfig(plan: SetupPlan): Promise<void> {
    const effective = this.compatibility.effectiveHotkeys()
    if (!effective || !this.compatibility.hasCommand('seam:open-palette')) {
      plan.items.push({
        target: 'hotkeys.json · Mod+K',
        group: 'obsidian',
        status: 'unsupported',
        reason: 'unsupported',
      })
      return
    }
    await this.config(
      plan,
      'hotkeys.json',
      (current) => {
        const conflicts = Object.entries({ ...effective, ...current })
          .filter(
            ([id, keys]) => id !== 'seam:open-palette' && Array.isArray(keys) && keys.some(modK),
          )
          .map(([id]) => id)
        if (conflicts.length) throw new HotkeyConflictError(conflicts.join(', '))
        return { ...current, 'seam:open-palette': [{ modifiers: ['Mod'], key: 'K' }] }
      },
      ['seam:open-palette'],
    )
    const item = plan.items[plan.items.length - 1]
    if (item.operation?.kind === 'config') item.operation.hotkeys = JSON.stringify(effective)
  }
  private async baseHasView(view: string, plan?: SetupPlan): Promise<boolean> {
    const file = this.app.vault.getAbstractFileByPath(BOOKSHELF_PATH)
    if (!file)
      return Boolean(
        plan?.items.some((item) => item.target === BOOKSHELF_PATH && item.status === 'create'),
      )
    if (!(file instanceof TFile)) return false
    try {
      const parsed: unknown = parseYaml(await this.app.vault.read(file))
      return (
        object(parsed) &&
        Array.isArray(parsed.views) &&
        parsed.views.some((item) => object(item) && item.name === view && item.type === 'cards')
      )
    } catch {
      return false
    }
  }

  async apply(plan: SetupPlan): Promise<SetupReport> {
    if (
      this.disposed ||
      this.applying ||
      !this.plans.has(plan) ||
      plan.configDir !== this.app.vault.configDir
    )
      throw new Error('Setup preview expired.')
    this.plans.delete(plan)
    this.applying = true
    const report: SetupReport = { results: [], backupDir: null }
    let seamData = plan.seamData
    try {
      for (const item of plan.items) {
        if (this.disposed) {
          report.results.push({ target: item.target, outcome: 'skipped', reason: 'changed' })
          continue
        }
        if (item.status !== 'create' && item.status !== 'update') {
          report.results.push({ target: item.target, outcome: 'skipped', reason: item.reason })
          continue
        }
        try {
          const op = item.operation
          if (!op) continue
          if (op.kind === 'folder' || op.kind === 'file') {
            if (await this.app.vault.adapter.exists(item.target)) {
              report.results.push({ target: item.target, outcome: 'skipped', reason: 'changed' })
              continue
            }
            if (op.kind === 'folder') await this.app.vault.createFolder(item.target)
            else await this.app.vault.create(item.target, op.content ?? '')
          } else if (op.kind === 'config') {
            if (
              op.hotkeys !== undefined &&
              JSON.stringify(this.compatibility.effectiveHotkeys()) !== op.hotkeys
            ) {
              report.results.push({ target: item.target, outcome: 'skipped', reason: 'changed' })
              continue
            }
            if ((await this.raw(item.target)) !== op.before) {
              report.results.push({ target: item.target, outcome: 'skipped', reason: 'changed' })
              continue
            }
            if (!(await this.dependenciesReady(item.target))) {
              report.results.push({ target: item.target, outcome: 'skipped', reason: 'dependency' })
              continue
            }
            if (op.before !== null) await this.backup(plan, item.target, op.before, report)
            if ((await this.raw(item.target)) !== op.before) {
              report.results.push({ target: item.target, outcome: 'skipped', reason: 'changed' })
              continue
            }
            await this.app.vault.adapter.write(item.target, op.after)
            if ((await this.raw(item.target)) !== op.after)
              throw new Error('Configuration changed during setup.')
          } else {
            const current = this.getSettings()
            const next = { ...current, customSpecialSearches: [...current.customSpecialSearches] }
            if (op.kind === 'setting') {
              if (!equal(current[op.key], op.before)) {
                report.results.push({ target: item.target, outcome: 'skipped', reason: 'changed' })
                continue
              }
              if (!(await this.dependenciesReady(op.after))) {
                report.results.push({
                  target: item.target,
                  outcome: 'skipped',
                  reason: 'dependency',
                })
                continue
              }
              Object.assign(next, { [op.key]: op.after })
            } else {
              if (
                current.customSpecialSearches.some(
                  (search) =>
                    search.identifier.toLowerCase() === op.search.identifier.toLowerCase(),
                )
              ) {
                report.results.push({ target: item.target, outcome: 'skipped', reason: 'changed' })
                continue
              }
              if (
                !(await this.basesConfigured(plan)) ||
                !(await this.baseHasView(op.search.baseView))
              ) {
                report.results.push({
                  target: item.target,
                  outcome: 'skipped',
                  reason: 'dependency',
                })
                continue
              }
              next.customSpecialSearches.push(op.search)
            }
            const path = normalizePath(`${this.pluginDir}/data.json`)
            const before = await this.raw(path)
            if (seamData === undefined || before !== seamData) {
              report.results.push({ target: item.target, outcome: 'skipped', reason: 'changed' })
              continue
            }
            if (before !== null) {
              const data: unknown = JSON.parse(before)
              if (!object(data)) throw new Error('Invalid Seam settings')
              // Preserve unknown persisted settings alongside Seam's normalized in-memory values.
              Object.assign(next, { ...data, ...next })
              await this.backup(plan, path, before, report)
            }
            if ((await this.raw(path)) !== before)
              throw new Error('Seam settings changed during setup.')
            await this.saveSettings(next)
            seamData = await this.raw(path)
          }
          report.results.push({
            target: item.target,
            outcome: 'applied',
            reason: op.kind === 'config' ? 'restart' : 'applied',
            restart: op.kind === 'config',
          })
        } catch (error) {
          report.results.push({ target: item.target, outcome: 'failed', error: message(error) })
        }
      }
      return report
    } finally {
      this.applying = false
    }
  }
  dispose(): void {
    this.disposed = true
  }
  private dependencyPaths(target: string): string[] {
    return target.endsWith('/app.json')
      ? ['Fleeting', 'Resources/Attachments']
      : target.endsWith('/daily-notes.json')
        ? ['Resources/Daily', 'Resources/Templates/Daily Note Template.md']
        : target.endsWith('/templates.json')
          ? ['Resources/Templates']
          : [target.startsWith(this.app.vault.configDir + '/') ? this.app.vault.configDir : target]
  }
  private async dependenciesReady(target: string): Promise<boolean> {
    for (const path of this.dependencyPaths(target)) {
      if (!(await this.app.vault.adapter.exists(path))) return false
      if (path.startsWith(this.app.vault.configDir)) continue
      const resource = this.app.vault.getAbstractFileByPath(path)
      if (path.endsWith('.md') ? !(resource instanceof TFile) : !(resource instanceof TFolder))
        return false
    }
    return true
  }
  private async basesConfigured(plan: SetupPlan): Promise<boolean> {
    if (!this.compatibility.basesSupported) return false
    try {
      const raw = await this.raw(normalizePath(`${plan.configDir}/core-plugins.json`))
      if (raw === null) return false
      const core: unknown = JSON.parse(raw)
      return Array.isArray(core) ? core.includes('bases') : object(core) && core.bases === true
    } catch {
      return false
    }
  }
  private async backup(
    plan: SetupPlan,
    source: string,
    content: string,
    report: SetupReport,
  ): Promise<void> {
    const dir = normalizePath(`${this.pluginDir}/setup-backups/${plan.id}`)
    let path = ''
    for (const segment of dir.split('/')) {
      path = path ? `${path}/${segment}` : segment
      if (!(await this.app.vault.adapter.exists(path))) await this.app.vault.adapter.mkdir(path)
    }
    const target = normalizePath(
      `${dir}/${source === `${this.pluginDir}/data.json` ? 'seam-data.json' : source.split('/').pop()}`,
    )
    if (!(await this.app.vault.adapter.exists(target)))
      await this.app.vault.adapter.write(target, content)
    report.backupDir = dir
  }
}
