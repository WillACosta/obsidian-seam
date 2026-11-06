import { mediaText } from './strings'
import {
  App,
  TFile,
  Editor,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  parseYaml,
  requestUrl,
  stringifyYaml,
  normalizePath,
} from 'obsidian'
import { ImageCache } from './image-cache'
import { LayoutService } from './layout/service'
import { foldService } from '@codemirror/language'
import { findFoldGroup, FoldGroup } from './folding'
import { ImageMatch, images, parseEmbed, setCaption, sortTasks } from './core'

import { EmbedModal, ImagePicker, preview, PanelContext, MediaModal } from './ui'

import { EditorMediaSettings, EditorMediaView } from './settings'
import { PaletteItem } from '../types'
import { t } from '../i18n'

type Metadata = { title?: string; description?: string; image?: string }
class TextModal extends MediaModal {
  constructor(
    app: App,
    private label: string,
    private initial: string,
    private submit: (value: string) => void,
    back?: () => void,
  ) {
    super(app)
    if (back)
      this.backAction = () => {
        this.close()
        back()
      }
  }
  onOpen() {
    let value = this.initial
    const input = this.prepare(this.label)
    input.value = value
    this.confirm = () => {
      this.submit(value)
      this.close()
    }
    input.addEventListener('input', () => (value = input.value))
    this.body.hidden = true
    this.confirmationAction(mediaText('Save caption'), () => this.confirm?.())
    this.helpers(mediaText('submit'), null)
    input.focus()
  }
  onClose() {
    this.contentEl.empty()
  }
}
/** Internal registration owner, loaded only as a child of Seam, never as a standalone plugin. */
export class EditorMedia extends Plugin {
  constructor(
    owner: Plugin,
    private readSettings: () => EditorMediaSettings,
  ) {
    super(owner.app, owner.manifest)
  }
  get mediaSettings(): EditorMediaSettings {
    return this.readSettings()
  }
  private active = false
  private modals = new Set<MediaModal>()
  private present = (modal: MediaModal, panel?: PanelContext) => {
    if (!this.active) {
      panel?.back()
      return
    }
    this.modals.add(modal)
    modal.onDismiss = () => this.modals.delete(modal)
    if (panel) modal.mount(panel)
    else modal.open()
  }
  private layoutService!: LayoutService
  private pendingFold: FoldGroup | null = null
  private cache = new Map<string, Promise<Metadata>>()
  private imageCache!: ImageCache
  onload() {
    this.active = true
    if (this.mediaSettings.captions) {
      const adapter = this.app.vault.adapter
      const pluginPath =
        this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`
      const cachePath = normalizePath(`${pluginPath}/image-cache`)
      let ready: Promise<void> | undefined
      this.imageCache = new ImageCache(
        {
          read: async (key) => {
            if (!(await adapter.exists(`${cachePath}/${key}.type`))) return null
            return {
              data: await adapter.readBinary(`${cachePath}/${key}.bin`),
              type: await adapter.read(`${cachePath}/${key}.type`),
            }
          },
          write: async (key, image) => {
            ready ??= (async () => {
              if (!(await adapter.exists(cachePath))) await adapter.mkdir(cachePath)
            })()
            await ready
            await adapter.writeBinary(`${cachePath}/${key}.bin`, image.data)
            await adapter.write(`${cachePath}/${key}.type`, image.type)
          },
        },
        async (url) => {
          const response = await requestUrl({ url })
          const type =
            Object.entries(response.headers)
              .find(([key]) => key.toLowerCase() === 'content-type')?.[1]
              .split(';')[0]
              .trim()
              .toLowerCase() || ''
          return { data: response.arrayBuffer, type }
        },
      )
      this.register(() => this.imageCache.dispose())
    }
    this.layoutService = new LayoutService(this.app, () => this.mediaSettings.layouts, this.present)
    if (this.mediaSettings.layouts)
      this.registerMarkdownCodeBlockProcessor('seam-layout', (source, el, ctx) =>
        this.layoutService.render(source, el, ctx),
      )
    if (this.mediaSettings.folding)
      this.registerEditorExtension(
        foldService.of((state, from) => {
          const group = this.pendingFold
          if (!group || state.doc.lineAt(from).number !== group.start + 1) return null
          return { from: state.doc.line(group.start + 1).to, to: state.doc.line(group.end + 1).to }
        }),
      )
    if (this.mediaSettings.previews)
      this.registerMarkdownCodeBlockProcessor('seam-embed', (source, el, ctx) =>
        this.renderEmbed(source, el, ctx.sourcePath),
      )
    if (this.mediaSettings.captions) {
      const caption = (root: HTMLElement) => {
        if (!this.mediaSettings.captions) return
        root.querySelectorAll('img').forEach((img) => {
          if (img.closest('.seam-media-embed, .seam-layout, .modal, .prompt')) return
          const embed = img.closest('.internal-embed')
          const alt = (embed?.getAttribute('alt') || img.getAttribute('alt') || '')
            .split('|')
            .filter((part) => !/^\d+(?:x\d+)?$/.test(part))
            .join(' ')
            .trim()
          const existing = img.parentElement?.classList.contains('seam-media-captioned')
            ? img.parentElement
            : null
          if (!alt || alt === embed?.getAttribute('src')) {
            if (existing) {
              existing.replaceWith(img)
            }
            return
          }
          if (existing) {
            const label = existing.querySelector('.seam-media-caption')
            if (label && label.textContent !== alt) label.textContent = alt
            return
          }
          const wrapper = createSpan({ cls: 'seam-media-captioned' })
          img.parentNode?.insertBefore(wrapper, img)
          wrapper.appendChild(img)
          wrapper.createSpan({ cls: 'seam-media-caption', text: alt })
        })
      }
      this.registerMarkdownPostProcessor((el) => caption(el))
      const observer = new MutationObserver(() => caption(document.body))
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['alt', 'src'],
      })
      this.register(() => observer.disconnect())
      this.register(() => {
        document.querySelectorAll<HTMLElement>('.seam-media-captioned').forEach((wrapper) => {
          const img = wrapper.querySelector('img')
          if (img) wrapper.replaceWith(img)
        })
      })
    }
    if (this.mediaSettings.autoSort) {
      const snapshots = new Map<string, string>()
      const remember = async () => {
        const file = this.app.workspace.getActiveFile()
        if (this.active && file?.extension === 'md')
          snapshots.set(file.path, await this.app.vault.cachedRead(file))
      }
      this.app.workspace.onLayoutReady(() => {
        if (this.active) void remember()
      })
      this.registerEvent(
        this.app.workspace.on('file-open', () => {
          if (this.active) void remember()
        }),
      )
      this.registerEvent(
        this.app.vault.on('modify', (file) => {
          if (!(file instanceof TFile) || file.extension !== 'md') return
          void this.app.vault
            .cachedRead(file)
            .then(async (text) => {
              const previous = snapshots.get(file.path)
              snapshots.set(file.path, text)
              if (!this.active || !this.mediaSettings.autoSort || !previous) return
              const newlyChecked = text
                .split('\n')
                .some(
                  (line) =>
                    /\[[xX]\]/.test(line) &&
                    previous.split('\n').includes(line.replace(/\[[xX]\]/, '[ ]')),
                )
              if (!newlyChecked) return
              await this.app.vault.process(file, (current) => {
                if (!this.active) return current
                const checkedLines = text
                  .split('\n')
                  .filter(
                    (line) =>
                      /\[[xX]\]/.test(line) &&
                      previous.split('\n').includes(line.replace(/\[[xX]\]/, '[ ]')),
                  )
                const sorted = sortTasks(current, checkedLines)
                snapshots.set(file.path, sorted)
                return sorted
              })
            })
            .catch(() => new Notice(mediaText('Could not sort completed tasks.')))
        }),
      )
    }
    if (this.mediaSettings.captions) {
      this.registerEvent(
        this.app.workspace.on('editor-menu', (menu, editor) => {
          if (!this.mediaSettings.captions) return
          const found = images(editor.getValue())
          if (found.length)
            menu.addItem((item) =>
              item
                .setTitle(mediaText('Add caption'))
                .setIcon('captions')
                .onClick(() => this.chooseCaption(editor)),
            )
        }),
      )
      this.registerDomEvent(document, 'contextmenu', (event: MouseEvent) => {
        if (!this.mediaSettings.captions || !(event.target instanceof HTMLImageElement)) return
        const view = this.app.workspace.getActiveViewOfType(MarkdownView)
        if (
          !view ||
          !view.containerEl.contains(event.target) ||
          event.target.closest('.seam-media-embed')
        )
          return
        const found = images(view.editor.getValue())
        const alt = event.target.getAttribute('alt') || ''
        const matches = found.filter((item) => item.caption === alt)
        if (!found.length) return
        event.preventDefault()
        event.stopPropagation()
        const menu = new Menu()
        menu.addItem((item) =>
          item
            .setTitle(mediaText('Add caption'))
            .setIcon('captions')
            .onClick(() =>
              matches.length === 1
                ? this.withEditor((editor) =>
                    this.editCaption(editor, matches[0], editor.getValue()),
                  )
                : this.withEditor((editor) => this.chooseCaption(editor)),
            ),
        )
        menu.showAtMouseEvent(event)
      })
    }
    this.updateBody()
  }
  commandDefinitions() {
    return [
      {
        id: 'embed-url',
        name: t().editorMediaEmbed,
        icon: 'link',
        enabled: this.mediaSettings.previews,
        view: 'embed-url' as EditorMediaView,
        run: () => this.embed(),
      },
      {
        id: 'add-caption',
        name: t().editorMediaCaption,
        icon: 'captions',
        enabled: this.mediaSettings.captions,
        view: 'add-caption' as EditorMediaView,
        run: () => this.withEditor((editor) => this.chooseCaption(editor)),
      },
      {
        id: 'toggle-fold',
        name: t().editorMediaFold,
        icon: 'fold-vertical',
        enabled: this.mediaSettings.folding,
        run: () => this.withEditor((editor) => this.fold(editor)),
      },
      {
        id: 'image-layout',
        name: t().editorMediaLayout,
        icon: 'images',
        enabled: this.mediaSettings.layouts,
        view: 'image-layout' as EditorMediaView,
        run: () => this.imageLayout(),
      },
    ]
  }
  paletteItems(): PaletteItem[] {
    if (!this.app.workspace.getActiveViewOfType(MarkdownView)) return []
    return this.commandDefinitions()
      .filter((item) => item.enabled)
      .map((item) => ({
        id: `cmd-${item.id}`,
        title: item.name,
        description: '',
        type: 'command',
        icon: item.icon,
        shortcutCommandId: `${this.manifest.id}:${item.id}`,
        editorMediaView: item.view,
        action: item.run,
      }))
  }
  openView(id: EditorMediaView, panel: PanelContext) {
    if (!this.commandDefinitions().some((item) => item.view === id && item.enabled)) {
      panel.back()
      return
    }
    if (id === 'embed-url') this.embed(panel)
    else if (id === 'image-layout') this.imageLayout(panel)
    else void this.withEditor((editor) => this.chooseCaption(editor, panel))
  }
  updateBody() {
    document.body.classList.toggle('seam-media-completed', this.mediaSettings.completed)
    document.body.classList.toggle('seam-media-layouts', this.mediaSettings.layouts)
  }
  onunload() {
    this.active = false
    for (const modal of this.modals) modal.close()
    this.modals.clear()
    document.body.classList.remove('seam-media-completed', 'seam-media-layouts')
  }
  async withEditor(fn: (editor: Editor) => void) {
    if (!this.active) return
    const view = this.app.workspace.getActiveViewOfType(MarkdownView)
    if (!view?.file) {
      new Notice(mediaText('Open a Markdown note first.'))
      return
    }
    if (view.getMode() === 'preview')
      await view.leaf.setViewState({
        type: 'markdown',
        state: { file: view.file.path, mode: 'source' },
      })
    const current = this.app.workspace.getActiveViewOfType(MarkdownView)
    if (this.active && current) fn(current.editor)
  }
  imageLayout(panel?: PanelContext) {
    void this.withEditor((editor) =>
      this.layoutService.insert(editor, this.app.workspace.getActiveFile()?.path || '', panel),
    )
  }
  embed(panel?: PanelContext) {
    void this.withEditor((editor) => {
      const modal = new EmbedModal(
        this.app,
        (embed) => editor.replaceSelection('```seam-embed\n' + stringifyYaml(embed) + '```\n'),
        this.app.workspace.getActiveFile()?.path || '',
      )
      this.present(modal, panel)
    })
  }
  chooseCaption(editor: Editor, panel?: PanelContext) {
    const snapshot = editor.getValue()
    const found = images(snapshot)
    if (!found.length) {
      new Notice(mediaText('No images in this note.'))
      panel?.back()
      return
    }
    const modal = new ImagePicker(
      this.app,
      found,
      this.app.workspace.getActiveFile()?.path || '',
      (item) => this.editCaption(editor, item, snapshot, panel),
      this.imageCache,
    )
    this.present(modal, panel)
  }
  editCaption(editor: Editor, item: ImageMatch, snapshot: string, panel?: PanelContext) {
    const modal = new TextModal(
      this.app,
      mediaText('Add caption'),
      item.caption,
      (value) => {
        if (editor.getValue() !== snapshot) {
          new Notice(mediaText('The note changed. Choose the image again.'))
          return
        }
        editor.replaceRange(
          setCaption(item.raw, value),
          editor.offsetToPos(item.start),
          editor.offsetToPos(item.end),
        )
      },
      () => this.chooseCaption(editor),
    )
    if (panel) {
      const back = panel.back
      panel.back = () => {
        panel.back = back
        this.chooseCaption(editor, panel)
      }
      this.present(modal, panel)
    } else this.present(modal)
  }
  fold(editor: Editor) {
    const group = findFoldGroup(editor.getValue(), editor.getCursor().line)
    if (!group) {
      new Notice(mediaText('No foldable group at the cursor.'))
      return
    }
    // Restoring a caret inside folded text would immediately reveal it again.
    editor.setCursor({ line: group.start, ch: editor.getLine(group.start).length })
    this.pendingFold = group
    try {
      editor.exec('toggleFold')
      editor.focus()
    } finally {
      this.pendingFold = null
    }
  }
  async metadata(url: string): Promise<Metadata> {
    let pending = this.cache.get(url)
    if (!pending) {
      pending = (async () => {
        const response = await requestUrl({ url, throw: false })
        if (response.status < 200 || response.status >= 300) throw Error('Request failed')
        const doc = new DOMParser().parseFromString(response.text, 'text/html')
        const meta = (key: string) =>
          doc
            .querySelector(`meta[property="${key}"],meta[name="${key}"]`)
            ?.getAttribute('content')
            ?.trim()
            .slice(0, 1000)
        const image = meta('og:image') || meta('twitter:image')
        let imageUrl: string | null = null
        try {
          if (image) {
            const resolved = new URL(image, url)
            if (['http:', 'https:'].includes(resolved.protocol)) imageUrl = resolved.href
          }
        } catch {}
        return {
          title: meta('og:title') || doc.querySelector('title')?.textContent?.trim().slice(0, 1000),
          description: meta('og:description') || meta('description'),
          image: imageUrl ?? undefined,
        }
      })().catch(() => ({}))
      this.cache.set(url, pending)
    }
    return pending
  }
  async renderEmbed(source: string, el: HTMLElement, sourcePath = '') {
    const embed = parseEmbed(source, parseYaml)
    if (!embed) {
      el.setText(mediaText('Invalid embed URL.'))
      return
    }
    preview(this.app, el, embed, sourcePath)
    if (!this.active || !this.mediaSettings.previews) return
    const data = await this.metadata(embed.url)
    if (!this.active || !this.mediaSettings.previews || !el.isConnected) return
    preview(
      this.app,
      el,
      {
        ...embed,
        title: embed.title || data.title,
        description: embed.description || data.description,
        image: embed.image || data.image,
      },
      sourcePath,
    )
  }
}
