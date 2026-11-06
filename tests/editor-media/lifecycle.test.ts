import '../mocks/obsidian'
import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { DEFAULT_EDITOR_MEDIA } from '../../src/editor-media/settings'

// Load CodeMirror before installing the minimal document used by this lifecycle test.
require('@codemirror/language')
const blocks = new Map<string, unknown>()
let postProcessors = 0
let extensions = 0
let listeners = 0
let observers = 0
const callbacks: (() => void)[] = []
const obsidian = require('obsidian')
obsidian.Modal = class {}
obsidian.MarkdownView = class {}
obsidian.Plugin = class {
  app: unknown
  manifest: unknown
  cleanups: (() => void)[] = []
  constructor(app: unknown, manifest: unknown) {
    this.app = app
    this.manifest = manifest
  }
  register(fn: () => void) {
    this.cleanups.push(fn)
  }
  registerMarkdownCodeBlockProcessor(name: string, handler: unknown) {
    blocks.set(name, handler)
    this.register(() => blocks.delete(name))
  }
  registerMarkdownPostProcessor() {
    postProcessors++
    this.register(() => postProcessors--)
  }
  registerEditorExtension() {
    extensions++
    this.register(() => extensions--)
  }
  registerEvent() {
    listeners++
    this.register(() => listeners--)
  }
  registerDomEvent() {
    listeners++
    this.register(() => listeners--)
  }
  unload() {
    this.onunload()
    for (const fn of this.cleanups.reverse()) fn()
  }
}
Object.assign(globalThis, {
  document: { body: { classList: { toggle() {}, remove() {} } }, querySelectorAll: () => [] },
  MutationObserver: class {
    observe() {
      observers++
    }
    disconnect() {
      observers--
    }
  },
})
const { EditorMedia } = require('../../src/editor-media/EditorMedia')
const owner = {
  app: {
    vault: { adapter: {}, on() {} },
    workspace: {
      onLayoutReady: (fn: () => void) => callbacks.push(fn),
      on() {},
      getActiveViewOfType: () => ({}),
    },
  },
  manifest: { id: 'seam', dir: '.obsidian/plugins/seam' },
}

test('all disabled features register no renderer, extension, observer, or vault listener', () => {
  const feature = new EditorMedia(owner, () => ({
    previews: false,
    captions: false,
    layouts: false,
    folding: false,
    autoSort: false,
    completed: false,
  }))
  feature.onload()
  assert.equal(blocks.size, 0)
  assert.equal(postProcessors + extensions + listeners + observers, 0)
  assert.deepEqual(feature.paletteItems(), [])
  feature.unload()
})

test('enabled renderers and listeners belong to Seam and are removed on unload', () => {
  const feature = new EditorMedia(owner, () => ({
    ...DEFAULT_EDITOR_MEDIA,
    previews: true,
    autoSort: true,
  }))
  feature.onload()
  assert.deepEqual([...blocks.keys()].sort(), ['seam-embed', 'seam-layout'])
  assert.equal(observers, 1)
  assert.equal(extensions, 1)
  assert.ok(listeners > 0)
  const items = feature.paletteItems()
  assert.equal(items.length, 4)
  assert.ok(
    items.every((item: { shortcutCommandId: string }) =>
      item.shortcutCommandId.startsWith('seam:'),
    ),
  )
  assert.ok(items.every((item: { id: string }) => !item.id.startsWith('utility:')))
  feature.unload()
  assert.equal(blocks.size, 0)
  assert.equal(postProcessors + extensions + listeners + observers, 0)
  // Deferred startup work from a removed module must not read the vault.
  for (const callback of callbacks) callback()
})
