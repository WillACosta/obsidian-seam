import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { dragInsertionIndex } from '../../src/editor-media/layout/drag'

test('drag insertion slots follow the remaining thumbnail midpoints', () => {
  assert.equal(dragInsertionIndex(20, [45, 145, 245]), 0)
  assert.equal(dragInsertionIndex(100, [45, 145, 245]), 1)
  assert.equal(dragInsertionIndex(200, [45, 145, 245]), 2)
  assert.equal(dragInsertionIndex(400, [45, 145, 245]), 3)
  assert.equal(dragInsertionIndex(50, []), 0)
})
test('drag insertion slots mirror in right-to-left strips', () => {
  assert.equal(dragInsertionIndex(300, [245, 145, 45], true), 0)
  assert.equal(dragInsertionIndex(200, [245, 145, 45], true), 1)
  assert.equal(dragInsertionIndex(100, [245, 145, 45], true), 2)
  assert.equal(dragInsertionIndex(0, [245, 145, 45], true), 3)
})
