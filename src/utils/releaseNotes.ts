const RELEASE_REPOSITORY = 'https://raw.githubusercontent.com/WillACosta/obsidian-seam'

/** Resolves repository-relative Markdown media paths for in-app release notes. */
export function resolveReleaseAssetUrls(markdown: string, releaseTag: string): string {
  const baseUrl = `${RELEASE_REPOSITORY}/${encodeURIComponent(releaseTag)}`

  return markdown.replace(
    /(!?\[[^\]]*\]\()((?:\.\/)?(?:docs|assets)\/[^)\s]+)(\))/g,
    (_match, prefix: string, relativePath: string, suffix: string) => {
      const normalizedPath = relativePath.replace(/^\.\//, '')
      const encodedPath = normalizedPath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')
      return `${prefix}${baseUrl}/${encodedPath}${suffix}`
    },
  )
}

/** Match the announcement policy used for major and minor version changes. */
export function isMajorReleaseChange(previousVersion: string, currentVersion: string): boolean {
  const previousParts = previousVersion.split('.').map(Number)
  const currentParts = currentVersion.split('.').map(Number)
  if (
    previousParts.some((part) => !Number.isFinite(part)) ||
    currentParts.some((part) => !Number.isFinite(part))
  )
    return false
  const [previousMajor, previousMinor] = previousParts
  const [currentMajor, currentMinor] = currentParts
  return (
    currentMajor > previousMajor || (currentMajor === previousMajor && currentMinor > previousMinor)
  )
}
