/** Icons shared by registered commands, Palette pins, and settings. */
const COMMAND_ICONS: Record<string, string> = {
  'show-global-statistics': 'chart-no-axes-combined',
  'create-quick-note': 'file-plus-2',
  'create-new-note': 'file-plus',
  'create-note-from-attachment': 'files',
  'open-palette': 'search',
  'open-palette-command-mode': 'terminal',
  'process-pending': 'list-checks',
  'show-status': 'activity',
  'pin-current-note-to-calendar': 'pin',
  'unpin-current-note-from-calendar': 'pin-off',
  'delete-current-note': 'trash-2',
  'show-note-outline': 'list-tree',
  'pin-note': 'pin',
  'unpin-note': 'pin-off',
  'show-note-completion': 'chart-no-axes-combined',
  'show-note-statistics': 'chart-no-axes-column',
  'archive-current-note': 'archive',
  'move-to-permanent': 'folder-input',
  'move-to-fleeting': 'folder-clock',
  'move-daily-todos': 'calendar-days',
  'pull-daily-todos': 'calendar-days',
}

export function seamCommandIcon(id: string): string {
  return COMMAND_ICONS[id] ?? 'terminal'
}
