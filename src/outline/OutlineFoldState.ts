import { EditorState, TransactionSpec } from '@codemirror/state'
import { foldable, foldEffect, foldedRanges, unfoldEffect } from '@codemirror/language'

/** Mirror a heading fold without changing text or revealing a caret hidden by the fold. */
export function outlineFoldTransaction(
  state: EditorState,
  line: number,
  collapsed: boolean,
): TransactionSpec | null {
  if (line < 0 || line >= state.doc.lines) return null
  const heading = state.doc.line(line + 1)
  let existing: { from: number; to: number } | null = null
  foldedRanges(state).between(heading.from, heading.to, (from, to) => {
    if (state.doc.lineAt(from).number === heading.number) existing = { from, to }
  })
  const range = existing ?? foldable(state, heading.from, heading.to)
  if (!range || Boolean(existing) === collapsed) return null
  const hideSelection =
    collapsed &&
    state.selection.ranges.some(
      (selection) => selection.from <= range.to && selection.to > range.from,
    )
  return {
    effects: collapsed ? foldEffect.of(range) : unfoldEffect.of(range),
    ...(hideSelection ? { selection: { anchor: heading.to } } : {}),
  }
}
