import './mocks/obsidian'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { orderPaletteCommands } from '../src/ui/PaletteCommandOrder'
import { groupPaletteItems } from '../src/ui/PaletteGroups'
import type { PaletteItem } from '../src/types'

const command = (id: string, title: string, description = ''): PaletteItem => ({
  id,
  title,
  description,
  type: 'command',
})

describe('Pinned commands in the Universal Palette', () => {
  const commands = [command('one', 'First'), command('two', 'Second'), command('three', 'Third')]
  const pins = [command('two', 'Second'), command('extra', 'Extra command')]
  it('puts all available pins in saved order ahead of unpinned commands without duplicates', () => {
    const items = orderPaletteCommands(commands, pins, ['extra', 'two', 'missing', 'extra'])
    assert.deepEqual(
      items.map((item) => item.id),
      ['extra', 'two', 'one', 'three'],
    )
    assert.deepEqual(
      items.map((item) => !!item.pinnedCommand),
      [true, true, false, false],
    )
    const grouped = groupPaletteItems(items, true)
    assert.equal(grouped[0].groupLabel, 'Pinned Commands')
    assert.equal(grouped[1].groupLabel, undefined)
    assert.equal(groupPaletteItems(items, false), items)
  })
  it('filters pins and ordinary commands consistently without reintroducing duplicates', () => {
    assert.deepEqual(
      orderPaletteCommands(commands, pins, ['two', 'extra'], 'second').map((item) => item.id),
      ['two'],
    )
    assert.deepEqual(
      orderPaletteCommands(commands, pins, ['two', 'extra'], 'command').map((item) => item.id),
      ['extra'],
    )
    assert.deepEqual(
      orderPaletteCommands(commands, pins, ['two'], 'third').map((item) => item.id),
      ['three'],
    )
    assert.equal(
      orderPaletteCommands(
        [command('two', 'Second', 'Active note')],
        pins,
        ['two'],
        'active note',
      )[0].id,
      'two',
    )
  })
  it('does not duplicate a pinned registered action with its contextual Palette equivalent', () => {
    const contextual = [command('cmd-palette-pin', 'Unpin current note'), command('other', 'Other')]
    const registered = [command('registered:unpin-note', 'Unpin current note')]
    const items = orderPaletteCommands(contextual, registered, ['registered:unpin-note'])
    assert.deepEqual(
      items.map((item) => item.id),
      ['registered:unpin-note', 'other'],
    )
    assert.deepEqual(
      orderPaletteCommands(contextual, [], ['registered:unpin-note']).map((item) => item.id),
      ['cmd-palette-pin', 'other'],
    )
  })
  it('keeps pins visible when default commands are hidden', () => {
    assert.deepEqual(
      orderPaletteCommands(commands, pins, ['extra', 'two'], '', false).map((item) => item.id),
      ['extra', 'two'],
    )
  })
})
