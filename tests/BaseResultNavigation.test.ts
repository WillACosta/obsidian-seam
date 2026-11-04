import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BaseResultNavigation } from '../src/ui/BaseResultNavigation'

function fixture() {
  const attrs = new Map<string, string>()
  const classes = new Set<string>()
  let title = 'First'
  let top = 0
  const card = {
    id: '',
    dataset: {} as Record<string, string>,
    style: { top: '0px', insetInlineStart: '0px' },
    querySelector: () => ({ textContent: title, getAttribute: () => null }),
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({
      top: top - container.scrollTop,
      bottom: top - container.scrollTop + 100,
      left: 0,
      height: 100,
    }),
    toggleClass: (name: string, enabled: boolean) =>
      enabled ? classes.add(name) : classes.delete(name),
    removeClass: (name: string) => classes.delete(name),
    setAttribute: (name: string, value: string) => attrs.set(name, value),
    removeAttribute: (name: string) => attrs.delete(name),
  }
  const search = {
    value: '',
    dispatchEvent: () => {
      // Native Bases searches its data, then recycles this node for a match
      // which was never rendered before the search.
      title = 'Previously offscreen'
      top = 0
      card.style.top = '0px'
    },
  }
  const container = {
    scrollTop: 0,
    scrollHeight: 500,
    clientHeight: 150,
    clientWidth: 100,
    getBoundingClientRect: () => ({ top: 0, bottom: 150, left: 0 }),
    querySelector: (selector: string) =>
      selector.includes('input') ? search : selector.includes('cards') ? {} : null,
    querySelectorAll: (selector: string) => (selector.includes('draggable') ? [card] : []),
  }
  const navigation = new BaseResultNavigation(container as unknown as HTMLElement, 'No results')
  return {
    navigation,
    card,
    container,
    attrs,
    search,
    recycle: (name: string, y: number) => {
      title = name
      top = y
      card.style.top = `${y}px`
    },
  }
}

describe('Base result virtualization', () => {
  it('does not restore stale coordinates when a card node is recycled', () => {
    const f = fixture()
    f.navigation.refresh()
    f.recycle('Last', 400)
    f.container.scrollTop = 350
    f.navigation.refresh()
    assert.equal(f.card.style.top, '400px')
    f.navigation.moveSelection('up')
    f.navigation.moveSelection('up')
    f.recycle('Previous', 288)
    f.navigation.refresh()
    assert.equal(f.navigation.activeFileRef, 'Previous')
    assert.equal(f.card.style.top, '288px')
    f.navigation.destroy()
    assert.equal(f.card.style.top, '288px')
  })

  it('selects the new first match after asynchronous native filtering', () => {
    const f = fixture()
    f.navigation.refresh()
    f.search.dispatchEvent = () => {}
    f.navigation.refresh('offscreen')
    f.recycle('Previously offscreen', 0)
    f.navigation.refresh()
    assert.equal(f.navigation.activeFileRef, 'Previously offscreen')
    assert.equal(f.attrs.get('aria-selected'), 'true')
  })

  it('delegates filtering to the complete native result set', () => {
    const f = fixture()
    f.navigation.refresh()
    f.navigation.refresh('Previously offscreen')
    assert.equal(f.search.value, 'Previously offscreen')
    assert.equal(f.navigation.activeFileRef, 'Previously offscreen')
    assert.equal(f.attrs.get('aria-selected'), 'true')
    assert.equal(f.container.scrollTop, 0)
  })
})

function gridFixture(layout: 'cards' | 'table' = 'cards') {
  const scroller = { scrollLeft: 0, clientWidth: 300, scrollWidth: 900 }
  const container = {
    scrollTop: 0,
    scrollHeight: 324,
    clientHeight: 100,
    clientWidth: 300,
    getBoundingClientRect: () => ({ top: 0, bottom: 100, left: 0 }),
    querySelector: (selector: string): unknown =>
      selector === '.bases-table-container'
        ? scroller
        : selector.includes(`data-view-type="${layout}"`)
          ? {}
          : null,
    querySelectorAll: (selector: string): unknown[] =>
      (selector.includes('draggable') && layout === 'cards') ||
      (selector === '.bases-tr' && layout === 'table')
        ? rendered
        : [],
  }
  const entries = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((name, index) => {
    const top = layout === 'cards' ? Math.floor(index / 3) * 112 : index * 32
    const left = layout === 'cards' ? (index % 3) * 100 : 0
    const height = layout === 'cards' ? 100 : 32
    return {
      id: '',
      dataset: {} as Record<string, string>,
      querySelector: () => ({ textContent: name, getAttribute: () => name }),
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({
        top: top - container.scrollTop,
        bottom: top - container.scrollTop + height,
        left,
        height,
      }),
      toggleClass() {},
      removeClass() {},
      setAttribute() {},
      removeAttribute() {},
    }
  })
  let rendered = entries
  const navigation = new BaseResultNavigation(container as unknown as HTMLElement, 'No results')
  return {
    navigation,
    container,
    scroller,
    show: (from: number, to: number) => {
      rendered = entries.slice(from, to)
    },
  }
}

describe('Base spatial navigation', () => {
  it('uses Left/Right in reading order and Up/Down in the nearest column', () => {
    const f = gridFixture()
    f.navigation.refresh()
    for (const [direction, expected] of [
      ['right', 'B'],
      ['right', 'C'],
      ['down', 'F'],
      ['left', 'E'],
      ['up', 'B'],
      ['left', 'A'],
      ['up', 'A'],
      ['left', 'A'],
    ] as const) {
      f.navigation.moveSelection(direction)
      assert.equal(f.navigation.activeFileRef, expected)
    }
  })
  it('retains the preferred column through an incomplete last row and crosses row boundaries horizontally', () => {
    const f = gridFixture()
    f.navigation.refresh()
    for (const [direction, expected] of [
      ['right', 'B'],
      ['right', 'C'],
      ['down', 'F'],
      ['down', 'G'],
      ['up', 'F'],
      ['up', 'C'],
      ['right', 'D'],
      ['left', 'C'],
    ] as const) {
      f.navigation.moveSelection(direction)
      assert.equal(f.navigation.activeFileRef, expected)
    }
  })
  it('resolves a virtualized row in the preferred column and waits for rendering before repeating', () => {
    const f = gridFixture()
    f.show(0, 3)
    f.navigation.refresh()
    f.navigation.moveSelection('right')
    f.navigation.moveSelection('down')
    assert.equal(f.container.scrollTop, 112)
    f.navigation.moveSelection('down')
    assert.equal(f.container.scrollTop, 112)
    f.show(3, 6)
    f.navigation.refresh()
    assert.equal(f.navigation.activeFileRef, 'E')
    f.navigation.moveSelection('up')
    assert.equal(f.container.scrollTop, 0)
    f.show(0, 3)
    f.navigation.refresh()
    assert.equal(f.navigation.activeFileRef, 'B')
  })
  it('moves table rows vertically and scrolls columns horizontally without changing the selected row', () => {
    const f = gridFixture('table')
    f.navigation.refresh()
    f.navigation.moveSelection('down')
    assert.equal(f.navigation.activeFileRef, 'B')
    f.navigation.moveSelection('right')
    assert.equal(f.scroller.scrollLeft, 150)
    assert.equal(f.navigation.activeFileRef, 'B')
    f.navigation.moveSelection('left')
    assert.equal(f.scroller.scrollLeft, 0)
    f.navigation.moveSelection('up')
    assert.equal(f.navigation.activeFileRef, 'A')
  })
  it('releases a pending move into bottom padding so Up still works at the final row', () => {
    const f = gridFixture()
    f.container.scrollHeight = 339
    f.navigation.refresh()
    f.navigation.moveSelection('down')
    f.navigation.moveSelection('down')
    assert.equal(f.navigation.activeFileRef, 'G')
    f.navigation.moveSelection('down')
    f.container.scrollTop = 239 // Native scrolling clamps to scrollHeight - clientHeight.
    f.navigation.refresh()
    assert.equal(f.navigation.activeFileRef, 'G')
    f.navigation.moveSelection('up')
    assert.equal(f.navigation.activeFileRef, 'D')
  })
})
