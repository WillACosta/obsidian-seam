import './mocks/obsidian'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { App, TFile } from 'obsidian'
import { MockTFile, MockTFolder } from './mocks/obsidian'
import { DEFAULT_SETTINGS, PaletteItem } from '../src/types'
import {
  countNoteTasks,
  currentNoteCompletion,
  readNoteCompletion,
} from '../src/statistics/NoteCompletion'
import { PalettePins, normalizePalettePins } from '../src/notes/PalettePins'
import { groupPaletteItems } from '../src/ui/PaletteGroups'

describe('Note completion', () => {
  it('counts partial items separately and gives them no full-completion credit', () => {
    assert.deepEqual(countNoteTasks('- [ ] Start\n- [/] Working\n- [x] Done\n- [X] Done'), {
      total: 4,
      unfinished: 1,
      partial: 1,
      completed: 2,
      percent: 50,
    })
    assert.equal(countNoteTasks('- [/] Working').percent, 0)
    assert.deepEqual(countNoteTasks('No tasks'), {
      total: 0,
      unfinished: 0,
      partial: 0,
      completed: 0,
      percent: 0,
    })
  })
  it('ignores frontmatter, comments, fenced and indented code while keeping nested and quoted tasks', () => {
    const text = [
      '---',
      '- [ ] YAML',
      '---',
      '    - [ ] Code',
      '```md',
      '<!--',
      '- [ ] Code',
      '```',
      '<!--',
      '- [ ] Hidden',
      '-->',
      '%%',
      '- [ ] Hidden',
      '%%',
      '- [ ] Parent',
      '  - [/] Child',
      '> - [x] Quoted',
      '1. [x] Ordered',
      '* [ ] Star',
      '+ [ ] Plus',
    ].join('\r\n')
    assert.deepEqual(countNoteTasks(text), {
      total: 6,
      unfinished: 3,
      partial: 1,
      completed: 2,
      percent: 33,
    })
  })
  it('distinguishes nested tasks from code indented inside a list', () => {
    assert.deepEqual(
      countNoteTasks('- [ ] Parent\n    - [x] Child\n\n          - [ ] Nested code\n- [/] Sibling'),
      { total: 3, unfinished: 1, partial: 1, completed: 1, percent: 33 },
    )
  })
  it('uses unsaved editor tasks for both command visibility and reporting', async () => {
    const file = new MockTFile('A.md') as TFile
    const app = {
      workspace: {
        getActiveViewOfType: () => ({
          file,
          getMode: () => 'source',
          editor: { getValue: () => '- [/] Draft' },
        }),
      },
      vault: { cachedRead: () => assert.fail('Must read editor') },
    } as unknown as App
    assert.equal(currentNoteCompletion(app, file).total, 1)
    assert.equal((await readNoteCompletion(app, file)).partial, 1)
  })
  it('uses cache for synchronous visibility and file content for a reading-mode report', async () => {
    const file = new MockTFile('A.md') as TFile
    const app = {
      workspace: { getActiveViewOfType: () => null },
      metadataCache: {
        getFileCache: () => ({ listItems: [{ task: ' ' }, { task: '/' }, { task: 'x' }] }),
      },
      vault: { cachedRead: async () => '- [x] Done' },
    } as unknown as App
    assert.equal(currentNoteCompletion(app, file).partial, 1)
    assert.equal((await readNoteCompletion(app, file)).percent, 100)
  })
})

function pinFixture(save: () => Promise<void> = async () => {}) {
  const settings = { ...DEFAULT_SETTINGS, palettePinnedNotes: [] as string[] }
  const files = new Map<string, MockTFile>()
  const listeners = new Map<string, Function>()
  const app = {
    vault: {
      getAbstractFileByPath: (path: string) => files.get(path),
      on: (event: string, handler: Function) => {
        listeners.set(event, handler)
      },
    },
  } as unknown as App
  const pins = new PalettePins(app, () => settings, save)
  Object.assign(pins, { registerEvent: () => {} })
  pins.onload()
  return {
    settings,
    files,
    listeners,
    pins,
    add: (path: string) => {
      const file = new MockTFile(path)
      files.set(path, file)
      return file as TFile
    },
  }
}
describe('Palette note pins', () => {
  it('normalizes persisted references without sharing calendar or query pin limits', () => {
    assert.deepEqual(normalizePalettePins([null, 'A.md', 'A.md', '../Escape.md', 'Photo.png']), [
      'A.md',
    ])
    assert.deepEqual(normalizePalettePins(null), [])
  })
  it('serializes pin toggles, persists across service recreation, and permits unpinning', async () => {
    const f = pinFixture()
    const a = f.add('A.md')
    const b = f.add('B.md')
    await Promise.all([f.pins.toggle(a), f.pins.toggle(b)])
    assert.deepEqual(f.settings.palettePinnedNotes, ['A.md', 'B.md'])
    const restored = new PalettePins(
      {} as App,
      () => f.settings,
      async () => {},
    )
    assert.equal(restored.has('A.md'), true)
    await f.pins.toggle(a)
    assert.deepEqual(f.settings.palettePinnedNotes, ['B.md'])
  })
  it('rolls back failed saves and continues queued operations', async () => {
    let fail = true
    const f = pinFixture(async () => {
      if (fail) {
        fail = false
        throw Error('Disk full')
      }
    })
    const a = f.add('A.md')
    const b = f.add('B.md')
    const results = await Promise.allSettled([f.pins.toggle(a), f.pins.toggle(b)])
    assert.equal(results[0].status, 'rejected')
    assert.deepEqual(f.settings.palettePinnedNotes, ['B.md'])
  })
  it('tracks folder moves and note deletion without changing note contents', async () => {
    const f = pinFixture()
    await f.pins.toggle(f.add('Folder/A.md'))
    await f.pins.toggle(f.add('B.md'))
    f.listeners.get('rename')!(new MockTFolder('Moved'), 'Folder')
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(f.settings.palettePinnedNotes, ['Moved/A.md', 'B.md'])
    f.listeners.get('delete')!(new MockTFile('Moved/A.md'))
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(f.settings.palettePinnedNotes, ['B.md'])
  })
})

describe('Palette group labels', () => {
  const item = (id: string, type: PaletteItem['type'] = 'command'): PaletteItem => ({
    id,
    type,
    title: id,
    description: '',
  })
  it('groups related commands without inserting selectable headers or mutating inputs', () => {
    const items = [
      item('cmd-note-statistics'),
      item('cmd-move-permanent', 'action'),
      item('cmd-note-completion'),
    ]
    const grouped = groupPaletteItems(items, true)
    assert.deepEqual(
      grouped.map((i) => i.id),
      ['cmd-note-statistics', 'cmd-note-completion', 'cmd-move-permanent'],
    )
    assert.deepEqual(
      grouped.map((i) => i.groupLabel),
      ['Note Statistics', undefined, 'Move Notes'],
    )
    assert.equal(items[0].groupLabel, undefined)
    assert.equal(groupPaletteItems(items, false), items)
  })
  it('preserves special-query pin priority and configured ordering across built-in/custom boundaries', () => {
    const items = [
      { ...item('pinned-custom', 'special'), customSearchId: 'one' },
      item('builtin', 'special'),
      { ...item('custom', 'special'), customSearchId: 'two' },
    ]
    const grouped = groupPaletteItems(items, true, true)
    assert.deepEqual(
      grouped.map((i) => i.id),
      items.map((i) => i.id),
    )
    assert.deepEqual(
      grouped.map((i) => i.groupLabel),
      ['Custom Queries', 'Special Queries', 'Custom Queries'],
    )
  })
})
