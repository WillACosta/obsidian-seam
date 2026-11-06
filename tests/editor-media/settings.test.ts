import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { DEFAULT_EDITOR_MEDIA, readEditorMediaSettings } from '../../src/editor-media/settings'

test('editor and media defaults make networking and task movement opt-in', () => {
  const settings = readEditorMediaSettings(undefined)
  assert.equal(settings.previews, false)
  assert.equal(settings.autoSort, false)
  assert.equal(settings.layouts, true)
  settings.layouts = false
  assert.equal(DEFAULT_EDITOR_MEDIA.layouts, true)
})

test('editor and media settings retain explicit opt-outs and reject non-boolean saved values', () => {
  assert.deepEqual(
    readEditorMediaSettings({
      captions: false,
      layouts: false,
      previews: true,
      folding: 'false',
      autoSort: 1,
      completed: null,
    }),
    {
      ...DEFAULT_EDITOR_MEDIA,
      captions: false,
      layouts: false,
      previews: true,
    },
  )
  assert.deepEqual(readEditorMediaSettings(null), DEFAULT_EDITOR_MEDIA)
})
