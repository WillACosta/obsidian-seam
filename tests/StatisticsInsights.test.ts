import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { overviewInsights } from '../src/statistics/GlobalStatisticsModel'
import { emptyActivity } from '../src/statistics/WritingActivity'

describe('Global overview insights', () => {
  it('uses calendar months, excludes future activity, and finds the longest streak across years', () => {
    const state = emptyActivity('2023-12-30')
    state.notes.a = { path: 'A.md' }
    for (const [day, words] of [
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
    assert.equal(result.monthlyNotes, 1)
    assert.equal(result.activeYearPercent, 2 / 366)
    assert.equal(result.longestStreak, 3)
  })
  it('does not invent growth when no previous month baseline exists', () => {
    assert.deepEqual(overviewInsights(emptyActivity('2026-10-28'), '2026-10-28'), {
      monthlyWordChange: null,
      monthlyNotes: 0,
      activeYearPercent: 0,
      longestStreak: 0,
    })
  })
})
