import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planLayoutInsertion } from '../../src/editor-media/layout/insertion'
import { emptyLayout, layoutBlock, parseLayoutImage } from '../../src/editor-media/layout/model'

const block = '```seam-layout\ntype: grid\n\n![[a.png]]\n![[b.png]]\n```\n'
const selected = [{ path: 'a.png' }, { path: 'b.png' }]
function apply(
  text: string,
  from = text.length,
  to = from,
  entries = selected,
  content = block,
  identity?: (path: string) => string,
) {
  const changes = planLayoutInsertion(text, entries, from, to, content, identity)
  for (let i = 1; i < changes.length; i++) assert.ok(changes[i - 1].to <= changes[i].from)
  let result = text
  for (const change of changes.slice().reverse())
    result = result.slice(0, change.from) + change.text + result.slice(change.to)
  return result
}

test('moves the selected note images into one layout and keeps preceding prose', () => {
  const source = 'Paragraph with words.\n\n![[a.png]]\n![[b.png]]\n'
  assert.equal(apply(source), 'Paragraph with words.\n\n' + block)
})

test('only removes selected images and preserves surrounding inline text and emoji offsets', () => {
  const source = 'Before 😀 ![[a.png|First|400]] after.\n![[keep.png|Keep]]\n\n'
  assert.equal(
    apply(source, source.length, source.length, [{ path: 'a.png' }]),
    'Before 😀  after.\n![[keep.png|Keep]]\n\n' + block,
  )
})

test('resolves vault aliases and Markdown escapes to the selected image while retaining new captions', () => {
  const source = '![Old](<Images/a photo(2).png>)\n![[a photo(2).png|Old alias]]\n'
  const identity = (path: string) =>
    path.endsWith('a photo(2).png') ? 'Images/a photo(2).png' : path
  const image = parseLayoutImage('![[Images/a photo(2).png|New caption]]')!
  const layout = { ...emptyLayout(), images: [image] }
  const content = layoutBlock(layout, () => 'type: grid\n')
  assert.equal(apply(source, source.length, source.length, [image], content, identity), content)
})

test('moves signed URLs without changing their query strings', () => {
  const url = 'https://example.com/a%2Fb(2).png?signature=a%26b%3D'
  const source = `![Old](<${url}> "Title")\n`
  const content = '```seam-layout\ntype: flex\n\n' + `![New](<${url}>)\n` + '```\n'
  assert.equal(apply(source, source.length, source.length, [{ path: url }], content), content)
})

test('leaves existing layouts, fenced examples, frontmatter, comments, inline code and escaped syntax intact', () => {
  const untouched =
    [
      '---',
      'example: "![[a.png]]"',
      '---',
      '````md',
      '![[a.png]]',
      '```',
      '````',
      '~~~seam-layout',
      'type: grid',
      '![[a.png]]',
      '~~~',
      'Inline `![[a.png]]` example and \\![[a.png]].',
      '    ![[a.png]]',
      '<!-- comment',
      '![[a.png]]',
      '-->',
      '%% comment',
      '![[a.png]]',
      '%%',
    ].join('\n') + '\n'
  assert.equal(apply(untouched + '![[a.png]]\n'), untouched + block)
})

test('inserting inside an image or across selected image lines produces nonoverlapping replacements', () => {
  const source = 'Before\n\n![[a.png]]\n![[b.png]]\n\nAfter'
  const from = source.indexOf('a.png') + 2
  const to = source.indexOf('b.png') + 2
  assert.equal(apply(source, from, to), 'Before\n\n' + block + '\nAfter')
  assert.equal(apply('![[a.png]]', 4, 4, [{ path: 'a.png' }]), block)
})

test('inserting before the images handles removals after the insertion point', () => {
  const source = 'Title\n\n![[a.png]]\n![[keep.png]]\n'
  assert.equal(apply(source, 0, 0, [{ path: 'a.png' }]), block + 'Title\n\n![[keep.png]]\n')
})

test('handles repeated images, image-only lines with multiple embeds, and CRLF notes', () => {
  assert.equal(apply('![[a.png]] ![[b.png]]\n![[a.png]]\n'), block)
  const source = 'Text\r\n\r\n![[a.png]]\r\n![[b.png]]\r\n'
  assert.equal(apply(source), 'Text\r\n\r\n' + block.replace(/\n/g, '\r\n'))
})

test('empty selections only insert the block and retain the previous text selection behavior', () => {
  assert.equal(apply('Before selected after', 7, 15, []), 'Before \n' + block + ' after')
  assert.equal(apply('![[a.png]]\n', 0, 0, []), block + '![[a.png]]\n')
})

test('protects multiline code spans and resumes after an indented comment terminator', () => {
  const example = 'An inline example `starts here\n![[a.png]]\nand ends` here.\n<!--\n    -->\n'
  assert.equal(apply(example + '![[a.png]]\n'), example + block)
})
