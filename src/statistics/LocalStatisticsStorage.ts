import { App } from 'obsidian'

/** Strip the session-specific authority and cache-buster from Obsidian resource URLs. */
export function stableResourcePath(resource: string): string {
  const withoutQuery = resource.split('?')[0]
  return withoutQuery.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '')
}

/** Read keys written by earlier Seam releases before vault-scoped storage was adopted. */
export function legacyStatisticsValue(
  prefix: string,
  resource: string,
  accept: (value: string) => boolean = () => true,
): string | null {
  const storage = window.localStorage
  const exact = storage.getItem(prefix + resource)
  if (exact !== null && accept(exact)) return exact
  return (
    Object.keys(storage)
      .filter(
        (key) =>
          key.startsWith(prefix) && stableResourcePath(key.slice(prefix.length)) === resource,
      )
      .sort((a, b) => Number(b.split('?')[1] ?? 0) - Number(a.split('?')[1] ?? 0))
      .map((key) => storage.getItem(key))
      .find((value): value is string => value !== null && accept(value)) ?? null
  )
}

/** Obsidian's local storage API swallows errors; read back to detect failed writes. */
export function saveLocalStatistics(app: App, key: string, value: string | null): void {
  app.saveLocalStorage(key, value)
  const saved: unknown = app.loadLocalStorage(key)
  if (saved !== value) throw new Error('Local statistics storage could not be verified')
}

export function loadLocalStatistics(app: App, key: string): string | null {
  const value: unknown = app.loadLocalStorage(key)
  if (value === null) return null
  if (typeof value !== 'string') throw new Error('Invalid local statistics storage')
  return value
}
