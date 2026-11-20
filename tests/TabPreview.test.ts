import './mocks/obsidian'
import assert from 'node:assert/strict'
import { test } from 'node:test'

class Element {
  isConnected = true
  inert = false
  tabIndex = 0
  children: Element[] = []
  attrs = new Map<string, string>()
  events = new Map<string, () => void>()
  createDiv(options = {}) {
    return this.createEl('div', options)
  }
  createSpan(options = {}) {
    return this.createEl('span', options)
  }
  createEl(_tag: string, options: { attr?: Record<string, string> } = {}) {
    const el = new Element()
    for (const [key, value] of Object.entries(options.attr ?? {})) el.attrs.set(key, value)
    this.children.push(el)
    return el
  }
  appendText() {}
  addClass() {}
  setAttr(key: string, value: string) {
    this.attrs.set(key, value)
  }
  addEventListener(key: string, fn: () => void) {
    this.events.set(key, fn)
  }
  focus() {}
  scrollIntoView() {}
  empty() {
    this.children = []
  }
}
class Scope {
  handlers = new Map<string, (event: object) => boolean>()
  constructor(_parent?: unknown) {}
  register(modifiers: string[] | null, key: string, handler: (event: object) => boolean) {
    this.handlers.set([...(modifiers ?? []), key].join('+'), handler)
  }
}
class Component {
  cleanups: (() => void)[] = []
  listeners = new Map<string, (event: object) => void>()
  register(fn: () => void) {
    this.cleanups.push(fn)
  }
  registerEvent() {}
  registerDomEvent(_target: unknown, name: string, fn: (event: object) => void) {
    this.listeners.set(name, fn)
  }
  load() {}
  unload() {
    this.cleanups.forEach((fn) => fn())
  }
}
let lastModal: any
class Modal {
  scope = new Scope()
  modalEl = new Element()
  contentEl = new Element()
  constructor(public app: unknown) {
    lastModal = this
  }
  open() {
    ;(this as any).onOpen()
  }
  close() {
    ;(this as any).onClose()
  }
  setTitle() {}
}
Object.assign(require.cache['obsidian']!.exports, {
  Component,
  Modal,
  Scope,
  FileView: class {},
  MarkdownView: class {},
  setIcon() {},
})
const { TabPreview } = require('../src/ui/TabPreview')

function fixture(count = 3) {
  const leaves = Array.from({ length: count }, (_, i) => ({
    getViewState: () => ({ state: {} }),
    view: {
      getDisplayText: () => `Tab ${i}`,
      getIcon: () => 'file',
      containerEl: { textContent: '', querySelector: () => null },
    },
  }))
  let scope: Scope
  let popped = false
  let modalOpen = false
  let active = leaves[0]
  const workspace = {
    activeLeaf: active,
    containerEl: {
      ownerDocument: { defaultView: {}, querySelector: () => modalOpen, hidden: false },
    },
    // Obsidian stops iteration on a truthy callback result.
    iterateRootLeaves(fn: (leaf: unknown) => unknown) {
      for (const leaf of leaves) if (fn(leaf)) break
    },
    setActiveLeaf(leaf: typeof active) {
      active = leaf
    },
    on() {},
  }
  const app = {
    workspace,
    scope: new Scope(),
    keymap: {
      pushScope(value: Scope) {
        scope = value
      },
      popScope() {
        popped = true
      },
    },
  }
  const controller = new TabPreview(app)
  controller.onload()
  return {
    controller,
    leaves,
    begin(back = false) {
      return scope.handlers.get(back ? 'Ctrl+Shift+Tab' : 'Ctrl+Tab')!({})
    },
    cycle(back = false) {
      lastModal.scope.handlers.get(back ? 'Ctrl+Shift+Tab' : 'Ctrl+Tab')!({})
    },
    release() {
      controller.listeners.get('keyup')({ key: 'Control' })
    },
    selected: () =>
      lastModal.buttons.findIndex((b: Element) => b.attrs.get('aria-pressed') === 'true'),
    active: () => active,
    dismiss: () => lastModal.close(),
    modal: () => lastModal,
    otherModal() {
      modalOpen = true
    },
    popped: () => popped,
  }
}

test('enumerates every tab, wraps both ways, and defers activation until Ctrl release', () => {
  const f = fixture()
  assert.equal(f.begin(), false)
  assert.equal(f.selected(), 1)
  assert.equal(f.active(), f.leaves[0])
  f.cycle()
  assert.equal(f.selected(), 2)
  f.cycle()
  assert.equal(f.selected(), 0)
  f.cycle(true)
  assert.equal(f.selected(), 2)
  f.release()
  assert.equal(f.active(), f.leaves[2])
})
test('initial Shift+Tab selects the previous tab, and dismissal cancels selection', () => {
  const f = fixture()
  f.begin(true)
  assert.equal(f.selected(), 2)
  f.dismiss()
  f.release()
  assert.equal(f.active(), f.leaves[0])
})
test('click selects the clicked tab and releasing Ctrl does not select again', () => {
  const f = fixture()
  f.begin()
  f.modal().buttons[2].events.get('click')()
  assert.equal(f.active(), f.leaves[2])
  f.release()
  assert.equal(f.active(), f.leaves[2])
})
test('removed tabs are never activated and unloading removes the keyboard scope', () => {
  const f = fixture()
  f.begin()
  f.leaves.splice(1, 1)
  f.release()
  assert.equal(f.active(), f.leaves[0])
  f.controller.onunload()
  f.controller.unload()
  assert.equal(f.popped(), true)
})
test('single-tab workspaces and other modals retain their existing shortcut handling', () => {
  assert.equal(fixture(1).begin(), true)
  const f = fixture()
  f.otherModal()
  assert.equal(f.begin(), true)
})
