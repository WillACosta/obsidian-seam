import './mocks/obsidian'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MockTFile, MockTFolder } from './mocks/obsidian'
import { moment } from 'obsidian'
import { DEFAULT_SETTINGS } from '../src/types'

// Keep the real Palette routing and async suggestion logic; stub only its UI host.
class ModalHost {
  inputEl = { value: '', closest: () => null }
  scope = {
    register: (mods: string[], key: string, callback: Function) => {
      this.handlers.set([...mods, key].join('+'), callback)
    },
  }
  handlers = new Map<string, Function>()
  instructions: { command: string; purpose: string }[] = []
  constructor(public app: unknown) {}
  setPlaceholder() {}
  setInstructions(value: typeof this.instructions) {
    this.instructions = value
  }
  close() {}
}
Object.assign(require.cache['obsidian']!.exports, {
  SuggestModal: ModalHost,
  Modal: ModalHost,
  AbstractInputSuggest: class {},
})
const { UniversalPalette } = require('../src/ui/UniversalPalette')

describe('Palette date-query creation shortcuts', () => {
  it('shows a recoverable settings error for an invalid yearly format without creating a note', async () => {
    let writes = 0
    const app = {
      vault: {
        getAbstractFileByPath: () => null,
        create: async () => {
          writes++
        },
      },
    }
    const palette = new UniversalPalette(
      app,
      {
        ...DEFAULT_SETTINGS,
        confirmPeriodicNoteCreation: false,
        calendarUsePeriodicNotes: false,
        calendarYearlyFormat: 'GGGG',
      },
      { searchCombinedSpecialWithContent: async () => [] },
      [],
    )
    palette.disposeBaseRender = () => {}
    palette.renderActiveSpecialQueryInput = () => {}
    palette.inputEl.value = '@thisYear'
    const items = await palette.getSuggestions('@thisYear')
    assert.equal(items[0].id, 'period-query-error')
    assert.deepEqual(
      palette.instructions.map((entry: { purpose: string }) => entry.purpose),
      ['dismiss'],
    )
    palette.close = () => assert.fail('Error selection must not dismiss the Palette')
    palette.selectSuggestion(items[0], {})
    assert.equal(writes, 0)
  })

  for (const query of ['@today', '@yesterday', '@thisWeek', '@thisYear']) {
    for (const [shortcut, target] of [
      ['Enter', false],
      ['Mod+Enter', 'tab'],
      ['Shift+Enter', 'split'],
      ['Mod+Shift+Enter', 'split'],
    ] as const) {
      it(`${query} creates in the requested destination with ${shortcut}`, async () => {
        const files = new Map<string, MockTFile | MockTFolder>()
        files.set('Templates/Weekly.md', new MockTFile('Templates/Weekly.md'))
        files.set('Templates/Yearly.md', new MockTFile('Templates/Yearly.md'))
        const contents = new Map<string, string>()
        const opened: unknown[][] = []
        const app = {
          vault: {
            configDir: '.obsidian',
            adapter: {
              exists: async () => true,
              read: async () => JSON.stringify({ folder: 'Daily', format: 'YYYY-MM-DD' }),
            },
            getAbstractFileByPath: (path: string) => files.get(path),
            createFolder: async (path: string) => {
              files.set(path, new MockTFolder(path))
            },
            read: async () => '# {{title}}\n{{date:YYYY-MM-DD}}',
            create: async (path: string, content: string) => {
              const file = new MockTFile(path)
              files.set(path, file)
              contents.set(path, content)
              return file
            },
          },
          workspace: {
            getLeaf: (...args: unknown[]) => ({
              openFile: async (file: MockTFile) => {
                opened.push([...args, file.path])
              },
            }),
          },
        }
        const settings = {
          ...DEFAULT_SETTINGS,
          confirmPeriodicNoteCreation: false,
          calendarUsePeriodicNotes: false,
          calendarWeeklyFolder: 'Weekly',
          calendarWeeklyFormat: 'GGGG/[W]WW',
          calendarWeeklyTemplate: 'Templates/Weekly',
          calendarYearlyFolder: 'Yearly',
          calendarYearlyFormat: 'YYYY/[Goals]',
          calendarYearlyTemplate: 'Templates/Yearly',
        }
        const palette = new UniversalPalette(
          app,
          settings,
          { searchCombinedSpecialWithContent: async () => [] },
          [],
        )
        palette.disposeBaseRender = () => {}
        palette.renderActiveSpecialQueryInput = () => {}
        palette.inputEl.value = query
        const items = await palette.getSuggestions(query)
        assert.equal(items[0].type, 'create')
        assert.deepEqual(
          palette.instructions.map((entry: { purpose: string }) => entry.purpose),
          ['create', 'create in a new tab', 'create in split view', 'dismiss'],
        )
        palette.chooser = { values: items, selectedItem: 0 }
        if (shortcut === 'Enter') palette.onChooseSuggestion(items[0], {})
        else assert.equal(palette.handlers.get(shortcut)({ preventDefault() {} }), false)
        await new Promise((resolve) => setImmediate(resolve))
        assert.equal(opened.length, 1)
        assert.deepEqual(
          opened[0].slice(0, -1),
          target === 'split' ? ['split', 'vertical'] : [target],
        )
        assert.equal(opened[0][opened[0].length - 1], items[0].description)

        if (query === '@thisWeek') {
          assert.equal(
            items[0].description,
            `Weekly/${moment().format('GGGG')}/W${moment().format('WW')}.md`,
          )
          assert.ok(
            contents
              .get(items[0].description)
              ?.includes(moment().startOf('isoWeek').format('YYYY-MM-DD')),
          )
        }
        if (query === '@thisYear') {
          assert.equal(items[0].description, `Yearly/${moment().format('YYYY')}/Goals.md`)
          assert.equal(
            contents.get(items[0].description),
            `# Goals\n${moment().format('YYYY')}-01-01`,
          )
        }
        // Refreshing the query after creation must restore the open labels.
        await palette.getSuggestions(query)
        assert.equal(palette.instructions[1].purpose, 'open in a new tab')
      })
    }
  }
})

describe('Palette atomic special-query Backspace', () => {
  function host(value: string, caret = value.length) {
    const palette = new UniversalPalette(
      {},
      {
        ...DEFAULT_SETTINGS,
        confirmPeriodicNoteCreation: false,
        customSpecialSearches: [
          { id: 'custom', identifier: '@bookshelf', mode: 'base', hidden: false },
        ],
      },
      {},
      [],
    )
    Object.assign(palette.inputEl, {
      value,
      selectionStart: caret,
      selectionEnd: caret,
      setSelectionRange(start: number, end: number) {
        this.selectionStart = start
        this.selectionEnd = end
      },
    })
    let refreshes = 0
    palette.refreshSuggestions = () => {
      refreshes++
    }
    const event = { key: 'Backspace', preventDefault() {}, stopImmediatePropagation() {} }
    return { palette, event, refreshes: () => refreshes }
  }

  for (const token of [
    '@today',
    '@yesterday',
    '@calendar',
    '@thisWeek',
    '@thisYear',
    '@recentlyOpened',
    '@fleeting',
    '@permanent',
    '@recent',
    '@untagged',
    '@docs',
    '@images',
    '@task',
    '@todo',
    '@done',
    '@code',
    '@sources',
    '@last30days',
    '@bookshelf',
    '@CALENDAR',
    '@THISWEEK',
  ]) {
    it(`removes ${token} and its separator with one Backspace`, () => {
      const h = host(`${token} `)
      assert.equal(h.palette.removeSpecialQueryBeforeCaret(h.event), true)
      assert.equal(h.palette.inputEl.value, '')
      assert.equal(h.refreshes(), 1)
    })
  }

  it('removes only the query before the caret and preserves remaining filters', () => {
    const h = host('@todo @thisWeek #work plan', '@todo @thisWeek '.length)
    h.palette.selectedTags = ['reading']
    h.palette.excludedTags = ['archive']
    assert.equal(h.palette.removeSpecialQueryBeforeCaret(h.event), true)
    assert.equal(h.palette.inputEl.value, '@todo #work plan')
    assert.deepEqual(h.palette.selectedTags, ['reading'])
    assert.deepEqual(h.palette.excludedTags, ['archive'])
  })

  it('removes one query at a time from a composed prefix', () => {
    const h = host('')
    h.palette.composedQueryPrefix = '@todo @thisWeek '
    assert.equal(h.palette.removeSpecialQueryBeforeCaret(h.event), true)
    assert.equal(h.palette.composedQueryPrefix, '@todo ')
    assert.equal(h.palette.removeSpecialQueryBeforeCaret(h.event), true)
    assert.equal(h.palette.composedQueryPrefix, '')
  })

  it('leaves ordinary typing, incomplete queries, selections, and modified deletion alone', () => {
    for (const [value, caret] of [
      ['@cal', 4],
      ['@todo text', 10],
      ['@todone', 5],
    ] as const) {
      const h = host(value, caret)
      assert.equal(h.palette.removeSpecialQueryBeforeCaret(h.event), false)
      assert.equal(h.palette.inputEl.value, value)
    }
    for (const change of [
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { shiftKey: true },
      { isComposing: true },
    ]) {
      const h = host('@todo')
      assert.equal(h.palette.removeSpecialQueryBeforeCaret({ ...h.event, ...change }), false)
    }
    const h = host('@todo')
    h.palette.inputEl.selectionStart = 0
    assert.equal(h.palette.removeSpecialQueryBeforeCaret(h.event), false)
  })
})

describe('Note report Backspace', () => {
  for (const query of ['> percentage completion', '> statistics']) {
    it(`${query} returns to usable Palette search and removes report controls`, () => {
      const palette = new UniversalPalette({}, DEFAULT_SETTINGS, {}, [])
      let removedReport = false
      let removedDismiss = false
      let refreshed = false
      let focused = false
      palette.mode = 'statistics'
      palette.statisticsHost = {
        remove: () => {
          removedReport = true
        },
      }
      palette.modalEl = {
        removeClass: (cls: string) => assert.equal(cls, 'seam-palette-statistics'),
        querySelector: () => ({
          remove: () => {
            removedDismiss = true
          },
        }),
      }
      Object.assign(palette.inputEl, {
        value: query,
        disabled: true,
        focus: () => {
          focused = true
        },
      })
      palette.refreshSuggestions = () => {
        refreshed = true
      }
      palette.updateInstructions('')
      assert.deepEqual(
        palette.instructions.map((entry: { purpose: string }) => entry.purpose),
        ['back', 'dismiss'],
      )
      let prevented = false
      assert.equal(
        palette.handlers.get('Backspace')({
          preventDefault: () => {
            prevented = true
          },
        }),
        false,
      )
      assert.equal(prevented && removedReport && removedDismiss && refreshed && focused, true)
      assert.equal(palette.mode, 'search')
      assert.equal(palette.statisticsHost, null)
      assert.equal(palette.inputEl.disabled, false)
      assert.equal(palette.inputEl.value, '')
    })
  }
  it('preserves normal input editing', () => {
    const palette = new UniversalPalette({}, DEFAULT_SETTINGS, {}, [])
    palette.mode = 'search'
    palette.inputEl.value = 'text'
    assert.equal(
      palette.handlers.get('Backspace')({
        preventDefault: () => assert.fail('Must not intercept'),
      }),
      true,
    )
  })
})
