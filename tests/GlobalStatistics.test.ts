import './mocks/obsidian'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EditorState, Transaction } from '@codemirror/state'
import type { App, TFile } from 'obsidian'
import { MockTFile, MockTFolder } from './mocks/obsidian'
import {
  ActivityState,
  applyActivity,
  activityTotals,
  emptyActivity,
  grossWordsAdded,
  localDay,
  parseActivity,
  parseActivityJournal,
  SESSION_GAP_MS,
} from '../src/statistics/WritingActivity'
import {
  contribution,
  contributionWeeks,
  intensity,
  monthlyTrends,
  monthlyChartScale,
} from '../src/statistics/GlobalStatisticsModel'
import { observeWritingTransactions } from '../src/statistics/WritingActivityExtension'
import { GlobalStatistics } from '../src/statistics/GlobalStatistics'
import {
  encodeStatistics,
  decodeStatistics,
  STATISTICS_SEGMENT_BYTES,
} from '../src/statistics/SegmentedStatistics'

class MarkdownViewHost {}
Object.assign(require.cache['obsidian']!.exports, {
  Notice: class {},
  MarkdownView: MarkdownViewHost,
})
const storage = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
  document: { hidden: false },
})
function edit(before: string, from: number, to: number, insert: string) {
  const transaction = EditorState.create({ doc: before }).update({ changes: { from, to, insert } })
  const changes: { fromA: number; toA: number; fromB: number; toB: number }[] = []
  transaction.changes.iterChanges((fromA, toA, fromB, toB) =>
    changes.push({ fromA, toA, fromB, toB }),
  )
  return grossWordsAdded(before, transaction.newDoc.toString(), changes)
}
describe('Gross words added', () => {
  it('credits a typed word once, including growing prefixes and trailing separators', () => {
    assert.equal(edit('', 0, 0, 'h'), 1)
    assert.equal(edit('h', 1, 1, 'ello'), 0)
    assert.equal(edit('hello', 5, 5, ' '), 0)
    assert.equal(edit('hello ', 6, 6, 'world'), 1)
    assert.equal(edit('hello world', 11, 11, 's'), 0)
  })
  it('counts replacement words even when net count stays constant or falls', () => {
    assert.equal(edit('one two', 0, 7, 'three four'), 2)
    assert.equal(edit('one two three', 0, 13, 'new'), 1)
    assert.equal(edit('one two', 0, 3, 'one'), 0)
    assert.equal(edit('one two', 0, 7, 'one two three'), 1)
    assert.equal(edit('one two', 0, 7, 'two one'), 0)
    assert.equal(edit('hello', 1, 4, 'ipp'), 0)
  })
  it('counts splits, merges, deletion, punctuation and Unicode consistently', () => {
    assert.equal(edit('helloworld', 5, 5, ' '), 1)
    assert.equal(edit('hello world', 5, 6, ''), 0)
    assert.equal(edit('hello world', 0, 6, ''), 0)
    assert.equal(edit('café', 4, 4, ' déjà vu'), 2)
    assert.equal(edit('word', 4, 4, '!'), 0)
    assert.equal(edit('', 0, 0, '😀 ** café well-known'), 2)
  })
  it('credits only new words when a large repeated passage is pasted over itself', () => {
    const before = 'repeated word '.repeat(2000)
    assert.equal(edit(before, 0, before.length, before + 'addition'), 1)
  })
  it('does not double-count overlapping neighbourhoods of multiple changes', () => {
    const before = 'one two three'
    const transaction = EditorState.create({ doc: before }).update({
      changes: [
        { from: 0, to: 3, insert: 'new' },
        { from: 8, to: 13, insert: 'fresh' },
      ],
    })
    const changes: { fromA: number; toA: number; fromB: number; toB: number }[] = []
    transaction.changes.iterChanges((fromA, toA, fromB, toB) =>
      changes.push({ fromA, toA, fromB, toB }),
    )
    assert.equal(grossWordsAdded(before, transaction.newDoc.toString(), changes), 2)
  })
})

describe('Editor transaction provenance', () => {
  for (const event of [
    'input.type',
    'input.type.compose',
    'input.paste',
    'input.complete',
    'delete.backward',
    'undo',
    'redo',
    undefined,
  ]) {
    it(`handles ${event ?? 'programmatic'} updates without fabricating writing`, () => {
      const edits: number[] = []
      let updated = ''
      const tr = EditorState.create({ doc: 'old' }).update({
        changes: { from: 0, to: 3, insert: 'new words' },
        userEvent: event,
      })
      observeWritingTransactions(
        {
          updateEditor: (_file, text) => {
            updated = text
          },
          recordEdit: (_file, words) => {
            edits.push(words)
          },
        },
        new MockTFile('A.md') as TFile,
        [tr],
        true,
        tr.newDoc.toString(),
      )
      assert.equal(updated, 'new words')
      assert.deepEqual(edits, event?.startsWith('input') || event?.startsWith('delete') ? [2] : [])
    })
  }
  it('credits IME composition once when the entire provisional word is repeatedly replaced', () => {
    let state = EditorState.create({ doc: '' })
    const words: number[] = []
    let continuing = false
    for (const text of ['n', 'ni', '你']) {
      const tr = state.update({
        changes: { from: 0, to: state.doc.length, insert: text },
        userEvent: 'input.type.compose',
      })
      continuing = observeWritingTransactions(
        {
          updateEditor() {},
          recordEdit: (_file, count) => {
            words.push(count)
          },
        },
        new MockTFile('A.md') as TFile,
        [tr],
        true,
        text,
        continuing,
      )
      state = tr.state
    }
    assert.deepEqual(words, [1, 0, 0])
  })
  it('credits the first IME replacement of existing text before coalescing provisional updates', () => {
    const state = EditorState.create({ doc: 'replace these' })
    const tr = state.update({
      changes: { from: 0, to: state.doc.length, insert: 'n' },
      userEvent: 'input.type.compose',
    })
    const words: number[] = []
    const continuing = observeWritingTransactions(
      {
        updateEditor() {},
        recordEdit: (_file, count) => {
          words.push(count)
        },
      },
      new MockTFile('A.md') as TFile,
      [tr],
      true,
      'n',
    )
    const second = tr.state.update({
      changes: { from: 0, to: 1, insert: '你' },
      userEvent: 'input.type.compose',
    })
    observeWritingTransactions(
      {
        updateEditor() {},
        recordEdit: (_file, count) => {
          words.push(count)
        },
      },
      new MockTFile('A.md') as TFile,
      [second],
      true,
      '你',
      continuing,
    )
    assert.deepEqual(words, [1, 0])
  })
  it('counts a direct move as an edit without crediting reordered words', () => {
    const state = EditorState.create({ doc: 'one two' })
    const tr = state.update({
      changes: { from: 0, to: 7, insert: 'two one' },
      userEvent: 'move.drop',
    })
    const words: number[] = []
    observeWritingTransactions(
      {
        updateEditor() {},
        recordEdit: (_file, count) => {
          words.push(count)
        },
      },
      new MockTFile('A.md') as TFile,
      [tr],
      true,
      'two one',
    )
    assert.deepEqual(words, [0])
  })
  it('excludes remote, unfocused, identical replacements and selection-only transactions', () => {
    const state = EditorState.create({ doc: 'text' })
    const service = {
      updateEditor() {},
      recordEdit() {
        assert.fail('Not direct writing')
      },
    }
    observeWritingTransactions(
      service,
      new MockTFile('A.md') as TFile,
      [
        state.update({
          changes: { from: 4, insert: ' synced' },
          userEvent: 'input',
          annotations: Transaction.remote.of(true),
        }),
      ],
      true,
      'text synced',
    )
    observeWritingTransactions(
      service,
      new MockTFile('A.md') as TFile,
      [state.update({ changes: { from: 4, insert: ' offscreen' }, userEvent: 'input' })],
      false,
      'text offscreen',
    )
    observeWritingTransactions(
      service,
      new MockTFile('A.md') as TFile,
      [
        state.update({ changes: { from: 0, to: 4, insert: 'text' }, userEvent: 'input' }),
        state.update({ selection: { anchor: 0 } }),
      ],
      true,
      'text',
    )
  })
})

function record(state: ActivityState, id: string, day: string, words: number, timestamp: number) {
  applyActivity(state, {
    kind: 'edit',
    sequence: state.sequence + 1,
    id,
    path: `${id}.md`,
    day,
    words,
    timestamp,
  })
}
describe('Local activity ledger and calendar aggregates', () => {
  it('deduplicates replayed events and groups sessions per note/day across reloads', () => {
    const state = emptyActivity('2026-10-26')
    record(state, 'A', '2026-10-26', 2, 1000)
    const restored = parseActivity(JSON.parse(JSON.stringify(state)))
    record(restored, 'A', '2026-10-26', 1, 2000)
    record(restored, 'A', '2026-10-26', 3, 2000 + SESSION_GAP_MS + 1)
    applyActivity(restored, {
      kind: 'edit',
      sequence: 1,
      id: 'A',
      path: 'A.md',
      day: '2026-10-26',
      words: 1000,
      timestamp: 1000,
    })
    assert.equal(contribution(restored, '2026-10-26', 'words'), 6)
    assert.equal(contribution(restored, '2026-10-26', 'sessions'), 2)
    assert.equal(contribution(restored, '2026-10-26', 'notes'), 1)
  })
  it('tracks renames, folder moves, deletion and future days without rewriting past totals', () => {
    const state = emptyActivity('2026-10-24')
    record(state, 'A', '2026-10-24', 2, 1000)
    applyActivity(state, { kind: 'rename', sequence: 2, from: 'A.md', to: 'Folder/A.md' })
    applyActivity(state, { kind: 'rename', sequence: 3, from: 'Folder', to: 'Moved' })
    assert.equal(state.notes.A.path, 'Moved/A.md')
    applyActivity(state, { kind: 'delete', sequence: 4, path: 'Moved' })
    assert.equal(state.notes.A.deleted, true)
    record(state, 'B', '2026-10-25', 0, 2000)
    record(state, 'C', '2026-10-27', 999, 3000)
    assert.deepEqual(activityTotals(state, '2026-10-26'), { activeDays: 2, streak: 2 })
    assert.deepEqual(activityTotals(state, '2026-10-29'), { activeDays: 3, streak: 0 })
  })
  it('uses local calendar dates and treats midnight as a new session even within five minutes', () => {
    const state = emptyActivity('2026-10-25')
    const a = new Date(2026, 9, 25, 23, 59)
    const b = new Date(2026, 9, 26, 0, 1)
    record(state, 'A', localDay(a), 1, a.getTime())
    record(state, 'A', localDay(b), 1, b.getTime())
    assert.equal(contribution(state, '2026-10-25', 'sessions'), 1)
    assert.equal(contribution(state, '2026-10-26', 'sessions'), 1)
    assert.deepEqual(activityTotals(state, '2026-10-26'), { activeDays: 2, streak: 2 })
  })
  it('builds 52 weekly columns, a three-month range, and never exposes future dates', () => {
    const weeks = contributionWeeks('2026-10-26', 'year')
    assert.equal(weeks.length, 52)
    assert.equal(weeks[51][1], '2026-10-26')
    assert.equal(weeks[51][2], null)
    assert.ok(weeks.flat().every((day) => day === null || day <= '2026-10-26'))
    assert.ok(contributionWeeks('2024-05-31', 'quarter').flat().includes('2024-02-29'))
    assert.deepEqual(
      [0, 1, 2, 3, 4].map((value) => intensity(value, 4)),
      [0, 1, 2, 3, 4],
    )
  })
  it('aggregates six months across New Year and excludes future contributions and creations', () => {
    const state = emptyActivity('2025-09-01')
    record(state, 'A', '2025-12-31', 4, 1000)
    record(state, 'A', '2026-01-01', 3, 2000)
    record(state, 'B', '2026-01-03', 99, 3000)
    applyActivity(state, { kind: 'create', sequence: 4, id: 'A', path: 'A.md', day: '2025-12-31' })
    applyActivity(state, { kind: 'create', sequence: 5, id: 'B', path: 'B.md', day: '2026-01-03' })
    const words = monthlyTrends(state, '2026-01-02', 'words')
    assert.equal(words.length, 6)
    assert.equal(words[0].month, '2025-08')
    assert.deepEqual(
      words.slice(-2).map((month) => month.value),
      [4, 3],
    )
    assert.deepEqual(
      monthlyTrends(state, '2026-01-02', 'created')
        .slice(-2)
        .map((month) => month.value),
      [1, 0],
    )
  })
  it('keeps recorded local dates stable after timezone changes and excludes days that become future dates', () => {
    const previous = process.env.TZ
    try {
      process.env.TZ = 'Pacific/Auckland'
      const timestamp = new Date('2026-10-26T12:30:00Z').getTime()
      const state = emptyActivity(localDay(new Date(timestamp)))
      record(state, 'A', localDay(new Date(timestamp)), 1, timestamp)
      assert.ok(state.days['2026-10-27'])
      process.env.TZ = 'America/Los_Angeles'
      assert.equal(localDay(new Date(timestamp)), '2026-10-26')
      assert.deepEqual(activityTotals(state, localDay(new Date(timestamp))), {
        activeDays: 0,
        streak: 0,
      })
      process.env.TZ = 'America/New_York'
      const spring = emptyActivity('2026-03-07')
      record(spring, 'A', '2026-03-07', 1, new Date(2026, 2, 7, 12).getTime())
      record(spring, 'A', '2026-03-08', 1, new Date(2026, 2, 8, 12).getTime())
      assert.deepEqual(activityTotals(spring, '2026-03-08'), { activeDays: 2, streak: 2 })
    } finally {
      if (previous === undefined) delete process.env.TZ
      else process.env.TZ = previous
    }
  })
  it('rejects malformed recovery events before applying them', () => {
    for (const journal of [
      [{ kind: 'unknown', sequence: 1 }],
      [
        {
          kind: 'edit',
          sequence: 1,
          id: 'A',
          path: 'A.md',
          day: '2026-10-26',
          words: -1,
          timestamp: 0,
        },
      ],
    ])
      assert.throws(() => parseActivityJournal(journal))
  })
  it('rejects corrupt, unsupported and negative activity data', () => {
    for (const value of [
      null,
      { version: 2 },
      { ...emptyActivity('2026-10-26'), days: { bad: {} } },
      {
        ...emptyActivity('2026-10-26'),
        notes: { A: { path: 'A.md' } },
        days: { '2026-10-26': { A: { words: -1, sessions: 1, lastEdit: 0 } } },
      },
    ])
      assert.throws(() => parseActivity(value))
  })
})

let fixtureNumber = 0
function fixture(
  existing?: ActivityState,
  seed: [string, string][] = [
    ['A.md', 'one two'],
    ['B.md', 'three'],
  ],
) {
  const path = `Resources/Seam/Statistics/test-${fixtureNumber++}.json`
  const files = new Map<string, MockTFile>()
  const texts = new Map<string, string>(seed)
  for (const [path] of seed) files.set(path, new MockTFile(path))
  const disk = new Map<string, string>()
  const device = path.split('/').pop()!.replace('.json', '')
  if (existing)
    for (const [name, content] of encodeStatistics(device, existing)) disk.set(name, content)
  const events = new Map<string, Function>()
  let reads = 0
  let fail = false
  const app = {
    loadLocalStorage: (key: string) => storage.get(key) ?? null,
    saveLocalStorage: (key: string, value: string | null) => {
      if (value === null) storage.delete(key)
      else storage.set(key, value)
    },
    vault: {
      createFolder: async (path: string) => {
        files.set(path, new MockTFolder(path) as MockTFile)
      },
      adapter: {
        list: async (folder: string) => ({
          files: [...disk.keys()].filter((path) => path.startsWith(folder + '/')),
          folders: [],
        }),
        getResourcePath: (path: string) => path,
        exists: async (path: string) => disk.has(path),
        read: async (path: string) => disk.get(path),
        write: async (path: string, text: string) => {
          if (fail) throw Error('Storage unavailable')
          disk.set(path, text)
        },
        remove: async (path: string) => {
          disk.delete(path)
        },
      },
      on: (name: string, handler: Function) => {
        events.set(name, handler)
      },
      getAbstractFileByPath: (path: string) => files.get(path) ?? null,
      getMarkdownFiles: () => [...files.values()].filter((file) => file instanceof MockTFile),
      cachedRead: async (file: TFile) => {
        reads++
        return texts.get(file.path) ?? ''
      },
    },
    workspace: { onLayoutReady: (ready: () => void) => ready(), getLeavesOfType: () => [] },
  } as unknown as App
  const service = new GlobalStatistics(
    app,
    'test-plugin',
    path.split('/').pop()!.replace('.json', ''),
  )
  Object.assign(service, { registerEvent() {}, registerDomEvent() {} })
  return {
    app,
    service,
    files,
    texts,
    disk,
    path,
    device,
    readState: async () =>
      (
        await decodeStatistics(device, async (name) => {
          const content = disk.get(name)
          if (content === undefined) throw new Error('Missing segment')
          return content
        })
      ).state,
    events,
    reads: () => reads,
    fail: (value: boolean) => {
      fail = value
    },
  }
}
describe('Background global statistics and persistence', () => {
  it('reads a legacy remote snapshot without changing it or counting it twice', async () => {
    const f = fixture()
    const legacy = emptyActivity('2026-10-01')
    record(legacy, 'legacy', '2026-10-30', 7, 1000)
    const path = 'Resources/Seam/Statistics/legacy-device.json'
    const original = JSON.stringify(legacy)
    f.disk.set(path, original)
    await f.service.initialize()
    await f.service.refreshRemote()
    assert.equal(f.service.snapshot().error, false)
    assert.equal(contribution(f.service.snapshot().activity, '2026-10-30', 'words'), 7)
    assert.equal(f.disk.get(path), original)
    f.service.onunload()
  })
  it('preserves all legacy local history when the next edit migrates it to segments', async () => {
    const f = fixture()
    const legacy = emptyActivity('2026-09-01')
    record(legacy, 'old', '2026-09-03', 7, 1000)
    record(legacy, 'later', '2026-10-03', 3, 2000)
    const original = JSON.stringify(legacy)
    f.disk.set(f.path, original)
    await f.service.initialize()
    assert.equal(f.service.snapshot().error, false)
    assert.equal(f.disk.get(f.path), original)
    f.service.recordEdit(f.files.get('A.md')! as TFile, 2, {})
    await f.service.flush()
    const migrated = await f.readState()
    assert.equal(contribution(migrated, '2026-09-03', 'words'), 7)
    assert.equal(contribution(migrated, '2026-10-03', 'words'), 3)
    assert.equal(contribution(migrated, localDay(), 'words'), 2)
    assert.equal(JSON.parse(f.disk.get(f.path)!).version, 2)
    f.service.onunload()
  })
  it('creates metadata folders without setup and combines arriving device snapshots once', async () => {
    const f = fixture()
    await f.service.initialize()
    assert.ok(f.files.has('Resources/Seam/Statistics'))
    const localFile = f.files.get('A.md')! as TFile
    f.service.recordEdit(localFile, 2, {})
    await f.service.flush()
    const remote = emptyActivity(localDay())
    record(remote, 'remote-note', localDay(), 5, Date.now())
    remote.notes['remote-note'].path = 'A.md'
    const remotePath = 'Resources/Seam/Statistics/ipad.json'
    for (const [path, content] of encodeStatistics('ipad', remote)) f.disk.set(path, content)
    await f.service.refreshRemote()
    await f.service.refreshRemote()
    assert.equal(contribution(f.service.snapshot().activity, localDay(), 'words'), 7)
    assert.equal(contribution(f.service.snapshot().activity, localDay(), 'notes'), 1)
    remote.days[localDay()]['remote-note'].words = 8
    for (const [path, content] of encodeStatistics('ipad', remote)) f.disk.set(path, content)
    await f.service.refreshRemote()
    assert.equal(contribution(f.service.snapshot().activity, localDay(), 'words'), 10)
    assert.equal(contribution(await f.readState(), localDay(), 'words'), 2)
    f.disk.set(remotePath, '{broken')
    await f.service.refreshRemote()
    assert.equal(f.service.snapshot().error, true)
    assert.equal(contribution(f.service.snapshot().activity, localDay(), 'words'), 10)
    f.disk.delete(remotePath)
    await f.service.refreshRemote()
    assert.equal(contribution(f.service.snapshot().activity, localDay(), 'words'), 2)
    f.service.onunload()
  })
  it('supports an empty vault without fabricated activity', async () => {
    const f = fixture(undefined, [])
    await f.service.initialize()
    assert.equal(f.service.snapshot().totalNotes, 0)
    assert.equal(f.service.snapshot().totalWords, 0)
    assert.deepEqual(activityTotals(f.service.snapshot().activity, localDay()), {
      activeDays: 0,
      streak: 0,
    })
    f.service.onunload()
  })
  it('indexes existing notes without inventing history and never scans on snapshot/open', async () => {
    const f = fixture()
    await f.service.initialize()
    assert.equal(f.service.snapshot().totalNotes, 2)
    assert.equal(f.service.snapshot().totalWords, 3)
    assert.deepEqual(f.service.snapshot().activity.days, {})
    assert.deepEqual(f.service.snapshot().activity.created, {})
    const reads = f.reads()
    for (let i = 0; i < 10; i++) f.service.snapshot()
    assert.equal(f.reads(), reads)
    await f.service.flush()
    assert.ok(f.disk.has(f.path))
    f.service.onunload()
  })
  it('uses stored totals during initial editor loading and keeps unsaved editor totals during a later refresh', async () => {
    const f = fixture()
    const view = Object.assign(new MarkdownViewHost(), {
      file: f.files.get('A.md'),
      getMode: () => 'source',
      editor: { getValue: () => '' },
    })
    f.app.workspace.getLeavesOfType = () => [{ view }] as never
    f.service.onload()
    await f.service.initialize()
    assert.equal(f.service.snapshot().totalWords, 3)
    f.service.updateEditor(f.files.get('A.md')! as TFile, 'unsaved content has four')
    f.events.get('modify')!(f.files.get('A.md'))
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(f.service.snapshot().totalWords, 5)
    f.service.onunload()
  })
  it('keeps a note identity when typing arrives before persisted history has loaded', async () => {
    const state = emptyActivity(localDay())
    record(state, 'A', localDay(), 3, Date.now() - 1000)
    const f = fixture(state)
    f.service.recordEdit(f.files.get('A.md')! as TFile, 2, {})
    await f.service.initialize()
    await f.service.flush()
    assert.equal(contribution(f.service.snapshot().activity, localDay(), 'words'), 5)
    assert.equal(contribution(f.service.snapshot().activity, localDay(), 'notes'), 1)
    f.service.onunload()
  })
  it('preserves early buffered input through a reload while history is still loading', async () => {
    const f = fixture(emptyActivity(localDay()))
    let release!: () => void
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const read = f.app.vault.adapter.read
    let first = true
    f.app.vault.adapter.read = async (path) => {
      if (first) {
        first = false
        await blocked
      }
      return read(path)
    }
    const firstInitialization = f.service.initialize()
    await new Promise((resolve) => setImmediate(resolve))
    f.service.recordEdit(f.files.get('A.md')! as TFile, 1, {})
    f.service.onunload()
    const restored = new GlobalStatistics(
      f.app,
      'test-plugin',
      f.path.split('/').pop()!.replace('.json', ''),
    )
    const secondInitialization = restored.initialize()
    release()
    await firstInitialization
    await secondInitialization
    assert.equal(contribution(restored.snapshot().activity, localDay(), 'words'), 1)
    restored.onunload()
  })
  it('waits for the previous service writer during reload before loading or saving new edits', async () => {
    const f = fixture(emptyActivity(localDay()))
    await f.service.initialize()
    let release!: () => void
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const write = f.app.vault.adapter.write
    let first = true
    f.app.vault.adapter.write = async (path, data) => {
      if (first) {
        first = false
        await blocked
      }
      return write(path, data)
    }
    const file = f.files.get('A.md')! as TFile
    f.service.recordEdit(file, 1, {})
    await new Promise((resolve) => setImmediate(resolve))
    f.service.onunload()
    const restored = new GlobalStatistics(
      f.app,
      'test-plugin',
      f.path.split('/').pop()!.replace('.json', ''),
    )
    let ready = false
    const initialization = restored.initialize().then(() => {
      ready = true
    })
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(ready, false)
    release()
    await initialization
    restored.recordEdit(file, 2, {})
    await restored.flush()
    assert.equal(contribution(await f.readState(), localDay(), 'words'), 3)
    restored.onunload()
  })
  it('migrates a legacy pending journal once without replaying it after a successful save', async () => {
    const f = fixture()
    const key = `seam-writing:${f.path}`
    const event = {
      kind: 'edit',
      id: 'legacy-note',
      path: 'A.md',
      words: 5,
      timestamp: Date.now(),
      day: localDay(),
      sequence: 1,
    }
    const legacyValue = JSON.stringify([event])
    storage.set(key, legacyValue)
    Object.defineProperty(globalThis.localStorage, key, {
      value: legacyValue,
      configurable: true,
      enumerable: true,
    })
    // Vault-scoped values use a separate namespace from legacy browser keys.
    const scoped = new Map<string, string>()
    f.app.loadLocalStorage = (name) => scoped.get(name) ?? null
    f.app.saveLocalStorage = (name, value) => {
      if (value === null) scoped.delete(name)
      else scoped.set(name, value as string)
    }
    try {
      await f.service.initialize()
      await f.service.flush()
      assert.equal(contribution(await f.readState(), localDay(), 'words'), 5)
      assert.equal(scoped.get(`${key}:migrated`), '1')
      f.service.onunload()
      const restored = new GlobalStatistics(f.app, 'test-plugin', f.device)
      await restored.initialize()
      await restored.flush()
      assert.equal(contribution(restored.snapshot().activity, localDay(), 'words'), 5)
      restored.onunload()
    } finally {
      storage.delete(key)
      Reflect.deleteProperty(globalThis.localStorage, key)
    }
  })
  it('stores user activity once and recovers a journal after an immediate failed-save reload', async () => {
    const f = fixture()
    await f.service.initialize()
    await f.service.flush()
    f.fail(true)
    const file = f.files.get('A.md')! as TFile
    const transaction = {}
    f.service.recordEdit(file, 3, transaction)
    f.service.recordEdit(file, 3, transaction)
    await f.service.flush()
    assert.equal(f.service.snapshot().saveError, true)
    assert.equal(contribution(f.service.snapshot().activity, localDay(), 'words'), 3)
    f.service.onunload()
    await f.service.flush()
    f.fail(false)
    const restored = new GlobalStatistics(
      f.app,
      'test-plugin',
      f.path.split('/').pop()!.replace('.json', ''),
    )
    await restored.initialize()
    await restored.flush()
    assert.equal(contribution(restored.snapshot().activity, localDay(), 'words'), 3)
    assert.equal(contribution(restored.snapshot().activity, localDay(), 'sessions'), 1)
    restored.onunload()
  })
  for (const silent of [false, true])
    it(`recovers a ${silent ? 'silently truncated' : 'failed'} local write from the complete checkpoint`, async () => {
      const state = emptyActivity(localDay())
      record(state, 'A', localDay(), 3, Date.now() - 1000)
      const f = fixture(state)
      await f.service.initialize()
      const write = f.app.vault.adapter.write
      f.app.vault.adapter.write = async (path, data) => {
        if (path !== f.path) return write(path, data)
        f.disk.set(path, '')
        if (!silent) throw new Error('Interrupted write')
      }
      f.service.recordEdit(f.files.get('A.md')! as TFile, 2, {})
      await f.service.flush()
      assert.equal(f.service.snapshot().saveError, true)
      assert.equal(f.disk.get(f.path), '')
      const checkpoint = f.path.replace(/\/([^/]+)\.json$/, '/.$1.checkpoint')
      assert.ok(f.disk.get(checkpoint))
      f.service.onunload()
      f.app.vault.adapter.write = write
      const restored = new GlobalStatistics(
        f.app,
        'test-plugin',
        f.path.split('/').pop()!.replace('.json', ''),
      )
      await restored.initialize()
      await restored.flush()
      assert.equal(restored.snapshot().error, false)
      assert.equal(contribution(await f.readState(), localDay(), 'words'), 5)
      assert.equal(f.disk.has(checkpoint), false)
      restored.onunload()
    })
  it('preserves the last checkpoint if another write fails while replacing it', async () => {
    const state = emptyActivity(localDay())
    record(state, 'A', localDay(), 3, Date.now() - 1000)
    const f = fixture(state)
    await f.service.initialize()
    const write = f.app.vault.adapter.write
    f.app.vault.adapter.write = async (path, data) => {
      if (path !== f.path) return write(path, data)
      f.disk.set(path, '')
      throw new Error('Interrupted primary write')
    }
    f.service.recordEdit(f.files.get('A.md')! as TFile, 2, {})
    await f.service.flush()
    await new Promise((resolve) => setImmediate(resolve))
    f.app.vault.adapter.write = async (path, data) => {
      if (path.endsWith('.checkpoint')) {
        f.disk.set(path, '')
        throw new Error('Interrupted checkpoint write')
      }
      await write(path, data)
    }
    await f.service.flush()
    assert.equal(contribution(await f.readState(), localDay(), 'words'), 5)
    f.service.onunload()
    f.app.vault.adapter.write = write
    const restored = new GlobalStatistics(
      f.app,
      'test-plugin',
      f.path.split('/').pop()!.replace('.json', ''),
    )
    await restored.initialize()
    assert.equal(restored.snapshot().error, false)
    assert.equal(contribution(restored.snapshot().activity, localDay(), 'words'), 5)
    restored.onunload()
  })
  it('keeps valid history when an interrupted checkpoint is incomplete', async () => {
    const state = emptyActivity(localDay())
    record(state, 'A', localDay(), 3, Date.now())
    const f = fixture(state)
    const checkpoint = f.path.replace(/\/([^/]+)\.json$/, '/.$1.checkpoint')
    f.disk.set(checkpoint, '')
    await f.service.initialize()
    assert.equal(f.service.snapshot().error, false)
    assert.equal(contribution(f.service.snapshot().activity, localDay(), 'words'), 3)
    assert.equal(f.disk.has(checkpoint), false)
    f.service.onunload()
  })
  it('does not overwrite history if a recovery checkpoint cannot be saved', async () => {
    const f = fixture(emptyActivity(localDay()))
    await f.service.initialize()
    const before = f.disk.get(f.path)
    const write = f.app.vault.adapter.write
    f.app.vault.adapter.write = async (path, data) => {
      if (path.endsWith('.checkpoint')) throw new Error('Storage full')
      await write(path, data)
    }
    try {
      f.service.recordEdit(f.files.get('A.md')! as TFile, 2, {})
      await f.service.flush()
      assert.equal(f.service.snapshot().saveError, true)
      assert.equal(f.disk.get(f.path), before)
    } finally {
      f.app.vault.adapter.write = write
      await new Promise((resolve) => setImmediate(resolve))
      await f.service.flush()
      f.service.onunload()
    }
  })
  it('updates totals for imports/programmatic changes and counts growth without creating writing activity', async () => {
    const f = fixture()
    f.service.onload()
    await f.service.initialize()
    const file = new MockTFile('Imported.md')
    f.files.set(file.path, file)
    f.texts.set(file.path, 'imported words')
    f.events.get('create')!(file)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(f.service.snapshot().totalNotes, 3)
    assert.equal(f.service.snapshot().totalWords, 5)
    assert.deepEqual(f.service.snapshot().activity.days, {})
    f.texts.set(file.path, 'programmatic update with more words')
    f.events.get('modify')!(file)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(f.service.snapshot().totalWords, 8)
    assert.deepEqual(f.service.snapshot().activity.days, {})
    f.service.onunload()
  })
  it('preserves history through file/folder renames and deletion while updating current totals', async () => {
    const f = fixture()
    f.service.onload()
    await f.service.initialize()
    const file = f.files.get('A.md')!
    f.service.recordEdit(file as TFile, 4, {})
    f.files.delete(file.path)
    file.path = 'Folder/A.md'
    f.files.set(file.path, file)
    f.texts.set(file.path, 'one two')
    f.events.get('rename')!(file, 'A.md')
    await new Promise((resolve) => setImmediate(resolve))
    const history = f.service.snapshot().activity
    const id = Object.keys(history.days[localDay()])[0]
    assert.equal(history.notes[id].path, 'Folder/A.md')
    f.files.delete(file.path)
    f.events.get('delete')!(new MockTFolder('Folder'))
    assert.equal(f.service.snapshot().totalNotes, 1)
    assert.equal(history.notes[id].deleted, true)
    assert.equal(contribution(history, localDay(), 'words'), 4)
    f.service.onunload()
  })
  it('reports corrupt stored history and does not overwrite it', async () => {
    const f = fixture()
    f.disk.set(f.path, '{bad json')
    await f.service.initialize()
    assert.equal(f.service.snapshot().error, true)
    await f.service.flush()
    assert.equal(f.disk.get(f.path), '{bad json')
    f.service.onunload()
  })
})

describe('Linear monthly chart', () => {
  it('uses the same zero baseline and proportional heights for all six months', () => {
    const scale = monthlyChartScale([0, 1000, 2000, 3000, 4000, 8000])
    assert.equal(scale.max, 8000)
    assert.deepEqual(scale.heights, [0, 12.5, 25, 37.5, 50, 100])
    assert.deepEqual(scale.ticks, [8000, 6000, 4000, 2000, 0])
  })
  it('keeps empty and sparse note-creation charts finite with readable integer intervals', () => {
    for (const values of [
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 2],
    ]) {
      const scale = monthlyChartScale(values)
      assert.equal(scale.max, 4)
      assert.deepEqual(scale.ticks, [4, 3, 2, 1, 0])
      assert.ok(
        scale.heights.every((height) => Number.isFinite(height) && height >= 0 && height <= 100),
      )
    }
  })
})

describe('Segmented statistics storage', () => {
  it('round trips multiple months and bounded reference and activity shards', async () => {
    const state = emptyActivity('2026-01-01')
    for (let i = 0; i < 120; i++) {
      const id = `note-${String(i).padStart(4, '0')}`
      applyActivity(state, {
        kind: 'create',
        sequence: state.sequence + 1,
        id,
        path: `Folder/${id}.md`,
        day: '2026-01-01',
      })
      applyActivity(state, {
        kind: 'edit',
        sequence: state.sequence + 1,
        id,
        path: `Folder/${id}.md`,
        day: i % 2 ? '2026-01-12' : '2026-02-12',
        timestamp: 1000 + i,
        words: i,
      })
    }
    const files = encodeStatistics('device', state, 2000)
    assert.ok([...files.keys()].filter((name) => name.includes('.refs.')).length > 1)
    assert.ok([...files.keys()].filter((name) => name.includes('.2026-01.')).length > 1)
    assert.ok([...files.keys()].some((name) => name.includes('.2026-02.')))
    for (const contents of files.values())
      assert.ok(new TextEncoder().encode(contents).length <= 2000)
    const decoded = await decodeStatistics('device', async (path) => {
      const value = files.get(path)
      if (value === undefined) throw new Error('Missing segment')
      return value
    })
    assert.deepEqual(decoded.state, state)
    assert.ok(STATISTICS_SEGMENT_BYTES < 5 * 1024 * 1024)
  })

  it('updates references on rename without rewriting historical month shards', async () => {
    const state = emptyActivity('2026-01-01')
    record(state, 'A', '2026-01-01', 3, 1000)
    const before = encodeStatistics('device', state)
    applyActivity(state, { kind: 'rename', sequence: 2, from: 'A.md', to: 'Folder/Renamed.md' })
    const after = encodeStatistics('device', state)
    const month = [...before.keys()].find((name) => name.includes('.2026-01.'))!
    const refs = [...before.keys()].find((name) => name.includes('.refs.'))!
    assert.equal(after.get(month), before.get(month))
    assert.notEqual(after.get(refs), before.get(refs))
    const result = await decodeStatistics('device', async (path) => after.get(path)!)
    assert.equal(result.state.notes.A.path, 'Folder/Renamed.md')
    assert.equal(contribution(result.state, '2026-01-01', 'words'), 3)
  })

  it('writes only the affected month and keeps past files unchanged during edits and moves', async () => {
    const state = emptyActivity('2025-01-01')
    record(state, 'A', '2025-01-10', 3, 1000)
    const f = fixture(state)
    f.service.onload()
    await f.service.initialize()
    const writes: string[] = []
    const write = f.app.vault.adapter.write
    f.app.vault.adapter.write = async (path, contents) => {
      writes.push(path)
      await write(path, contents)
    }
    const file = f.files.get('A.md')!
    f.service.recordEdit(file as TFile, 2, {})
    await f.service.flush()
    assert.ok(writes.some((path) => path.includes(`.${localDay().slice(0, 7)}.`)))
    assert.ok(!writes.some((path) => path.includes('.2025-01.')))
    assert.ok(!writes.some((path) => path.includes('.refs.')))
    writes.length = 0
    f.files.delete('A.md')
    file.path = 'Folder/A.md'
    f.files.set(file.path, file)
    f.events.get('rename')!(file, 'A.md')
    await f.service.flush()
    assert.ok(writes.some((path) => path.includes('.refs.')))
    assert.ok(!writes.some((path) => path.includes('.2025-01.')))
    f.service.onunload()
  })

  it('does not record its own statistics file renames or deletions as note changes', async () => {
    const f = fixture()
    f.service.onload()
    await f.service.initialize()
    const before = f.service.snapshot().activity.sequence
    const part = new MockTFile(`${f.path}.2026-10.0001.json`)
    f.events.get('rename')!(part, `${f.path}.old.json`)
    f.events.get('delete')!(part)
    assert.equal(f.service.snapshot().activity.sequence, before)
    f.service.onunload()
  })

  it('restores a partially written month segment from its checkpoint', async () => {
    const state = emptyActivity(localDay())
    record(state, 'A', localDay(), 3, Date.now() - 1000)
    const f = fixture(state)
    await f.service.initialize()
    const write = f.app.vault.adapter.write
    let failed = false
    f.app.vault.adapter.write = async (path, content) => {
      if (!failed && path.includes(`.${localDay().slice(0, 7)}.`)) {
        failed = true
        f.disk.set(path, '')
        throw new Error('Interrupted segment')
      }
      await write(path, content)
    }
    f.service.recordEdit(f.files.get('A.md')! as TFile, 2, {})
    await f.service.flush()
    assert.equal(f.service.snapshot().saveError, true)
    f.service.onunload()
    f.app.vault.adapter.write = write
    const restored = new GlobalStatistics(f.app, 'test-plugin', f.device)
    await restored.initialize()
    assert.equal(restored.snapshot().error, false)
    assert.equal(contribution(restored.snapshot().activity, localDay(), 'words'), 5)
    restored.onunload()
  })

  it('does not accept a stale segment when a newer manifest arrives first', async () => {
    const f = fixture()
    await f.service.initialize()
    const state = emptyActivity(localDay())
    record(state, 'remote', localDay(), 5, Date.now())
    const first = encodeStatistics('ipad', state)
    for (const [path, content] of first) f.disk.set(path, content)
    await f.service.refreshRemote()
    record(state, 'remote', localDay(), 2, Date.now())
    const second = encodeStatistics('ipad', state)
    const manifest = 'Resources/Seam/Statistics/ipad.json'
    f.disk.set(manifest, second.get(manifest)!)
    await f.service.refreshRemote()
    assert.equal(f.service.snapshot().error, true)
    assert.equal(contribution(f.service.snapshot().activity, localDay(), 'words'), 5)
    for (const [path, content] of second) f.disk.set(path, content)
    await f.service.refreshRemote()
    assert.equal(f.service.snapshot().error, false)
    assert.equal(contribution(f.service.snapshot().activity, localDay(), 'words'), 7)
    f.service.onunload()
  })

  it('retains the last complete remote snapshot while a referenced shard is missing', async () => {
    const f = fixture()
    await f.service.initialize()
    const state = emptyActivity(localDay())
    record(state, 'remote', localDay(), 5, Date.now())
    const remote = encodeStatistics('ipad', state)
    for (const [path, content] of remote) f.disk.set(path, content)
    await f.service.refreshRemote()
    const month = [...remote.keys()].find((path) => path.includes(`.${localDay().slice(0, 7)}.`))!
    f.disk.delete(month)
    await f.service.refreshRemote()
    assert.equal(f.service.snapshot().error, true)
    assert.equal(contribution(f.service.snapshot().activity, localDay(), 'words'), 5)
    f.disk.set(month, remote.get(month)!)
    await f.service.refreshRemote()
    assert.equal(f.service.snapshot().error, false)
    assert.equal(contribution(f.service.snapshot().activity, localDay(), 'words'), 5)
    f.service.onunload()
  })
})
