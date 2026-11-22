import { EditorView, ViewPlugin } from '@codemirror/view'
import { foldedRanges } from '@codemirror/language'
import { editorInfoField, TFile } from 'obsidian'
import { outlineFoldTransaction } from './OutlineFoldState'

/** Public CodeMirror registrations connect Palette headings with every open editor of the note. */
export class OutlineFolding {
  private views = new Set<EditorView>()
  private requested = new Map<string, Map<number, boolean>>()
  readonly extension = ViewPlugin.define((view) => {
    this.views.add(view)
    let path = ''
    let alive = true
    const sync = () => {
      const next = view.state.field(editorInfoField, false)?.file?.path ?? ''
      if (!next || next === path) return
      path = next
      queueMicrotask(() => {
        if (!alive || view.state.field(editorInfoField, false)?.file?.path !== next) return
        for (const [line, collapsed] of this.requested.get(next) ?? [])
          this.apply(view, line, collapsed)
        this.requested.delete(next)
      })
    }
    sync()
    return {
      update: sync,
      destroy: () => {
        alive = false
        this.views.delete(view)
      },
    }
  })
  private apply(view: EditorView, line: number, collapsed: boolean): void {
    const transaction = outlineFoldTransaction(view.state, line, collapsed)
    if (transaction) view.dispatch(transaction)
  }
  collapsedLines(file: TFile): Set<number> {
    const result = new Set<number>()
    for (const view of this.views) {
      if (view.state.field(editorInfoField, false)?.file?.path !== file.path) continue
      foldedRanges(view.state).between(0, view.state.doc.length, (from) => {
        result.add(view.state.doc.lineAt(from).number - 1)
      })
    }
    for (const [line, collapsed] of this.requested.get(file.path) ?? []) {
      if (collapsed) result.add(line)
      else result.delete(line)
    }
    return result
  }
  setCollapsed(file: TFile, line: number, collapsed: boolean): void {
    let matched = false
    for (const view of this.views)
      if (view.state.field(editorInfoField, false)?.file?.path === file.path) {
        matched = true
        this.apply(view, line, collapsed)
      }
    if (matched) this.requested.delete(file.path)
    else {
      const requests = this.requested.get(file.path) ?? new Map<number, boolean>()
      requests.set(line, collapsed)
      this.requested.set(file.path, requests)
    }
  }
}
