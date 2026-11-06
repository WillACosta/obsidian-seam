import { mediaText } from '../strings'
import {
  App,
  Editor,
  MarkdownPostProcessorContext,
  Menu,
  Notice,
  TFile,
  parseYaml,
  stringifyYaml,
  setIcon,
  setTooltip,
} from 'obsidian'
import { PanelContext } from '../ui'
import { LayoutModal } from './modal'
import { LayoutBlock, layoutBlock, layoutBlocks, parseLayout, replaceLayoutBlock } from './model'
import { renderLayout } from './render'

export class LayoutService {
  constructor(
    private app: App,
    private enabled: () => boolean,
    private present: (modal: LayoutModal, panel?: PanelContext) => void,
  ) {}
  insert(editor: Editor, sourcePath: string, panel?: PanelContext) {
    const snapshot = editor.getValue()
    const from = editor.getCursor('from')
    const to = editor.getCursor('to')
    const modal = new LayoutModal(
      this.app,
      sourcePath,
      (layout) => {
        if (editor.getValue() !== snapshot)
          throw new Error(mediaText('This note changed. Reopen Image Layout before inserting.'))
        const prefix = from.ch > 0 ? '\n' : ''
        editor.replaceRange(prefix + layoutBlock(layout, stringifyYaml), from, to)
      },
      undefined,
      false,
      snapshot,
    )
    this.present(modal, panel)
  }
  render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    el.empty()
    if (!this.enabled()) {
      el.createEl('pre', { text: source })
      return
    }
    el.addClass('seam-layout-component')
    const toolbar = el.createDiv({ cls: 'seam-layout-toolbar' })
    const showError = (error: unknown) =>
      new Notice(error instanceof Error ? error.message : String(error))
    const edit = () => {
      void this.edit(source, el, ctx).catch(showError)
    }
    const editButton = toolbar.createEl('button', {
      cls: 'clickable-icon seam-layout-edit',
      attr: { type: 'button', 'aria-label': mediaText('Edit layout') },
    })
    setIcon(editButton, 'layout-grid')
    setTooltip(editButton, mediaText('Edit layout'))
    editButton.addEventListener('click', edit)
    const content = el.createDiv()
    try {
      renderLayout(this.app, content, parseLayout(source, parseYaml), ctx.sourcePath)
    } catch (error) {
      content.createDiv({
        cls: 'seam-layout-error',
        text: error instanceof Error ? error.message : mediaText('Invalid layout configuration.'),
      })
    }
    el.addEventListener('contextmenu', (event) => {
      if ((event.target as HTMLElement).closest('a')) return
      event.preventDefault()
      const menu = new Menu()
      menu.addItem((item) =>
        item.setTitle(mediaText('Edit layout')).setIcon('layout-grid').onClick(edit),
      )
      menu.showAtMouseEvent(event)
    })
  }
  private async anchor(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): Promise<{ file: TFile; block: LayoutBlock; text: string }> {
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath)
    if (!(file instanceof TFile)) throw new Error(mediaText('Source note is unavailable.'))
    const current = await this.app.vault.read(file)
    let candidates = layoutBlocks(current).filter((block) => block.source.trim() === source.trim())
    const section = ctx.getSectionInfo(el)
    if (section) {
      const exact = candidates.find((block) => block.line === section.lineStart)
      if (exact) candidates = [exact]
      else {
        const within = candidates.filter(
          (block) => block.line >= section.lineStart && block.line <= section.lineEnd,
        )
        if (within.length) candidates = within
      }
    }
    if (candidates.length !== 1)
      throw new Error(
        'This layout changed or cannot be identified safely. Reopen the note and try again.',
      )
    return { file, block: candidates[0], text: current }
  }
  private async edit(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    const { file, block, text } = await this.anchor(source, el, ctx)
    const layout = parseLayout(block.source, parseYaml)
    this.present(
      new LayoutModal(
        this.app,
        file.path,
        async (updated) => {
          await this.app.vault.process(file, (current) =>
            replaceLayoutBlock(current, block, layoutBlock(updated, stringifyYaml)),
          )
        },
        layout,
        true,
        text,
      ),
    )
  }
}
