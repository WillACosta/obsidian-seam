import { mediaText } from '../strings'
import { App, setIcon, TFile } from 'obsidian'
import { validUrl } from '../core'
import { Layout, LayoutImage } from './model'

let nextLayoutId = 0
export function renderLayout(
  app: App,
  host: HTMLElement,
  layout: Layout,
  sourcePath: string,
  placeholder = false,
): void {
  host.empty()
  const id = `seam-layout-${++nextLayoutId}`
  const root = host.createDiv({ cls: `seam-layout seam-layout-${layout.type}`, attr: { id } })
  const columns =
    layout.columns === 'auto'
      ? 'repeat(auto-fit,minmax(min(160px,100%),1fr))'
      : `repeat(${layout.columns},minmax(0,1fr))`
  // Only validated numeric values and fixed enum values enter this component-scoped stylesheet.
  root.createEl('style', {
    text: `#${id}{--layout-gap:${layout.gap}px;--layout-height:${layout.height === 'auto' ? 180 : layout.height}px;--layout-radius:${layout.radius === undefined ? 'var(--radius-m)' : layout.radius + 'px'};--layout-grid:${columns};--layout-columns:${layout.columns === 'auto' ? 3 : layout.columns};--layout-fit:${layout.fit}}`,
  })
  const gallery = root.createDiv({ cls: 'seam-layout-gallery' })
  const entries: LayoutImage[] = layout.images.length
    ? layout.images
    : placeholder
      ? Array.from({ length: 3 }, (_, i) => ({ raw: '', path: '', caption: `Image ${i + 1}` }))
      : []
  if (!entries.length)
    root.createDiv({
      cls: 'seam-layout-empty',
      text: mediaText('No images yet. Edit layout to add images.'),
    })
  for (const image of entries) {
    const crop = image.crop ?? (layout.height !== 'auto' && layout.type !== 'flex')
    const figure = gallery.createEl('figure', { cls: 'seam-layout-item' })
    figure.toggleClass('is-cropped', crop)
    figure.toggleClass('has-height', layout.height !== 'auto')
    if (image.fit) figure.addClass(`fit-${image.fit}`)
    const remote = validUrl(image.path)
    const file =
      !remote && image.path ? app.metadataCache.getFirstLinkpathDest(image.path, sourcePath) : null
    const source = remote || (file instanceof TFile ? app.vault.getResourcePath(file) : null)
    const link = figure.createEl('a', {
      cls: 'seam-layout-image-link',
      attr: { 'aria-label': image.caption || image.path || mediaText('Image placeholder') },
    })
    const missing = () => {
      link.empty()
      link.addClass('seam-layout-missing')
      setIcon(link.createSpan(), 'image-off')
      link.createSpan({
        text: image.path
          ? `Image not found: ${image.path}`
          : image.caption || mediaText('Image placeholder'),
      })
    }
    if (source) {
      link.href = source
      link.setAttr('rel', 'noopener noreferrer')
      const img = link.createEl('img', {
        attr: {
          src: source,
          alt: image.caption || image.path,
          loading: 'lazy',
          referrerpolicy: 'no-referrer',
        },
      })
      img.addEventListener('error', missing, { once: true })
      if (file instanceof TFile)
        link.addEventListener('click', (event) => {
          event.preventDefault()
          void app.workspace.getLeaf('tab').openFile(file)
        })
    } else missing()
    if (layout.captions && image.caption)
      figure.createEl('figcaption', { cls: 'seam-layout-image-caption', text: image.caption })
  }
  if (layout.caption) root.createDiv({ cls: 'seam-layout-caption', text: layout.caption })
}
