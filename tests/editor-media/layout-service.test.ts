import '../mocks/obsidian'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyLayout,
  parseLayoutImage,
  layoutBlocks,
  parseLayout,
} from '../../src/editor-media/layout/model'

Object.assign(require.cache['obsidian']!.exports, {
  Modal: class {
    constructor(public app: unknown) {}
  },
})
const { LayoutService } = require('../../src/editor-media/layout/service')

function fixture(initial: string) {
  let text = initial
  let transactions = 0
  const history: string[] = []
  const position = (offset: number) => {
    const lines = text.slice(0, offset).split('\n')
    return { line: lines.length - 1, ch: lines[lines.length - 1].length }
  }
  const offset = (position: { line: number; ch: number }) =>
    text
      .split('\n')
      .slice(0, position.line)
      .reduce((sum, line) => sum + line.length + 1, 0) + position.ch
  const editor = {
    getValue: () => text,
    getCursor: () => position(text.length),
    offsetToPos: position,
    posToOffset: offset,
    transaction: (change: {
      changes: {
        from: { line: number; ch: number }
        to: { line: number; ch: number }
        text: string
      }[]
    }) => {
      transactions++
      history.push(text)
      const changes = change.changes.map((entry) => ({
        ...entry,
        from: offset(entry.from),
        to: offset(entry.to),
      }))
      for (const entry of changes.slice().reverse())
        text = text.slice(0, entry.from) + entry.text + text.slice(entry.to)
    },
  }
  let modal: { save: Function }
  const app = {
    metadataCache: {
      getFirstLinkpathDest: (path: string, source: string) => {
        assert.equal(source, 'Notes/Source.md')
        return { path: path === 'a.png' ? 'Attachments/a.png' : path }
      },
    },
  }
  const service = new LayoutService(
    app,
    () => true,
    (value: typeof modal) => {
      modal = value
    },
  )
  service.insert(editor, 'Notes/Source.md')
  return {
    editor,
    save: (layout: unknown) => modal!.save(layout),
    history,
    count: () => transactions,
    change: (value: string) => {
      text = value
    },
  }
}

test('insertion moves canonical note images in one transaction with one-step undo data', () => {
  const initial = 'Prose\n\n![[a.png|Original]]\n![[unselected.png]]\n'
  const f = fixture(initial)
  const image = parseLayoutImage('![[Attachments/a.png|New caption]]')!
  f.save({ ...emptyLayout(), images: [image] })
  assert.equal(f.count(), 1)
  const block = layoutBlocks(f.editor.getValue())[0]
  assert.ok(block)
  assert.equal(parseLayout(block.source, JSON.parse).images[0].caption, 'New caption')
  assert.equal(f.editor.getValue().slice(0, block.start), 'Prose\n\n![[unselected.png]]\n')
  assert.deepEqual(f.history, [initial])
})

test('a note changed while the layout was open is not overwritten or stripped of images', () => {
  const f = fixture('![[a.png]]\n')
  const changed = 'New text\n![[a.png]]\n'
  f.change(changed)
  assert.throws(
    () => f.save({ ...emptyLayout(), images: [parseLayoutImage('![[a.png]]')!] }),
    /note changed/i,
  )
  assert.equal(f.count(), 0)
  assert.equal(f.editor.getValue(), changed)
})
