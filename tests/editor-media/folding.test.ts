import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { findFoldGroup } from '../../src/editor-media/folding'

test('finds the same heading group throughout its text and stops at the next heading', () => {
  const text = '# First\n\nParagraph text.\n\n# Next\nOther body.'
  assert.deepEqual(findFoldGroup(text, 2), { start: 0, end: 2 })
  assert.deepEqual(findFoldGroup(text, 0), { start: 0, end: 2 })
  assert.deepEqual(findFoldGroup(text, 5), { start: 4, end: 5 })
})
test('finds nested headings and ignores heading markers inside fences', () => {
  assert.deepEqual(findFoldGroup('# A\n## B\nText\n```md\n# Example\n```\n# C\nEnd', 4), {
    start: 1,
    end: 5,
  })
})
test('finds list/checklist groups from each item without folding a previous unrelated list', () => {
  const text = '- [ ] One\n- [ ] Two\n- [ ] Three\n\nOutside paragraph.'
  for (const line of [0, 1, 2]) assert.deepEqual(findFoldGroup(text, line), { start: 0, end: 2 })
  assert.equal(findFoldGroup(text, 4), null)
})
test('prefers the inner list group and retains an outer parent on its own line', () => {
  const text = '- Parent\n  - First\n  - Second\n- Other\n\nParagraph'
  assert.deepEqual(findFoldGroup(text, 0), { start: 0, end: 2 })
  assert.deepEqual(findFoldGroup(text, 2), { start: 1, end: 2 })
})
test('does not fold standalone text or fenced list examples', () => {
  assert.equal(findFoldGroup('Plain text', 0), null)
  assert.equal(findFoldGroup('```md\n- One\n- Two\n```', 2), null)
})
