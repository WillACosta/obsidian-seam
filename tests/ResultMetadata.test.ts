import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PaletteItem } from '../src/types'
import { readResultMetadataSettings } from '../src/settings/ResultMetadataSettings'
import { paletteResultMetadata } from '../src/ui/ResultMetadata'

describe('Palette result metadata', () => {
  const item: PaletteItem = {
    id: 'note',
    title: 'Note',
    description: '',
    type: 'note',
    matchCount: 2,
  }
  it('migrates the old combined setting without overriding independently saved values', () => {
    assert.deepEqual(readResultMetadataSettings({}), {
      showFileExtension: true,
      showMatchCount: true,
    })
    assert.deepEqual(readResultMetadataSettings({ showFileExtensionAndMatchCount: false }), {
      showFileExtension: false,
      showMatchCount: false,
    })
    assert.deepEqual(
      readResultMetadataSettings({
        showFileExtensionAndMatchCount: true,
        showFileExtension: false,
      }),
      { showFileExtension: false, showMatchCount: true },
    )
    assert.deepEqual(
      readResultMetadataSettings({ showFileExtensionAndMatchCount: false, showMatchCount: true }),
      { showFileExtension: false, showMatchCount: true },
    )
  })
  it('shows each requested field independently without orphaned separators', () => {
    const render = (showFileExtension: boolean, showMatchCount: boolean) =>
      paletteResultMetadata(item, { showFileExtension, showMatchCount })
    assert.deepEqual(render(true, true), {
      beforeCompletion: '.md • 2 matches',
      afterCompletion: '',
    })
    assert.equal(render(true, false).beforeCompletion, '.md')
    assert.equal(render(false, true).beforeCompletion, '2 matches')
    assert.equal(render(false, false).beforeCompletion, '')
    assert.deepEqual(
      paletteResultMetadata(
        { ...item, matchCount: 1, taskCompletionPercent: 50 },
        { showFileExtension: false, showMatchCount: true },
      ),
      { beforeCompletion: '', afterCompletion: '• 1 match' },
    )
    assert.equal(
      paletteResultMetadata(
        { ...item, matchCount: undefined },
        { showFileExtension: false, showMatchCount: true },
      ).beforeCompletion,
      '',
    )
  })
})
