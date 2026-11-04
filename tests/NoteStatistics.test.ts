import './mocks/obsidian'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { App, TFile } from 'obsidian'
import { countNoteText, readNoteStatistics } from '../src/statistics/NoteStatistics'

describe('Note statistics', () => {
  it('reports zero for an empty note', () => {
    assert.deepEqual(countNoteText(''), { words: 0, characters: 0, paragraphs: 0, readMinutes: 0 })
    assert.deepEqual(countNoteText(' \n\t\n'), {
      words: 0,
      characters: 4,
      paragraphs: 0,
      readMinutes: 0,
    })
  })
  it('counts accented words, combining accents, numbers, and contractions without counting Markdown markers', () => {
    assert.equal(countNoteText("# Café cafe\u0301 don't it’s well-known 2026 ** *** 😀").words, 6)
  })
  it('includes spaces and newlines in characters and counts Unicode code points', () => {
    assert.equal(countNoteText('A 😀\n').characters, 4)
  })
  it('counts blank-line-separated paragraphs, preserving wrapped lines and CRLF', () => {
    const content = '  First paragraph\r\ncontinued.\r\n \t\r\n\r\nSecond.\r\n\r\nThird.\r\n'
    assert.equal(countNoteText(content).paragraphs, 3)
  })
  it('rounds reading time up at 200 words per minute', () => {
    assert.equal(countNoteText('word '.repeat(200)).readMinutes, 1)
    assert.equal(countNoteText('word '.repeat(201)).readMinutes, 2)
  })
  it('uses current unsaved text without saving or reading the stored file', async () => {
    const file = {
      path: 'Notes/Draft.md',
      basename: 'Draft',
      stat: { mtime: 2000, ctime: 1000 },
    } as TFile
    const app = {
      workspace: {
        getActiveViewOfType: () => ({
          file,
          getMode: () => 'source',
          editor: { getValue: () => 'Unsaved words\n\nAnother paragraph.' },
        }),
      },
      vault: {
        cachedRead: () => {
          throw new Error('Must use editor')
        },
      },
    } as unknown as App
    assert.deepEqual(await readNoteStatistics(app, file), {
      title: 'Draft',
      path: file.path,
      ...countNoteText('Unsaved words\n\nAnother paragraph.'),
      modified: 2000,
      created: 1000,
    })
  })
  it('reads the file in reading mode or when another note owns the active editor', async () => {
    const file = {
      path: 'Notes/Report.md',
      basename: 'Report',
      stat: { mtime: 2000, ctime: 1000 },
    } as TFile
    for (const view of [
      null,
      { file, getMode: () => 'preview' },
      { file: { path: 'Other.md' }, getMode: () => 'source' },
    ]) {
      const app = {
        workspace: { getActiveViewOfType: () => view },
        vault: {
          cachedRead: async (target: TFile) => {
            assert.equal(target, file)
            return 'Stored text'
          },
        },
      } as unknown as App
      assert.equal((await readNoteStatistics(app, file)).words, 2)
    }
  })
  it('propagates a read error instead of reporting a misleading empty note', async () => {
    const app = {
      workspace: { getActiveViewOfType: () => null },
      vault: {
        cachedRead: async () => {
          throw new Error('Unavailable')
        },
      },
    } as unknown as App
    await assert.rejects(() => readNoteStatistics(app, {} as TFile), /Unavailable/)
  })
})
