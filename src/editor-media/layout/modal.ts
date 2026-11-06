import { mediaText } from '../strings'
import { App, Setting, setIcon, setTooltip } from 'obsidian'
import { MediaModal, imageSource, customizationSection } from '../ui'
import {
  Layout,
  LayoutImage,
  emptyLayout,
  imageExtension,
  captionImage,
  moveImage,
  layoutImageFromPath,
  noteLayoutImages,
} from './model'
import { renderLayout } from './render'
import { ImageStripDrag } from './drag'

export class LayoutModal extends MediaModal {
  constructor(
    app: App,
    private sourcePath: string,
    private save: (layout: Layout) => Promise<void> | void,
    private initial: Layout = emptyLayout(),
    private editing = false,
    private sourceText = '',
  ) {
    super(app)
  }
  onOpen() {
    const title = this.prepare(
      this.editing ? mediaText('Edit Image Layout…') : mediaText('Image Layout…'),
    )
    title.readOnly = true
    const prompt = this.contentEl.closest<HTMLElement>('.prompt')
    prompt?.addClass('seam-layout-dialog')
    this.onLeave = () => prompt?.removeClass('seam-layout-dialog')
    this.contentEl.addClass('seam-layout-editor')
    const data: Layout = {
      ...this.initial,
      images: this.initial.images.map((image) => ({ ...image })),
    }
    let refresh = () => {}
    const presets = this.body.createDiv({
      cls: 'seam-layout-presets',
      attr: { role: 'group', 'aria-label': mediaText('Layout preset') },
    })
    const presetButtons = new Map<string, HTMLButtonElement>()
    for (const [type, label, icon] of [
      ['grid', mediaText('Grid'), 'layout-grid'],
      ['flex', mediaText('Flex'), 'columns-3'],
      ['masonry', mediaText('Masonry'), 'panels-top-left'],
    ] as const) {
      const button = presets.createEl('button', {
        attr: { type: 'button', 'aria-pressed': String(type === data.type) },
      })
      setIcon(button.createSpan(), icon)
      button.createSpan({ text: label })
      presetButtons.set(type, button)
      button.addEventListener('click', () => {
        data.type = type
        for (const [key, b] of presetButtons) b.setAttr('aria-pressed', String(key === type))
        refresh()
      })
    }
    const imagesHeading = this.body.createDiv({ cls: 'seam-layout-section-heading' })
    const count = imagesHeading.createEl('strong', { text: mediaText('Images') })
    const add = imagesHeading.createEl('button', {
      text: mediaText('Add images'),
      attr: { type: 'button', 'aria-expanded': 'false' },
    })
    const strip = this.body.createDiv({
      cls: 'seam-layout-strip',
      attr: { 'aria-label': mediaText('Selected images') },
    })
    const inspector = this.body.createDiv({ cls: 'seam-layout-inspector' })
    inspector.hidden = true
    inspector.id = `seam-layout-image-options-${crypto.randomUUID()}`
    let inspectedImage: LayoutImage | null = null
    const syncSelection = () => {
      Array.from(strip.querySelectorAll<HTMLElement>('.seam-layout-thumbnail')).forEach(
        (item, index) => {
          const selected = !inspector.hidden && data.images[index] === inspectedImage
          item.toggleClass('is-selected', selected)
          item.querySelector('button')?.setAttr('aria-expanded', String(selected))
        },
      )
    }
    const closeInspector = () => {
      inspectedImage = null
      inspector.hidden = true
      syncSelection()
    }
    const picker = this.body.createDiv({ cls: 'seam-layout-picker' })
    picker.hidden = true
    const pickerId = `seam-layout-picker-${crypto.randomUUID()}`
    picker.id = pickerId
    add.setAttr('aria-controls', pickerId)
    type Source = 'vault' | 'note' | 'manual'
    let activeSource: Source = 'vault'
    const tabs = picker.createDiv({
      cls: 'seam-layout-source-tabs',
      attr: { role: 'tablist', 'aria-label': mediaText('Image source') },
    })
    const sourceButtons = new Map<Source, HTMLButtonElement>()
    const sourcePanels = new Map<Source, HTMLElement>()
    const searches = new Map<Source, HTMLInputElement>()
    const collections = new Map<Source, HTMLElement>()
    const chooseSource = (source: Source) => {
      activeSource = source
      for (const [key, button] of sourceButtons) {
        button.setAttr('aria-selected', String(key === source))
        button.tabIndex = key === source ? 0 : -1
        sourcePanels.get(key)!.hidden = key !== source
      }
      renderPicker()
    }
    for (const [source, label] of [
      ['vault', mediaText('Vault')],
      ['note', mediaText('Current note')],
      ['manual', mediaText('URL or path')],
    ] as const) {
      const button = tabs.createEl('button', {
        text: label,
        attr: {
          type: 'button',
          role: 'tab',
          id: `${pickerId}-${source}-tab`,
          'aria-controls': `${pickerId}-${source}`,
          'aria-selected': String(source === activeSource),
          tabindex: source === activeSource ? '0' : '-1',
        },
      })
      sourceButtons.set(source, button)
      const panel = picker.createDiv({
        cls: 'seam-layout-source-panel',
        attr: { role: 'tabpanel', id: `${pickerId}-${source}`, 'aria-labelledby': button.id },
      })
      panel.hidden = source !== activeSource
      sourcePanels.set(source, panel)
      button.addEventListener('click', () => chooseSource(source))
      if (source === 'manual') continue
      const placeholder =
        source === 'vault'
          ? mediaText('Filter vault images')
          : mediaText('Filter current note images')
      const search = panel.createEl('input', {
        cls: 'seam-media-input',
        attr: { type: 'search', placeholder, 'aria-label': placeholder },
      })
      searches.set(source, search)
      collections.set(source, panel.createDiv({ cls: 'seam-layout-picker-results' }))
      search.addEventListener('input', () => renderPicker())
    }
    this.viewKey = (event) => {
      const handle = (event.target as HTMLElement)?.closest('.seam-layout-drag')
      if (
        handle &&
        strip.contains(handle) &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        ['ArrowLeft', 'ArrowRight'].includes(event.key)
      ) {
        const index = Array.from(strip.querySelectorAll('.seam-layout-drag')).indexOf(handle)
        const next = Math.max(
          0,
          Math.min(data.images.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)),
        )
        if (next === index) return true
        moveImage(data.images, index, next)
        closeInspector()
        renderStrip()
        refresh()
        strip.querySelectorAll<HTMLButtonElement>('.seam-layout-drag')[next]?.focus()
        return true
      }
      const keys = [...sourceButtons.keys()]
      const index = keys.findIndex((key) => sourceButtons.get(key) === event.target)
      if (index < 0 || event.altKey || event.metaKey || event.ctrlKey) return false
      const direction = getComputedStyle(tabs).direction === 'rtl' ? -1 : 1
      const step =
        event.key === 'ArrowLeft' ? -direction : event.key === 'ArrowRight' ? direction : 0
      if (step || event.key === 'Home' || event.key === 'End') {
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? keys.length - 1
              : (index + step + keys.length) % keys.length
        chooseSource(keys[next])
        sourceButtons.get(keys[next])!.focus()
        return true
      }
      if (event.key === 'Enter' || event.key === ' ') {
        sourceButtons.get(keys[index])!.click()
        return true
      }
      return false
    }
    tabs.addEventListener('keydown', (event) => {
      if (!event.defaultPrevented && this.viewKey?.(event)) {
        event.preventDefault()
        event.stopPropagation()
      }
    })
    const manual = new Setting(sourcePanels.get('manual')!).setName(
      mediaText('Image URL or vault path'),
    )
    let manualInput!: HTMLInputElement
    const addManual = () => {
      const image = layoutImageFromPath(manualInput.value)
      if (!image) {
        manualInput.setCustomValidity(
          mediaText('Enter an HTTP(S) image URL or a vault image path.'),
        )
        manualInput.reportValidity()
        return
      }
      if (selectedIndex(image) < 0) data.images.push(image)
      manualInput.value = ''
      closeInspector()
      renderStrip()
      refresh()
      manualInput.focus()
    }
    manual.addText((input) => {
      manualInput = input.inputEl
      manualInput.setAttr('aria-label', mediaText('Image URL or vault path'))
      input
        .setPlaceholder(mediaText('Images/photo.png or https://…'))
        .onChange(() => manualInput.setCustomValidity(''))
      manualInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.isComposing) return
        event.preventDefault()
        event.stopPropagation()
        addManual()
      })
    })
    manual.addButton((button) => button.setButtonText('Add image').onClick(addManual))
    const vaultImages: LayoutImage[] = this.app.vault
      .getFiles()
      .filter((file) => imageExtension.test(file.path))
      .map((file) => ({ raw: `![[${file.path}]]`, path: file.path, caption: '' }))
    const noteImages = noteLayoutImages(this.sourceText)
    const identity = (image: LayoutImage) =>
      this.app.metadataCache.getFirstLinkpathDest(image.path, this.sourcePath)?.path ?? image.path
    const selectedIndex = (image: LayoutImage) =>
      data.images.findIndex((selected) => identity(selected) === identity(image))
    const renderPicker = () => {
      const results = collections.get(activeSource)
      const search = searches.get(activeSource)
      if (!results || !search) return
      results.empty()
      const candidates = activeSource === 'vault' ? vaultImages : noteImages
      const seen = new Set<string>()
      const query = search.value.trim().toLowerCase()
      const matching = candidates.filter((image) => {
        const key = identity(image)
        if (seen.has(key)) return false
        seen.add(key)
        return `${image.path} ${image.caption}`.toLowerCase().includes(query)
      })
      for (const image of matching.slice(0, 60)) {
        const button = results.createEl('button', {
          cls: 'seam-layout-picker-image',
          attr: {
            type: 'button',
            'aria-pressed': String(selectedIndex(image) >= 0),
            'aria-label': image.path,
          },
        })
        const src = imageSource(this.app, image.path, this.sourcePath)
        if (src) button.createEl('img', { attr: { src, alt: '', loading: 'lazy' } })
        else setIcon(button.createSpan(), 'image-off')
        button.createSpan({ text: image.path.split('/').pop() || image.path })
        setTooltip(button, image.path)
        button.addEventListener('click', () => {
          const index = selectedIndex(image)
          if (index >= 0) data.images.splice(index, 1)
          else data.images.push({ ...image })
          closeInspector()
          renderStrip()
          renderPicker()
          refresh()
        })
      }
      if (matching.length > 60)
        results.createDiv({
          text: `Showing 60 of ${matching.length} images. Filter by name to find more.`,
          cls: 'setting-item-description',
        })
      if (!matching.length)
        results.createDiv({
          text: query
            ? mediaText('No matching images.')
            : activeSource === 'note'
              ? mediaText('No images in the current note.')
              : mediaText('No images in the vault.'),
          cls: 'setting-item-description',
        })
    }
    add.addEventListener('click', () => {
      picker.hidden = !picker.hidden
      add.setAttr('aria-expanded', String(!picker.hidden))
      if (!picker.hidden) {
        renderPicker()
        sourceButtons.get(activeSource)?.focus()
      }
    })
    const sortable = new ImageStripDrag(strip, (from, to) => {
      moveImage(data.images, from, to)
      closeInspector()
      renderStrip()
      refresh()
    })
    const previousLeave = this.onLeave
    this.onLeave = () => {
      sortable.destroy()
      previousLeave?.()
    }
    const editImage = (image: LayoutImage) => {
      if (inspectedImage === image && !inspector.hidden) {
        closeInspector()
        return
      }
      inspectedImage = image
      inspector.empty()
      inspector.hidden = false
      syncSelection()
      const name = inspector.createEl('strong', { cls: 'seam-layout-image-name', text: image.path })
      setTooltip(name, image.path)
      new Setting(inspector).setName(mediaText('Caption')).addText((input) =>
        input.setValue(image.caption).onChange((value) => {
          captionImage(image, value)
          renderStrip()
          refresh()
        }),
      )
      new Setting(inspector)
        .setName(mediaText('Crop image'))
        .setDesc('Crop this image to the configured height, or 180px when height is automatic.')
        .addToggle((toggle) =>
          toggle
            .setValue(image.crop ?? (data.height !== 'auto' && data.type !== 'flex'))
            .onChange((value) => {
              image.crop = value
              refresh()
            }),
        )
      new Setting(inspector).setName(mediaText('Image fit')).addDropdown((input) =>
        input
          .addOptions({
            '': 'Use layout setting',
            cover: mediaText('Cover'),
            contain: mediaText('Contain'),
          })
          .setValue(image.fit || '')
          .onChange((value) => {
            image.fit = value === 'cover' || value === 'contain' ? value : undefined
            refresh()
          }),
      )
    }
    const renderStrip = () => {
      sortable.cancel()
      strip.empty()
      count.setText(`${mediaText('Images')} · ${data.images.length} ${mediaText('selected')}`)
      if (!data.images.length)
        strip.createSpan({
          text: mediaText('No images selected. The live preview uses placeholders.'),
          cls: 'setting-item-description',
        })
      data.images.forEach((image, index) => {
        const item = strip.createDiv({
          cls: 'seam-layout-thumbnail',
          attr: { role: 'group', 'aria-label': image.path },
        })
        const button = item.createEl('button', {
          cls: 'seam-layout-thumbnail-button',
          attr: {
            type: 'button',
            'aria-label': `Edit ${image.path}`,
            'aria-controls': inspector.id,
            'aria-expanded': 'false',
          },
        })
        const src = imageSource(this.app, image.path, this.sourcePath)
        if (src)
          button.createEl('img', {
            attr: { src, alt: image.caption || image.path, draggable: 'false' },
          })
        else setIcon(button.createSpan(), 'image-off')
        button.createSpan({ text: image.path.split('/').pop() || image.path })
        setTooltip(button, image.path)
        button.addEventListener('click', () => editImage(image))
        const actions = item.createDiv({ cls: 'seam-layout-thumbnail-actions' })
        const drag = actions.createEl('button', {
          cls: 'clickable-icon seam-layout-drag',
          attr: {
            type: 'button',
            draggable: 'true',
            'aria-label': mediaText('Drag to rearrange'),
            'aria-description': mediaText('Use left and right arrow keys to reorder.'),
          },
        })
        setIcon(drag, 'grip-vertical')
        setTooltip(drag, mediaText('Drag to rearrange'))
        const remove = actions.createEl('button', {
          cls: 'clickable-icon seam-layout-remove',
          attr: { type: 'button', 'aria-label': mediaText('Delete') },
        })
        setIcon(remove, 'x')
        setTooltip(remove, mediaText('Delete'))
        remove.addEventListener('click', () => {
          data.images.splice(index, 1)
          closeInspector()
          renderStrip()
          renderPicker()
          refresh()
        })
        actions.appendChild(drag)
        sortable.bind(item, drag, index)
      })
      syncSelection()
    }
    this.body.createEl('h4', { text: mediaText('Live Preview') })
    const live = this.body.createDiv({ cls: 'seam-layout-live' })
    const appearance = customizationSection(this.body, mediaText('Appearance'))
    appearance.addClass('seam-layout-appearance')
    new Setting(appearance).setName(mediaText('Columns')).addDropdown((input) =>
      input
        .addOptions({
          auto: mediaText('Auto'),
          '1': '1',
          '2': '2',
          '3': '3',
          '4': '4',
          '5': '5',
          '6': '6',
          ...(data.columns !== 'auto' ? { [String(data.columns)]: String(data.columns) } : {}),
        })
        .setValue(String(data.columns))
        .onChange((value) => {
          data.columns = value === 'auto' ? 'auto' : Number(value)
          refresh()
        }),
    )
    const numeric = (name: string, key: 'gap' | 'height' | 'radius', max: number) => {
      new Setting(appearance).setName(name).addText((input) =>
        input
          .setPlaceholder(
            key === 'gap' ? '8' : key === 'height' ? mediaText('Auto') : mediaText('Theme default'),
          )
          .setValue(data[key] === undefined || data[key] === 'auto' ? '' : String(data[key]))
          .onChange((value) => {
            const parsed = Number(value)
            const minimum = key === 'height' ? 16 : 0
            if (value.trim() && (!Number.isFinite(parsed) || parsed < minimum || parsed > max)) {
              input.inputEl.setCustomValidity(`Enter ${minimum}–${max}.`)
              return
            }
            input.inputEl.setCustomValidity('')
            if (key === 'height') data.height = value.trim() ? parsed : 'auto'
            else if (key === 'radius') data.radius = value.trim() ? parsed : undefined
            else data.gap = value.trim() ? parsed : 8
            refresh()
          }),
      )
    }
    numeric(mediaText('Gap (px)'), 'gap', 128)
    numeric(mediaText('Image height (px)'), 'height', 2000)
    numeric(mediaText('Corner radius (px)'), 'radius', 256)
    new Setting(appearance).setName(mediaText('Image fit')).addDropdown((input) =>
      input
        .addOptions({ cover: mediaText('Cover'), contain: mediaText('Contain') })
        .setValue(data.fit)
        .onChange((value) => {
          data.fit = value as Layout['fit']
          refresh()
        }),
    )
    new Setting(appearance).setName(mediaText('Show image captions')).addToggle((input) =>
      input.setValue(data.captions).onChange((value) => {
        data.captions = value
        refresh()
      }),
    )
    new Setting(appearance).setName(mediaText('Layout caption')).addText((input) =>
      input.setValue(data.caption || '').onChange((value) => {
        data.caption = value
        refresh()
      }),
    )
    appearance.createDiv({
      cls: 'setting-item-description seam-layout-appearance-hint',
      text: mediaText(
        'Images retain their proportions unless a fixed height or individual crop is selected.',
      ),
    })
    refresh = () => renderLayout(this.app, live, data, this.sourcePath, true)
    renderStrip()
    refresh()
    const submit = this.confirmationAction(
      this.editing ? mediaText('Save layout') : mediaText('Insert layout'),
      () => {
        void save().catch((error) => this.showError(error))
      },
    )
    submit.addClass('seam-layout-confirm')
    let saving = false
    const save = async () => {
      if (saving) return
      const invalid = appearance.querySelector<HTMLInputElement>('input:invalid')
      if (invalid) {
        const section = appearance.closest('.seam-media-metadata')!
        if (!section.classList.contains('is-open'))
          section.querySelector<HTMLButtonElement>('button')!.click()
        invalid.reportValidity()
        invalid.focus()
        return
      }
      saving = true
      submit.disabled = true
      try {
        await this.save(data)
        this.close()
      } finally {
        saving = false
        submit.disabled = false
      }
    }
    this.confirm = () => {
      void save().catch((error) => this.showError(error))
    }
    this.helpers(this.editing ? mediaText('save') : mediaText('insert'))
  }
  private showError(error: unknown) {
    let message = this.body.querySelector<HTMLElement>('.seam-layout-save-error')
    if (!message)
      message = this.body.createDiv({ cls: 'seam-layout-save-error', attr: { role: 'alert' } })
    message.setText(error instanceof Error ? error.message : String(error))
    message.scrollIntoView({ block: 'nearest' })
  }
}
