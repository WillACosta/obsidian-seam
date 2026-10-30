import { App, TFolder } from 'obsidian'
import { ActivityState, emptyActivity, localDay } from './WritingActivity'

export const STATISTICS_FOLDER = 'Resources/Seam/Statistics'

/** Safe for concurrent creation by setup, startup, and arriving sync files. */
export async function ensureStatisticsFolder(app: App): Promise<void> {
  let path = ''
  for (const segment of STATISTICS_FOLDER.split('/')) {
    path = path ? `${path}/${segment}` : segment
    const existing = app.vault.getAbstractFileByPath(path)
    if (existing instanceof TFolder) continue
    if (existing) throw new Error(`Statistics folder is blocked by a file: ${path}`)
    try {
      await app.vault.createFolder(path)
    } catch (error) {
      if (!(app.vault.getAbstractFileByPath(path) instanceof TFolder)) throw error
    }
  }
}

/** Strip the session-specific authority and cache-buster from Obsidian resource URLs. */
export function stableResourcePath(resource: string): string {
  const withoutQuery = resource.split('?')[0]
  return withoutQuery.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '')
}

/** Device-local identity must never be stored in synced plugin settings. */
export function statisticsDeviceId(app: App, pluginDirectory: string): string {
  // Resource URLs include a cache-busting query that changes whenever the plugin reloads.
  const resource = stableResourcePath(app.vault.adapter.getResourcePath(pluginDirectory))
  const key = `seam-statistics-device:${resource}`
  const valid = (value: string | null): value is string => !!value && /^[a-zA-Z0-9-]+$/.test(value)
  const stored = localStorage.getItem(key)
  if (valid(stored)) return stored
  // Reuse the most recent identity created by the old cache-busted key format.
  const legacy = Object.keys(localStorage)
    .filter(
      (candidate) =>
        candidate.startsWith('seam-statistics-device:') &&
        stableResourcePath(candidate.slice('seam-statistics-device:'.length)) === resource,
    )
    .sort((a, b) => Number(b.split('?')[1] ?? 0) - Number(a.split('?')[1] ?? 0))
    .map((candidate) => localStorage.getItem(candidate))
    .find(valid)
  const id = legacy ?? crypto.randomUUID()
  localStorage.setItem(key, id)
  return id
}

/** Combine device contributions by note path, keeping one note per day and summing writing. */
export function combineActivity(states: ActivityState[]): ActivityState {
  const result = emptyActivity(localDay())
  for (const state of states) {
    if (state.startedAt < result.startedAt) result.startedAt = state.startedAt
    for (const [id, note] of Object.entries(state.notes)) {
      const key = JSON.stringify([note.path, !!note.deleted])
      result.notes[key] = { ...note }
      const created = state.created[id]
      if (created && (!result.created[key] || created < result.created[key]))
        result.created[key] = created
      for (const [day, entries] of Object.entries(state.days)) {
        const activity = entries[id]
        if (!activity) continue
        const target = result.days[day] ?? (result.days[day] = {})
        const previous = target[key]
        target[key] = {
          words: (previous?.words ?? 0) + activity.words,
          sessions: (previous?.sessions ?? 0) + activity.sessions,
          lastEdit: Math.max(previous?.lastEdit ?? 0, activity.lastEdit),
        }
      }
    }
  }
  return result
}
