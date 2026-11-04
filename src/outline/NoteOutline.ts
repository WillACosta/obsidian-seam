import { App, TFile } from 'obsidian'
import { PaletteItem } from '../types'

/** Use Obsidian's Markdown metadata so fenced code and Setext headings follow the native outline. */
export function getNoteOutline(app: App, file: TFile): PaletteItem[] {
  const leaf = app.workspace.getLeaf(false)
  return (app.metadataCache.getFileCache(file)?.headings ?? []).map((heading) => ({
    id: `heading-${heading.position.start.line}`,
    title: heading.heading,
    description: '',
    type: 'heading',
    headingLevel: heading.level,
    action: async () => {
      await leaf.openFile(file, {
        active: true,
        eState: { line: heading.position.start.line, focus: true },
      })
    },
  }))
}

/** Headings own following entries until the next heading at the same or higher level. */
export function outlineParentIds(items: PaletteItem[]): Set<string> {
  const parents = new Set<string>()
  for (let index = 0; index + 1 < items.length; index++)
    if ((items[index + 1].headingLevel ?? 0) > (items[index].headingLevel ?? 0))
      parents.add(items[index].id)
  return parents
}

/** During filtering, a folded ancestor only hides results when that ancestor also matches. */
export function visibleOutlineItems(
  items: PaletteItem[],
  collapsed: ReadonlySet<string>,
  query: string,
): PaletteItem[] {
  const term = query.trim().toLowerCase()
  let hiddenBelow: number | null = null
  return items.filter((item) => {
    const level = item.headingLevel ?? 0
    if (hiddenBelow !== null && level <= hiddenBelow) hiddenBelow = null
    const matches = !term || item.title.toLowerCase().includes(term)
    const visible = hiddenBelow === null && matches
    if (visible && collapsed.has(item.id)) hiddenBelow = level
    return visible
  })
}
