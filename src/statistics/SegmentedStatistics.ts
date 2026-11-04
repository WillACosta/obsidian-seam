import { ActivityState, DailyNoteActivity, emptyActivity, parseActivity } from './WritingActivity'
import { STATISTICS_FOLDER } from './StatisticsStorage'

/** Leave ample headroom below Obsidian Sync's standard file-size limit. */
export const STATISTICS_SEGMENT_BYTES = 1024 * 1024

type Row = [string, unknown] | [string, string, unknown]
type Manifest = {
  version: 2
  type: 'manifest'
  startedAt: string
  sequence: number
  files: [string, string][]
}
type Segment = { version: 2; type: 'references' | 'month'; month?: string; rows: Row[] }
const bytes = (value: string): number => new TextEncoder().encode(value).length
const base = (device: string): string => `${STATISTICS_FOLDER}/${device}`

// Detect out-of-order Sync updates; this checksum is for consistency, not authentication.
const checksum = (content: string): string => {
  let a = 0x811c9dc5
  let b = 0x9e3779b9
  for (let i = 0; i < content.length; i++) {
    a = Math.imul(a ^ content.charCodeAt(i), 0x01000193)
    b = Math.imul(b ^ content.charCodeAt(i), 0x85ebca6b)
  }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`
}

/** Encode independent reference shards and month shards. Each row stays in exactly one shard. */
export function encodeStatistics(
  device: string,
  state: ActivityState,
  limit = STATISTICS_SEGMENT_BYTES,
  incremental?: { previous: Map<string, string>; months: Set<string>; references: boolean },
): Map<string, string> {
  const previousManifest = incremental?.previous.get(`${base(device)}.json`)
  // Legacy snapshots have no reusable shards; the first subsequent save must encode all history.
  if (previousManifest && JSON.parse(previousManifest).version === 1) incremental = undefined
  if (!incremental) parseActivity(state)
  const files = new Map<string, string>()
  if (incremental) {
    for (const [path, content] of incremental.previous) {
      if (path === `${base(device)}.json`) continue
      const suffix = path.slice(base(device).length + 1)
      if (suffix.startsWith('refs.') && incremental.references) continue
      if (incremental.months.has(suffix.slice(0, 7))) continue
      files.set(path, content)
    }
  }
  const add = (name: string, type: Segment['type'], rows: Row[], month?: string): void => {
    let part = 1
    let chunk: Row[] = []
    let size = 128
    const emit = (): void => {
      if (!chunk.length) return
      const path = `${base(device)}.${name}.${String(part++).padStart(4, '0')}.json`
      const content = JSON.stringify({ version: 2, type, ...(month ? { month } : {}), rows: chunk })
      if (bytes(content) > limit) throw new Error('Statistics segment exceeds size limit')
      files.set(path, content)
      chunk = []
      size = 128
    }
    for (const row of rows) {
      const rowSize = bytes(JSON.stringify(row)) + 1
      if (size + rowSize > limit && chunk.length) emit()
      if (size + rowSize > limit) throw new Error('Statistics record exceeds size limit')
      chunk.push(row)
      size += rowSize
    }
    emit()
  }
  if (!incremental || incremental.references)
    add(
      'refs',
      'references',
      Object.entries(state.notes).sort(([a], [b]) => a.localeCompare(b)),
    )
  const months = new Map<string, Row[]>()
  for (const [day, entries] of Object.entries(state.days).sort(([a], [b]) => a.localeCompare(b))) {
    const month = day.slice(0, 7)
    if (incremental && !incremental.months.has(month)) continue
    const rows = months.get(month) ?? []
    for (const [id, activity] of Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)))
      rows.push([day, id, activity])
    months.set(month, rows)
  }
  for (const [id, day] of Object.entries(state.created).sort(([a], [b]) => a.localeCompare(b))) {
    const month = day.slice(0, 7)
    if (incremental && !incremental.months.has(month)) continue
    const rows = months.get(month) ?? []
    rows.push([id, day])
    months.set(month, rows)
  }
  for (const [month, rows] of [...months].sort(([a], [b]) => a.localeCompare(b)))
    add(month, 'month', rows, month)
  const oldManifest = incremental?.previous.get(`${base(device)}.json`)
  const oldChecksums = new Map<string, string>(
    oldManifest ? (JSON.parse(oldManifest) as Manifest).files : [],
  )
  const manifest: Manifest = {
    version: 2,
    type: 'manifest',
    startedAt: state.startedAt,
    sequence: state.sequence,
    files: [...files]
      .map(([path, content]): [string, string] => {
        const name = path.slice(STATISTICS_FOLDER.length + 1)
        const previous = incremental?.previous.get(path)
        return [
          name,
          previous === content ? (oldChecksums.get(name) ?? checksum(content)) : checksum(content),
        ]
      })
      .sort(([a], [b]) => a.localeCompare(b)),
  }
  const content = JSON.stringify(manifest)
  if (bytes(content) > limit) throw new Error('Statistics manifest exceeds size limit')
  files.set(`${base(device)}.json`, content)
  return files
}

/** Validate every shard before exposing a snapshot; incomplete sync never replaces a good snapshot. */
export async function decodeStatistics(
  device: string,
  read: (path: string) => Promise<string>,
): Promise<{ state: ActivityState; files: Map<string, string> }> {
  const manifestPath = `${base(device)}.json`
  const manifestRaw = await read(manifestPath)
  const manifest = JSON.parse(manifestRaw) as Manifest
  if ((manifest as { version?: number })?.version === 1)
    return { state: parseActivity(manifest), files: new Map([[manifestPath, manifestRaw]]) }
  if (manifest?.version !== 2 || manifest.type !== 'manifest' || !Array.isArray(manifest.files))
    throw new Error('Invalid statistics manifest')
  const files = new Map<string, string>([[manifestPath, manifestRaw]])
  const state = emptyActivity(manifest.startedAt)
  state.sequence = manifest.sequence
  for (const entry of manifest.files) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[1] !== 'string' ||
      !/^[0-9a-f]{16}$/.test(entry[1])
    )
      throw new Error('Invalid statistics checksum')
    const [name, expected] = entry
    if (
      typeof name !== 'string' ||
      !name.startsWith(`${device}.`) ||
      !/^[a-zA-Z0-9.-]+\.json$/.test(name)
    )
      throw new Error('Invalid statistics segment path')
    const path = `${STATISTICS_FOLDER}/${name}`
    if (files.has(path)) throw new Error('Duplicate statistics segment')
    const raw = await read(path)
    if (checksum(raw) !== expected) throw new Error('Statistics segment is not yet synchronized')
    const part = JSON.parse(raw) as Segment
    if (
      part?.version !== 2 ||
      !Array.isArray(part.rows) ||
      (part.type !== 'references' && part.type !== 'month')
    )
      throw new Error('Invalid statistics segment')
    if (part.type === 'references' && !name.startsWith(`${device}.refs.`))
      throw new Error('Invalid reference segment')
    if (
      part.type === 'month' &&
      (!/^\d{4}-\d{2}$/.test(part.month ?? '') || !name.startsWith(`${device}.${part.month}.`))
    )
      throw new Error('Invalid monthly segment')
    for (const row of part.rows) {
      if (!Array.isArray(row) || typeof row[0] !== 'string')
        throw new Error('Invalid statistics row')
      if (part.type === 'references') {
        if (row.length !== 2 || state.notes[row[0]]) throw new Error('Duplicate note reference')
        state.notes[row[0]] = row[1] as ActivityState['notes'][string]
      } else if (row.length === 2) {
        if (
          typeof row[1] !== 'string' ||
          !row[1].startsWith(`${part.month}-`) ||
          state.created[row[0]]
        )
          throw new Error('Invalid creation row')
        state.created[row[0]] = row[1]
      } else if (
        row.length === 3 &&
        typeof row[1] === 'string' &&
        row[0].startsWith(`${part.month}-`)
      ) {
        const day = state.days[row[0]] ?? (state.days[row[0]] = {})
        if (day[row[1]]) throw new Error('Duplicate activity row')
        day[row[1]] = row[2] as DailyNoteActivity
      } else throw new Error('Invalid monthly row')
    }
    files.set(path, raw)
  }
  return { state: parseActivity(state), files }
}
