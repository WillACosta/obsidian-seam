import './mocks/obsidian'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { App, ListItemCache, TFile } from 'obsidian'
import { calendarEventItems, calendarEventTitles } from '../src/calendar/CalendarEvents'
import { extractPendingTasks } from '../src/daily/PendingTasks'
import { matchesSpecialSearch } from '../src/search/SearchService'
import { countNoteTasks, summarizeTasks } from '../src/statistics/NoteCompletion'

function item(task: string, line = 0, col = 0): ListItemCache {
  const loc = { line, col, offset: 0 }
  return { task, position: { start: loc, end: loc }, parent: -1 }
}

describe('Daily Note calendar events', () => {
  it('uses indexed event positions to read titles and excludes other tasks', () => {
    const content = [
      '## Plans',
      '- [<] Christmas Eve',
      '- [>] Moved task',
      '  - [<] Family visit',
      '~~~',
      '- [<] Example inside a fence',
      '~~~',
    ].join('\r\n')
    const items = calendarEventItems([item('<', 1), item('>', 2), item('<', 3, 2)])
    assert.deepEqual(calendarEventTitles(content, items), ['Christmas Eve', 'Family visit'])
  })

  it('omits events from task queries, progress, and transfers', () => {
    const calendarEvent = item('<')
    const done = item('x', 1)
    const todo = item(' ', 2)
    const file = {} as TFile
    let listItems = [calendarEvent]
    const app = { metadataCache: { getFileCache: () => ({ listItems }) } } as unknown as App

    for (const query of ['task', 'todo', 'done'] as const)
      assert.equal(matchesSpecialSearch(app, file, query), false)
    listItems = [calendarEvent, done]
    assert.equal(matchesSpecialSearch(app, file, 'task'), true)
    assert.equal(matchesSpecialSearch(app, file, 'done'), true)
    listItems.push(todo)
    assert.equal(matchesSpecialSearch(app, file, 'todo'), true)
    assert.equal(matchesSpecialSearch(app, file, 'done'), false)

    const source = '- [<] Event\n- [x] Complete\n- [ ] Pending\n'
    const expected = { total: 2, unfinished: 1, partial: 0, completed: 1, percent: 50 }
    assert.deepEqual(countNoteTasks(source), expected)
    assert.deepEqual(summarizeTasks(['<', 'x', ' ']), expected)
    assert.equal(extractPendingTasks(source).pending, '- [ ] Pending')
  })
})
