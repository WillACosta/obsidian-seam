import { App, Modal, setIcon, setTooltip } from 'obsidian'
import { mediaText } from '../strings'
import { Layout } from './model'
import { renderLayout } from './render'

/** Keeps the original composition fixed and scales its entire surface together. */
export class LayoutPreviewModal extends Modal {
  onDismiss?: () => void
  private observer?: ResizeObserver
  private viewport!: HTMLElement
  private surface!: HTMLElement
  private stage!: HTMLElement
  private zoom: number | null = null

  constructor(
    app: App,
    private layout: Layout,
    private sourcePath: string,
    private width: number,
  ) {
    super(app)
    this.width = Math.max(1, width || 720)
  }

  onOpen(): void {
    this.modalEl.addClass('seam-layout-fullscreen')
    this.setTitle(mediaText('Layout preview'))
    const controls = this.contentEl.createDiv({ cls: 'seam-layout-preview-controls' })
    const action = (label: string, icon: string, run: () => void) => {
      const button = controls.createEl('button', {
        cls: 'clickable-icon',
        attr: { type: 'button', 'aria-label': mediaText(label) },
      })
      setIcon(button, icon)
      setTooltip(button, mediaText(label))
      button.addEventListener('click', run)
    }
    action('Zoom out', 'minus', () => this.changeZoom(1 / 1.25))
    action('Fit layout', 'scan', () => {
      this.zoom = null
      this.resize()
    })
    action('Zoom in', 'plus', () => this.changeZoom(1.25))
    this.viewport = this.contentEl.createDiv({ cls: 'seam-layout-preview-viewport' })
    this.stage = this.viewport.createDiv({ cls: 'seam-layout-preview-stage' })
    this.surface = this.stage.createDiv({ cls: 'seam-layout-preview-surface' })
    this.surface.setCssProps({ width: `${this.width}px` })
    renderLayout(this.app, this.surface, this.layout, this.sourcePath)
    // Preview is read-only; tapping images must not navigate away or zoom one image.
    this.surface.inert = true
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(this.viewport)
    this.observer.observe(this.surface)
    this.resize()
  }

  private fit(): number {
    return Math.max(
      0.01,
      Math.min(
        Math.max(1, this.viewport.clientWidth - 32) / this.width,
        Math.max(1, this.viewport.clientHeight - 32) / Math.max(1, this.surface.offsetHeight),
      ),
    )
  }

  private changeZoom(factor: number): void {
    this.zoom = Math.min(8, Math.max(0.05, (this.zoom ?? this.fit()) * factor))
    this.resize()
  }

  private resize(): void {
    const scale = this.zoom ?? this.fit()
    const height = this.surface.offsetHeight
    this.surface.setCssProps({ transform: `scale(${scale})` })
    this.stage.setCssProps({ width: `${this.width * scale}px`, height: `${height * scale}px` })
  }

  onClose(): void {
    this.observer?.disconnect()
    this.contentEl.empty()
    this.onDismiss?.()
  }
}
