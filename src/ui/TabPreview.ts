import {
  App,
  Component,
  FileView,
  MarkdownView,
  MarkdownRenderer,
  Modal,
  Scope,
  TFile,
  WorkspaceLeaf,
  setIcon,
} from 'obsidian'
import { t } from '../i18n'

/** Captures Ctrl+Tab before Obsidian's immediate tab-navigation handler. */
export class TabPreview extends Component {
  private modal: TabPreviewModal | null = null

  constructor(private app: App) {
    super()
  }

  onload(): void {
    const doc = this.app.workspace.containerEl.ownerDocument
    const win = doc.defaultView
    if (!win) return
    const scope = new Scope(this.app.scope)
    for (const backwards of [false, true]) {
      scope.register(backwards ? ['Ctrl', 'Shift'] : ['Ctrl'], 'Tab', (event) => {
        if (event.isComposing || doc.querySelector('.modal-container')) return true
        const leaves: WorkspaceLeaf[] = []
        this.app.workspace.iterateRootLeaves((leaf) => {
          leaves.push(leaf)
        })
        if (leaves.length < 2) return true
        this.modal = new TabPreviewModal(this.app, leaves, () => {
          this.modal = null
        })
        this.modal.open()
        this.modal.cycle(backwards ? -1 : 1)
        return false
      })
    }
    this.app.keymap.pushScope(scope)
    this.register(() => this.app.keymap.popScope(scope))
    this.registerDomEvent(
      win,
      'keyup',
      (event) => {
        if (event.key === 'Control') this.modal?.select()
      },
      true,
    )
    this.registerDomEvent(win, 'blur', () => this.modal?.close())
    this.registerDomEvent(doc, 'visibilitychange', () => {
      if (doc.hidden) this.modal?.close()
    })
    this.registerEvent(this.app.workspace.on('layout-change', () => this.modal?.close()))
  }

  onunload(): void {
    this.modal?.close()
  }
}

class TabPreviewModal extends Modal {
  private index: number
  private buttons: HTMLButtonElement[] = []
  private previews = new Component()

  constructor(
    app: App,
    private leaves: WorkspaceLeaf[],
    private dismissed: () => void,
  ) {
    super(app)
    this.index = Math.max(
      0,
      leaves.findIndex((leaf) => leaf === app.workspace.activeLeaf),
    )
  }

  onOpen(): void {
    this.previews.load()
    this.modalEl.addClass('seam-tab-preview')
    for (const backwards of [false, true])
      this.scope.register(backwards ? ['Ctrl', 'Shift'] : ['Ctrl'], 'Tab', () => {
        this.cycle(backwards ? -1 : 1)
        return false
      })
    this.scope.register(null, 'Escape', () => {
      this.close()
      return false
    })
    this.setTitle(t().tabPreviewTitle)
    const row = this.contentEl.createDiv({ cls: 'seam-tab-preview-row' })
    this.buttons = this.leaves.map((leaf, index) => {
      const title = leaf.view.getDisplayText()
      const button = row.createEl('button', {
        cls: 'seam-tab-preview-item',
        attr: { type: 'button', 'aria-label': title, title, 'aria-pressed': 'false' },
      })
      const preview = button.createDiv({
        cls: 'seam-tab-preview-image',
        attr: { 'aria-hidden': 'true' },
      })
      const view = leaf.view
      // A detached, inert snapshot preserves unsaved editor content without activating tabs.
      const snapshot = preview.createDiv({ cls: 'seam-tab-preview-snapshot' })
      snapshot.inert = true
      const filePath: unknown = leaf.getViewState().state?.file
      const candidate =
        view instanceof FileView
          ? view.file
          : typeof filePath === 'string'
            ? this.app.vault.getAbstractFileByPath(filePath)
            : null
      if (candidate instanceof TFile && candidate.extension === 'md') {
        snapshot.addClass('markdown-rendered')
        const file = candidate
        const text =
          view instanceof MarkdownView && view.getMode() !== 'preview'
            ? Promise.resolve(view.editor.getValue())
            : this.app.vault.cachedRead(file)
        void text
          .then(async (source) => {
            if (!snapshot.isConnected) return
            await MarkdownRenderer.render(this.app, source, snapshot, file.path, this.previews)
          })
          .catch(() => {
            if (snapshot.isConnected) snapshot.setText(title)
          })
      } else if (
        view.containerEl.textContent?.trim() ||
        view.containerEl.querySelector('img, svg, canvas')
      ) {
        const source = view.containerEl.querySelector('.view-content') ?? view.containerEl
        const clone = source.cloneNode(true) as HTMLElement
        clone
          .querySelectorAll('script, iframe, video, audio, style')
          .forEach((node) => node.remove())
        for (const node of [clone, ...Array.from(clone.querySelectorAll('[id]'))])
          node.removeAttribute('id')
        snapshot.appendChild(clone)
      } else if (view instanceof MarkdownView) {
        snapshot.createEl('pre', { text: view.editor.getValue() })
      } else {
        setIcon(snapshot.createDiv(), view.getIcon())
        snapshot.createDiv({ text: title })
      }
      button.createSpan({ cls: 'seam-tab-preview-label', text: title })
      button.addEventListener('click', () => {
        this.index = index
        this.select()
      })
      return button
    })
    const footer = this.contentEl.createDiv({ cls: 'prompt-instructions seam-tab-preview-hint' })
    const navigation = footer.createDiv({ cls: 'prompt-instruction' })
    const keys = navigation.createSpan({ cls: 'prompt-instruction-command' })
    keys.createEl('kbd', { text: '⇥', attr: { 'aria-label': 'Tab' } })
    keys.appendText(' / ')
    keys.createEl('kbd', { text: '⇧⇥', attr: { 'aria-label': 'Shift+Tab' } })
    navigation.createSpan({ text: t().paletteHelpNavigate })
    const dismiss = footer.createDiv({ cls: 'prompt-instruction' })
    dismiss.createEl('kbd', { cls: 'prompt-instruction-command', text: 'esc' })
    dismiss.createSpan({ text: t().paletteHelpDismiss })
    this.updateSelection()
  }

  cycle(direction: number): void {
    this.index = (this.index + direction + this.leaves.length) % this.leaves.length
    this.updateSelection()
  }

  private updateSelection(): void {
    this.buttons.forEach((button, index) => {
      button.setAttr('aria-pressed', String(index === this.index))
      button.tabIndex = index === this.index ? 0 : -1
    })
    const selected = this.buttons[this.index]
    selected?.focus({ preventScroll: true })
    selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  select(): void {
    const leaf = this.leaves[this.index]
    const current: WorkspaceLeaf[] = []
    this.app.workspace.iterateRootLeaves((item) => {
      current.push(item)
    })
    this.close()
    if (current.includes(leaf)) this.app.workspace.setActiveLeaf(leaf, { focus: true })
  }

  onClose(): void {
    this.previews.unload()
    this.contentEl.empty()
    this.dismissed()
  }
}
