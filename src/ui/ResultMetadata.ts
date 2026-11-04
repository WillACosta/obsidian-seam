import { PaletteItem, SeamSettings } from '../types'

/** Format the metadata around the optional task-completion indicator. */
export function paletteResultMetadata(
  item: PaletteItem,
  settings: Pick<SeamSettings, 'showFileExtension' | 'showMatchCount'>,
): { beforeCompletion: string; afterCompletion: string } {
  const extension = settings.showFileExtension ? `.${item.file?.extension ?? 'md'}` : ''
  const count =
    settings.showMatchCount && item.matchCount !== undefined
      ? `${item.matchCount} ${item.matchCount === 1 ? 'match' : 'matches'}`
      : ''
  if (item.taskCompletionPercent !== undefined) {
    return { beforeCompletion: extension, afterCompletion: count ? `• ${count}` : '' }
  }
  return { beforeCompletion: [extension, count].filter(Boolean).join(' • '), afterCompletion: '' }
}
