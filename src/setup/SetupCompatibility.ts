import { App, requireApiVersion } from 'obsidian'

interface ConfigReader {
  getConfig?: (key: string) => unknown
}
interface InternalPlugin {
  enabled?: boolean
}
interface RuntimeAccess {
  internalPlugins?: { plugins?: Record<string, InternalPlugin> }
  commands?: { commands?: Record<string, { hotkeys?: unknown[] }> }
  hotkeyManager?: {
    getHotkeys?: (id: string) => unknown[] | undefined
    getDefaultHotkeys?: (id: string) => unknown[] | undefined
  }
}

/** Undocumented access is read-only and isolated here. All writes use DataAdapter with snapshots.
 * Configuration changes require a restart, avoiding private mutation APIs and their delayed saves.
 */
export class SetupCompatibility {
  constructor(private readonly app: App) {}
  supportsAppSetting(key: string, value: unknown): boolean {
    const vault = this.app.vault as typeof this.app.vault & ConfigReader
    try {
      return typeof vault.getConfig === 'function' && typeof vault.getConfig(key) === typeof value
    } catch {
      return false
    }
  }
  hasCommand(id: string): boolean {
    return Boolean((this.app as App & RuntimeAccess).commands?.commands?.[id])
  }
  hasCorePlugin(id: string): boolean {
    return Boolean((this.app as App & RuntimeAccess).internalPlugins?.plugins?.[id])
  }
  corePluginStates(): Record<string, boolean> {
    const plugins = (this.app as App & RuntimeAccess).internalPlugins?.plugins
    if (!plugins) throw new Error('Core plugin state is unavailable')
    if (Object.values(plugins).some((plugin) => typeof plugin.enabled !== 'boolean'))
      throw new Error('Core plugin state is unavailable')
    return Object.fromEntries(
      Object.entries(plugins).map(([id, plugin]) => [id, plugin.enabled === true]),
    )
  }
  get basesSupported(): boolean {
    return requireApiVersion('1.13.0') && this.hasCorePlugin('bases')
  }
  /** Returns null when effective/default shortcuts cannot be inspected safely. */
  effectiveHotkeys(): Record<string, unknown[]> | null {
    const runtime = this.app as App & RuntimeAccess
    const manager = runtime.hotkeyManager
    if (!runtime.commands?.commands || !manager?.getHotkeys || !manager.getDefaultHotkeys)
      return null
    try {
      return Object.fromEntries(
        Object.keys(runtime.commands.commands).map((id) => [
          id,
          manager.getHotkeys?.(id) ?? manager.getDefaultHotkeys?.(id) ?? [],
        ]),
      )
    } catch {
      return null
    }
  }
}
