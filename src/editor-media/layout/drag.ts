/** Return the insertion slot among the other items, not an index into the dragged item. */
export function dragInsertionIndex(pointer: number, centers: number[], rtl = false): number {
  return centers.reduce(
    (index, center) => index + Number(rtl ? pointer < center : pointer > center),
    0,
  )
}

type DragState = {
  from: number
  to: number
  item: HTMLElement
  handle: HTMLButtonElement
  placeholder: HTMLElement
  ghost: HTMLElement | null
  pointer: number | null
}

/** DOM-only drag preview; the data model changes once, on a successful drop. */
export class ImageStripDrag {
  private state: DragState | null = null
  private animations = new Map<HTMLElement, Animation>()
  constructor(
    private strip: HTMLElement,
    private commit: (from: number, to: number) => void,
  ) {
    strip.addEventListener('dragover', this.over)
    strip.addEventListener('drop', this.drop)
  }
  private over = (event: DragEvent) => {
    if (!this.state || this.state.pointer !== null) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    this.preview(event.clientX)
  }
  private drop = (event: DragEvent) => {
    if (!this.state) return
    event.preventDefault()
    this.finish()
  }
  bind(item: HTMLElement, handle: HTMLButtonElement, index: number): void {
    handle.addEventListener('dragstart', (event) => {
      if (this.state && this.state.pointer !== null) {
        event.preventDefault()
        return
      }
      this.start(item, handle, index)
      const ghost = item.cloneNode(true) as HTMLElement
      ghost.removeClass('is-dragging')
      ghost.addClass('seam-layout-drag-ghost')
      ghost.inert = true
      ghost.setAttr('aria-hidden', 'true')
      this.strip.ownerDocument.body.appendChild(ghost)
      this.state!.ghost = ghost
      event.dataTransfer?.setDragImage(ghost, item.clientWidth / 2, 32)
      event.dataTransfer?.setData('text/plain', String(index))
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
    })
    handle.addEventListener('dragend', () => this.cancel())
    handle.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
      event.preventDefault()
      this.start(item, handle, index)
      handle.draggable = false
      this.state!.pointer = event.pointerId
      handle.setPointerCapture(event.pointerId)
    })
    handle.addEventListener('pointermove', (event) => {
      if (this.state?.pointer !== event.pointerId) return
      event.preventDefault()
      this.preview(event.clientX)
    })
    handle.addEventListener('pointerup', (event) => {
      if (this.state?.pointer !== event.pointerId) return
      event.preventDefault()
      this.finish()
    })
    handle.addEventListener('pointercancel', () => this.cancel())
    handle.addEventListener('lostpointercapture', () => this.cancel())
  }
  private start(item: HTMLElement, handle: HTMLButtonElement, index: number): void {
    this.cancel()
    const placeholder = this.strip.createDiv({
      cls: 'seam-layout-drop-placeholder',
      attr: { 'aria-hidden': 'true' },
      text: 'Drop here',
    })
    this.strip.insertBefore(placeholder, item)
    this.state = { from: index, to: index, item, handle, placeholder, ghost: null, pointer: null }
    this.strip.addClass('is-reordering')
    item.addClass('is-dragging')
  }
  private preview(x: number): void {
    const state = this.state
    if (!state) return
    const bounds = this.strip.getBoundingClientRect()
    if (x < bounds.left + 24) this.strip.scrollLeft -= 12
    else if (x > bounds.right - 24) this.strip.scrollLeft += 12
    const others = Array.from(
      this.strip.querySelectorAll<HTMLElement>(':scope > .seam-layout-thumbnail'),
    ).filter((item) => item !== state.item)
    const centers = others.map(
      (item) => bounds.left + item.offsetLeft - this.strip.scrollLeft + item.offsetWidth / 2,
    )
    const to = dragInsertionIndex(x, centers, getComputedStyle(this.strip).direction === 'rtl')
    if (to === state.to) return
    const positions = others.map((item) => ({ item, x: item.offsetLeft, y: item.offsetTop }))
    state.to = to
    this.strip.insertBefore(state.placeholder, others[to] ?? null)
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const { item, x: beforeX, y: beforeY } of positions) {
      this.animations.get(item)?.cancel()
      const dx = beforeX - item.offsetLeft,
        dy = beforeY - item.offsetTop
      if (!dx && !dy) continue
      this.animations.set(
        item,
        item.animate(
          [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }],
          { duration: 140, easing: 'ease-out' },
        ),
      )
    }
  }
  private finish(): void {
    const state = this.state
    if (!state) return
    const { from, to } = state
    this.cancel()
    this.commit(from, to)
  }
  cancel(): void {
    const state = this.state
    this.state = null
    if (!state) return
    if (state.pointer !== null && state.handle.hasPointerCapture(state.pointer))
      state.handle.releasePointerCapture(state.pointer)
    state.handle.draggable = true
    state.placeholder.remove()
    state.ghost?.remove()
    state.item.removeClass('is-dragging')
    this.strip.removeClass('is-reordering')
    for (const animation of this.animations.values()) animation.cancel()
    this.animations.clear()
  }
  destroy(): void {
    this.cancel()
    this.strip.removeEventListener('dragover', this.over)
    this.strip.removeEventListener('drop', this.drop)
  }
}
