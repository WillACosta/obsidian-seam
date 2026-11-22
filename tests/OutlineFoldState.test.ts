import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EditorState } from '@codemirror/state'
import { codeFolding, foldService, foldedRanges } from '@codemirror/language'
import { outlineFoldTransaction } from '../src/outline/OutlineFoldState'

function fixture() {
  return EditorState.create({
    doc: '# Parent\ntext\n## Child\nbody\n# Next',
    selection: { anchor: 12 },
    extensions: [
      codeFolding(),
      foldService.of((state, from) => {
        const line = state.doc.lineAt(from)
        if (line.number === 1) return { from: line.to, to: state.doc.line(4).to }
        if (line.number === 3) return { from: line.to, to: state.doc.line(4).to }
        return null
      }),
    ],
  })
}
const ranges = (state: EditorState) => {
  const result: number[] = []
  foldedRanges(state).between(0, state.doc.length, (from) => result.push(from))
  return result
}

test('outline collapse mirrors the editor without changing text or leaving the caret hidden', () => {
  let state = fixture()
  const before = state.doc.toString()
  const transaction = outlineFoldTransaction(state, 0, true)!
  state = state.update(transaction).state
  assert.deepEqual(ranges(state), [state.doc.line(1).to])
  assert.equal(state.selection.main.head, state.doc.line(1).to)
  assert.equal(state.doc.toString(), before)
  assert.equal(outlineFoldTransaction(state, 0, true), null)
  state = state.update(outlineFoldTransaction(state, 0, false)!).state
  assert.deepEqual(ranges(state), [])
})

test('unfolding a parent preserves the independently folded child and unrelated caret', () => {
  let state = fixture().update({ selection: { anchor: 0 } }).state
  state = state.update(outlineFoldTransaction(state, 2, true)!).state
  state = state.update(outlineFoldTransaction(state, 0, true)!).state
  state = state.update(outlineFoldTransaction(state, 0, false)!).state
  assert.deepEqual(ranges(state), [state.doc.line(3).to])
  assert.equal(state.selection.main.head, 0)
  assert.equal(outlineFoldTransaction(state, -1, true), null)
  assert.equal(outlineFoldTransaction(state, 99, true), null)
})
