import { mediaText } from './strings'
import { App, Modal, Platform, Setting, setIcon, TFile, Scope, setTooltip } from 'obsidian'
import { Embed, ImageMatch, validUrl } from './core'
import { gridNeighbor, isBackShortcut } from './navigation'
import { parseLayoutImage } from './layout/model'
import { ImageCache, imageName } from './image-cache'

let metadataPanelId = 0

/** Shared disclosure presentation for optional customization fields. */
export function customizationSection(parent: HTMLElement, label: string): HTMLElement {
  const section = parent.createDiv({ cls: 'seam-media-metadata' })
  const panelId = `seam-media-metadata-${++metadataPanelId}`
  const toggle = section.createEl('button', {
    cls: 'seam-media-metadata-toggle',
    attr: { type: 'button', 'aria-expanded': 'false', 'aria-controls': panelId },
  })
  setIcon(toggle.createSpan({ cls: 'seam-media-metadata-chevron' }), 'chevron-right')
  toggle.createSpan({ text: label })
  const panel = section.createDiv({
    cls: 'seam-media-metadata-panel',
    attr: { id: panelId, 'aria-hidden': 'true' },
  })
  const fields = panel.createDiv({ cls: 'seam-media-metadata-fields' })
  fields.inert = true
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true'
    toggle.setAttr('aria-expanded', String(open))
    panel.setAttr('aria-hidden', String(!open))
    section.toggleClass('is-open', open)
    fields.inert = !open
  })
  return fields
}

export type PanelContext = {
  host: HTMLElement
  back: () => void
  close: () => void
  handleKey?: (event: KeyboardEvent) => boolean
  dispose?: () => void
}
export class MediaModal extends Modal {
  onDismiss?: () => void
  private leave() {
    this.onLeave?.()
    this.onDismiss?.()
  }
  private panel?: PanelContext
  protected onLeave?: () => void
  protected primary?: HTMLInputElement
  protected confirm?: () => void
  protected body!: HTMLElement
  protected backAction?: () => void
  protected viewKey?: (event: KeyboardEvent) => boolean
  private helperEl?: HTMLElement
  mount(panel: PanelContext) {
    panel.dispose?.()
    panel.dispose = () => this.leave()
    this.panel = panel
    this.contentEl = panel.host
    this.contentEl.empty()
    this.onOpen()
    panel.handleKey = (event) => this.handleKey(event)
  }
  protected get isEmbedded() {
    return Boolean(this.panel)
  }
  close() {
    if (this.panel) this.panel.close()
    else super.close()
  }
  protected prepare(placeholder: string): HTMLInputElement {
    const root = this.contentEl
    root.addClass('seam-media-view')
    if (!this.panel) {
      this.modalEl.addClass('prompt', 'seam-media-prompt')
      this.titleEl.hidden = true
      const keyScope = new Scope(this.scope)
      for (const key of ['Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', ' '])
        keyScope.register([], key, (event) => (this.handleKey(event) ? false : true))
      keyScope.register(['Mod'], '[', (event) => (this.handleKey(event) ? false : true))
      this.app.keymap.pushScope(keyScope)
      this.onClose = () => {
        this.app.keymap.popScope(keyScope)
        this.leave()
      }
    }
    const header = root.createDiv({ cls: 'prompt-input-container seam-media-prompt-input' })
    const input = header.createEl('input', { cls: 'prompt-input', placeholder })
    const close = header.createEl('button', {
      cls: 'clickable-icon seam-palette-close',
      attr: { 'aria-label': mediaText('Dismiss') },
    })
    setIcon(close, 'circle-x')
    close.addEventListener('click', () => this.close())
    this.body = root.createDiv({ cls: 'seam-media-view-body' })
    this.primary = input
    setTimeout(() => input.focus(), 0)
    return input
  }
  protected confirmationAction(label: string, submit: () => void): HTMLButtonElement {
    const button = this.primary!.parentElement!.createEl('button', {
      cls: 'clickable-icon seam-media-confirm',
      attr: { type: 'button', 'aria-label': label },
    })
    setIcon(button, 'check')
    setTooltip(button, label)
    this.primary!.after(button)
    button.addEventListener('click', submit)
    return button
  }
  protected helpers(
    confirm = mediaText('confirm'),
    navigation: string | null = '⇥',
    escape = mediaText('dismiss'),
  ) {
    this.helperEl?.remove()
    const footer = this.contentEl.createDiv({ cls: 'prompt-instructions' })
    this.helperEl = footer
    if (!Platform.isPhone)
      for (const [command, purpose] of [
        ...(navigation ? [[navigation, mediaText('navigate')]] : []),
        ['↵', confirm],
        [Platform.isMacOS ? '⌘[' : 'Ctrl+[', mediaText('back')],
        ['esc', escape],
      ]) {
        const hint = footer.createDiv({ cls: 'prompt-instruction' })
        hint.createSpan({ cls: 'prompt-instruction-command', text: command })
        hint.createSpan({ text: purpose })
      }
  }
  private goBack(): void {
    if (this.panel) this.panel.back()
    else if (this.backAction) this.backAction()
    else this.close()
  }
  private handleKey(event: KeyboardEvent): boolean {
    if (event.defaultPrevented) return true
    if (event.isComposing) return false
    if (isBackShortcut(event, Platform.isMacOS)) {
      this.goBack()
      return true
    }
    if (this.viewKey?.(event)) return true
    if (event.key === 'Escape') {
      this.close()
      return true
    }
    const input = event.target as HTMLInputElement
    if (
      event.key === 'Enter' &&
      input === this.primary &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      this.confirm?.()
      return true
    }
    return false
  }
}
export function imageSource(app: App, path: string, sourcePath: string): string | null {
  const remote = validUrl(path)
  if (remote) return remote
  const file = app.metadataCache.getFirstLinkpathDest(path, sourcePath)
  return file instanceof TFile ? app.vault.getResourcePath(file) : null
}
export function preview(app: App, el: HTMLElement, embed: Embed, sourcePath: string) {
  el.empty()
  const anchor = el.createEl('a', {
    href: embed.url,
    cls: `seam-media-embed seam-media-${embed.style}`,
  })
  anchor.setAttr('rel', 'noopener noreferrer')
  if (embed.style !== 'minimal') {
    const media = anchor.createSpan({ cls: 'seam-media-media' })
    setIcon(media, 'image')
    const src = embed.image && imageSource(app, embed.image, sourcePath)
    if (src) {
      const img = media.createEl('img', { cls: 'seam-media-preview-image' })
      img.referrerPolicy = 'no-referrer'
      img.src = src
      img.addEventListener('error', () => img.remove())
    }
  }
  const text = anchor.createSpan({ cls: 'seam-media-embed-text' })
  const heading = text.createSpan({ cls: 'seam-media-heading' })
  if (embed.style === 'minimal')
    setIcon(heading.createSpan({ cls: 'seam-media-link-icon' }), 'link')
  heading.createEl('strong', { text: embed.title || embed.url })
  if (embed.style === 'card' && embed.description)
    text.createSpan({ cls: 'seam-media-description', text: embed.description })
  if (embed.style !== 'minimal')
    text.createSpan({ cls: 'seam-media-domain', text: new URL(embed.url).hostname })
  setIcon(anchor.createSpan({ cls: 'seam-media-external' }), 'external-link')
}
export class EmbedModal extends MediaModal {
  constructor(
    app: App,
    private insert: (embed: Embed) => void,
    private sourcePath: string,
  ) {
    super(app)
  }
  onOpen() {
    const input = this.prepare(mediaText('Insert URL Preview…'))
    const data: Embed = { url: '', style: 'card' }
    let refresh = () => {}
    input.addEventListener('input', () => {
      data.url = input.value
      input.setCustomValidity('')
      refresh()
    })
    new Setting(this.body).setName(mediaText('Preview style')).addDropdown((input) =>
      input
        .addOptions({
          card: mediaText('Card'),
          compact: mediaText('Compact'),
          minimal: mediaText('Minimal'),
        })
        .setValue('card')
        .onChange((value) => {
          data.style = value as Embed['style']
          refresh()
        }),
    )
    this.body.createEl('h4', { text: mediaText('Live Preview') })
    const live = this.body.createDiv({ cls: 'seam-media-live-preview' })
    const fields = customizationSection(this.body, mediaText('Customize metadata'))
    for (const [key, label] of [
      ['title', mediaText('Title')],
      ['description', mediaText('Description')],
      ['image', mediaText('Image URL')],
    ] as const)
      new Setting(fields).setName(label).addText((input) => {
        input.inputEl.setAttr('aria-label', label)
        input.onChange((value) => {
          data[key] = value
          refresh()
        })
      })
    const hint = fields.createDiv({ cls: 'seam-media-metadata-hint' })
    setIcon(
      hint.createSpan({ cls: 'seam-media-info-icon', attr: { 'aria-hidden': 'true' } }),
      'info',
    )
    hint.createSpan({ text: mediaText('Empty fields use automatically detected metadata.') })
    refresh = () =>
      preview(
        this.app,
        live,
        {
          ...data,
          url: validUrl(data.url) || 'https://example.com/article',
          title: data.title || mediaText('Website Title'),
          description:
            data.description ||
            mediaText(
              'A short description of the webpage content will appear here, providing a brief overview of the linked resource.',
            ),
        },
        this.sourcePath,
      )
    refresh()
    const submit = () => {
      const valid = validUrl(data.url)
      if (!valid) {
        input.setCustomValidity('Enter a valid HTTP or HTTPS URL.')
        input.reportValidity()
        input.focus()
        return
      }
      this.insert({ ...data, url: valid })
      this.close()
    }
    this.confirm = submit
    this.confirmationAction(mediaText('Insert URL preview'), submit)
    this.helpers(mediaText('insert'))
  }
}
export class ImagePicker extends MediaModal {
  constructor(
    app: App,
    private items: ImageMatch[],
    private sourcePath: string,
    private choose: (item: ImageMatch) => void,
    private imageCache: ImageCache,
  ) {
    super(app)
  }
  onOpen() {
    const filter = this.prepare(mediaText('Choose an image…'))
    let selected = this.items[0]
    const list = this.body.createDiv({
      cls: 'seam-media-image-list is-grid',
      attr: { role: 'grid', 'aria-label': mediaText('Images') },
    })
    let navigationActive = false
    const matchesFilter = (item: ImageMatch) => {
      const path = parseLayoutImage(item.raw)?.path || ''
      return `${imageName(path)} ${item.caption} ${path}`
        .toLowerCase()
        .includes(filter.value.toLowerCase())
    }
    const visibleItems = () => this.items.filter(matchesFilter)
    const render = () => {
      list.empty()
      for (const item of visibleItems()) {
        const button = list.createEl('button', {
          cls: 'seam-media-image-choice',
          attr: { role: 'gridcell', tabindex: '-1' },
        })
        button.setAttr('aria-selected', String(item === selected))
        button.addEventListener('focus', () => {
          selected = item
          navigationActive = true
          list.addClass('is-navigation-active')
          for (const cell of Array.from(list.querySelectorAll('button')))
            cell.setAttr('aria-selected', String(cell === button))
          this.helpers(mediaText('choose'), '↑↓←→', mediaText('back to filter'))
        })
        const path = parseLayoutImage(item.raw)?.path || ''
        const name = imageName(path)
        button.setAttr('aria-label', name)
        setTooltip(button, name)
        const thumbnail = button.createDiv({ cls: 'seam-media-image-thumbnail' })
        const fallback = thumbnail.createSpan({
          cls: 'seam-media-image-fallback',
          text: mediaText('Loading…'),
        })
        const img = thumbnail.createEl('img', { attr: { alt: item.caption || name } })
        img.hidden = true
        img.addEventListener('load', () => {
          img.hidden = false
          fallback.hidden = true
        })
        const failed = () => {
          img.hidden = true
          fallback.hidden = false
          fallback.textContent = mediaText('Image unavailable')
        }
        img.addEventListener('error', failed)
        const remote = validUrl(path)
        if (remote) {
          void this.imageCache
            .get(remote)
            .then((src) => {
              if (img.isConnected) img.src = src
            })
            .catch(failed)
        } else {
          const src = imageSource(this.app, path, this.sourcePath)
          if (src) img.src = src
          else failed()
        }
        button.createSpan({ cls: 'seam-media-image-name', text: name })
        button.addEventListener('click', () => {
          selected = item
          this.confirm?.()
        })
      }
    }
    filter.addEventListener('input', () => {
      const visible = visibleItems()
      if (!visible.includes(selected)) selected = visible[0]
      render()
    })
    const focusSelected = () => {
      const visible = visibleItems()
      if (!visible.length) return
      if (!visible.includes(selected)) selected = visible[0]
      const button = list.querySelectorAll<HTMLButtonElement>('button')[visible.indexOf(selected)]
      navigationActive = true
      list.addClass('is-navigation-active')
      for (const cell of Array.from(list.querySelectorAll('button')))
        cell.setAttr('aria-selected', String(cell === button))
      this.helpers(mediaText('choose'), '↑↓←→', mediaText('back to filter'))
      button?.focus()
      button?.scrollIntoView({ block: 'nearest' })
    }
    filter.addEventListener('focus', () => {
      navigationActive = false
      list.removeClass('is-navigation-active')
      this.helpers(mediaText('choose'), '↑↓')
    })
    this.viewKey = (event) => {
      if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return false
      if (event.target === filter) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          focusSelected()
          return true
        }
        return false
      }
      if (!navigationActive || !list.contains(event.target as Node)) return false
      if (event.key === 'Escape') {
        navigationActive = false
        list.removeClass('is-navigation-active')
        this.helpers(mediaText('choose'), '↑↓')
        filter.focus()
        return true
      }
      if (event.key === 'Enter' || event.key === ' ') {
        this.confirm?.()
        return true
      }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return false
      const visible = visibleItems()
      const columns = getComputedStyle(list).gridTemplateColumns.split(' ').length
      selected =
        visible[gridNeighbor(visible.indexOf(selected), visible.length, columns, event.key)]
      focusSelected()
      return true
    }
    this.confirm = () => {
      if (selected && matchesFilter(selected)) {
        if (!this.isEmbedded) this.close()
        this.choose(selected)
      }
    }
    render()
    this.helpers(mediaText('choose'), '↑↓')
  }
}
