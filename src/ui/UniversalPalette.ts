import {
  App,
  Component,
  MarkdownRenderer,
  Scope,
  SuggestModal,
  setIcon,
  normalizePath,
  Notice,
  Platform,
  TFile,
  TFolder,
} from 'obsidian'
import {
  CustomSpecialSearch,
  PaletteItem,
  QuickAddChoice,
  QuickAddConflictBehavior,
  SeamSettings,
  SpecialSearch,
  SpecialSearchOption,
  SPECIAL_SEARCH_ICONS,
  SPECIAL_SEARCH_LABELS,
} from '../types'
import { normalizeTextQuery, parseSpecialSearch, SearchService } from '../search/SearchService'
import { t } from '../i18n'
import { NoteTitleModal } from './NoteTitleModal'
import { NoteConflictModal } from './NoteConflictModal'
import { getTagInputContext, getTagSuggestions } from './TagFilterSuggest'
import { openSearchResult } from '../search/OpenSearchResult'
import { hasDirectoryFilter, parseQuery } from '../search/QueryParser'
import { createDailyNote, getMissingDailyNote } from '../daily/DailyNotes'
import { BaseResultNavigation } from './BaseResultNavigation'
import { BaseNavigationMode } from './BaseNavigationMode'
import { GlobalStatistics } from '../statistics/GlobalStatistics'
import { GlobalStatisticsView } from './GlobalStatisticsView'
import { readNoteStatistics } from '../statistics/NoteStatistics'
import { groupPaletteItems } from './PaletteGroups'
import { confirmPeriodicNote } from './PeriodicNoteConfirmation'
import { renderNoteCompletion } from './NoteCompletionView'
import { readNoteCompletion, summarizeTasks } from '../statistics/NoteCompletion'
import { renderNoteStatistics } from './NoteStatisticsView'
import { currentPeriodTarget, CurrentPeriod } from '../calendar/CurrentPeriodNotes'
import { CalendarPins } from '../calendar/CalendarPins'
import { readWeeklyNoteSettings } from '../calendar/WeeklyNotes'
import { DailyNoteCalendar } from '../calendar/DailyNoteCalendar'
import { readDailyNoteSettings } from '../daily/DailyNotes'
import { orderSpecialSearches } from '../calendar/SpecialSearchOrder'
import { getNoteOutline } from '../outline/NoteOutline'

/**
 * Internal interface for the SuggestModal's chooser.
 * Not part of the public Obsidian API, but stable across versions
 * and commonly used by community plugins for modifier-key features.
 */
interface SuggestChooser<T> {
  values: T[] | null
  selectedItem: number
}

/**
 * Renders text into a parent element with highlighted portions matching the query.
 * Used for title, tags, and snippet highlighting.
 */
function renderHighlightedText(parent: HTMLElement, text: string, query: string): void {
  if (!query) {
    parent.appendText(text)
    return
  }

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  let lastIndex = 0
  let index = lowerText.indexOf(lowerQuery)

  if (index === -1) {
    // No match found, render as plain text
    parent.appendText(text)
    return
  }

  while (index !== -1) {
    // Text before match
    if (index > lastIndex) {
      parent.appendText(text.slice(lastIndex, index))
    }
    // Highlighted match
    parent.createSpan({
      cls: 'seam-palette-highlight',
      text: text.slice(index, index + query.length),
    })
    lastIndex = index + query.length
    index = lowerText.indexOf(lowerQuery, lastIndex)
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    parent.appendText(text.slice(lastIndex))
  }
}

/**
 * Universal Palette — the primary UI for Seam.
 * Combines note search, tag search, and command execution
 * in a single floating modal built on Obsidian's SuggestModal.
 */
export class UniversalPalette extends SuggestModal<PaletteItem> {
  onClosed?: () => void
  private createSuggestionActive = false
  private closeButtonScope: Scope | null = null
  private lastQuery = ''
  private selectedTags: string[] = []
  private excludedTags: string[] = []
  private chipsContainerEl: HTMLElement | null = null
  private composedChipsContainerEl: HTMLElement | null = null
  private composedTagKeys: string[] = []
  private composedQueryPrefix = ''
  private composedQueryPrefixEl: HTMLElement | null = null
  private queryInputMirrorEl: HTMLElement | null = null
  private mode: 'search' | 'quick-add' | 'statistics' | 'outline' = 'search'
  private outlineItems: PaletteItem[] = []
  private outlinePreviousLimit: number | null = null
  private calendarView: DailyNoteCalendar | null = null
  private calendarHost: HTMLElement | null = null
  private calendarGeneration = 0
  private statisticsHost: HTMLElement | null = null
  private globalStatisticsView: GlobalStatisticsView | null = null
  private quickAddDraft = ''
  private selectedDirectoryToken: string | null = null
  private selectedInlineTagTokens = new Set<string>()
  private baseRenderComponent: Component | null = null
  private baseRenderHost: HTMLElement | null = null
  private baseRenderKey = ''
  private baseRenderObserver: MutationObserver | null = null
  private baseResultNavigation: BaseResultNavigation | null = null
  private baseNavigationMode: BaseNavigationMode | null = null
  private baseNavigationEnabled = false
  private baseSourcePath = ''
  private readonly baseNavigationKeyListener = (event: KeyboardEvent): void => {
    if (this.mode === 'statistics') {
      const dismiss = this.modalEl.querySelector<HTMLButtonElement>('.seam-note-statistics-dismiss')
      if (dismiss && event.target === dismiss && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        event.stopImmediatePropagation()
        dismiss.click()
        return
      }
      this.globalStatisticsView?.handleKey(event)
      return
    }
    if (this.calendarView?.handleKey(event)) return
    if (this.calendarHost && !this.calendarView && (event.key === 'Enter' || event.key === ' ')) {
      const target = event.target as Node | null
      const retry =
        target?.instanceOf(HTMLButtonElement) && this.calendarHost.contains(target) ? target : null
      if (retry) {
        event.preventDefault()
        event.stopImmediatePropagation()
        retry.click()
        return
      }
    }
    if (this.baseNavigationEnabled) this.baseNavigationMode?.handleKey(event)
  }

  constructor(
    app: App,
    private settings: SeamSettings,
    private searchService: SearchService,
    private commands: PaletteItem[],
    private calendarPins?: CalendarPins,
    private globalStatistics?: GlobalStatistics,
  ) {
    super(app)
    this.setPlaceholder(t().palettePlaceholder)
    this.updateInstructions('')
    this.emptyStateText = 'No results found.'

    // Register Mod+Enter (Cmd on Mac, Ctrl on Win/Linux) to open in new tab.
    // SuggestModal's default Enter handler does not preserve modifier state
    // when calling onChooseSuggestion, so we intercept at the scope level.
    this.scope.register(['Mod'], 'Enter', (evt: KeyboardEvent) => {
      if (
        this.mode === 'statistics' ||
        this.mode === 'outline' ||
        this.calendarHost ||
        this.closeButtonScope
      )
        return false
      evt.preventDefault()
      const item = this.getSelectedItem()
      if (item?.type === 'note' && item.file) {
        this.close()
        void openSearchResult(this.app, item, 'tab')
      } else if (item?.type === 'create') {
        this.close()
        void item.action?.('tab')
      } else if (item?.type === 'tag') {
        this.selectSuggestion(item, evt)
      }
      return false
    })
    const openInSplit = (evt: KeyboardEvent): boolean => {
      if (
        this.mode === 'statistics' ||
        this.mode === 'outline' ||
        this.calendarHost ||
        this.closeButtonScope
      )
        return false
      const item = this.getSelectedItem()
      if (item?.type === 'create') {
        evt.preventDefault()
        this.close()
        void item.action?.('split')
        return false
      }
      if (item?.type !== 'note' || !item.file || this.baseNavigationEnabled) return true
      evt.preventDefault()
      this.close()
      void openSearchResult(this.app, item, 'split')
      return false
    }
    this.scope.register(['Mod', 'Shift'], 'Enter', openInSplit)
    this.scope.register(['Shift'], 'Enter', openInSplit)
    this.scope.register([], 'Escape', (evt: KeyboardEvent) => {
      if (this.mode === 'statistics' || this.mode === 'outline') {
        this.close()
        return false
      }
      if (this.mode === 'search') return true
      evt.preventDefault()
      this.returnToSearch()
      return false
    })
    this.scope.register([], 'Backspace', (evt: KeyboardEvent) => {
      if (this.mode === 'statistics') {
        evt.preventDefault()
        this.returnToSearch()
        return false
      }
      if (this.mode === 'search' || this.inputEl.value.length > 0) return true
      evt.preventDefault()
      this.returnToSearch()
      return false
    })
  }

  onOpen(): void {
    window.addEventListener('keydown', this.baseNavigationKeyListener, true)
    void super.onOpen()
    this.setupChipsContainer()
  }

  onClose(): void {
    window.removeEventListener('keydown', this.baseNavigationKeyListener, true)
    this.releaseCloseButtonScope()
    this.disposeCalendar()
    this.globalStatisticsView?.destroy()
    this.globalStatisticsView = null
    this.statisticsHost?.remove()
    this.statisticsHost = null
    this.outlineItems = []
    this.inputEl
      .closest<HTMLElement>('.prompt')
      ?.removeClass(
        'seam-palette-custom-search-expanded',
        'seam-palette-special-search-active',
        'seam-palette-directory-search-active',
      )
    this.selectedTags = []
    this.excludedTags = []
    this.selectedDirectoryToken = null
    this.selectedInlineTagTokens.clear()
    this.composedTagKeys = []
    this.composedQueryPrefix = ''
    this.disposeBaseRender()
    this.onClosed?.()
  }

  private disposeCalendar(): void {
    this.calendarGeneration++
    this.calendarView?.unload()
    this.calendarView = null
    this.calendarHost?.remove()
    this.calendarHost = null
    this.modalEl.removeClass('seam-palette-calendar')
  }

  private showCalendar(): void {
    if (this.calendarHost) return
    this.baseNavigationEnabled = false
    this.disposeBaseRender()
    this.modalEl.addClass('seam-palette-calendar')
    const host = this.modalEl.createDiv({
      cls: 'seam-calendar',
      attr: { 'aria-label': t().paletteSpecialCalendar, 'aria-busy': 'true' },
    })
    this.resultContainerEl.before(host)
    this.calendarHost = host
    host.createEl('p', { text: t().calendarLoading })
    const generation = ++this.calendarGeneration
    void Promise.all([
      readDailyNoteSettings(this.app),
      readWeeklyNoteSettings(this.app, this.settings),
    ])
      .then(([settings, weekly]) => {
        if (generation !== this.calendarGeneration) return
        const leaf = this.app.workspace.getLeaf(false)
        this.calendarView = new DailyNoteCalendar(
          this.app,
          host,
          this.inputEl,
          settings,
          {
            changed: () => this.updateInstructions(''),
            open: async (file, target) => {
              this.close()
              const destination =
                target === 'split'
                  ? this.app.workspace.getLeaf('split', 'vertical')
                  : target === 'tab'
                    ? this.app.workspace.getLeaf('tab')
                    : leaf
              await destination.openFile(file)
            },
          },
          this.scope,
          this.calendarPins,
          weekly,
          this.settings.confirmPeriodicNoteCreation,
        )
        this.calendarView.load()
      })
      .catch((error: unknown) => {
        if (generation !== this.calendarGeneration) return
        host.empty()
        host.createEl('p', {
          text: `${t().calendarLoadFailed} ${error instanceof Error ? error.message : String(error)}`,
          attr: { role: 'alert' },
        })
        const retry = host.createEl('button', { text: t().calendarRetry, attr: { type: 'button' } })
        retry.addEventListener('click', () => {
          this.disposeCalendar()
          this.refreshSuggestions()
        })
      })
      .finally(() => {
        host.removeAttribute('aria-busy')
      })
  }

  /** Keep native suggestion navigation and clicking for the note's full heading hierarchy. */
  showNoteOutline(file: TFile): void {
    this.mode = 'outline'
    this.lastQuery = ''
    this.baseNavigationEnabled = false
    this.disposeBaseRender()
    this.selectedTags = []
    this.excludedTags = []
    this.composedTagKeys = []
    this.composedQueryPrefix = ''
    this.renderChips()
    this.modalEl.removeClass(
      'seam-palette-custom-search-expanded',
      'seam-palette-special-search-active',
      'seam-palette-directory-search-active',
    )
    this.modalEl.addClass('seam-palette-outline')
    this.outlineItems = getNoteOutline(this.app, file)
    this.outlinePreviousLimit = this.limit
    this.limit = Math.max(1, this.outlineItems.length)
    this.emptyStateText = t().outlineEmpty
    this.inputEl.value = ''
    this.setPlaceholder(t().outlinePlaceholder(file.basename))
    this.inputEl.setAttribute('aria-label', t().outlinePlaceholder(file.basename))
    this.updateInstructions('')
    this.refreshSuggestions()
    this.inputEl.focus()
  }

  /** Replace search with a read-only report in the same Palette. */
  private createReportHost(title: string): HTMLElement {
    this.mode = 'statistics'
    this.lastQuery = ''
    this.baseNavigationEnabled = false
    this.disposeBaseRender()
    this.modalEl.addClass('seam-palette-statistics')
    this.inputEl.disabled = true
    this.updateInstructions('')
    this.globalStatisticsView?.destroy()
    this.globalStatisticsView = null
    this.statisticsHost?.remove()
    this.modalEl.querySelector('.seam-note-statistics-dismiss')?.remove()
    this.modalEl.removeClass('seam-palette-global-statistics')
    const host = this.modalEl.createDiv({
      cls: 'seam-note-statistics',
      attr: {
        tabindex: '-1',
        'aria-label': title,
        role: 'region',
        'aria-busy': 'true',
        'aria-live': 'polite',
      },
    })
    this.resultContainerEl.before(host)
    this.statisticsHost = host
    host.createEl('p', { text: t().statisticsLoading })
    const dismiss = this.modalEl.createEl('button', {
      cls: 'clickable-icon seam-note-statistics-dismiss',
      attr: { type: 'button', 'aria-label': t().paletteHelpDismiss },
    })
    setIcon(dismiss, 'x')
    dismiss.addEventListener('click', () => this.close())
    host.focus()
    return host
  }

  showGlobalStatistics(): void {
    if (!this.globalStatistics) return
    const host = this.createReportHost(t().globalTitle)
    host.setAttribute('aria-live', 'off')
    host.removeAttribute('aria-busy')
    this.modalEl.addClass('seam-palette-global-statistics')
    this.globalStatisticsView = new GlobalStatisticsView(
      this.app,
      host,
      this.globalStatistics,
      async (file) => {
        this.close()
        await this.app.workspace.getLeaf(false).openFile(file)
      },
    )
  }

  async showNoteStatistics(file: TFile, completion = false): Promise<void> {
    const host = this.createReportHost(completion ? t().completionTitle : t().statisticsTitle)
    try {
      if (completion) {
        const report = await readNoteCompletion(this.app, file)
        if (this.statisticsHost !== host) return
        renderNoteCompletion(host, file, report)
      } else {
        const report = await readNoteStatistics(this.app, file)
        if (this.statisticsHost !== host) return
        renderNoteStatistics(host, report, this.settings.showIcons)
      }
    } catch {
      if (this.statisticsHost !== host) return
      host.empty()
      host.createEl('p', { text: t().statisticsReadFailed, attr: { role: 'alert' } })
    } finally {
      host.removeAttribute('aria-busy')
    }
  }

  private releaseCloseButtonScope(): void {
    const scope = this.closeButtonScope
    this.closeButtonScope = null
    if (scope) this.app.keymap.popScope(scope)
  }

  /** Sets up the chips and dismiss control inside the prompt input container. */
  private setupChipsContainer(): void {
    const parent = this.inputEl.parentElement
    if (!parent) return

    parent.addClass('seam-palette-input-container')
    // The native clear control is no longer adjacent to inputEl after chip wrapping.
    // Give the visible X an explicit, accessible modal-dismiss action instead.
    parent.querySelector('.search-input-clear-button')?.remove()
    const close = parent.createEl('button', {
      cls: 'clickable-icon seam-palette-close',
      attr: {
        type: 'button',
        'aria-label': t().paletteHelpDismiss,
      },
    })
    setIcon(close, 'circle-x')
    close.addEventListener('click', () => this.close())
    close.addEventListener('focus', () => {
      if (this.closeButtonScope) return
      const scope = new Scope(this.scope)
      const dismiss = (): false => {
        this.close()
        return false
      }
      scope.register([], 'Enter', dismiss)
      scope.register([], ' ', dismiss)
      this.closeButtonScope = scope
      this.app.keymap.pushScope(scope)
      this.updateInstructions(this.lastQuery)
    })
    close.addEventListener('blur', () => {
      this.releaseCloseButtonScope()
      this.updateInstructions(this.lastQuery)
    })

    this.chipsContainerEl = createDiv({ cls: 'seam-palette-chips-container is-hidden' })
    parent.insertBefore(this.chipsContainerEl, this.inputEl)

    const inputShell = createDiv({ cls: 'seam-palette-input-shell' })
    parent.insertBefore(inputShell, this.inputEl)
    inputShell.appendChild(this.inputEl)
    this.queryInputMirrorEl = inputShell.createDiv({ cls: 'seam-palette-query-input-mirror' })
    this.composedQueryPrefixEl = createSpan({ cls: 'seam-palette-query-input-token is-hidden' })
    parent.insertBefore(this.composedQueryPrefixEl, inputShell)
    this.composedChipsContainerEl = createDiv({ cls: 'seam-palette-chips-container is-hidden' })
    parent.insertBefore(this.composedChipsContainerEl, inputShell)

    // Click anywhere in container focuses the input
    parent.addEventListener('click', (e) => {
      if (e.target === parent || e.target === this.chipsContainerEl) {
        this.inputEl.focus()
      }
    })

    // Keydown listener on inputEl for Backspace removal of chips
    this.inputEl.addEventListener('keydown', (evt: KeyboardEvent) => {
      if (this.removeSpecialQueryBeforeCaret(evt)) return
      if (
        evt.key === 'Backspace' &&
        this.composedQueryPrefix &&
        !this.inputEl.value &&
        !this.selectedTags.length &&
        !this.excludedTags.length
      ) {
        evt.preventDefault()
        evt.stopImmediatePropagation()
        this.composedQueryPrefix = ''
        this.refreshSuggestions()
        return
      }
      const trailingTag = this.inputEl.value.trimEnd().match(/(?:^|\s)(!?#[^\s]+)$/)?.[1]
      if (
        evt.key === 'Backspace' &&
        this.mode === 'search' &&
        trailingTag &&
        this.selectedInlineTagTokens.has(trailingTag) &&
        this.inputEl.selectionStart === this.inputEl.value.length &&
        this.inputEl.selectionEnd === this.inputEl.value.length
      ) {
        evt.preventDefault()
        evt.stopImmediatePropagation()
        this.inputEl.value = this.inputEl.value.trimEnd().slice(0, -trailingTag.length)
        this.selectedInlineTagTokens.delete(trailingTag)
        this.refreshSuggestions()
        return
      }
      if (
        evt.key === 'Backspace' &&
        this.mode === 'search' &&
        this.selectedDirectoryToken &&
        this.inputEl.selectionStart === this.inputEl.value.length &&
        this.inputEl.selectionEnd === this.inputEl.value.length &&
        this.inputEl.value.trimEnd().endsWith(this.selectedDirectoryToken)
      ) {
        evt.preventDefault()
        evt.stopImmediatePropagation()
        this.inputEl.value = this.inputEl.value
          .trimEnd()
          .slice(0, -this.selectedDirectoryToken.length)
          .trimEnd()
        this.selectedDirectoryToken = null
        this.refreshSuggestions()
        return
      }
      if (
        evt.key === 'Backspace' &&
        this.inputEl.selectionStart === 0 &&
        this.inputEl.selectionEnd === 0
      ) {
        if (this.excludedTags.length > 0) {
          evt.preventDefault()
          this.removeSelectedTag(this.excludedTags[this.excludedTags.length - 1], true)
        } else if (this.selectedTags.length > 0) {
          evt.preventDefault()
          this.removeSelectedTag(this.selectedTags[this.selectedTags.length - 1], false)
        }
      }
    })

    // Also automatically convert a completed tag when user types space (e.g. "#ai ")
    this.inputEl.addEventListener('input', () => {
      const val = this.inputEl.value
      const tokens = new Set(val.split(/\s+/))
      for (const token of this.selectedInlineTagTokens) {
        if (!tokens.has(token)) this.selectedInlineTagTokens.delete(token)
      }
      if (this.selectedDirectoryToken && !val.includes(this.selectedDirectoryToken))
        this.selectedDirectoryToken = null
      const match = val.match(/^(!)?#([^\s#]+)\s+$/)
      if (match) {
        const tag = match[2]
        if (this.composedQueryPrefix) {
          const key = `${match[1] ? '!' : ''}#${tag.toLowerCase()}`
          if (!this.composedTagKeys.includes(key)) this.composedTagKeys.push(key)
        }
        this.inputEl.value = ''
        this.addSelectedTag(tag, Boolean(match[1]))
        return
      }
      const directoryTagMatch = val.match(
        /^(.*(?:^|\s)(?:\/|dir:)(?:"[^"]*"|[^\s]+)\s+)(!?#[^\s#]+)\s+$/i,
      )
      if (directoryTagMatch) {
        const [, queryPrefix, tagToken] = directoryTagMatch
        this.composedQueryPrefix = `${queryPrefix.trimEnd()} `
        const excluded = tagToken.startsWith('!')
        const tagKey = `${excluded ? '!' : ''}#${tagToken.replace(/^!?#/, '').toLowerCase()}`
        if (!this.composedTagKeys.includes(tagKey)) this.composedTagKeys.push(tagKey)
        this.addSelectedTag(tagToken.replace(/^!?#/, ''), excluded)
      }
      window.requestAnimationFrame(() => this.syncQueryInputMirrorScroll())
    })
    this.inputEl.addEventListener('scroll', () => this.syncQueryInputMirrorScroll())
  }

  /**
   * Renders the active tag chips in the input bar.
   */
  private renderChips(): void {
    if (!this.chipsContainerEl) return
    this.chipsContainerEl.empty()
    this.composedChipsContainerEl?.empty()

    if (this.selectedTags.length === 0 && this.excludedTags.length === 0) {
      this.chipsContainerEl.addClass('is-hidden')
      this.composedChipsContainerEl?.addClass('is-hidden')
      this.setPlaceholder(t().palettePlaceholder)
      return
    }

    this.chipsContainerEl.removeClass('is-hidden')
    this.setPlaceholder(t().paletteTagPlaceholder)

    const chips = [
      ...this.selectedTags.map((tag) => ({ tag, excluded: false })),
      ...this.excludedTags.map((tag) => ({ tag, excluded: true })),
    ]
    chips.sort(
      (a, b) =>
        this.composedTagKeys.indexOf(`${a.excluded ? '!' : ''}#${a.tag}`) -
        this.composedTagKeys.indexOf(`${b.excluded ? '!' : ''}#${b.tag}`),
    )
    for (const { tag, excluded } of chips) {
      const key = `${excluded ? '!' : ''}#${tag}`
      const container = this.composedTagKeys.includes(key)
        ? this.composedChipsContainerEl!
        : this.chipsContainerEl
      const chipEl = container.createSpan({ cls: 'seam-palette-chip' })
      if (excluded) chipEl.addClass('seam-palette-chip-negative')

      const textEl = chipEl.createSpan({ cls: 'seam-palette-chip-text' })
      textEl.setText(`${excluded ? '!' : ''}#${tag}`)

      const removeEl = chipEl.createSpan({ cls: 'seam-palette-chip-remove' })
      setIcon(removeEl, 'x')
      removeEl.setAttribute('aria-label', `Remove ${excluded ? '!' : ''}#${tag}`)
      removeEl.addEventListener('click', (e) => {
        e.stopPropagation()
        this.removeSelectedTag(tag, excluded)
        this.inputEl.focus()
      })
    }
    this.chipsContainerEl.toggleClass('is-hidden', !this.chipsContainerEl.childElementCount)
    this.composedChipsContainerEl?.toggleClass(
      'is-hidden',
      !this.composedChipsContainerEl.childElementCount,
    )
  }

  /**
   * Appends a tag to the active filter conditions and refreshes suggestions.
   */
  private addSelectedTag(tag: string, excluded = false, remainingInput = ''): void {
    const normTag = tag.replace(/^#/, '').trim().toLowerCase()
    if (!normTag) return

    const targetTags = excluded ? this.excludedTags : this.selectedTags
    if (!targetTags.includes(normTag)) {
      targetTags.push(normTag)
    }

    this.inputEl.value = remainingInput
    this.renderChips()
    this.refreshSuggestions()
  }

  /**
   * Removes a tag from the active filter conditions and refreshes suggestions.
   */
  private removeSelectedTag(tag: string, excluded = false): void {
    const normTag = tag.replace(/^#/, '').trim().toLowerCase()
    if (excluded) {
      this.excludedTags = this.excludedTags.filter((t) => t !== normTag)
    } else {
      this.selectedTags = this.selectedTags.filter((t) => t !== normTag)
    }
    this.composedTagKeys = this.composedTagKeys.filter(
      (key) => key !== `${excluded ? '!' : ''}#${normTag}`,
    )
    this.renderChips()
    this.refreshSuggestions()
  }

  /**
   * Programmatically re-triggers the SuggestModal's input handler to update suggestions.
   */
  refreshSpecialSearchChoices(): void {
    const query = this.composedQueryPrefix + this.inputEl.value
    if (
      this.mode === 'search' &&
      !this.calendarHost &&
      query.trimStart().startsWith('@') &&
      !this.getSpecialQueryTokens(query).length
    ) {
      this.refreshSuggestions()
    }
  }

  private refreshSuggestions(): void {
    this.inputEl.dispatchEvent(new Event('input'))
  }

  /**
   * Intercept suggestion selection to keep the modal open when a tag is selected.
   */
  selectSuggestion(value: PaletteItem, evt: MouseEvent | KeyboardEvent): void {
    if (this.mode === 'statistics' || this.calendarHost || value.id === 'period-query-error') return
    if (this.mode === 'outline') {
      if (value.type !== 'heading') return
      this.close()
      this.onChooseSuggestion(value, evt)
      return
    }
    if (value.id === 'cmd-global-statistics') {
      this.showGlobalStatistics()
      return
    }
    if (value.id === 'cmd-note-outline' && value.file) {
      this.showNoteOutline(value.file)
      return
    }
    if ((value.id === 'cmd-note-statistics' || value.id === 'cmd-note-completion') && value.file) {
      void this.showNoteStatistics(value.file, value.id === 'cmd-note-completion')
      return
    }
    const fullInput = this.composedQueryPrefix + this.inputEl.value
    if (value.type === 'tag' && this.getSpecialQueryTokens(fullInput).length > 0) {
      const remainingInput = fullInput.replace(/!?#[^\s]*$/, '')
      const key = `${value.tagMode === 'exclude' ? '!' : ''}#${value.title.toLowerCase()}`
      if (!this.composedTagKeys.includes(key)) this.composedTagKeys.push(key)
      this.composedQueryPrefix = remainingInput
      this.addSelectedTag(value.title, value.tagMode === 'exclude')
      this.inputEl.setSelectionRange(this.inputEl.value.length, this.inputEl.value.length)
      return
    }
    if (value.type === 'tag' && hasDirectoryFilter(fullInput)) {
      const prefix = fullInput.replace(/!?#[^\s]*$/, '').trimEnd()
      this.composedQueryPrefix = `${prefix} `
      const excluded = value.tagMode === 'exclude'
      const key = `${excluded ? '!' : ''}#${value.title.toLowerCase()}`
      if (!this.composedTagKeys.includes(key)) this.composedTagKeys.push(key)
      this.addSelectedTag(value.title, excluded)
      this.inputEl.setSelectionRange(this.inputEl.value.length, this.inputEl.value.length)
      return
    }
    if (
      value.type === 'directory' ||
      (value.type === 'tag' && this.getSpecialQueryTokens(this.inputEl.value).length > 0)
    ) {
      const token =
        value.type === 'directory'
          ? `/${value.title.includes(' ') ? JSON.stringify(value.title) : value.title}`
          : `${value.tagMode === 'exclude' ? '!' : ''}#${value.title}`
      this.inputEl.value =
        this.inputEl.value.replace(/(?:(?:\/|dir:)"[^"]*|(?:\/|dir:)\S*|!?#\S*)$/i, token) + ' '
      this.inputEl.setSelectionRange(this.inputEl.value.length, this.inputEl.value.length)
      if (value.type === 'directory') this.selectedDirectoryToken = token
      else this.selectedInlineTagTokens.add(token)
      this.refreshSuggestions()
      return
    }
    if (value.type === 'tag') {
      const tag = value.title.replace(/^#/, '')
      this.addSelectedTag(tag, value.tagMode === 'exclude')
      return
    }
    if (value.type === 'special') {
      this.inputEl.value = `${value.specialSearchInput ?? value.title} `
      this.inputEl.setSelectionRange(this.inputEl.value.length, this.inputEl.value.length)
      this.refreshSuggestions()
      return
    }
    if (value.type === 'base') {
      if (
        evt instanceof KeyboardEvent &&
        this.baseNavigationEnabled &&
        this.openSelectedBaseResult(evt)
      )
        return
      this.close()
      return
    }
    if (value.id === 'cmd-quick-add') {
      this.showQuickAdd()
      return
    }
    if (value.id.startsWith('quick-add-choice-')) {
      const choice = this.settings.quickAddChoices.find(
        (item) => item.id === value.id.slice('quick-add-choice-'.length),
      )
      if (choice) this.promptQuickAdd(choice)
      return
    }
    if (value.id === 'quick-add-fleeting') {
      this.promptQuickAdd(null)
      return
    }
    super.selectSuggestion(value, evt)
  }

  private async getDailyNoteCreationSuggestion(
    search: 'today' | 'yesterday',
  ): Promise<PaletteItem | null> {
    try {
      const target = await getMissingDailyNote(this.app, search)
      if (!target) return null
      return {
        id: `create-daily-note-${search}`,
        title:
          search === 'today'
            ? t().paletteCreateTodayDailyNote
            : t().paletteCreateYesterdayDailyNote,
        description: target.path,
        type: 'create',
        icon: 'calendar-plus',
        action: async (openBehavior = false) => {
          try {
            if (
              !(await confirmPeriodicNote(
                this.app,
                target.path,
                this.settings.confirmPeriodicNoteCreation,
              ))
            )
              return
            const file = await createDailyNote(this.app, target.date, target.settings)
            const leaf =
              openBehavior === 'split'
                ? this.app.workspace.getLeaf('split', 'vertical')
                : this.app.workspace.getLeaf(openBehavior)
            await leaf.openFile(file)
          } catch (error) {
            new Notice(
              `${t().noticeCreateDailyFailed}: ${error instanceof Error ? error.message : String(error)}`,
            )
          }
        },
      }
    } catch {
      return null
    }
  }

  private async getPeriodNoteCreationSuggestion(
    search: CurrentPeriod,
  ): Promise<PaletteItem | null> {
    const target = await currentPeriodTarget(this.app, this.settings, search)
    if (this.app.vault.getAbstractFileByPath(target.path)) return null
    return {
      id: `create-period-note-${search}`,
      title: search === 'thisWeek' ? t().paletteCreateWeeklyNote : t().paletteCreateYearlyNote,
      description: target.path,
      type: 'create',
      icon: 'calendar-plus',
      action: async (openBehavior = false) => {
        try {
          if (
            !(await confirmPeriodicNote(
              this.app,
              target.path,
              this.settings.confirmPeriodicNoteCreation,
            ))
          )
            return
          const file = await target.create()
          const leaf =
            openBehavior === 'split'
              ? this.app.workspace.getLeaf('split', 'vertical')
              : this.app.workspace.getLeaf(openBehavior)
          await leaf.openFile(file)
        } catch (error) {
          new Notice(
            `${t().calendarActionFailed}: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      },
    }
  }

  /** Gets the currently selected suggestion from the internal chooser. */
  private getSelectedItem(): PaletteItem | null {
    const chooser = (this as unknown as { chooser: SuggestChooser<PaletteItem> }).chooser
    if (!chooser?.values || chooser.selectedItem < 0) return null
    return chooser.values[chooser.selectedItem] ?? null
  }

  /**
   * Returns suggestions for the given query.
   * For text queries, returns a Promise to enable async in-note content search.
   * For tag queries, shows tag suggestions when '#' is present in the input.
   * When tags are selected in chips, shows notes matching those tags.
   */
  getSuggestions(query: string): PaletteItem[] | Promise<PaletteItem[]> {
    if (this.mode === 'statistics') return []
    if (this.mode === 'outline') {
      this.updateInstructions(query)
      return this.outlineItems.filter((item) =>
        item.title.toLowerCase().includes(query.trim().toLowerCase()),
      )
    }
    query = this.composedQueryPrefix + query
    if (
      this.mode === 'search' &&
      query.trim().toLowerCase() === '@calendar' &&
      !this.selectedTags.length &&
      !this.excludedTags.length
    ) {
      this.lastQuery = '@calendar'
      this.renderActiveSpecialQueryInput(query)
      this.showCalendar()
      this.updateInstructions('')
      return []
    }
    if (this.calendarHost) this.disposeCalendar()
    const trimmed = query.trim()
    this.lastQuery = trimmed
    this.createSuggestionActive = false
    if (this.mode === 'search') {
      const specialQueries = this.getSpecialQueryTokens(query)
      const placeholder = specialQueries.some((entry) => entry.custom?.mode === 'base')
        ? ''
        : specialQueries.length > 0
          ? t().paletteSeamSearchPlaceholder
          : hasDirectoryFilter(query) ||
              getTagInputContext(query) ||
              this.selectedTags.length > 0 ||
              this.excludedTags.length > 0
            ? t().paletteTagPlaceholder
            : t().palettePlaceholder
      this.setPlaceholder(placeholder)
    }
    const customSearch =
      this.mode === 'search' && trimmed.startsWith('@')
        ? this.getCustomSearchForQuery(trimmed)
        : null
    this.baseNavigationEnabled = customSearch?.mode === 'base'
    if (customSearch?.mode !== 'base') this.disposeBaseRender()
    this.inputEl
      .closest<HTMLElement>('.prompt')
      ?.toggleClass('seam-palette-custom-search-expanded', Boolean(customSearch?.expandModal))
    this.renderActiveSpecialQueryInput(query)
    this.updateInstructions(trimmed)

    if (this.mode === 'quick-add') return this.getQuickAddChoices(trimmed)

    const directoryInput = query.match(/(?:^|\s)(?:\/|dir:)(?:"([^"]*)|([^\s]*))$/i)
    if (directoryInput) {
      const prefix = (directoryInput[1] ?? directoryInput[2]).toLowerCase()
      return this.app.vault
        .getAllLoadedFiles()
        .filter(
          (file): file is TFolder =>
            file instanceof TFolder && Boolean(file.path) && file.path !== '/',
        )
        .filter((folder) => folder.path.toLowerCase().includes(prefix))
        .map((folder) => ({
          id: `dir-${folder.path}`,
          title: folder.path,
          description: '',
          type: 'directory' as const,
          icon: 'folder',
        }))
    }

    // Special search mode: typing @ lists supported filters; selecting one applies it.
    if (trimmed.startsWith('@')) {
      const combined = this.getSpecialQueryTokens(trimmed)
      if (
        combined.length > 0 &&
        !combined.some((entry) => entry.custom?.mode === 'base') &&
        getTagInputContext(query)
      ) {
        return this.handleTagQuery(query)
      }
      if (combined.length > 0) {
        const baseQueries = combined.filter((entry) => entry.custom?.mode === 'base')
        const remaining = trimmed
          .split(/\s+/)
          .filter(
            (token) => !combined.some((entry) => entry.token.toLowerCase() === token.toLowerCase()),
          )
          .join(' ')
          .trim()
        if (baseQueries.length > 0) {
          if (
            combined.length !== 1 ||
            this.selectedTags.length ||
            this.excludedTags.length ||
            /(?:^|\s)(?:!?#[^\s]+|\/|dir:|@[^\s]+)/i.test(remaining)
          )
            return []
          const base = baseQueries[0].custom!
          const items = this.getCustomBaseItem(base, remaining)
          if (items.length === 0) this.disposeBaseRender()
          return items
        }

        const parsedRemaining = parseQuery(remaining)
        const filterTokens = parsedRemaining.tokens.filter((token) => token.type !== 'text')
        const inlineTagQuery = filterTokens
          .map((token) => {
            if (token.type === 'tag') return `#${token.value}`
            if (token.type === 'negativeTag') return `!#${token.value}`
            if (token.type === 'directory') return `/${JSON.stringify(token.value)}`
            return 'OR'
          })
          .join(' ')
        const chipQuery = [
          ...this.selectedTags.map((tag) => `#${tag}`),
          ...this.excludedTags.map((tag) => `!#${tag}`),
        ].join(' ')
        const textQuery = parsedRemaining.tokens
          .filter((token) => token.type === 'text')
          .map((token) => token.value)
          .join(' ')
        return this.searchService
          .searchCombinedSpecialWithContent(
            combined.flatMap((entry) =>
              entry.special ? [{ search: entry.special.search, days: entry.special.days }] : [],
            ),
            [
              ...combined.flatMap((entry) =>
                entry.custom?.mode === 'tags' ? [entry.custom.filterQuery] : [],
              ),
              ...(chipQuery ? [chipQuery] : []),
            ],
            inlineTagQuery,
            textQuery,
          )
          .then(async (results) => {
            if (this.lastQuery !== trimmed) return []
            const items = this.mapSearchResults(
              results,
              textQuery || inlineTagQuery || chipQuery,
              combined.some((entry) => entry.special?.search === 'todo'),
            )
            if (!items.length && textQuery.trim()) {
              const custom = combined.find((entry) => entry.custom?.mode === 'tags')?.custom
              if (custom) items.push(this.customSearchCreateSuggestion(custom, textQuery))
            }
            const dailySearch = combined.length === 1 ? combined[0].special?.search : null
            if (
              !items.length &&
              !remaining &&
              !chipQuery &&
              (dailySearch === 'today' ||
                dailySearch === 'yesterday' ||
                dailySearch === 'thisWeek' ||
                dailySearch === 'thisYear')
            ) {
              const suggestion =
                dailySearch === 'thisWeek' || dailySearch === 'thisYear'
                  ? await this.getPeriodNoteCreationSuggestion(dailySearch)
                  : await this.getDailyNoteCreationSuggestion(dailySearch)
              if (this.lastQuery !== trimmed) return []
              if (suggestion) items.push(suggestion)
            }
            this.createSuggestionActive = items.some((item) => item.type === 'create')
            this.updateInstructions(trimmed)
            return items
          })
          .catch((error: unknown) => {
            if (
              !combined.some(
                (entry) =>
                  entry.special?.search === 'thisWeek' || entry.special?.search === 'thisYear',
              )
            )
              throw error
            if (this.lastQuery !== trimmed) return []
            this.createSuggestionActive = false
            this.setInstructions([{ command: 'esc', purpose: t().paletteHelpDismiss }])
            return [
              {
                id: 'period-query-error',
                title: t().periodQueryFailed,
                description: error instanceof Error ? error.message : String(error),
                type: 'action' as const,
                icon: 'alert-triangle',
              },
            ]
          })
      }
      const custom = customSearch
      if (custom) {
        const textQuery = trimmed.slice(custom.identifier.length).trim()
        if (custom.mode === 'base') {
          const items = this.getCustomBaseItem(custom, textQuery)
          if (items.length === 0) this.disposeBaseRender()
          return items
        }
        return this.getCustomFilterSuggestions(custom, textQuery, trimmed)
      }
      const parsed = parseSpecialSearch(trimmed)
      if (!parsed.search) return this.getSpecialSearchChoices(trimmed)
      return this.getAsyncSuggestions(trimmed)
    }

    // Command mode: > prefix
    if (trimmed.startsWith('>')) {
      const cmdQuery = trimmed.substring(1).trim().toLowerCase()
      if (!cmdQuery) return groupPaletteItems(this.commands, this.settings.showPaletteGroups)
      return groupPaletteItems(
        this.commands.filter(
          (c) =>
            c.title.toLowerCase().includes(cmdQuery) ||
            c.description.toLowerCase().includes(cmdQuery),
        ),
        this.settings.showPaletteGroups,
      )
    }

    // Tag search mode: user has typed '#' in the current input
    if (getTagInputContext(query)) {
      return this.handleTagQuery(query)
    }

    if (hasDirectoryFilter(query)) {
      const fullQuery =
        query +
        ' ' +
        this.selectedTags.map((tag) => '#' + tag).join(' ') +
        ' ' +
        this.excludedTags.map((tag) => '!#' + tag).join(' ')
      return this.searchService
        .searchWithContent(fullQuery)
        .then((results) =>
          this.lastQuery === trimmed ? this.mapSearchResults(results, trimmed) : [],
        )
    }

    // Notes search mode when tags are selected
    if (this.selectedTags.length > 0 || this.excludedTags.length > 0) {
      if (!trimmed) {
        // Return all notes matching selected tags synchronously
        return this.getAsyncSelectedTagsSuggestions(this.selectedTags, this.excludedTags, '')
      }
      // Additional text filter with selected tags: async with content
      return this.getAsyncSelectedTagsSuggestions(this.selectedTags, this.excludedTags, trimmed)
    }

    // Commands can be shown by default or kept behind the `>` prefix.
    if (!trimmed) {
      const notes = this.settings.palettePinnedNotes.flatMap((path) => {
        const file = this.app.vault.getAbstractFileByPath(path)
        return file instanceof TFile
          ? [
              {
                id: `pinned-note-${path}`,
                title: file.basename,
                description: file.parent?.path ?? '',
                type: 'note' as const,
                file,
              },
            ]
          : []
      })
      return groupPaletteItems(
        [...notes, ...(this.settings.showCommandsByDefault ? this.commands : [])],
        this.settings.showPaletteGroups,
      )
    }

    // Plain text queries without tags: async (in-note content search)
    return this.getAsyncSuggestions(trimmed)
  }

  /**
   * Handles tag search queries when '#' is typed into the input.
   * Swaps the results listing for available vault tags.
   */
  private handleTagQuery(query: string): PaletteItem[] {
    const context = getTagInputContext(query)
    if (!context) return []
    const { prefix, excluded } = context

    // Get matching tags, excluding already-selected tags
    const matchingTags = getTagSuggestions(this.searchService, query, [
      ...this.selectedTags,
      ...this.excludedTags,
    ]).map((suggestion) => suggestion.tag)

    if (matchingTags.length > 0) {
      return matchingTags.map((tag) => ({
        id: `tag-${tag}`,
        title: tag,
        description: '',
        type: 'tag' as const,
        icon: 'hash',
        tagMode: excluded ? 'exclude' : 'include',
      }))
    }

    // If a prefix was typed but no matching tags exist in the vault, allow adding it as custom tag
    if (prefix.length > 0) {
      return [
        {
          id: `tag-${prefix}`,
          title: prefix,
          description: t().paletteFilterByTag(prefix),
          type: 'tag' as const,
          icon: 'hash',
          tagMode: excluded ? 'exclude' : 'include',
        },
      ]
    }

    return []
  }

  /**
   * Async content search for text queries matching selected tags.
   */
  private async getAsyncSelectedTagsSuggestions(
    tags: string[],
    excludedTags: string[],
    textQuery: string,
  ): Promise<PaletteItem[]> {
    const results = await this.searchService.searchBySelectedTagsWithContent(
      tags,
      excludedTags,
      textQuery,
    )

    if (this.lastQuery !== textQuery) {
      return []
    }

    return this.withCommandSuggestions(this.mapSearchResults(results, textQuery), textQuery)
  }

  /**
   * Async content search for plain text queries.
   * Uses vault.cachedRead for in-note searching.
   */
  private async getAsyncSuggestions(query: string): Promise<PaletteItem[]> {
    const results = await this.searchService.searchWithContent(query)

    // Guard against stale results
    if (this.lastQuery !== query) {
      return []
    }

    const items = this.mapSearchResults(results, query)
    if (query.startsWith('@') || query.includes('#')) return items

    if (items.length === 0 && query.trim()) {
      items.push({
        id: `create-note-${query}`,
        title: t().paletteCreateNoteTitle(query),
        description: '',
        type: 'create',
        icon: 'file-plus',
        action: (openBehavior) => this.createNote(query, openBehavior),
      })
    }

    this.createSuggestionActive = items.some((item) => item.type === 'create')
    this.updateInstructions(query)

    return this.withCommandSuggestions(items, query)
  }

  private withCommandSuggestions(items: PaletteItem[], query: string): PaletteItem[] {
    if (
      !this.settings.showCommandsByDefault ||
      query.trim() ||
      this.selectedTags.length ||
      this.excludedTags.length
    )
      return items
    const normalizedQuery = query.trim().toLowerCase()
    const commands = this.commands.filter(
      (command) =>
        !normalizedQuery ||
        command.title.toLowerCase().includes(normalizedQuery) ||
        command.description.toLowerCase().includes(normalizedQuery),
    )
    const existingIds = new Set(items.map((item) => item.id))
    return [...items, ...commands.filter((command) => !existingIds.has(command.id))]
  }

  private getCustomSearchForQuery(query: string): CustomSpecialSearch | null {
    return (
      this.settings.customSpecialSearches.find((search) => {
        if (search.hidden) return false
        const identifier = search.identifier.toLowerCase()
        const lowerQuery = query.toLowerCase()
        return lowerQuery === identifier || lowerQuery.startsWith(`${identifier} `)
      }) ?? null
    )
  }

  private getSpecialQueryTokens(query: string): Array<{
    token: string
    special?: { search: SpecialSearch; days?: number }
    custom?: CustomSpecialSearch
  }> {
    const matches: Array<{
      token: string
      special?: { search: SpecialSearch; days?: number }
      custom?: CustomSpecialSearch
    }> = []
    for (const token of query.split(/\s+/)) {
      if (!token.startsWith('@')) continue
      const custom = this.settings.customSpecialSearches.find(
        (search) => !search.hidden && search.identifier.toLowerCase() === token.toLowerCase(),
      )
      if (custom) {
        matches.push({ token, custom })
        continue
      }
      const parsed = parseSpecialSearch(token)
      if (parsed.search)
        matches.push({ token, special: { search: parsed.search, days: parsed.days } })
    }
    return matches
  }

  private getCustomBaseItem(search: CustomSpecialSearch, baseSearchText: string): PaletteItem[] {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(search.basePath))
    if (!(file instanceof TFile)) return []
    return [
      {
        id: `custom-base-${search.id}`,
        title: search.identifier,
        description: '',
        type: 'base',
        customSearchId: search.id,
        basePath: search.basePath,
        baseView: search.baseView,
        baseSearchText,
      },
    ]
  }

  private async getCustomFilterSuggestions(
    search: CustomSpecialSearch,
    textQuery: string,
    inputQuery: string,
  ): Promise<PaletteItem[]> {
    if (!search.filterQuery) return []
    const results = await this.searchService.searchFilteredWithContent(
      search.filterQuery,
      textQuery,
    )
    if (this.lastQuery !== inputQuery) return []
    const items = this.mapSearchResults(results, textQuery)
    if (items.length === 0 && textQuery.trim())
      items.push(this.customSearchCreateSuggestion(search, textQuery))
    this.createSuggestionActive = items.some((item) => item.type === 'create')
    this.updateInstructions(textQuery)
    return items
  }

  private customSearchCreateSuggestion(
    search: CustomSpecialSearch,
    textQuery: string,
  ): PaletteItem {
    const title = textQuery.trim()
    return {
      id: `create-custom-note-${search.id}-${title}`,
      title: t().paletteCreateNoteTitle(title || search.identifier),
      description: search.filterQuery,
      type: 'create',
      icon: 'file-plus',
      customSearchId: search.id,
      action: async (openBehavior) => {
        await this.createCustomSearchNote(search, title, openBehavior)
      },
    }
  }

  private async createCustomSearchNote(
    search: CustomSpecialSearch,
    title: string,
    openBehavior: false | 'tab' | 'split' = false,
  ): Promise<boolean> {
    const parsed = parseQuery(search.filterQuery)
    const directory = parsed.tokens.find((token) => token.type === 'directory')?.value ?? ''
    const tags = [
      ...new Set(parsed.tokens.filter((token) => token.type === 'tag').map((token) => token.value)),
    ]
    const folderPath = normalizePath(directory.replace(/^\/+/, '').replace(/\/$/, ''))
    try {
      const segments = folderPath.split('/').filter(Boolean)
      let current = ''
      for (const segment of segments) {
        current = current ? `${current}/${segment}` : segment
        if (!this.app.vault.getAbstractFileByPath(current)) {
          try {
            await this.app.vault.createFolder(current)
          } catch {
            if (!this.app.vault.getAbstractFileByPath(current))
              throw new Error(`Unable to create ${current}`)
          }
        }
      }
      let basename = title.trim()
      let path = normalizePath(`${folderPath ? `${folderPath}/` : ''}${basename}.md`)
      let suffix = 1
      while (this.app.vault.getAbstractFileByPath(path)) {
        basename = `${title.trim()} ${suffix++}`
        path = normalizePath(`${folderPath ? `${folderPath}/` : ''}${basename}.md`)
      }
      const file = await this.app.vault.create(path, '')
      if (tags.length) {
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
          const existing = Array.isArray(frontmatter.tags) ? frontmatter.tags : []
          frontmatter.tags = [...new Set([...existing, ...tags])]
        })
      }
      const leaf = this.app.workspace.getLeaf(
        openBehavior === 'split' ? 'split' : openBehavior === 'tab' ? 'tab' : false,
      )
      await leaf.openFile(file)
      new Notice(t().noticeQuickAddCreated(basename))
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      new Notice(t().noticeQuickAddFailed(message))
      return false
    }
  }

  /**
   * Maps SearchResults to PaletteItems, appending a "Create new note" action
   * when no results are found for a text query.
   */
  private mapSearchResults(
    results: ReturnType<SearchService['search']>,
    query: string,
    showTodoCompletion = false,
  ): PaletteItem[] {
    const items: PaletteItem[] = results.map((r) => {
      const dailyTitle = this.searchService.getDailyNoteDisplayTitle(r.file)
      const parentPath = r.file.parent?.path && r.file.parent.path !== '/' ? r.file.parent.path : ''
      return {
        id: r.file.path,
        title: dailyTitle ?? r.title,
        description: dailyTitle ? t().dailyNoteLabel : parentPath,
        icon: dailyTitle ? 'calendar-days' : undefined,
        type: 'note' as const,
        file: r.file,
        tags: r.tags,
        matchSnippet: r.matchSnippet,
        matchCount: r.matchCount,
        searchTerms: r.searchTerms,
        taskCompletionPercent:
          this.settings.showTodoCompletionPercent && showTodoCompletion
            ? this.getTaskCompletionPercent(r.file)
            : undefined,
      }
    })

    return items
  }

  private getTaskCompletionPercent(file: TFile): number | undefined {
    const tasks =
      this.app.metadataCache
        .getFileCache(file)
        ?.listItems?.filter((item) => item.task !== undefined) ?? []
    if (tasks.length === 0) return undefined
    return summarizeTasks(tasks.map((item) => item.task!)).percent
  }

  /**
   * Creates a new note in the fleeting folder and opens it.
   * If a template is configured, uses its content as the initial note body.
   */
  private async createNote(
    title: string,
    openBehavior: false | 'tab' | 'split' = false,
  ): Promise<void> {
    await this.createQuickAddNote(title, null, undefined, openBehavior)
  }

  private async createQuickAddNote(
    title: string,
    choice: QuickAddChoice | null,
    forcedConflictBehavior?: QuickAddConflictBehavior,
    openBehavior: false | 'tab' | 'split' = false,
  ): Promise<boolean> {
    const selectedFolder =
      choice?.location === 'specific' ? choice.folderPath : this.settings.fleetingFolder
    const folderPath = normalizePath(selectedFolder)

    // Ensure fleeting folder exists
    if (!this.app.vault.getAbstractFileByPath(folderPath)) {
      try {
        await this.app.vault.createFolder(folderPath)
      } catch {
        // Folder may already exist
      }
    }

    let finalTitle = title
    let filePath = normalizePath(`${folderPath}/${finalTitle}.md`)
    let existing = this.app.vault.getAbstractFileByPath(filePath)
    if (existing) {
      const behavior = forcedConflictBehavior || choice?.conflictBehavior || 'ask'
      if (behavior === 'ask') {
        return new Promise((resolve) => {
          new NoteConflictModal(this.app, (selectedBehavior) => {
            void this.createQuickAddNote(title, choice, selectedBehavior, openBehavior).then(
              resolve,
            )
          }).open()
        })
      }
      if (behavior === 'create-new') {
        let suffix = 1
        do {
          finalTitle = `${title} ${suffix++}`
          filePath = normalizePath(`${folderPath}/${finalTitle}.md`)
          existing = this.app.vault.getAbstractFileByPath(filePath)
        } while (existing)
      } else if (!(existing instanceof TFile)) {
        new Notice(`Cannot replace "${title}" because it is not a note.`)
        return false
      }
    }

    // Read template content if configured
    let initialContent = ''
    const templatePath = choice ? choice.templatePath : this.settings.fleetingNoteTemplate
    if (choice && !templatePath) new Notice(t().noticeQuickAddNoTemplate)
    if (templatePath) {
      initialContent = await this.readTemplate(templatePath)
    }

    try {
      const existingFile = existing instanceof TFile ? existing : null
      const file = existingFile
        ? await this.app.vault.modify(existingFile, initialContent).then(() => existingFile)
        : await this.app.vault.create(filePath, initialContent)
      if (!choice || choice.open) {
        const target = choice?.openBehavior ?? openBehavior
        const leaf =
          target === 'split'
            ? this.app.workspace.getLeaf('split', 'vertical')
            : this.app.workspace.getLeaf(target === 'tab' ? 'tab' : false)
        await leaf.openFile(file)
        if (choice && !choice.focus) this.app.workspace.setActiveLeaf(leaf, { focus: false })
      }
      new Notice(t().noticeQuickAddCreated(finalTitle))
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      new Notice(t().noticeQuickAddFailed(message))
      return false
    }
  }

  showQuickAdd(): void {
    this.mode = 'quick-add'
    this.inputEl.value = ''
    this.setPlaceholder(t().paletteSelectChoice)
    this.updateInstructions('')
    this.refreshSuggestions()
  }

  private returnToSearch(): void {
    if (this.mode === 'statistics') {
      this.globalStatisticsView?.destroy()
      this.globalStatisticsView = null
      this.statisticsHost?.remove()
      this.statisticsHost = null
      this.modalEl.removeClass('seam-palette-statistics', 'seam-palette-global-statistics')
      this.modalEl.querySelector('.seam-note-statistics-dismiss')?.remove()
      this.inputEl.disabled = false
    }
    if (this.mode === 'outline') {
      this.modalEl.removeClass('seam-palette-outline')
      this.inputEl.removeAttribute('aria-label')
      this.outlineItems = []
      if (this.outlinePreviousLimit !== null) this.limit = this.outlinePreviousLimit
      this.outlinePreviousLimit = null
      this.emptyStateText = 'No results found.'
    }
    this.mode = 'search'
    this.inputEl.value = ''
    this.setPlaceholder(t().palettePlaceholder)
    this.updateInstructions('')
    this.refreshSuggestions()
    this.inputEl.focus()
  }

  private updateInstructions(query: string): void {
    if (this.closeButtonScope) {
      this.setInstructions([
        { command: '↵', purpose: t().paletteHelpDismiss },
        { command: 'esc', purpose: t().paletteHelpDismiss },
      ])
      return
    }
    if (
      this.mode === 'search' &&
      this.baseNavigationEnabled &&
      this.baseNavigationMode &&
      this.baseResultNavigation?.isSupported
    ) {
      this.setInstructions([
        {
          command: this.baseNavigationMode.active ? '↑↓←→' : '↑↓',
          purpose: t().paletteHelpNavigate,
        },
        { command: '↵', purpose: t().paletteHelpOpen },
        { command: Platform.isMacOS ? '⌘↵' : 'Ctrl+↵', purpose: t().paletteHelpOpenNewTab },
        { command: '⇧↵', purpose: t().paletteHelpOpenSplit },
        {
          command: 'esc',
          purpose: this.baseNavigationMode.active
            ? t().paletteHelpReturnToSearch
            : t().paletteHelpDismiss,
        },
      ])
      return
    }
    if (this.calendarHost) {
      const instructions = [{ command: '↑↓←→', purpose: t().paletteHelpNavigate }]
      if (this.calendarView) {
        instructions.push({ command: '↵', purpose: this.calendarView.footerAction })
        const action = this.calendarView.openingAction
        if (action) {
          instructions.push(
            {
              command: Platform.isMacOS ? '⌘↵' : 'Ctrl+↵',
              purpose:
                action === 'create' ? t().paletteHelpCreateNewTab : t().paletteHelpOpenNewTab,
            },
            {
              command: '⇧↵',
              purpose: action === 'create' ? t().paletteHelpCreateSplit : t().paletteHelpOpenSplit,
            },
          )
        }
      }
      instructions.push({
        command: 'esc',
        purpose: this.calendarView?.navigationActive
          ? t().paletteHelpReturnToSearch
          : t().paletteHelpDismiss,
      })
      this.setInstructions(instructions)
      return
    }
    if (this.mode === 'outline') {
      const instructions = [
        { command: '↑↓', purpose: t().paletteHelpNavigate },
        { command: '↵', purpose: t().paletteHelpSelect },
      ]
      if (!query) instructions.push({ command: '⌫', purpose: t().paletteHelpBack })
      instructions.push({ command: 'esc', purpose: t().paletteHelpDismiss })
      this.setInstructions(instructions)
      return
    }
    if (this.mode === 'statistics') {
      this.setInstructions([
        { command: '⌫', purpose: t().paletteHelpBack },
        { command: 'esc', purpose: t().paletteHelpDismiss },
      ])
      return
    }
    if (this.mode === 'search' && this.createSuggestionActive) {
      this.setInstructions([
        { command: '↵', purpose: t().paletteHelpCreate },
        { command: Platform.isMacOS ? '⌘↵' : 'Ctrl+↵', purpose: t().paletteHelpCreateNewTab },
        { command: '⇧↵', purpose: t().paletteHelpCreateSplit },
        { command: 'esc', purpose: t().paletteHelpDismiss },
      ])
      return
    }
    if (
      this.mode === 'search' &&
      !query.trim() &&
      !this.selectedTags.length &&
      !this.excludedTags.length &&
      !this.composedQueryPrefix
    ) {
      this.setInstructions([
        { command: '#', purpose: t().paletteHelpTag },
        { command: '@', purpose: t().paletteHelpSpecialSearch },
        { command: '/', purpose: t().paletteHelpDirectory },
        { command: '>', purpose: t().paletteHelpCommands },
        { command: 'esc', purpose: t().paletteHelpDismiss },
      ])
      return
    }

    if (
      this.mode === 'search' &&
      (query.startsWith('@') ||
        getTagInputContext(query) ||
        this.selectedTags.length > 0 ||
        this.excludedTags.length > 0)
    ) {
      const openNewTab = Platform.isMacOS ? '⌘↵' : 'Ctrl+↵'
      this.setInstructions([
        { command: '↑↓', purpose: t().paletteHelpNavigate },
        { command: openNewTab, purpose: t().paletteHelpOpenNewTab },
        { command: '⇧↵', purpose: t().paletteHelpOpenSplit },
        { command: 'esc', purpose: t().paletteHelpDismiss },
      ])
      return
    }

    if (this.mode === 'search' && query.startsWith('>')) {
      this.setInstructions([
        { command: '↑↓', purpose: t().paletteHelpNavigate },
        { command: '↵', purpose: t().paletteHelpSelect },
        { command: 'esc', purpose: t().paletteHelpDismiss },
      ])
      return
    }

    if (this.mode === 'search' && query.trim()) {
      const openNewTab = Platform.isMacOS ? '⌘↵' : 'Ctrl+↵'
      this.setInstructions([
        { command: '↑↓', purpose: t().paletteHelpNavigate },
        { command: '↵', purpose: t().paletteHelpOpen },
        { command: openNewTab, purpose: t().paletteHelpOpenNewTab },
        { command: '⇧↵', purpose: t().paletteHelpOpenSplit },
        { command: 'esc', purpose: t().paletteHelpDismiss },
      ])
      return
    }

    const instructions = [
      { command: '↑↓', purpose: t().paletteHelpNavigate },
      { command: '↵', purpose: t().paletteHelpOpen },
    ]
    if (this.mode !== 'search' && !query) {
      instructions.push({ command: '⌫', purpose: t().paletteHelpBack })
    }
    instructions.push({ command: 'esc', purpose: t().paletteHelpDismiss })
    this.setInstructions(instructions)
  }

  onNoSuggestion(): void {
    if (this.mode === 'statistics' || this.calendarHost) return
    if (this.mode === 'search' && !this.inputEl.value.trim()) {
      this.resultContainerEl.empty()
      return
    }
    super.onNoSuggestion()
  }

  private getQuickAddChoices(query: string): PaletteItem[] {
    const choices = this.settings.quickAddChoices
    if (choices.length === 0)
      return [
        {
          id: 'quick-add-fleeting',
          title: t().paletteAddFleeting,
          description: this.settings.fleetingFolder,
          type: 'action',
          icon: 'file-plus',
        },
      ]
    return choices
      .filter((choice) => choice.name.toLowerCase().includes(query.toLowerCase()))
      .map((choice) => ({
        id: `quick-add-choice-${choice.id}`,
        title: choice.name,
        description: '',
        type: 'action' as const,
        icon: choice.icon || 'file-plus',
      }))
  }

  private getSpecialSearchChoices(query: string): PaletteItem[] {
    const options: SpecialSearchOption[] = [
      { search: 'today', label: SPECIAL_SEARCH_LABELS.today, description: t().paletteSpecialToday },
      {
        search: 'yesterday',
        label: SPECIAL_SEARCH_LABELS.yesterday,
        description: t().paletteSpecialYesterday,
      },
      {
        search: 'calendar',
        label: SPECIAL_SEARCH_LABELS.calendar,
        description: t().paletteSpecialCalendar,
      },
      {
        search: 'thisWeek',
        label: SPECIAL_SEARCH_LABELS.thisWeek,
        description: t().paletteSpecialThisWeek,
      },
      {
        search: 'thisYear',
        label: SPECIAL_SEARCH_LABELS.thisYear,
        description: t().paletteSpecialThisYear,
      },
      {
        search: 'recent',
        label: SPECIAL_SEARCH_LABELS.recent,
        description: t().paletteSpecialRecent,
      },
      {
        search: 'recentlyOpened',
        label: SPECIAL_SEARCH_LABELS.recentlyOpened,
        description: t().paletteSpecialRecentlyOpened,
      },
      {
        search: 'fleeting',
        label: SPECIAL_SEARCH_LABELS.fleeting,
        description: t().paletteSpecialFleeting,
      },
      {
        search: 'permanent',
        label: SPECIAL_SEARCH_LABELS.permanent,
        description: t().paletteSpecialPermanent,
      },
      {
        search: 'lastDays',
        label: SPECIAL_SEARCH_LABELS.lastDays,
        description: t().paletteSpecialLastDays,
      },
      {
        search: 'untagged',
        label: SPECIAL_SEARCH_LABELS.untagged,
        description: t().paletteSpecialUntagged,
      },
      { search: 'docs', label: SPECIAL_SEARCH_LABELS.docs, description: t().paletteSpecialDocs },
      {
        search: 'images',
        label: SPECIAL_SEARCH_LABELS.images,
        description: t().paletteSpecialImages,
      },
      { search: 'task', label: SPECIAL_SEARCH_LABELS.task, description: t().paletteSpecialTask },
      { search: 'todo', label: SPECIAL_SEARCH_LABELS.todo, description: t().paletteSpecialTodo },
      { search: 'done', label: SPECIAL_SEARCH_LABELS.done, description: t().paletteSpecialDone },
      { search: 'code', label: SPECIAL_SEARCH_LABELS.code, description: t().paletteSpecialCode },
      {
        search: 'sources',
        label: SPECIAL_SEARCH_LABELS.sources,
        description: t().paletteSpecialSources,
      },
    ]
    const needle = query.toLowerCase()
    const builtIns = options
      .filter(
        (option) =>
          option.label.toLowerCase().startsWith(needle) &&
          !this.settings.specialSearchPreferences.find(
            (preference) => preference.search === option.search,
          )?.hidden,
      )
      .map((option) => ({
        id: `special-search-${option.search}`,
        title: option.label,
        description: option.description,
        type: 'special' as const,
        specialSearch: option.search,
        specialSearchInput: option.search === 'lastDays' ? '@last1Days' : option.label,
        icon: SPECIAL_SEARCH_ICONS[option.search],
      }))
    const custom = this.settings.customSpecialSearches
      .filter((search) => !search.hidden && search.identifier.toLowerCase().startsWith(needle))
      .map((search) => ({
        id: `custom-search-${search.id}`,
        title: search.identifier,
        description:
          search.description?.trim() ||
          (search.mode === 'base' ? search.basePath : search.filterQuery || 'Custom filter'),
        type: 'special' as const,
        customSearchId: search.id,
        icon: search.icon || 'search',
      }))
    return groupPaletteItems(
      orderSpecialSearches([...builtIns, ...custom], this.settings),
      this.settings.showPaletteGroups,
      true,
    )
  }

  /** Delete a complete query token atomically, leaving other filters and text intact. */
  private removeSpecialQueryBeforeCaret(event: KeyboardEvent): boolean {
    if (
      this.mode !== 'search' ||
      event.key !== 'Backspace' ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      this.inputEl.selectionStart !== this.inputEl.selectionEnd
    )
      return false
    const inPrefix =
      !this.inputEl.value &&
      Boolean(this.composedQueryPrefix) &&
      !this.selectedTags.length &&
      !this.excludedTags.length
    const source = inPrefix ? this.composedQueryPrefix : this.inputEl.value
    const caret = inPrefix ? source.length : this.inputEl.selectionStart
    if (
      caret === null ||
      (caret < source.length && !/\s/.test(source[caret]) && !/\s/.test(source[caret - 1] ?? ''))
    )
      return false
    const match = /(?:^|\s)(@[^\s]+)\s*$/.exec(source.slice(0, caret))
    if (!match || this.getActiveSpecialQueryToken(match[1]) !== match[1]) return false
    const start = match.index + match[0].indexOf('@')
    const before = source.slice(0, start)
    const remaining = (before.trim() ? before : '') + source.slice(caret)
    event.preventDefault()
    event.stopImmediatePropagation()
    if (inPrefix) this.composedQueryPrefix = remaining
    else {
      this.inputEl.value = remaining
      this.inputEl.setSelectionRange(before.trim() ? start : 0, before.trim() ? start : 0)
    }
    this.refreshSuggestions()
    return true
  }

  private getActiveSpecialQueryToken(query: string): string | null {
    const custom = this.getCustomSearchForQuery(query.trim())
    if (custom) return query.trimStart().slice(0, custom.identifier.length)
    const match = query
      .trimStart()
      .match(
        /^@(last[1-9]\d*days|calendar|thisWeek|thisYear|today|yesterday|recentlyOpened|fleeting|permanent|recent|untagged|docs|images|task|todo|done|code|sources)(?=\s|$)/i,
      )
    return match?.[0] ?? null
  }

  private renderActiveSpecialQueryInput(query: string): void {
    const prompt = this.inputEl.closest<HTMLElement>('.prompt')
    this.composedQueryPrefixEl?.setText(this.composedQueryPrefix.trim())
    this.composedQueryPrefixEl?.toggleClass('is-hidden', !this.composedQueryPrefix)
    if (this.composedQueryPrefix) {
      prompt?.removeClass(
        'seam-palette-special-search-active',
        'seam-palette-directory-search-active',
      )
      this.queryInputMirrorEl?.empty()
      this.inputEl.parentElement?.removeClass('seam-palette-input-before-chips')
      return
    }
    const token = this.getActiveSpecialQueryToken(query)
    const directory = token ? null : /(?:^|\s)((?:\/|dir:)(?:"[^"]*"|[^\s]+))(?=\s|$)/i.exec(query)
    prompt?.toggleClass('seam-palette-special-search-active', Boolean(token))
    prompt?.toggleClass('seam-palette-directory-search-active', Boolean(directory))
    if (!this.queryInputMirrorEl) return
    this.queryInputMirrorEl.empty()
    if (!token && !directory) return

    const start = token
      ? query.length - query.trimStart().length
      : directory!.index + directory![0].indexOf(directory![1])
    const activeToken = token ?? directory![1]
    this.queryInputMirrorEl.appendText(query.slice(0, start))
    this.queryInputMirrorEl.createSpan({ cls: 'seam-palette-query-input-token', text: activeToken })
    this.queryInputMirrorEl.appendText(query.slice(start + activeToken.length))
    const specialOnly =
      token && this.getSpecialQueryTokens(query).length === query.trim().split(/\s+/).length
    const isBaseSearch = Boolean(token && this.getCustomSearchForQuery(query)?.mode === 'base')
    if (
      (directory && /^\s*$/.test(query.slice(start + activeToken.length))) ||
      (specialOnly && !isBaseSearch && /\s$/.test(query))
    ) {
      this.queryInputMirrorEl.createSpan({
        cls: 'seam-palette-query-placeholder',
        text: directory ? t().paletteTagPlaceholder : t().paletteSeamSearchPlaceholder,
      })
    }
    window.requestAnimationFrame(() => this.syncQueryInputMirrorScroll())
  }

  private syncQueryInputMirrorScroll(): void {
    if (this.queryInputMirrorEl) this.queryInputMirrorEl.scrollLeft = this.inputEl.scrollLeft
  }

  private promptQuickAdd(choice: QuickAddChoice | null): void {
    const initial = this.settings.persistQuickAddDrafts ? this.quickAddDraft : ''
    new NoteTitleModal(
      this.app,
      initial,
      choice?.name ?? 'New note',
      async (title) => {
        this.quickAddDraft = this.settings.persistQuickAddDrafts ? title : ''
        const created = await this.createQuickAddNote(title, choice)
        if (created) this.close()
      },
      (draft) => {
        this.quickAddDraft = this.settings.persistQuickAddDrafts ? draft : ''
      },
    ).open()
  }

  /**
   * Reads the content of a template file from the vault.
   * Returns empty string if the template doesn't exist or can't be read.
   */
  private async readTemplate(templatePath: string): Promise<string> {
    const normalized = normalizePath(templatePath.replace(/\.md$/, '') + '.md')
    const file = this.app.vault.getAbstractFileByPath(normalized)
    if (!file || !(file instanceof TFile)) {
      return ''
    }
    try {
      return await this.app.vault.cachedRead(file)
    } catch {
      return ''
    }
  }

  renderSuggestion(item: PaletteItem, el: HTMLElement): void {
    if (item.groupLabel) {
      const label = createDiv({
        cls: 'seam-palette-group-label',
        text: item.groupLabel,
        attr: { role: 'presentation', 'aria-hidden': 'true' },
      })
      // SuggestModal can render before attaching the row. Insert after native rendering finishes.
      queueMicrotask(() => {
        if (el.parentElement) el.before(label)
      })
    }
    if (item.type === 'heading') {
      el.addClass('seam-palette-heading')
      el.setAttribute('data-heading-level', String(item.headingLevel))
      el.createSpan({ cls: 'seam-palette-heading-level', text: `H${item.headingLevel}` })
      el.createSpan({ cls: 'seam-palette-title', text: item.title })
      return
    }
    // Derive the plain search query for highlighting
    const highlightQuery = this.getHighlightQuery()

    if (item.type === 'base') {
      this.renderBaseEmbed(item, el)
    } else if (
      item.type === 'command' ||
      item.type === 'action' ||
      item.type === 'create' ||
      item.type === 'special'
    ) {
      el.addClass('seam-palette-command-item')
      if (item.type === 'special') el.addClass('seam-palette-special-search')
      if (item.customSearchId) el.addClass('seam-palette-custom-search')
      const rowEl = el.createDiv({ cls: 'seam-palette-title-row' })

      if (this.settings.showIcons) {
        const iconEl = rowEl.createSpan({ cls: 'seam-palette-command-icon' })
        setIcon(iconEl, item.icon || 'terminal')
      }

      const titleEl = rowEl.createSpan({ cls: 'seam-palette-title' })
      titleEl.setText(item.title)

      const isSpecialSearch = Boolean(item.specialSearch || item.customSearchId)
      if (isSpecialSearch && this.isSpecialSearchPinned(item)) {
        const pinEl = rowEl.createSpan({
          cls: 'seam-palette-pinned-icon',
          attr: { 'aria-label': 'Pinned search' },
        })
        setIcon(pinEl, 'pin')
      }
      if (item.description && this.settings.showPaletteDescriptions) {
        const descEl = el.createDiv({ cls: 'seam-palette-description' })
        descEl.setText(item.description)
      }
    } else if (item.type === 'tag' || item.type === 'directory') {
      el.addClass('seam-palette-tag-item')
      const rowEl = el.createDiv({ cls: 'seam-palette-title-row' })

      if (this.settings.showIcons) {
        const iconEl = rowEl.createSpan({ cls: 'seam-palette-command-icon' })
        setIcon(iconEl, item.icon || 'hash')
      }

      const titleEl = rowEl.createSpan({ cls: 'seam-palette-title' })
      renderHighlightedText(titleEl, item.title, highlightQuery)
    } else {
      el.addClass('seam-palette-note-item')

      // Title with highlighting
      const titleRow = el.createDiv({ cls: 'seam-palette-note-title-row' })
      const titleEl = titleRow.createDiv({ cls: 'seam-palette-title' })
      renderHighlightedText(titleEl, item.title, highlightQuery)
      const matchCount =
        this.settings.showFileExtensionAndMatchCount && item.matchCount !== undefined
          ? ` • ${item.matchCount} ${item.matchCount === 1 ? 'match' : 'matches'}`
          : ''
      if (this.settings.showFileExtensionAndMatchCount) {
        titleRow.createSpan({
          cls: 'seam-palette-result-metadata',
          text: `.${item.file?.extension ?? 'md'}${item.taskCompletionPercent === undefined ? matchCount : ''}`,
        })
      }
      if (item.taskCompletionPercent !== undefined) {
        const completion = titleRow.createDiv({ cls: 'seam-palette-task-completion' })
        completion.createSpan({
          cls: 'seam-palette-task-completion-label',
          text: t().paletteTodoCompletionLabel,
        })
        completion.createSpan({ cls: 'seam-palette-task-completion-separator', text: '•' })
        completion.createSpan({
          cls: 'seam-palette-task-completion-value',
          text: `${item.taskCompletionPercent}%`,
        })
        if (matchCount)
          titleRow.createSpan({ cls: 'seam-palette-result-metadata', text: matchCount.trim() })
      }

      if (item.description) {
        const folderEl = el.createDiv({ cls: 'seam-palette-folder' })
        if (this.settings.showIcons) {
          const iconEl = folderEl.createSpan({ cls: 'seam-palette-folder-icon' })
          setIcon(iconEl, item.icon || 'folder')
        }
        const nameEl = folderEl.createSpan({ cls: 'seam-palette-folder-name' })
        nameEl.setText(item.description)
      }

      // Render content match snippet with highlighting
      if (item.matchSnippet) {
        const snippetEl = el.createDiv({ cls: 'seam-palette-snippet' })
        const { text, matchStart, matchEnd } = item.matchSnippet

        // Text before match
        if (matchStart > 0) {
          snippetEl.createSpan({ text: text.slice(0, matchStart) })
        }

        // Highlighted match
        snippetEl.createSpan({
          cls: 'seam-palette-highlight',
          text: text.slice(matchStart, matchEnd),
        })

        // Text after match
        if (matchEnd < text.length) {
          snippetEl.createSpan({ text: text.slice(matchEnd) })
        }
      }

      // Tags with highlighting for all active selected tags and search query
      if (item.tags && item.tags.length > 0) {
        const tagsEl = el.createDiv({ cls: 'seam-palette-tags' })
        const lowerHighlight = highlightQuery.toLowerCase()
        const selectedTagSet = new Set(
          [...this.selectedTags, ...this.excludedTags].map((t) => t.toLowerCase()),
        )

        item.tags.forEach((tag, idx) => {
          if (idx > 0) tagsEl.appendText(' ')

          const lowerTag = tag.toLowerCase()
          const isSelected =
            selectedTagSet.has(lowerTag) ||
            Array.from(selectedTagSet).some((st) => lowerTag.startsWith(st + '/'))
          const matchesQuery =
            lowerHighlight.length > 0 &&
            (lowerTag.includes(lowerHighlight) || lowerTag.startsWith(lowerHighlight))

          if (isSelected || matchesQuery) {
            const span = tagsEl.createSpan({ cls: 'seam-palette-highlight' })
            span.setText(`#${tag}`)
          } else {
            tagsEl.appendText(`#${tag}`)
          }
        })
      }
    }
  }

  private isSpecialSearchPinned(item: PaletteItem): boolean {
    if (item.specialSearch) {
      return Boolean(
        this.settings.specialSearchPreferences.find(
          (preference) => preference.search === item.specialSearch,
        )?.pinned,
      )
    }
    return Boolean(
      item.customSearchId &&
      this.settings.customSpecialSearches.find((search) => search.id === item.customSearchId)
        ?.pinned,
    )
  }

  private renderBaseEmbed(item: PaletteItem, el: HTMLElement): void {
    el.addClass('seam-palette-base-item')
    el.addClass('seam-palette-base-hide-toolbar')
    if (item.customSearchId) el.addClass('seam-palette-custom-search-item')
    if (!item.basePath) return
    const target = `${item.basePath}${item.baseView ? `#${item.baseView}` : ''}`
    const renderKey = `${item.basePath}#${item.baseView}`
    if (this.baseRenderKey !== renderKey || !this.baseRenderHost || !this.baseRenderComponent) {
      this.disposeBaseRender()
      this.baseRenderKey = renderKey
      this.baseSourcePath = item.basePath
      this.baseRenderHost = createDiv({ cls: 'seam-palette-base-embed' })
      this.baseRenderHost.addEventListener(
        'click',
        (event) => this.handleBaseEmbedClick(event, item.basePath || ''),
        true,
      )
      this.baseRenderComponent = new Component()
      this.baseRenderComponent.load()
      const host = this.baseRenderHost
      const component = this.baseRenderComponent
      this.baseRenderObserver = new MutationObserver(() => this.refreshBaseNavigation())
      this.baseRenderObserver.observe(host, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style'],
      })
      void MarkdownRenderer.render(this.app, `![[${target}]]`, host, item.basePath, component).then(
        () => {
          if (this.baseRenderHost !== host) return
          this.limitBaseToolbar(host, component)
          this.refreshBaseNavigation()
        },
      )
    }
    el.appendChild(this.baseRenderHost)
    this.inputEl.closest<HTMLElement>('.prompt')?.addClass('seam-palette-has-base-embed')

    el.addClass('seam-palette-base-navigation')
    if (!this.baseResultNavigation) {
      this.baseResultNavigation = new BaseResultNavigation(
        this.baseRenderHost,
        t().paletteBaseNoMatches,
      )
      this.baseNavigationMode = new BaseNavigationMode(
        this.app,
        this.baseRenderHost,
        this.inputEl,
        this.baseResultNavigation,
        this.scope,
        t().paletteBaseResultsLabel,
        (event) => this.openSelectedBaseResult(event),
        () => this.updateInstructions(this.lastQuery),
      )
    }
    this.baseResultNavigation.refresh(item.baseSearchText ?? '')
    this.baseNavigationMode?.refresh()
    this.updateInstructions(this.lastQuery)
  }

  private refreshBaseNavigation(): void {
    if (!this.baseNavigationEnabled || !this.baseResultNavigation) return
    this.baseResultNavigation.refresh()
    this.baseNavigationMode?.refresh()
    this.updateInstructions(this.lastQuery)
  }

  private openSelectedBaseResult(event: KeyboardEvent): boolean {
    const fileRef = this.baseResultNavigation?.activeFileRef
    const file = fileRef
      ? this.app.metadataCache.getFirstLinkpathDest(fileRef, this.baseSourcePath)
      : null
    if (!file) return this.baseResultNavigation?.activateSelection() ?? false
    event.preventDefault()
    event.stopImmediatePropagation()
    this.close()
    const leaf = event.shiftKey
      ? this.app.workspace.getLeaf('split', 'vertical')
      : this.app.workspace.getLeaf(event.metaKey || event.ctrlKey ? 'tab' : false)
    void leaf.openFile(file)
    return true
  }

  private disposeBaseRender(): void {
    this.baseRenderObserver?.disconnect()
    this.baseRenderObserver = null
    const navigationMode = this.baseNavigationMode
    this.baseNavigationMode = null
    navigationMode?.destroy()
    this.baseResultNavigation?.destroy()
    this.baseResultNavigation = null
    this.baseRenderComponent?.unload()
    this.baseRenderComponent = null
    this.baseRenderHost?.remove()
    this.baseRenderHost = null
    this.inputEl.closest<HTMLElement>('.prompt')?.removeClass('seam-palette-has-base-embed')
    this.baseRenderKey = ''
    this.baseSourcePath = ''
    this.inputEl.removeAttribute('aria-activedescendant')
  }

  private limitBaseToolbar(embed: HTMLElement, component: Component): void {
    const apply = (): void => {
      const toolbar = embed.querySelector<HTMLElement>('.bases-toolbar, .bases-view-toolbar')
      if (!toolbar) return
      const controls = Array.from(toolbar.children).filter((child): child is HTMLElement =>
        child.instanceOf(HTMLElement),
      )
      for (const control of controls) {
        const label = [
          control.getAttribute('aria-label'),
          control.getAttribute('title'),
          control.getAttribute('data-tooltip'),
          control.textContent,
        ]
          .filter(Boolean)
          .join(' ')
          .trim()
          .toLowerCase()
        control.toggleClass('seam-palette-base-toolbar-control-hidden', !label.includes('search'))
      }
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(embed, { childList: true, subtree: true })
    component.register(() => observer.disconnect())
  }

  private openFileFromPaletteLink(event: MouseEvent, sourcePath: string): void {
    const eventTarget = event.target as Node | null
    const target = eventTarget?.instanceOf?.(Element)
      ? eventTarget.closest('a.internal-link, a[data-href], [data-href]')
      : null
    if (!target?.instanceOf(HTMLElement)) return
    const href = target.getAttribute('data-href') || target.getAttribute('href')
    if (!href) return
    let linkPath = href.replace(/^\.?\//, '')
    try {
      linkPath = decodeURIComponent(linkPath)
    } catch {
      // Keep the original link path if it contains malformed escaping.
    }
    const file = this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath)
    if (!file) return
    event.preventDefault()
    event.stopPropagation()
    this.close()
    void this.app.workspace.getLeaf(event.metaKey || event.ctrlKey ? 'tab' : false).openFile(file)
  }

  private handleBaseEmbedClick(event: MouseEvent, sourcePath: string): void {
    this.openFileFromPaletteLink(event, sourcePath)
    if (event.defaultPrevented || !this.baseNavigationEnabled) return
    const target = event.target instanceof Element ? event.target : null
    const card = target?.closest<HTMLElement>('.bases-cards-item[draggable="true"]')
    const title = card
      ?.querySelector<HTMLElement>('.bases-cards-property.mod-title .bases-cards-line')
      ?.textContent?.trim()
    if (!title) return
    const file = this.app.metadataCache.getFirstLinkpathDest(title, sourcePath)
    if (!file) return
    event.preventDefault()
    event.stopPropagation()
    this.close()
    void this.app.workspace.getLeaf(event.metaKey || event.ctrlKey ? 'tab' : false).openFile(file)
  }

  /**
   * Extracts the plain text query to use for highlighting in results.
   * For tag queries (#tag), extracts the tag name without the # prefix.
   * For text queries, returns the query as-is.
   */
  private getHighlightQuery(): string {
    const query = this.lastQuery
    if (!query) return ''

    // Command mode: no highlighting
    if (query.startsWith('>')) return ''

    if (query.startsWith('@')) {
      const custom = this.getCustomSearchForQuery(query)
      if (custom) return normalizeTextQuery(query.slice(custom.identifier.length).trim())
      return parseSpecialSearch(query).textQuery
    }

    // Tag query: extract tag value for highlighting
    if (getTagInputContext(query)) {
      const lastToken = query.split(/\s+/).pop() || ''
      return lastToken.replace(/^!?#/, '')
    }

    if (hasDirectoryFilter(query)) {
      const tokens = parseQuery(query).tokens
      return (
        tokens
          .filter((token) => token.type === 'text')
          .map((token) => token.value)
          .join(' ') ||
        tokens.find((token) => token.type === 'tag')?.value ||
        ''
      )
    }
    return normalizeTextQuery(query)
  }

  onChooseSuggestion(item: PaletteItem, _evt: MouseEvent | KeyboardEvent): void {
    if (this.mode === 'statistics' || this.calendarHost) return
    if (this.mode === 'outline') {
      if (item.type === 'heading') {
        void Promise.resolve()
          .then(() => item.action?.())
          .catch(() => new Notice(t().outlineJumpFailed))
      }
      return
    }
    if (item.type === 'note' && item.file) {
      // Default Enter: open in current tab
      // Mod+Enter (new tab) is handled by the scope handler registered in the constructor
      void openSearchResult(this.app, item)
    } else if (
      (item.type === 'command' || item.type === 'action' || item.type === 'create') &&
      item.action
    ) {
      void item.action()
    }
  }
}
