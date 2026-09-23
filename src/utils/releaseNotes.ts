const RELEASE_REPOSITORY = 'https://raw.githubusercontent.com/WillACosta/obsidian-seam';

/** Resolves repository-relative Markdown media paths for in-app release notes. */
export function resolveReleaseAssetUrls(markdown: string, releaseTag: string): string {
    const baseUrl = `${RELEASE_REPOSITORY}/${encodeURIComponent(releaseTag)}`;

    return markdown.replace(
        /(!?\[[^\]]*\]\()((?:\.\/)?(?:docs|assets)\/[^)\s]+)(\))/g,
        (_match, prefix: string, relativePath: string, suffix: string) => {
            const normalizedPath = relativePath.replace(/^\.\//, '');
            const encodedPath = normalizedPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
            return `${prefix}${baseUrl}/${encodedPath}${suffix}`;
        },
    );
}
