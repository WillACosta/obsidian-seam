import { App, MarkdownView, TFile } from 'obsidian'

export interface NoteStatistics {
  title: string
  path: string
  words: number
  characters: number
  paragraphs: number
  readMinutes: number
  modified: number
  created: number
}

/** Count the full note text. Paragraphs are nonempty blocks separated by blank lines. */
export function countNoteText(
  content: string,
): Pick<NoteStatistics, 'words' | 'characters' | 'paragraphs' | 'readMinutes'> {
  const words =
    content.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’\-][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu)
      ?.length ?? 0
  const paragraphs = content.trim()
    ? content.trim().split(/\r?\n[\t ]*\r?\n(?:[\t ]*\r?\n)*/).length
    : 0
  return {
    words,
    characters: Array.from(content).length,
    paragraphs,
    readMinutes: Math.ceil(words / 200),
  }
}

/** Prefer the active editor buffer, including unsaved changes; never write the note. */
export async function readNoteStatistics(app: App, file: TFile): Promise<NoteStatistics> {
  const view = app.workspace.getActiveViewOfType(MarkdownView)
  const content =
    view && view.file?.path === file.path && view.getMode() === 'source'
      ? view.editor.getValue()
      : await app.vault.cachedRead(file)
  return {
    title: file.basename,
    path: file.path,
    ...countNoteText(content),
    modified: file.stat.mtime,
    created: file.stat.ctime,
  }
}
