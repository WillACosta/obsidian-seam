import './mocks/obsidian'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { App } from 'obsidian'
import { stableResourcePath, statisticsDeviceId } from '../src/statistics/StatisticsStorage'
import { DEFAULT_SETTINGS } from '../src/types'

describe('Iteration 16 safety', () => {
  it('enables automatic processing by default', () => {
    assert.equal(DEFAULT_SETTINGS.automaticProcessing, true)
  })
  it('reuses a legacy device identity despite changing resource URL sessions', () => {
    const values: Record<string, string> = {
      'seam-statistics-device:app://old/vault/.obsidian/plugins/seam?10': 'old-id',
      'seam-statistics-device:app://old/vault/.obsidian/plugins/seam?20': 'latest-id',
      'seam-statistics-device:app://old/other/.obsidian/plugins/seam?30': 'other-id',
    }
    const storage = {
      ...values,
      getItem(key: string) {
        return ((this as Record<string, unknown>)[key] as string) ?? null
      },
      setItem(key: string, value: string) {
        ;(this as Record<string, unknown>)[key] = value
      },
    }
    const previous = globalThis.localStorage
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
    try {
      let url = 'app://new/vault/.obsidian/plugins/seam?40'
      const app = { vault: { adapter: { getResourcePath: () => url } } } as unknown as App
      assert.equal(statisticsDeviceId(app, 'plugin'), 'latest-id')
      url = 'app://another/vault/.obsidian/plugins/seam?50'
      assert.equal(statisticsDeviceId(app, 'plugin'), 'latest-id')
      assert.equal(stableResourcePath(url), '/vault/.obsidian/plugins/seam')
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous })
    }
  })
})
