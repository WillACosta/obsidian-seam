import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSettingsFilter } from '../src/settings/SettingsFilter'

describe('Settings filtering', () => {
  it('matches regardless of case, accents, or surrounding whitespace', () => {
    assert.equal(normalizeSettingsFilter('  CONFIGURAÇÕES  '), 'configuracoes')
    assert.equal(normalizeSettingsFilter('Weekly Note Format'), 'weekly note format')
    assert.ok(
      normalizeSettingsFilter('Configurações de automação').includes(
        normalizeSettingsFilter('AUTOMACAO'),
      ),
    )
  })
})
