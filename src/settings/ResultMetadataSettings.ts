/** Preserve the old combined preference while letting either new option override it. */
export function readResultMetadataSettings(data: Record<string, unknown>): {
  showFileExtension: boolean
  showMatchCount: boolean
} {
  const legacy = data.showFileExtensionAndMatchCount
  const fallback = legacy === undefined ? true : Boolean(legacy)
  return {
    showFileExtension:
      data.showFileExtension === undefined ? fallback : Boolean(data.showFileExtension),
    showMatchCount: data.showMatchCount === undefined ? fallback : Boolean(data.showMatchCount),
  }
}
