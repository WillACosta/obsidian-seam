export type EditorMediaView = 'embed-url' | 'add-caption' | 'image-layout'
export type EditorMediaSettings = {
  previews: boolean
  captions: boolean
  folding: boolean
  autoSort: boolean
  completed: boolean
  layouts: boolean
}
export const DEFAULT_EDITOR_MEDIA: EditorMediaSettings = {
  previews: false,
  captions: true,
  folding: true,
  autoSort: false,
  completed: true,
  layouts: true,
}
export function readEditorMediaSettings(value: unknown): EditorMediaSettings {
  const data = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const result = { ...DEFAULT_EDITOR_MEDIA }
  for (const key of Object.keys(result) as (keyof EditorMediaSettings)[])
    if (typeof data[key] === 'boolean') result[key] = data[key]
  return result
}
