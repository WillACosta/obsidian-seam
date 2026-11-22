import { EditorView } from '@codemirror/view'
import { Extension, Transaction } from '@codemirror/state'
import { editorInfoField, TFile } from 'obsidian'
import { GlobalStatistics } from './GlobalStatistics'
import { grossWordsAdded, SESSION_GAP_MS, TextChange } from './WritingActivity'

/** Shared across editors in this installation; never persists clipboard text or rewrites history. */
export class WritingActivityMoves {
  private cut: { text: string; at: number } | null = null
  private counted = new WeakMap<Transaction, number>()

  clear(): void {
    this.cut = null
  }

  count(
    transaction: Transaction,
    changes: TextChange[],
    composing: boolean,
    now = Date.now(),
  ): number {
    const previous = this.counted.get(transaction)
    if (previous !== undefined) return previous
    const before = transaction.startState.doc.toString()
    const after = transaction.newDoc.toString()
    const cut = this.cut
    this.clear()
    let moved = false
    if (transaction.isUserEvent('delete.cut')) {
      const text = changes.map((change) => before.slice(change.fromA, change.toA)).join('\n')
      if (text && changes.every((change) => change.fromB === change.toB))
        this.cut = { text, at: now }
    } else if (transaction.isUserEvent('input.paste') && cut && now - cut.at <= SESSION_GAP_MS) {
      const text = changes.map((change) => after.slice(change.fromB, change.toB)).join('\n')
      moved = text === cut.text
    }
    const words = moved ? 0 : grossWordsAdded(before, after, changes, composing)
    this.counted.set(transaction, words)
    return words
  }
}

/** Public CodeMirror transactions distinguish direct user input from Vault imports/sync/plugin edits. */
export function writingActivityExtension(statistics: GlobalStatistics): Extension {
  const compositions = new WeakMap<EditorView, boolean>()
  const moves = new WritingActivityMoves()
  return [
    EditorView.domEventHandlers({
      copy: () => {
        moves.clear()
      },
      compositionstart: (_event, view) => {
        compositions.set(view, false)
      },
      compositionend: (_event, view) => {
        compositions.delete(view)
      },
    }),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return
      const file = update.state.field(editorInfoField, false)?.file
      if (!file || file.extension !== 'md') return
      const composing = observeWritingTransactions(
        statistics,
        file,
        update.transactions,
        update.view.hasFocus,
        update.state.doc.toString(),
        compositions.get(update.view) ?? false,
        moves,
      )
      compositions.set(update.view, composing)
    }),
  ]
}

export function observeWritingTransactions(
  statistics: Pick<GlobalStatistics, 'updateEditor' | 'recordEdit'>,
  file: TFile,
  transactions: readonly Transaction[],
  focused: boolean,
  currentText: string,
  continuingComposition = false,
  moves?: WritingActivityMoves,
): boolean {
  statistics.updateEditor(file, currentText)
  for (const transaction of transactions) {
    if (!transaction.docChanged) continue
    if (transaction.startState.doc.eq(transaction.newDoc)) continue
    if (
      !focused ||
      transaction.annotation(Transaction.remote) ||
      (!transaction.isUserEvent('input') &&
        !transaction.isUserEvent('delete') &&
        !transaction.isUserEvent('move'))
    ) {
      if (transaction.isUserEvent('undo') || transaction.isUserEvent('redo')) moves?.clear()
      continuingComposition = false
      continue
    }
    const composing = transaction.isUserEvent('input.type.compose')
    const changes: TextChange[] = []
    transaction.changes.iterChanges((fromA, toA, fromB, toB) =>
      changes.push({ fromA, toA, fromB, toB }),
    )
    statistics.recordEdit(
      file,
      moves
        ? moves.count(transaction, changes, composing && continuingComposition)
        : grossWordsAdded(
            transaction.startState.doc.toString(),
            transaction.newDoc.toString(),
            changes,
            composing && continuingComposition,
          ),
      transaction,
    )
    continuingComposition = composing
  }
  return continuingComposition
}
