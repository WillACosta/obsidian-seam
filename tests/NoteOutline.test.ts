import './mocks/obsidian'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MockTFile } from './mocks/obsidian'
import { DEFAULT_SETTINGS } from '../src/types'
import { getNoteOutline } from '../src/outline/NoteOutline'

class ModalHost {
  inputEl = { value: '', setAttribute() {}, removeAttribute() {}, focus() {}, dispatchEvent() {} }
  limit = 100
  modalEl = { addClass() {}, removeClass() {} }
  handlers = new Map<string, Function>()
  scope = {
    register: (mods: string[], key: string, callback: Function) =>
      this.handlers.set([...mods, key].join('+'), callback),
  }
  instructions: { command: string; purpose: string }[] = []
  closed = false
  constructor(public app: unknown) {}
  setPlaceholder() {}
  setInstructions(value: typeof this.instructions) {
    this.instructions = value
  }
  close() {
    this.closed = true
  }
}
Object.assign(require.cache['obsidian']!.exports, {
  SuggestModal: ModalHost,
  Modal: ModalHost,
  AbstractInputSuggest: class {},
})
const { UniversalPalette } = require('../src/ui/UniversalPalette')

function fixture(
  headings: { heading: string; level: number; position: { start: { line: number } } }[] | undefined,
) {
  const file = new MockTFile('Notes/Outline.md')
  const opened: unknown[][] = []
  const app = {
    metadataCache: { getFileCache: () => (headings ? { headings } : null) },
    workspace: {
      getLeaf: (target: unknown) => {
        assert.equal(target, false)
        return {
          openFile: async (...args: unknown[]) => {
            opened.push(args)
          },
        }
      },
    },
  }
  const palette = new UniversalPalette(app, DEFAULT_SETTINGS, {}, [])
  palette.disposeBaseRender = () => {}
  palette.renderChips = () => {}
  palette.refreshSuggestions = () => {}
  return { file, app, palette, opened }
}
const heading = (title: string, level: number, line: number) => ({
  heading: title,
  level,
  position: { start: { line } },
})

describe('Note outline', () => {
  it('preserves order, all six levels, and duplicate headings with distinct destinations', async () => {
    const headings = Array.from({ length: 120 }, (_, i) => heading('Repeated', (i % 6) + 1, i * 3))
    const { palette, app, file, opened } = fixture(headings)
    palette.showNoteOutline(file)
    const items = palette.getSuggestions('')
    assert.equal(items.length, 120)
    assert.equal(palette.limit, 120)
    assert.deepEqual(
      items.slice(0, 6).map((item: { headingLevel: number }) => item.headingLevel),
      [1, 2, 3, 4, 5, 6],
    )
    assert.notEqual(items[0].id, items[119].id)
    await getNoteOutline(app as never, file as never)[119].action?.()
    assert.deepEqual(opened, [[file, { active: true, eState: { line: 357, focus: true } }]])
  })
  it('returns an empty outline for missing metadata and supports filtering without entering global search', () => {
    const empty = fixture(undefined)
    empty.palette.showNoteOutline(empty.file)
    assert.deepEqual(empty.palette.getSuggestions(''), [])
    const { palette, file } = fixture([heading('First', 1, 0), heading('Nested CAFÉ', 3, 5)])
    palette.showNoteOutline(file)
    assert.deepEqual(
      palette.getSuggestions('café').map((item: { title: string }) => item.title),
      ['Nested CAFÉ'],
    )
    assert.deepEqual(palette.getSuggestions('@today'), [])
  })
  it('offers navigate, select, back, dismiss and prevents tab/split shortcuts from opening old results', () => {
    const { palette, file, opened } = fixture([heading('First', 1, 0)])
    palette.showNoteOutline(file)
    assert.deepEqual(
      palette.instructions.map((item: { purpose: string }) => item.purpose),
      ['navigate', 'select', 'back', 'dismiss'],
    )
    for (const shortcut of ['Mod+Enter', 'Shift+Enter', 'Mod+Shift+Enter']) {
      assert.equal(palette.handlers.get(shortcut)({}), false)
    }
    assert.deepEqual(opened, [])
    assert.equal(palette.closed, false)
    palette.handlers.get('Escape')({})
    assert.equal(palette.closed, true)
  })
  it('keeps Backspace as text editing until the input is empty, then restores Palette search', () => {
    const { palette, file } = fixture([heading('Nested', 2, 7)])
    palette.showNoteOutline(file)
    palette.inputEl.value = 'Nested'
    palette.getSuggestions('Nested')
    assert.deepEqual(
      palette.instructions.map((item: { purpose: string }) => item.purpose),
      ['navigate', 'select', 'dismiss'],
    )
    assert.equal(
      palette.handlers.get('Backspace')({
        preventDefault: () => assert.fail('Must allow deletion'),
      }),
      true,
    )
    assert.equal(palette.mode, 'outline')
    palette.inputEl.value = ''
    let prevented = false
    assert.equal(
      palette.handlers.get('Backspace')({
        preventDefault: () => {
          prevented = true
        },
      }),
      false,
    )
    assert.equal(prevented, true)
    assert.equal(palette.mode, 'search')
    assert.equal(palette.limit, 100)
    assert.equal(palette.closed, false)
    assert.deepEqual(palette.outlineItems, [])
    assert.ok(palette.instructions.some((item: { purpose: string }) => item.purpose === 'commands'))
  })
  it('ignores stale search results and closes and jumps when a heading is selected', async () => {
    const { palette, file, opened } = fixture([heading('Nested', 2, 7)])
    palette.showNoteOutline(file)
    palette.selectSuggestion({ type: 'note', action: () => assert.fail('Stale result') }, {})
    assert.equal(palette.closed, false)
    palette.selectSuggestion(palette.getSuggestions('')[0], {})
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(palette.closed, true)
    assert.deepEqual(opened, [[file, { active: true, eState: { line: 7, focus: true } }]])
  })
})
