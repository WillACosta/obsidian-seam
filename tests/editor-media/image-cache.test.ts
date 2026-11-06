import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { ImageCache, imageName, type CachedImage } from '../../src/editor-media/image-cache'
import { images, setCaption } from '../../src/editor-media/core'
import { parseLayoutImage } from '../../src/editor-media/layout/model'

test('caption picker parses angle URLs and balanced parentheses without changing signed targets', () => {
  const url = 'https://example.com/folder/My%20photo(2).jpg?token=a%2Fb%3D&size=4'
  const text = `Before ![Old](<${url}> "Photo") after ![[Attachments/Local image.png|Local|400]]`
  const found = images(text)
  assert.equal(found.length, 2)
  assert.equal(parseLayoutImage(found[0].raw)?.path, url)
  assert.equal(text.slice(found[0].start, found[0].end), found[0].raw)
  assert.equal(setCaption(found[0].raw, 'New'), `![New](<${url}> "Photo")`)
  assert.equal(parseLayoutImage(images(`![](${url})`)[0].raw)?.path, url)
  assert.equal(imageName(url), 'My photo(2).jpg')
  assert.equal(imageName('Attachments/Local image.png'), 'Local image.png')
  assert.equal(imageName('folder/100% image.svg'), '100% image.svg')
})

test('remote image cache deduplicates requests and reuses disk bytes after reopening', async () => {
  const disk = new Map<string, CachedImage>()
  const storage = {
    read: async (key: string) => disk.get(key) ?? null,
    write: async (key: string, image: CachedImage) => {
      disk.set(key, image)
    },
  }
  let requests = 0
  const download = async () => {
    requests++
    return { data: new TextEncoder().encode('<svg/>').buffer, type: 'image/svg+xml' }
  }
  const url = 'https://example.com/image.svg?signature=secret'
  const first = new ImageCache(storage, download)
  const [a, b] = await Promise.all([first.get(url), first.get(url)])
  assert.equal(a, b)
  assert.equal(requests, 1)
  assert.equal((await fetch(a)).headers.get('content-type'), 'image/svg+xml')
  assert.ok([...disk.keys()].every((key) => /^[a-f0-9]{64}$/.test(key)))
  first.dispose()
  const second = new ImageCache(storage, download)
  await second.get(url)
  assert.equal(requests, 1)
  second.dispose()
})

test('failed downloads retry and invalid responses never enter cache', async () => {
  let requests = 0
  let writes = 0
  const cache = new ImageCache(
    {
      read: async () => null,
      write: async () => {
        writes++
      },
    },
    async () => {
      requests++
      return { data: new ArrayBuffer(1), type: requests === 1 ? 'text/html' : 'image/png' }
    },
  )
  await assert.rejects(cache.get('https://example.com/image.png'))
  assert.equal(writes, 0)
  await cache.get('https://example.com/image.png')
  assert.equal(requests, 2)
  assert.equal(writes, 1)
  cache.dispose()
})

test('cache write failures do not block previews and unload cancels pending previews', async () => {
  const cache = new ImageCache(
    {
      read: async () => {
        throw new Error('Missing')
      },
      write: async () => {
        throw new Error('Read only')
      },
    },
    async () => ({ data: new ArrayBuffer(1), type: 'image/png' }),
  )
  assert.match(await cache.get('https://example.com/image.png'), /^blob:/)
  cache.dispose()
  await assert.rejects(cache.get('https://example.com/other.png'), /closed/)
})
