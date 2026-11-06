import { setCaption, validUrl } from '../core'

export type LayoutImage = {
  raw: string
  path: string
  caption: string
  crop?: boolean
  fit?: 'cover' | 'contain'
}
export type Layout = {
  type: 'grid' | 'flex' | 'masonry'
  columns: number | 'auto'
  gap: number
  height: number | 'auto'
  fit: 'cover' | 'contain'
  radius?: number
  caption?: string
  captions: boolean
  images: LayoutImage[]
}
export const emptyLayout = (): Layout => ({
  type: 'grid',
  columns: 'auto',
  gap: 8,
  height: 'auto',
  fit: 'cover',
  captions: false,
  images: [],
})
export const imageExtension = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i

export function parseLayoutImage(raw: string): LayoutImage | null {
  const wiki = /^!\[\[([^\]\n]+)\]\]$/.exec(raw.trim())
  if (wiki) {
    const [path, ...aliases] = wiki[1].split('|')
    if (!path.trim()) return null
    return {
      raw: raw.trim(),
      path: path.trim(),
      caption: aliases.find((alias) => !/^\d+(?:x\d+)?$/.test(alias)) || '',
    }
  }
  const md = /^!\[([^\]\n]*)\]\((.+)\)$/.exec(raw.trim())
  if (!md) return null
  let path = md[2].trim().replace(/\s+["'][^"']*["']$/, '')
  if (path.startsWith('<') && path.endsWith('>')) path = path.slice(1, -1)
  path = path.replace(/\\([() ])/g, '$1')
  // URL escapes can be significant in signed paths and query strings; decode vault names only.
  if (!validUrl(path))
    try {
      path = decodeURIComponent(path)
    } catch {
      /* Keep literal percent characters in vault names. */
    }
  if (!path || /^(?:javascript|data|file):/i.test(path)) return null
  return { raw: raw.trim(), path, caption: md[1] }
}

export function layoutImageFromPath(value: string): LayoutImage | null {
  const path = value.trim()
  const url = validUrl(path)
  if (url) return parseLayoutImage(`![](<${url}>)`)
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || /[\[\]\r\n|]/.test(path)) return null
  return imageExtension.test(path) ? parseLayoutImage(`![[${path}]]`) : null
}

/** Include actual image syntax and layout images, excluding examples in other fenced code. */
export function noteLayoutImages(text: string): LayoutImage[] {
  const result: LayoutImage[] = []
  const seen = new Set<string>()
  let fence: { marker: string; length: number; layout: boolean } | null = null
  for (const line of text.split('\n')) {
    const marker = /^\s*(`{3,}|~{3,})(.*)$/.exec(line)
    if (marker) {
      if (!fence)
        fence = {
          marker: marker[1][0],
          length: marker[1].length,
          layout: marker[2].trim() === 'seam-layout',
        }
      else if (
        marker[1][0] === fence.marker &&
        marker[1].length >= fence.length &&
        !marker[2].trim()
      )
        fence = null
      continue
    }
    if (fence && !fence.layout) continue
    const start = /!\[\[|!\[[^\]\n]*\]\(/g
    let match: RegExpExecArray | null
    while ((match = start.exec(line))) {
      let end = -1
      if (match[0] === '![[') {
        const close = line.indexOf(']]', start.lastIndex)
        if (close >= 0) end = close + 2
      } else {
        let depth = 1
        let angle = false
        for (let i = start.lastIndex; i < line.length; i++) {
          if (line[i] === '\\') {
            i++
            continue
          }
          if (line[i] === '<') angle = true
          else if (line[i] === '>') angle = false
          else if (!angle && line[i] === '(') depth++
          else if (!angle && line[i] === ')' && --depth === 0) {
            end = i + 1
            break
          }
        }
      }
      if (end < 0) continue
      start.lastIndex = end
      const image = parseLayoutImage(line.slice(match.index, end))
      if (
        !image ||
        (!validUrl(image.path) && !imageExtension.test(image.path)) ||
        seen.has(image.path)
      )
        continue
      seen.add(image.path)
      result.push(image)
    }
  }
  return result
}
function number(value: unknown, fallback: number, name: string, max: number, min = 0): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`${name} must be between ${min} and ${max}.`)
  return value
}
export function parseLayout(source: string, yaml: (text: string) => unknown): Layout {
  const lines = source.split('\n')
  const first = lines.findIndex((line) => /^\s*!\[/.test(line))
  const header = first < 0 ? source : lines.slice(0, first).join('\n')
  const raw = yaml(header.trim()) ?? {}
  if (typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('Layout options must be a YAML mapping.')
  const data = raw as Record<string, unknown>
  const layout = emptyLayout()
  if (data.type !== undefined && !['grid', 'flex', 'masonry'].includes(String(data.type)))
    throw new Error('Unknown layout type.')
  layout.type = (data.type as Layout['type']) || 'grid'
  if (data.columns !== undefined && data.columns !== 'auto') {
    layout.columns = number(data.columns, 3, 'Columns', Number.MAX_SAFE_INTEGER, 1)
    if (!Number.isInteger(layout.columns)) throw new Error('Columns must be an integer or auto.')
  }
  layout.gap = number(data.gap, 8, 'Gap', 128)
  layout.height =
    data.height === undefined || data.height === 'auto'
      ? 'auto'
      : number(data.height, 180, 'Height', 2000, 16)
  if (data.fit !== undefined && data.fit !== 'cover' && data.fit !== 'contain')
    throw new Error('Image fit must be cover or contain.')
  layout.fit = data.fit === 'contain' ? 'contain' : 'cover'
  if (data.radius !== undefined) layout.radius = number(data.radius, 0, 'Radius', 256)
  if (typeof data.caption === 'string') layout.caption = data.caption
  if (data.captions !== undefined && typeof data.captions !== 'boolean')
    throw new Error('Captions must be true or false.')
  layout.captions = data.captions === true
  if (first >= 0)
    for (const line of lines.slice(first)) {
      if (!line.trim()) continue
      const image = parseLayoutImage(line)
      if (!image) throw new Error(`Invalid image syntax: ${line.slice(0, 80)}`)
      layout.images.push(image)
    }
  if (Array.isArray(data.imageOptions))
    for (const option of data.imageOptions) {
      if (!option || typeof option !== 'object') continue
      const item = option as Record<string, unknown>
      const image =
        typeof item.index === 'number' && Number.isInteger(item.index)
          ? layout.images[item.index]
          : undefined
      if (!image) continue
      if (typeof item.crop === 'boolean') image.crop = item.crop
      if (item.fit === 'cover' || item.fit === 'contain') image.fit = item.fit
    }
  return layout
}
export function layoutSource(layout: Layout, yaml: (data: unknown) => string): string {
  const { images, ...options } = layout
  const imageOptions = images.flatMap((image, index) =>
    image.crop !== undefined || image.fit
      ? [
          {
            index,
            ...(image.crop !== undefined ? { crop: image.crop } : {}),
            ...(image.fit ? { fit: image.fit } : {}),
          },
        ]
      : [],
  )
  const header = yaml({ ...options, ...(imageOptions.length ? { imageOptions } : {}) }).trimEnd()
  return (
    header + '\n' + (images.length ? '\n' + images.map((image) => image.raw).join('\n') + '\n' : '')
  )
}
export function layoutBlock(layout: Layout, yaml: (data: unknown) => string): string {
  return '```seam-layout\n' + layoutSource(layout, yaml) + '```\n'
}
export function captionImage(image: LayoutImage, caption: string): void {
  image.raw = setCaption(image.raw, caption)
  image.caption = parseLayoutImage(image.raw)?.caption || ''
}
export function moveImage(images: LayoutImage[], from: number, to: number): void {
  if (from < 0 || to < 0 || from >= images.length || to >= images.length || from === to) return
  images.splice(to, 0, images.splice(from, 1)[0])
}
export type LayoutBlock = { start: number; end: number; source: string; line: number; raw: string }
export function layoutBlocks(text: string): LayoutBlock[] {
  const lines = text.split('\n')
  const blocks: LayoutBlock[] = []
  let offset = 0
  for (let i = 0; i < lines.length; i++) {
    const fence = /^\s*(`{3,}|~{3,})([^\n]*)$/.exec(lines[i])
    if (!fence) {
      offset += lines[i].length + 1
      continue
    }
    const start = offset
    const line = i
    const marker = fence[1][0]
    const length = fence[1].length
    let end = i + 1
    while (end < lines.length && !new RegExp(`^\\s*${marker}{${length},}\\s*$`).test(lines[end]))
      end++
    if (end >= lines.length) break
    const raw = lines.slice(i, end + 1).join('\n')
    if (fence[2].trim() === 'seam-layout')
      blocks.push({
        start,
        end: start + raw.length,
        source: lines.slice(i + 1, end).join('\n'),
        line,
        raw,
      })
    offset += raw.length + 1
    i = end
  }
  return blocks
}
export function replaceLayoutBlock(
  current: string,
  anchor: LayoutBlock,
  replacement: string,
): string {
  if (current.slice(anchor.start, anchor.end) !== anchor.raw)
    throw new Error('This note changed. Reopen the layout before saving.')
  return current.slice(0, anchor.start) + replacement.trimEnd() + current.slice(anchor.end)
}
