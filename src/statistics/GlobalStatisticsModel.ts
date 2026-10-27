import { ActivityState, localDay } from './WritingActivity'
export type ContributionMetric = 'words' | 'notes' | 'sessions'
export type TrendMetric = 'words' | 'created'
export type ContributionPeriod = 'year' | 'quarter'
export function contribution(
  state: ActivityState,
  day: string,
  metric: ContributionMetric,
): number {
  const notes = Object.values(state.days[day] ?? {})
  if (metric === 'notes') return notes.length
  return notes.reduce((sum, note) => sum + note[metric], 0)
}
/** Sunday-first columns; future dates are empty slots, never contributions or interactive dates. */
export function contributionWeeks(today: string, period: ContributionPeriod): (string | null)[][] {
  const end = new Date(`${today}T12:00:00`)
  const start = new Date(end)
  if (period === 'year') start.setDate(start.getDate() - start.getDay() - 51 * 7)
  else {
    const date = start.getDate()
    start.setDate(1)
    start.setMonth(start.getMonth() - 3)
    start.setDate(Math.min(date, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()))
    start.setDate(start.getDate() - start.getDay())
  }
  const weeks: (string | null)[][] = []
  for (const cursor = new Date(start); cursor <= end;) {
    const week: (string | null)[] = []
    for (let day = 0; day < 7; day++) {
      week.push(cursor <= end ? localDay(cursor) : null)
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}
export function intensity(value: number, max: number): number {
  return value <= 0 || max <= 0 ? 0 : Math.min(4, Math.ceil((value / max) * 4))
}
export function monthlyTrends(
  state: ActivityState,
  today: string,
  metric: TrendMetric,
): { month: string; value: number }[] {
  const date = new Date(`${today}T12:00:00`)
  return Array.from({ length: 6 }, (_item, i) => {
    const month = localDay(new Date(date.getFullYear(), date.getMonth() - 5 + i, 1)).slice(0, 7)
    const value =
      metric === 'created'
        ? Object.values(state.created).filter((day) => day <= today && day.startsWith(month)).length
        : Object.keys(state.days)
            .filter((day) => day <= today && day.startsWith(month))
            .reduce((sum, day) => sum + contribution(state, day, 'words'), 0)
    return { month, value }
  })
}

/** A shared zero-based linear scale with four equal, readable intervals. */
export function monthlyChartScale(values: number[]): {
  max: number
  ticks: number[]
  heights: number[]
} {
  const peak = Math.max(0, ...values)
  const raw = Math.max(1, peak / 4)
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = ([1, 2, 2.5, 5, 10].find((value) => value * magnitude >= raw) ?? 10) * magnitude
  const max = step * 4
  return {
    max,
    ticks: [max, max * 0.75, max * 0.5, max * 0.25, 0],
    heights: values.map((value) => Math.max(0, Math.min(100, (value / max) * 100))),
  }
}
