export type Embed = {
  url: string
  style: 'card' | 'compact' | 'minimal'
  title?: string
  description?: string
  image?: string
}
export function validUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}
export function parseEmbed(source: string, parseYaml: (text: string) => unknown): Embed | null {
  const raw = source.trim()
  let data: Record<string, unknown>
  if (validUrl(raw)) data = { url: raw }
  else {
    try {
      const parsed = parseYaml(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      data = parsed as Record<string, unknown>
    } catch {
      return null
    }
  }
  const url = typeof data.url === 'string' ? validUrl(data.url) : null
  if (!url) return null
  const style = data.style === 'compact' || data.style === 'minimal' ? data.style : 'card'
  return {
    url,
    style,
    title: typeof data.title === 'string' ? data.title : undefined,
    description: typeof data.description === 'string' ? data.description : undefined,
    image: typeof data.image === 'string' ? data.image : undefined,
  }
}
export type ImageMatch = { start: number; end: number; raw: string; caption: string }
export function images(text: string): ImageMatch[] {
  const start = /!\[\[|!\[[^\]\n]*\]\(/g
  const result: ImageMatch[] = []
  let match: RegExpExecArray | null
  while ((match = start.exec(text))) {
    let end = -1
    if (match[0] === '![[') {
      const close = text.indexOf(']]', start.lastIndex)
      if (close >= 0 && !text.slice(start.lastIndex, close).includes('\n')) end = close + 2
    } else {
      let depth = 1
      let angle = false
      for (let i = start.lastIndex; i < text.length && text[i] !== '\n'; i++) {
        if (text[i] === '\\') {
          i++
          continue
        }
        if (text[i] === '<') angle = true
        else if (text[i] === '>') angle = false
        else if (!angle && text[i] === '(') depth++
        else if (!angle && text[i] === ')' && --depth === 0) {
          end = i + 1
          break
        }
      }
    }
    if (end < 0) continue
    const raw = text.slice(match.index, end)
    const wiki = raw.startsWith('![[')
    const caption = wiki
      ? (raw
          .slice(3, -2)
          .split('|')
          .slice(1)
          .find((p) => !/^\d+(?:x\d+)?$/.test(p)) ?? '')
      : (/^!\[([^\]]*)\]/.exec(raw)?.[1] ?? '')
    result.push({ start: match.index, end, raw, caption })
    start.lastIndex = end
  }
  return result
}
export function setCaption(raw: string, caption: string): string {
  const clean = caption.replace(/[\]\n\r|]/g, ' ').trim()
  if (raw.startsWith('![[')) {
    const parts = raw.slice(3, -2).split('|')
    const size = parts.slice(1).find((p) => /^\d+(?:x\d+)?$/.test(p))
    return `![[${parts[0]}${clean ? '|' + clean : ''}${size ? '|' + size : ''}]]`
  }
  return raw.replace(/^!\[[^\]]*\]/, `![${clean}]`)
}

export function sortTasks(text: string, newlyChecked: string[] = []): string {
  const lines = text.split('\n')
  let fenced = false
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      fenced = !fenced
      continue
    }
    if (fenced) continue
    const first = lines[i].match(/^(\s*)(?:[-*+]|\d+\.) \[[ xX]\] /)
    if (!first) continue
    const indent = first[1].length
    const blocks: string[][] = []
    let end = i
    while (end < lines.length) {
      const task = lines[end].match(/^(\s*)(?:[-*+]|\d+\.) \[[ xX]\] /)
      if (!task || task[1].length !== indent) break
      const block = [lines[end++]]
      while (
        end < lines.length &&
        lines[end].trim() &&
        (lines[end].match(/^\s*/)?.[0].length ?? 0) > indent
      )
        block.push(lines[end++])
      blocks.push(block)
    }
    blocks.sort(
      (a, b) =>
        Number(/\[[xX]\]/.test(a[0])) +
        Number(newlyChecked.includes(a[0])) -
        (Number(/\[[xX]\]/.test(b[0])) + Number(newlyChecked.includes(b[0]))),
    )
    lines.splice(i, end - i, ...blocks.flat())
    i = end - 1
  }
  return lines.join('\n')
}
