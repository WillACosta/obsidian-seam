import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { overviewInsights } from '../src/statistics/GlobalStatisticsModel'
import { emptyActivity } from '../src/statistics/WritingActivity'

describe('Global overview insights', () => {
  it('uses calendar months, excludes future activity, and finds the longest streak across years', () => {
    const state = emptyActivity('2023-12-01')
    state.notes.a = { path: 'A.md' }
    for (const [day, words] of [
      ['2023-12-01', 104],
      ['2023-12-30', 4],
      ['2023-12-31', 100],
      ['2024-01-01', 130],
      ['2024-01-03', 0],
      ['2024-01-20', 900],
    ] as const)
      state.days[day] = { a: { words, sessions: 1, lastEdit: 0 } }
    state.created = { a: '2024-01-01', future: '2024-01-20', old: '2023-12-31' }
    const result = overviewInsights(state, '2024-01-10')
    assert.equal(result.monthlyWordChange, 0.25)
    assert.equal(result.monthlyWords, 130)
    assert.equal(result.comparisonDays, 10)
    assert.equal(result.comparisonState, 'ready')
    assert.equal(result.monthlyNotes, 1)
    assert.equal(result.activeYearPercent, 2 / 366)
    assert.equal(result.longestStreak, 3)
  })
  it('does not invent growth when no previous month baseline exists', () => {
    assert.deepEqual(overviewInsights(emptyActivity('2026-10-28'), '2026-10-28'), {
      monthlyWords: 0,
      monthlyWordChange: null,
      comparisonDays: 28,
      comparisonState: 'incomplete',
      monthlyNotes: 0,
      activeYearPercent: 0,
      longestStreak: 0,
    })
  })
  it('keeps November additions but suppresses growth against a partially recorded October', () => {
    const state = emptyActivity('2026-10-26')
    state.days = {
      '2026-10-26': { a: { words: 121, sessions: 1, lastEdit: 0 } },
      '2026-11-03': { a: { words: 980, sessions: 1, lastEdit: 0 } },
    }
    const result = overviewInsights(state, '2026-11-05')
    assert.equal(result.monthlyWords, 980)
    assert.equal(result.monthlyWordChange, null)
    assert.equal(result.comparisonState, 'incomplete')
  })
  it('compares matching days rather than a partial month against all of the preceding month', () => {
    const state = emptyActivity('2026-10-01')
    state.days = {
      '2026-10-03': { a: { words: 100, sessions: 1, lastEdit: 0 } },
      '2026-10-26': { a: { words: 900, sessions: 1, lastEdit: 0 } },
      '2026-11-03': { a: { words: 150, sessions: 1, lastEdit: 0 } },
    }
    const result = overviewInsights(state, '2026-11-05')
    assert.equal(result.monthlyWordChange, 0.5)
    assert.equal(result.comparisonDays, 5)
  })
  for (const [year, februaryDays] of [
    [2024, 29],
    [2025, 28],
  ] as const)
    it(`uses ${februaryDays} matching days in March ${year}, keeping the full monthly total`, () => {
      const state = emptyActivity(`${year}-01-01`)
      state.days = {
        [`${year}-02-${februaryDays}`]: { a: { words: 100, sessions: 1, lastEdit: 0 } },
        [`${year}-03-${februaryDays}`]: { a: { words: 50, sessions: 1, lastEdit: 0 } },
        [`${year}-03-31`]: { a: { words: 1000, sessions: 1, lastEdit: 0 } },
      }
      const result = overviewInsights(state, `${year}-03-31`)
      assert.equal(result.monthlyWords, 1050)
      assert.equal(result.monthlyWordChange, -0.5)
      assert.equal(result.comparisonDays, februaryDays)
    })
  it('distinguishes a genuine zero baseline and allows a 100% decline', () => {
    const state = emptyActivity('2026-09-01')
    state.days = { '2026-11-01': { a: { words: 100, sessions: 1, lastEdit: 0 } } }
    assert.equal(overviewInsights(state, '2026-11-05').comparisonState, 'zero')
    assert.equal(overviewInsights(state, '2026-11-05').monthlyWordChange, null)
    state.days = { '2026-10-01': { a: { words: 100, sessions: 1, lastEdit: 0 } } }
    assert.equal(overviewInsights(state, '2026-11-05').monthlyWordChange, -1)
  })
})
