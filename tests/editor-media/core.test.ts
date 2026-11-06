import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { sortTasks, images, parseEmbed, setCaption, validUrl } from '../../src/editor-media/core'

test('validates web URLs and configuration', () => {
  assert.equal(validUrl('javascript:alert(1)'), null)
  assert.equal(validUrl('https://user:pass@example.com'), null)
  assert.deepEqual(
    parseEmbed('https://example.com', () => null),
    {
      url: 'https://example.com/',
      style: 'card',
      title: undefined,
      description: undefined,
      image: undefined,
    },
  )
  assert.equal(
    parseEmbed('bad', () => ({ url: 'file:///test' })),
    null,
  )
  assert.equal(
    parseEmbed('yaml', () => ({ url: 'https://example.com', style: 'compact' }))?.style,
    'compact',
  )
})
test('edits captions without losing wiki image sizes', () => {
  const found = images('![[image.png|Landscape|400]] and ![Old](image.png)')
  assert.equal(found.length, 2)
  assert.equal(found[0].caption, 'Landscape')
  assert.equal(setCaption(found[0].raw, 'New'), '![[image.png|New|400]]')
  assert.equal(setCaption(found[1].raw, 'New'), '![New](image.png)')
})

test('sorts task blocks without adding blank lines or changing fenced examples', () => {
  assert.equal(sortTasks('- [x] Done\n  child\n- [ ] Open'), '- [ ] Open\n- [x] Done\n  child')
  assert.equal(
    sortTasks('```md\n- [x] Done\n- [ ] Open\n```'),
    '```md\n- [x] Done\n- [ ] Open\n```',
  )
})

test('newly completed tasks move after previously completed tasks', () => {
  assert.equal(sortTasks('- [x] New\n- [x] Old', ['- [x] New']), '- [x] Old\n- [x] New')
})

test('image grid navigation follows rows and clamps an incomplete final row', async () => {
  const { gridNeighbor } = await import('../../src/editor-media/navigation')
  assert.equal(gridNeighbor(1, 8, 3, 'ArrowDown'), 4)
  assert.equal(gridNeighbor(5, 8, 3, 'ArrowDown'), 7)
  assert.equal(gridNeighbor(7, 8, 3, 'ArrowUp'), 4)
  assert.equal(gridNeighbor(0, 8, 3, 'ArrowLeft'), 0)
  assert.equal(gridNeighbor(6, 8, 3, 'ArrowRight'), 7)
  assert.equal(gridNeighbor(0, 0, 3, 'ArrowDown'), -1)
})

test('Back shortcut uses the platform modifier without stealing text-editing keys', async () => {
  const { isBackShortcut } = await import('../../src/editor-media/navigation')
  const event = { key: '[', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false }
  assert.equal(isBackShortcut(event, true), true)
  assert.equal(isBackShortcut(event, false), false)
  assert.equal(isBackShortcut({ ...event, metaKey: false, ctrlKey: true }, false), true)
  for (const key of ['Backspace', 'ArrowLeft', 'a'])
    assert.equal(isBackShortcut({ ...event, key }, true), false)
  assert.equal(isBackShortcut({ ...event, altKey: true }, true), false)
  assert.equal(isBackShortcut({ ...event, shiftKey: true }, true), false)
})
