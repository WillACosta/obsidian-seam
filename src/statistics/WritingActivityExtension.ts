import { EditorView } from '@codemirror/view'
import { Extension, Transaction } from '@codemirror/state'
import { editorInfoField, TFile } from 'obsidian'
import { GlobalStatistics } from './GlobalStatistics'
import { grossWordsAdded, TextChange } from './WritingActivity'

/** Public CodeMirror transactions distinguish direct user input from Vault imports/sync/plugin edits. */
export function writingActivityExtension(statistics: GlobalStatistics): Extension {
  const compositions = new WeakMap<EditorView, boolean>()
  return [
    EditorView.domEventHandlers({
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
      grossWordsAdded(
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
