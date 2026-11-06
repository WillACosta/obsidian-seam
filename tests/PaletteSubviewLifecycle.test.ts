import './mocks/obsidian'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SETTINGS } from '../src/types'

class Element {
  hidden = false
  removed = false
  nodes: Element[] = []
  addClass() {}
  removeClass() {}
  contains(node: Element) {
    return this.nodes.includes(node)
  }
  remove() {
    this.removed = true
  }
  createDiv() {
    const node = new Element()
    this.nodes.push(node)
    return node
  }
  querySelectorAll() {
    return this.nodes
  }
}
class Scope {
  register() {}
}
class Host {
  scope = new Scope()
  modalEl = new Element()
  inputEl = { value: '>', focus() {} }
  constructor(public app: unknown) {}
  setPlaceholder() {}
  setInstructions() {}
}
Object.assign(require.cache['obsidian']!.exports, {
  SuggestModal: Host,
  AbstractInputSuggest: class {},
  Modal: Host,
  Scope,
  Notice: class {},
})
const { UniversalPalette } = require('../src/ui/UniversalPalette')
function fixture(open: Function) {
  const stack: unknown[] = []
  const app = {
    keymap: {
      pushScope: (scope: unknown) => stack.push(scope),
      popScope: (scope: unknown) => {
        const index = stack.indexOf(scope)
        if (index >= 0) stack.splice(index, 1)
      },
    },
  }
  const palette = new UniversalPalette(
    app,
    DEFAULT_SETTINGS,
    {},
    [],
    undefined,
    undefined,
    [],
    open,
  )
  stack.push(palette.scope)
  const originals = [new Element(), new Element(), new Element()]
  palette.modalEl.nodes.push(...originals)
  return { palette, stack, originals }
}

test('an async no-image cancellation restores the Palette without pushing an empty key scope', async () => {
  let finish!: () => void
  const f = fixture(async (_id: string, panel: { back(): void }) => {
    await new Promise<void>((resolve) => {
      finish = resolve
    })
    panel.back()
  })
  const opened = f.palette.showEditorMediaPanel('add-caption')
  assert.equal(f.stack.length, 1)
  assert.ok(f.originals.every((element) => element.hidden))
  finish()
  await opened
  assert.equal(f.palette.editorMediaPanel, null)
  assert.equal(f.palette.editorMediaScope, null)
  assert.deepEqual(f.stack, [f.palette.scope])
  assert.ok(f.originals.every((element) => !element.hidden))
  assert.equal(f.palette.inputEl.value, '>')
})

test('a late cancelled view cannot remove the scope or content of a newer view', async () => {
  let finish!: () => void
  let disposed = false
  const f = fixture(
    async (id: string, panel: { back(): void; handleKey?: Function; dispose?: Function }) => {
      if (id === 'add-caption') {
        await new Promise<void>((resolve) => {
          finish = resolve
        })
        panel.back()
      } else {
        panel.handleKey = () => true
        panel.dispose = () => {
          disposed = true
        }
      }
    },
  )
  const stale = f.palette.showEditorMediaPanel('add-caption')
  await f.palette.showEditorMediaPanel('image-layout')
  const active = f.palette.editorMediaPanel
  assert.equal(f.stack.length, 2)
  finish()
  await stale
  assert.equal(f.palette.editorMediaPanel, active)
  assert.equal(f.stack.length, 2)
  f.palette.leaveEditorMediaPanel()
  assert.deepEqual(f.stack, [f.palette.scope])
  assert.equal(disposed, true)
})

test('a rejected view restores the visible Palette and leaves its keyboard scope active', async () => {
  const f = fixture(async () => {
    throw new Error('Unavailable view')
  })
  await f.palette.showEditorMediaPanel('add-caption')
  assert.equal(f.palette.editorMediaPanel, null)
  assert.equal(f.palette.editorMediaScope, null)
  assert.deepEqual(f.stack, [f.palette.scope])
  assert.ok(f.originals.every((element) => !element.hidden))
})
