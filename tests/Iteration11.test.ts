import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MockTFile } from './mocks/obsidian'
import type { App, TFile } from 'obsidian'
import moment from 'moment'
import { extractPendingTasks, hasPendingTasksInCache } from '../src/daily/PendingTasks'
import { DailyTaskTransfer } from '../src/daily/DailyTaskTransfer'
import {
  createDailyNote,
  dailyNoteDate,
  dailyNotePath,
  getMissingDailyNote,
} from '../src/daily/DailyNotes'
import { parseSpecialSearch, SearchService } from '../src/search/SearchService'
import { DEFAULT_SETTINGS } from '../src/types'

function vaultFixture(
  settings = { folder: 'Journal', format: 'YYYY-MM-DD', template: 'Templates/Daily' },
) {
  const contents = new Map<string, string>([
    ['Templates/Daily.md', '# {{title}}\n{{date:YYYY-MM-DD}} {{time:HH:mm}}\n'],
  ])
  const files = new Map<string, MockTFile>()
  const file = (path: string, content: string) => {
    const result = new MockTFile(path)
    files.set(path, result)
    contents.set(path, content)
    return result as unknown as TFile
  }
  file('Templates/Daily.md', contents.get('Templates/Daily.md')!)
  let failSource = false
  let afterAppend: (() => void) | undefined
  const app = {
    vault: {
      configDir: '.obsidian',
      adapter: { exists: async () => true, read: async () => JSON.stringify(settings) },
      getAbstractFileByPath: (path: string) => files.get(path),
      getFiles: () => [...files.values()],
      getMarkdownFiles: () => [...files.values()].filter((f) => f.extension === 'md'),
      read: async (file: TFile) => contents.get(file.path)!,
      cachedRead: async (file: TFile) => contents.get(file.path)!,
      createFolder: async () => {},
      create: async (path: string, content: string) => {
        if (files.has(path)) throw new Error('Collision')
        return file(path, content)
      },
      process: async (target: TFile, fn: (content: string) => string) => {
        if (failSource && target.path.endsWith('2026-10-23.md'))
          throw new Error('Source write failed')
        const next = fn(contents.get(target.path)!)
        contents.set(target.path, next)
        if (target.path.endsWith('2026-10-24.md')) afterAppend?.()
        return next
      },
    },
    workspace: { getLeavesOfType: () => [], getLastOpenFiles: () => [...files.keys()].reverse() },
    metadataCache: { getFileCache: () => ({ tags: [{ tag: '#work' }] }) },
  } as unknown as App
  return {
    app,
    file,
    contents,
    fail: () => {
      failSource = true
    },
    onAppend: (fn: () => void) => {
      afterAppend = fn
    },
  }
}

describe('Pending daily tasks', () => {
  it('hides transfers for completed-only sources and a missing yesterday note', async () => {
    const fixture = vaultFixture()
    const today = fixture.file(
      `Journal/${moment().format('YYYY-MM-DD')}.md`,
      '- [x] Done\n```\n- [ ] Example\n```\n',
    )
    const service = new DailyTaskTransfer(fixture.app)
    assert.deepEqual(await service.getAvailability(today), { tomorrow: false, yesterday: false })
    assert.deepEqual(await service.getAvailability(null), { tomorrow: false, yesterday: false })
    assert.deepEqual(await service.getAvailability(fixture.file('Other.md', '- [ ] Task')), {
      tomorrow: false,
      yesterday: false,
    })
  })
  it('independently checks today and yesterday and updates after tasks are completed', async () => {
    const fixture = vaultFixture()
    const today = fixture.file(`Journal/${moment().format('YYYY-MM-DD')}.md`, '- [x] Done\n')
    const yesterday = fixture.file(
      `Journal/${moment().subtract(1, 'day').format('YYYY-MM-DD')}.md`,
      '- [/] Partial\n  - [ ] Task\n',
    )
    const service = new DailyTaskTransfer(fixture.app)
    assert.deepEqual(await service.getAvailability(today), { tomorrow: false, yesterday: true })
    fixture.contents.set(today.path, '- [ ] New task\n')
    fixture.contents.set(yesterday.path, '- [x] Done\n')
    assert.deepEqual(await service.getAvailability(today), { tomorrow: true, yesterday: false })
  })
  it('uses metadata parent hierarchy without treating root siblings as descendants', () => {
    const item = (line: number, col: number, parent: number, task: string) => ({
      position: { start: { line, col } },
      parent,
      task,
    })
    assert.equal(hasPendingTasksInCache([item(0, 0, -0, 'x'), item(1, 0, -0, ' ')] as never), true)
    assert.equal(hasPendingTasksInCache([item(0, 0, -0, 'x'), item(1, 2, 0, ' ')] as never), false)
    assert.equal(hasPendingTasksInCache([item(0, 0, -0, '/'), item(1, 2, 0, ' ')] as never), true)
  })
  it('offers missing today and yesterday at their configured paths and creates from the template', async () => {
    const fixture = vaultFixture()
    for (const search of ['today', 'yesterday'] as const) {
      const target = await getMissingDailyNote(fixture.app, search)
      assert.ok(target)
      const expected = moment()
        .subtract(search === 'yesterday' ? 1 : 0, 'day')
        .format('YYYY-MM-DD')
      assert.equal(target.path, `Journal/${expected}.md`)
      assert.equal(fixture.contents.has(target.path), false)
      const created = await createDailyNote(fixture.app, target.date, target.settings)
      assert.match(fixture.contents.get(created.path)!, new RegExp('^# ' + expected))
      assert.equal(await getMissingDailyNote(fixture.app, search), null)
    }
  })
  it('opens an existing daily note if it appears after the create suggestion was shown', async () => {
    const fixture = vaultFixture()
    const target = await getMissingDailyNote(fixture.app, 'today')
    assert.ok(target)
    const existing = fixture.file(target.path, 'Keep concurrent content')
    const created = await createDailyNote(fixture.app, target.date, target.settings)
    assert.equal(created, existing)
    assert.equal(fixture.contents.get(target.path), 'Keep concurrent content')
  })
  it('moves unfinished branches and retains completed children under completed source context', () => {
    const content =
      '# Today\n- [x] Read Hyperion\n- [/] Implement Seam Features\n\t- [x] Implement mobile UI\n\t- [ ] Write unit tests\n- [ ] Buy a new espresso machine\n'
    const result = extractPendingTasks(content)
    assert.equal(
      result.pending,
      '- [/] Implement Seam Features\n\t- [ ] Write unit tests\n- [ ] Buy a new espresso machine',
    )
    assert.match(result.remaining, /- \[x\] Implement Seam Features\n\t- \[x\] Implement mobile UI/)
    assert.match(result.remaining, /Read Hyperion/)
    assert.doesNotMatch(result.remaining, /Write unit tests|espresso/)
    assert.equal(extractPendingTasks(result.remaining).pending, '')
  })
  it('preserves list parents, continuations, CRLF, and ordered list markers', () => {
    const result = extractPendingTasks(
      '## Work\r\n1. Project\r\n    - [ ] Pending\r\n      details\r\n    - [x] Done\r\n\r\nAfter\r\n',
    )
    assert.equal(result.pending, '1. Project\r\n    - [ ] Pending\r\n      details')
    assert.match(result.remaining, /1\. Project\r\n    - \[x\] Done/)
    assert.match(result.remaining, /After\r\n$/)
  })
  it('excludes YAML, fenced and indented code, and descendants of completed or cancelled tasks', () => {
    const result = extractPendingTasks(
      '---\n- [ ] property\n---\n```md\n- [ ] code\n```\n    - [ ] indented code\n- [x] Done\n  - [ ] Child\n- [-] Cancelled\n  - [ ] Child\n- [ ] Actual\n\n<!--\n- [ ] Commented out\n-->\n\n~~~\n- [ ] more code\n~~~\n',
    )
    assert.equal(result.pending, '- [ ] Actual')
    assert.match(result.remaining, /more code/)
    assert.match(result.remaining, /Child/)
  })
  it('preserves both notes and creates no destination when creation is cancelled', async () => {
    const fixture = vaultFixture()
    const source = fixture.file('Journal/2026-10-23.md', '- [ ] Keep here\n')
    const service = new DailyTaskTransfer(fixture.app, async (path) => {
      assert.equal(path, 'Journal/2026-10-24.md')
      return false
    })
    assert.equal(await service.transfer(source, 'tomorrow'), null)
    assert.equal(fixture.contents.get(source.path), '- [ ] Keep here\n')
    assert.equal(fixture.contents.has('Journal/2026-10-24.md'), false)
  })
  it('does not ask to create an existing destination', async () => {
    const fixture = vaultFixture()
    const source = fixture.file('Journal/2026-10-23.md', '- [ ] Transfer\n')
    fixture.file('Journal/2026-10-24.md', '# Existing\n')
    const service = new DailyTaskTransfer(fixture.app, async () =>
      assert.fail('Existing notes must not prompt'),
    )
    assert.equal(await service.transfer(source, 'tomorrow'), 1)
    assert.match(fixture.contents.get('Journal/2026-10-24.md')!, /Transfer/)
  })
  it('creates tomorrow with the core Daily Notes template and avoids repeated moves', async () => {
    const fixture = vaultFixture()
    const source = fixture.file('Journal/2026-10-23.md', '- [ ] Pending\n- [x] Done\n')
    const service = new DailyTaskTransfer(fixture.app)
    assert.equal(await service.transfer(source, 'tomorrow'), 1)
    assert.match(
      fixture.contents.get('Journal/2026-10-24.md')!,
      /^# 2026-10-24\n2026-10-24 \d{2}:\d{2}/,
    )
    assert.match(fixture.contents.get('Journal/2026-10-24.md')!, /- \[ \] Pending/)
    assert.equal(await service.transfer(source, 'tomorrow'), 0)
    assert.match(fixture.contents.get(source.path)!, /Done/)
  })
  it('pulls yesterday into an existing note without replacing its content', async () => {
    const fixture = vaultFixture()
    fixture.file('Journal/2026-10-22.md', '- [ ] Yesterday\n')
    const today = fixture.file('Journal/2026-10-23.md', '# Keep this\n')
    assert.equal(await new DailyTaskTransfer(fixture.app).transfer(today, 'yesterday'), 1)
    assert.equal(fixture.contents.get(today.path), '# Keep this\n\n- [ ] Yesterday\n')
    assert.equal(await new DailyTaskTransfer(fixture.app).transfer(today, 'yesterday'), 0)
  })
  it('preserves source when template is missing or destination creation fails', async () => {
    const fixture = vaultFixture({ folder: 'Journal', format: 'YYYY-MM-DD', template: 'Missing' })
    const source = fixture.file('Journal/2026-10-23.md', '- [ ] Keep\n')
    await assert.rejects(
      new DailyTaskTransfer(fixture.app).transfer(source, 'tomorrow'),
      /template not found/,
    )
    assert.equal(fixture.contents.get(source.path), '- [ ] Keep\n')
    assert.equal(fixture.contents.has('Journal/2026-10-24.md'), false)
  })
  it('rolls back the append if the source write fails', async () => {
    const fixture = vaultFixture()
    const source = fixture.file('Journal/2026-10-23.md', '- [ ] Keep\n')
    fixture.file('Journal/2026-10-24.md', '# Existing\n')
    fixture.fail()
    await assert.rejects(
      new DailyTaskTransfer(fixture.app).transfer(source, 'tomorrow'),
      /Source write failed/,
    )
    assert.equal(fixture.contents.get(source.path), '- [ ] Keep\n')
    assert.equal(fixture.contents.get('Journal/2026-10-24.md'), '# Existing\n')
  })
  it('preserves the source if the destination write fails', async () => {
    const fixture = vaultFixture()
    const source = fixture.file('Journal/2026-10-23.md', '- [ ] Keep\n')
    fixture.app.vault.process = async () => {
      throw new Error('Destination write failed')
    }
    await assert.rejects(
      new DailyTaskTransfer(fixture.app).transfer(source, 'tomorrow'),
      /Destination write failed/,
    )
    assert.equal(fixture.contents.get(source.path), '- [ ] Keep\n')
  })
  it('rejects overlapping commands to prevent duplicate transfers', async () => {
    const fixture = vaultFixture()
    const source = fixture.file('Journal/2026-10-23.md', '- [ ] Once\n')
    const service = new DailyTaskTransfer(fixture.app)
    const first = service.transfer(source, 'tomorrow')
    await assert.rejects(service.transfer(source, 'tomorrow'), /already running/)
    assert.equal(await first, 1)
    assert.equal((fixture.contents.get('Journal/2026-10-24.md')!.match(/Once/g) ?? []).length, 1)
  })
  it('does not overwrite concurrent source or destination edits', async () => {
    const fixture = vaultFixture()
    const source = fixture.file('Journal/2026-10-23.md', '- [ ] Keep\n')
    fixture.onAppend(() => {
      fixture.contents.set(source.path, '- [ ] Keep\nNew source text')
      fixture.contents.set(
        'Journal/2026-10-24.md',
        fixture.contents.get('Journal/2026-10-24.md')! + 'New destination text',
      )
    })
    await assert.rejects(
      new DailyTaskTransfer(fixture.app).transfer(source, 'tomorrow'),
      /Review both notes/,
    )
    assert.match(fixture.contents.get(source.path)!, /New source text/)
    assert.match(fixture.contents.get('Journal/2026-10-24.md')!, /New destination text/)
  })
  it('honors custom formats with nested paths and rejects unrelated date names', () => {
    const settings = { folder: 'Journal', format: 'YYYY/MM/YYYY-MM-DD', template: '' }
    const date = moment('2026-10-23')
    const path = dailyNotePath(date, settings)
    assert.equal(path, 'Journal/2026/10/2026-10-23.md')
    assert.equal(
      dailyNoteDate(new MockTFile(path) as TFile, settings)?.format('YYYY-MM-DD'),
      '2026-10-23',
    )
    assert.equal(dailyNoteDate(new MockTFile('Other/2026-10-23.md') as TFile, settings), null)
  })
})

describe('Iteration 11 searches', () => {
  it('includes attachments, respects folder boundaries and composes with tags', async () => {
    const fixture = vaultFixture()
    const pdf = fixture.file('Fleeting/Report.pdf', '')
    fixture.file('Fleeting/Sub/Note.md', 'body')
    fixture.file('Fleeting extra/Wrong.md', '')
    fixture.file('Permanent/Keep.md', '')
    const service = new SearchService(fixture.app, DEFAULT_SETTINGS)
    assert.deepEqual(
      (await service.searchWithContent('@fleeting')).map((result) => result.path).sort(),
      [pdf.path, 'Fleeting/Sub/Note.md'].sort(),
    )
    assert.deepEqual(
      (await service.searchCombinedSpecialWithContent([{ search: 'fleeting' }], [], '#work', ''))
        .map((result) => result.path)
        .sort(),
      [pdf.path, 'Fleeting/Sub/Note.md'].sort(),
    )
    assert.deepEqual(
      service.search('@permanent').map((result) => result.path),
      ['Permanent/Keep.md'],
    )
    assert.deepEqual(await service.searchWithContent('@fleeting impossible'), [])
  })
  it('preserves last-opened ordering and limit in plain and composed queries', async () => {
    const fixture = vaultFixture()
    for (let i = 0; i < 12; i++) fixture.file(`Fleeting/${i}.md`, 'body')
    const service = new SearchService(fixture.app, DEFAULT_SETTINGS)
    const expected = fixture.app.workspace.getLastOpenFiles().slice(0, 10)
    assert.deepEqual(parseSpecialSearch('@RECENTLYOPENED body'), {
      search: 'recentlyOpened',
      textQuery: 'body',
    })
    assert.deepEqual(
      (await service.searchWithContent('@recentlyOpened body')).map((result) => result.path),
      expected,
    )
    assert.deepEqual(
      (
        await service.searchCombinedSpecialWithContent(
          [{ search: 'recentlyOpened' }, { search: 'fleeting' }],
          [],
          '#work',
          'body',
        )
      ).map((result) => result.path),
      expected,
    )
  })
  it('formats only configured daily notes without renaming files', async () => {
    const fixture = vaultFixture()
    const daily = fixture.file('Journal/2026-10-02.md', '')
    const ordinary = fixture.file('Other/2026-10-02.md', '')
    const service = new SearchService(fixture.app, DEFAULT_SETTINGS)
    await service.refreshDailyNoteSettings()
    assert.equal(service.getDailyNoteDisplayTitle(daily), '2 Oct. 2026')
    assert.equal(service.getDailyNoteDisplayTitle(ordinary), null)
    assert.equal(daily.path, 'Journal/2026-10-02.md')
  })
})
