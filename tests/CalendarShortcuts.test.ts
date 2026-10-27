import './mocks/obsidian'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { moment } from 'obsidian'
import { MockTFile, MockTFolder } from './mocks/obsidian'
import type { CalendarOpenTarget } from '../src/calendar/DailyNoteCalendar'
import { weeklyNotePath } from '../src/calendar/WeeklyNotes'

const documentHost = { activeElement: null as ElementHost | null }
class ElementHost {
  children: ElementHost[] = []
  attrs = new Map<string, string>()
  listeners = new Map<string, () => void>()
  disabled = false
  constructor(
    readonly tag = 'div',
    readonly text = '',
    attributes: Record<string, string> = {},
  ) {
    for (const [key, value] of Object.entries(attributes)) this.attrs.set(key, value)
  }
  get ownerDocument() {
    return documentHost
  }
  get all(): ElementHost[] {
    return [this, ...this.children.flatMap((child) => child.all)]
  }
  createEl(tag: string, options: { text?: string; attr?: Record<string, string> } = {}) {
    const child = new ElementHost(tag, options.text, options.attr)
    this.children.push(child)
    return child
  }
  createDiv(options = {}) {
    return this.createEl('div', options)
  }
  createSpan(options = {}) {
    return this.createEl('span', options)
  }
  setAttribute(key: string, value: string) {
    this.attrs.set(key, value)
  }
  getAttribute(key: string) {
    return this.attrs.get(key) ?? null
  }
  hasAttribute(key: string) {
    return this.attrs.has(key)
  }
  matches(selector: string) {
    if (selector === ':disabled') return this.disabled
    if (selector === 'button[data-calendar-control]')
      return this.tag === 'button' && this.attrs.has('data-calendar-control')
    if (selector.includes('data-calendar-control')) return this.attrs.has('data-calendar-control')
    return (
      selector.includes('data-calendar-cell') &&
      this.attrs.has('data-calendar-cell') &&
      (!selector.includes('tabindex') || this.attrs.get('tabindex') === '0')
    )
  }
  instanceOf(type: typeof ElementHost) {
    return this instanceof type
  }
  contains(element: unknown) {
    return this.all.includes(element as ElementHost)
  }
  querySelector(selector: string) {
    return this.all.find((element) => element.matches(selector)) ?? null
  }
  querySelectorAll(selector: string) {
    return this.all.filter((element) => element.matches(selector))
  }
  empty() {
    this.children = []
  }
  focus() {
    documentHost.activeElement = this
  }
  addEventListener(event: string, callback: () => void) {
    this.listeners.set(event, callback)
  }
  click() {
    this.listeners.get('click')?.()
  }
  addClass() {}
  toggleClass() {}
  remove() {}
}
class ScopeHost {
  handlers = new Map<string, (event: KeyboardEvent) => boolean>()
  register(modifiers: string[], key: string, callback: (event: KeyboardEvent) => boolean) {
    this.handlers.set([...modifiers, key].join('+'), callback)
  }
}
const confirmations: ModalHost[] = []
class ModalHost {
  contentEl = new ElementHost()
  modalEl = new ElementHost()
  setTitle() {}
  onOpen() {}
  onClose() {}
  open() {
    confirmations.push(this)
    this.onOpen()
  }
  close() {
    this.onClose()
  }
  click(text: string) {
    this.contentEl.all.find((node) => node.tag === 'button' && node.text === text)!.click()
  }
}
Object.assign(globalThis, { HTMLElement: ElementHost })
Object.assign(require.cache['obsidian']!.exports, {
  Scope: ScopeHost,
  Modal: ModalHost,
  Notice: class {},
  setIcon() {},
})
const { DailyNoteCalendar } = require('../src/calendar/DailyNoteCalendar')
const tick = () => new Promise((resolve) => setImmediate(resolve))

function fixture({ existing = true, ask = false, weeklyExisting = true, rolling = false } = {}) {
  confirmations.length = 0
  const host = new ElementHost()
  const input = new ElementHost('input')
  const settings = { folder: 'Daily', format: 'YYYY-MM-DD', template: '' }
  const weekly = {
    folder: 'Weekly',
    format: 'GGGG-[W]WW',
    template: '',
    iso: true,
    source: 'seam' as const,
  }
  const date = moment('2024-02-29')
  const dailyPath = 'Daily/2024-02-29.md'
  const weeklyPath = weeklyNotePath(date, weekly)
  const files = new Map<string, MockTFile | MockTFolder>([
    ['Pinned.md', new MockTFile('Pinned.md')],
  ])
  if (existing) files.set(dailyPath, new MockTFile(dailyPath))
  if (weeklyExisting) files.set(weeklyPath, new MockTFile(weeklyPath))
  const opened: { path: string; target: CalendarOpenTarget }[] = []
  const app = {
    workspace: { getActiveFile: () => null },
    keymap: { popScope() {} },
    vault: {
      getAbstractFileByPath: (path: string) => files.get(path) ?? null,
      createFolder: async (path: string) => {
        files.set(path, new MockTFolder(path))
      },
      create: async (path: string) => {
        const file = new MockTFile(path)
        files.set(path, file)
        return file
      },
    },
  }
  const pins = {
    pins: rolling ? [{ kind: 'weekly' }] : [{ kind: 'file', path: 'Pinned.md' }],
    full: false,
    rolling,
    setWeeklySettings() {},
    weeklyTarget: (_pin: unknown, config: typeof weekly, date: moment.Moment) =>
      weeklyNotePath(date, config),
    hasFile: () => false,
    reconcile: async () => {},
  }
  const calendar = new DailyNoteCalendar(
    app,
    host,
    input,
    settings,
    {
      changed() {},
      open: async (file: MockTFile, target: CalendarOpenTarget) => {
        opened.push({ path: file.path, target })
      },
    },
    new ScopeHost(),
    pins,
    weekly,
    ask,
  )
  calendar.model.selected = date
  calendar.render()
  input.focus()
  const control = (id: string) =>
    host.all.find((node) => node.getAttribute('data-calendar-control') === id)!
  function key(target: ElementHost, options: Partial<KeyboardEvent> = {}, key = 'Enter') {
    target.focus()
    let consumed = false
    const event = {
      target,
      key,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      isComposing: false,
      preventDefault: () => {
        consumed = true
      },
      stopImmediatePropagation() {},
      ...options,
    }
    const handled = calendar.handleKey(event)
    return { handled, consumed }
  }
  return { calendar, host, input, files, opened, control, key, dailyPath, weeklyPath, weekly }
}

describe('Calendar note-opening shortcuts', () => {
  for (const [name, options, target] of [
    ['Enter', {}, false],
    ['Mod+Enter', { metaKey: true }, 'tab'],
    ['Shift+Enter', { shiftKey: true }, 'split'],
    ['Mod+Shift+Enter', { metaKey: true, shiftKey: true }, 'split'],
  ] as const) {
    for (const context of ['input', 'day', 'daily-button', 'weekly-button', 'pin'] as const) {
      it(`${context}: ${name} retains its destination`, async () => {
        const f = fixture()
        const element =
          context === 'input'
            ? f.input
            : context === 'day'
              ? f.host.querySelector('[data-calendar-cell][tabindex="0"]')!
              : f.control(
                  context === 'daily-button'
                    ? 'action'
                    : context === 'weekly-button'
                      ? 'weekly-action'
                      : 'open-pin-Pinned.md',
                )
        assert.equal(f.key(element, options).consumed, true)
        await tick()
        assert.deepEqual(f.opened, [
          {
            path:
              context === 'weekly-button'
                ? f.weeklyPath
                : context === 'pin'
                  ? 'Pinned.md'
                  : f.dailyPath,
            target,
          },
        ])
      })
    }
  }
  it('supports Ctrl+Enter on non-Mac keyboards and registers modified Enter in the navigation scope', async () => {
    const f = fixture()
    f.key(f.input, { ctrlKey: true })
    await tick()
    assert.equal(f.opened[0].target, 'tab')
    for (const key of ['Mod+Enter', 'Shift+Enter', 'Mod+Shift+Enter'])
      assert.ok(f.calendar.navigationScope.handlers.has(key))
  })
  for (const [options, target] of [
    [{ metaKey: true }, 'tab'],
    [{ shiftKey: true }, 'split'],
  ] as const) {
    for (const accept of [false, true])
      it(`missing daily note: ${target} ${accept ? 'creates and opens after confirmation' : 'cancels without creating or opening'}`, async () => {
        const f = fixture({ existing: false, ask: true })
        f.key(f.input, options)
        assert.equal(f.opened.length, 0)
        assert.equal(f.files.has(f.dailyPath), false)
        confirmations[0].click(accept ? 'Create note' : 'Cancel')
        await tick()
        assert.equal(f.files.has(f.dailyPath), accept)
        assert.deepEqual(f.opened, accept ? [{ path: f.dailyPath, target }] : [])
      })
  }
  it('preserves the destination when creating a weekly note or a missing rolling pin', async () => {
    const weekly = fixture({ weeklyExisting: false })
    weekly.key(weekly.control('weekly-action'), { metaKey: true })
    await tick()
    assert.deepEqual(weekly.opened, [{ path: weekly.weeklyPath, target: 'tab' }])
    const rolling = fixture({ rolling: true })
    rolling.key(rolling.control('open-pin-weekly'), { shiftKey: true })
    await tick()
    assert.deepEqual(rolling.opened, [
      { path: weeklyNotePath(moment(), rolling.weekly), target: 'split' },
    ])
  })
  it('keeps picker and pin controls separate from note-opening shortcuts', () => {
    const f = fixture()
    f.key(f.control('title'), { metaKey: true })
    assert.equal(f.calendar.model.page, 'days')
    f.key(f.control('unpin-Pinned.md'), { shiftKey: true })
    assert.equal(f.calendar.openingAction, null)
    f.calendar.model.page = 'years'
    f.calendar.render()
    const cell = f.host.querySelector('[data-calendar-cell][tabindex="0"]')!
    f.key(cell, { metaKey: true })
    assert.equal(f.calendar.model.page, 'years')
    assert.equal(f.calendar.openingAction, null)
    f.key(cell)
    assert.equal(f.calendar.model.page, 'months')
    assert.equal(f.opened.length, 0)
  })
  it('describes the focused daily/weekly/pinned note as open or create, and hides opening hints on controls', () => {
    const f = fixture({ existing: false })
    assert.equal(f.calendar.openingAction, 'create')
    assert.equal(f.calendar.footerAction, 'create')
    f.control('weekly-action').focus()
    assert.equal(f.calendar.openingAction, 'open')
    f.control('open-pin-Pinned.md').focus()
    assert.equal(f.calendar.openingAction, 'open')
    f.control('unpin-Pinned.md').focus()
    assert.equal(f.calendar.openingAction, null)
    assert.equal(f.calendar.footerAction, 'unpin')
  })
  it('preserves composing input, modified input arrows, and unrelated modified calendar keys', () => {
    const f = fixture()
    assert.equal(f.key(f.input, { isComposing: true }).handled, false)
    assert.equal(f.key(f.input, { altKey: true }).handled, false)
    assert.equal(f.key(f.input, { shiftKey: true }, 'ArrowLeft').handled, false)
    assert.equal(
      f.key(
        f.host.querySelector('[data-calendar-cell][tabindex="0"]')!,
        { metaKey: true },
        'ArrowDown',
      ).handled,
      false,
    )
    assert.equal(f.opened.length, 0)
  })
})
