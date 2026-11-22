import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  emptyLayout,
  parseLayout,
  parseLayoutImage,
  layoutSource,
  layoutBlock,
  layoutBlocks,
  replaceLayoutBlock,
  moveImage,
  captionImage,
  noteLayoutImages,
  layoutImageFromPath,
} from '../../src/editor-media/layout/model'

test('collects current-note images with captions, parentheses, and layout images but excludes other code', () => {
  const text = [
    '![[Images/one.png|First|400]] and ![Second](<Images/a photo (2).jpg>)',
    '![[Images/one.png]]',
    '![Third](Images/photo\\(3\\).png)',
    '![Remote](https://example.com/image.png?size=2)',
    '![[Other note]] ![[document.pdf]]',
    '````markdown',
    '![[example.png]]',
    '```seam-layout',
    '![[nested-example.png]]',
    '```',
    '````',
    '~~~seam-layout',
    'type: grid',
    '![[Images/layout.webp|Layout image]]',
    '~~~',
  ].join('\n')
  const images = noteLayoutImages(text)
  assert.deepEqual(
    images.map((image) => image.path),
    [
      'Images/one.png',
      'Images/a photo (2).jpg',
      'Images/photo(3).png',
      'https://example.com/image.png?size=2',
      'Images/layout.webp',
    ],
  )
  assert.equal(images[0].caption, 'First')
  assert.equal(images[4].caption, 'Layout image')
})

test('current-note images support multiple Markdown embeds and an empty note', () => {
  assert.deepEqual(noteLayoutImages('No images here.'), [])
  assert.deepEqual(
    noteLayoutImages('![One](Images/a(1).png) ![Two](Images/b.png)').map((image) => image.path),
    ['Images/a(1).png', 'Images/b.png'],
  )
})

test('manual image entry preserves valid vault paths and web URLs without accepting other schemes', () => {
  const local = layoutImageFromPath(' Images/a photo (1).png ')
  assert.equal(local?.path, 'Images/a photo (1).png')
  assert.equal(parseLayoutImage(local!.raw)?.path, local!.path)
  const remote = layoutImageFromPath('https://example.com/photo.jpg?size=400&crop=true')
  assert.equal(remote?.path, 'https://example.com/photo.jpg?size=400&crop=true')
  assert.equal(parseLayoutImage(remote!.raw)?.path, remote!.path)
  const signed = 'https://example.com/a%2Fb.png?token=a%26b%3Dc'
  assert.equal(layoutImageFromPath(signed)?.path, signed)
  for (const value of [
    '',
    'Note.md',
    'javascript:alert(1)',
    'data:image/png;base64,abc',
    'file:///tmp/image.png',
    'https://user:secret@example.com/image.png',
    'image.png|Caption',
  ])
    assert.equal(layoutImageFromPath(value), null)
})

test('parses wiki aliases, sizes, spaces, and Markdown image paths', () => {
  assert.deepEqual(parseLayoutImage('![[Images/a photo.png|Landscape|400]]'), {
    raw: '![[Images/a photo.png|Landscape|400]]',
    path: 'Images/a photo.png',
    caption: 'Landscape',
  })
  assert.equal(
    parseLayoutImage('![A caption](<Images/a photo (2).png>)')?.path,
    'Images/a photo (2).png',
  )
  assert.equal(parseLayoutImage('![Alt](Images/a%20photo.png)')?.path, 'Images/a photo.png')
  assert.equal(parseLayoutImage('![Alt](Images/photo\\(1\\).png)')?.path, 'Images/photo(1).png')
  assert.equal(parseLayoutImage('![Alt](javascript:alert(1))'), null)
})
test('separates the YAML header from image lines and applies defaults', () => {
  let header = ''
  const layout = parseLayout(
    'type: grid\ncolumns: 3\ngap: 8\n\n![[one.png]]\n![[two.png|Caption]]',
    (text) => {
      header = text
      return { type: 'grid', columns: 3, gap: 8 }
    },
  )
  assert.equal(header, 'type: grid\ncolumns: 3\ngap: 8')
  assert.equal(layout.height, 'auto')
  assert.equal(layout.fit, 'cover')
  assert.equal(layout.images.length, 2)
  assert.equal(layout.images[1].caption, 'Caption')
})
test('round trips all presets, explicit crop overrides, captions, and image order', () => {
  for (const type of ['grid', 'flex', 'masonry'] as const) {
    const layout = {
      ...emptyLayout(),
      type,
      columns: 3 as const,
      gap: 12,
      height: 180 as const,
      radius: 0,
      captions: true,
      caption: 'Gallery',
      images: [
        { ...parseLayoutImage('![[a.png|First|400]]')!, crop: false },
        { ...parseLayoutImage('![Second](b.png)')!, crop: true, fit: 'contain' as const },
      ],
    }
    assert.deepEqual(parseLayout(layoutSource(layout, JSON.stringify), JSON.parse), layout)
  }
})
test('validates layout values before generating styles and rejects malformed images', () => {
  for (const options of [
    { type: 'invalid' },
    { columns: 1.5 },
    { columns: 0 },
    { gap: -1 },
    { height: '100px; color:red' },
    { radius: Infinity },
    { captions: 'true' },
    ['grid'],
  ])
    assert.throws(() => parseLayout('config', () => options))
  assert.throws(() => parseLayout('{}\n\n![invalid](data:text/html,x)', JSON.parse))
  assert.deepEqual(parseLayout('{}', JSON.parse), emptyLayout())
})
test('reordering and caption editing preserve image options and size aliases', () => {
  const images = [
    parseLayoutImage('![[a.png|Old|400]]')!,
    { ...parseLayoutImage('![[b.png]]')!, crop: true },
  ]
  captionImage(images[0], 'New caption')
  assert.equal(images[0].raw, '![[a.png|New caption|400]]')
  moveImage(images, 0, 1)
  assert.equal(images[0].path, 'b.png')
  assert.equal(images[0].crop, true)
  moveImage(images, -1, 0)
  assert.equal(images[0].path, 'b.png')
})
test('finds complete blocks while ignoring layout examples inside other fences', () => {
  const block = layoutBlock(emptyLayout(), JSON.stringify)
  const text = 'Before\n\n' + block + '\nBetween\n' + block + '\nAfter'
  const blocks = layoutBlocks(text)
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].line, 2)
  const replacement = layoutBlock({ ...emptyLayout(), type: 'masonry' }, JSON.stringify)
  const changed = replaceLayoutBlock(text, blocks[1], replacement)
  assert.equal(layoutBlocks(changed)[0].raw, blocks[0].raw)
  assert.equal(parseLayout(layoutBlocks(changed)[1].source, JSON.parse).type, 'masonry')
  assert.ok(changed.endsWith('\nAfter'))
  assert.throws(() => replaceLayoutBlock('X' + text, blocks[1], replacement), /note changed/)
  assert.equal(layoutBlocks('````md\n' + block + '````').length, 0)
})
