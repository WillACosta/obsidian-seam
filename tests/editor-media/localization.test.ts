import '../mocks/obsidian'
import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { setTestLocale, t } from '../../src/i18n'
import { mediaText } from '../../src/editor-media/strings'
import { groupPaletteItems } from '../../src/ui/PaletteGroups'

test('editor and media commands share a localized Palette group', () => {
  for (const locale of ['en', 'pt-br'] as const) {
    setTestLocale(locale)
    const items = groupPaletteItems(
      [
        { id: 'cmd-image-layout', title: t().editorMediaLayout, description: '', type: 'command' },
        { id: 'cmd-add-caption', title: t().editorMediaCaption, description: '', type: 'command' },
      ],
      true,
    )
    assert.equal(items[0].groupLabel, t().settingsEditorMediaHeading)
    assert.equal(items[1].groupLabel, undefined)
  }
  setTestLocale(null)
})

test('media controls follow Seam language and preserve fallback labels', () => {
  setTestLocale('pt-br')
  assert.equal(mediaText('Save caption'), 'Salvar legenda')
  assert.equal(mediaText('Drag to rearrange'), 'Arraste para reordenar')
  assert.equal(mediaText('A custom filename.svg'), 'A custom filename.svg')
  setTestLocale('en')
  assert.equal(mediaText('Save caption'), 'Save caption')
  setTestLocale(null)
})
