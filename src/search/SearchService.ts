import { App, TFile } from 'obsidian';
import { SeamSettings, SearchResult, QueryToken, MatchSnippet } from '../types';
import { parseQuery } from './QueryParser';

/**
 * Extracts all tags from a file using Obsidian's MetadataCache.
 * Returns normalized tag names (lowercase, without # prefix).
 */
export function getFileTags(app: App, file: TFile): string[] {
    const cache = app.metadataCache.getFileCache(file);
    if (!cache) return [];

    const tags: string[] = [];

    // Frontmatter tags
    if (cache.frontmatter?.tags) {
        if (Array.isArray(cache.frontmatter.tags)) {
            tags.push(...cache.frontmatter.tags.map((t: string) => t.replace(/^#/, '').toLowerCase()));
        } else if (typeof cache.frontmatter.tags === 'string') {
            tags.push(
                ...cache.frontmatter.tags
                    .split(',')
                    .map((t: string) => t.trim().replace(/^#/, '').toLowerCase()),
            );
        }
    }

    // Inline tags from metadata cache
    if (cache.tags) {
        for (const tagCache of cache.tags) {
            tags.push(tagCache.tag.substring(1).toLowerCase());
        }
    }

    return [...new Set(tags)];
}

/**
 * Checks if a note's tag matches a search token value (exact or prefix match).
 * E.g., token "ele" matches "electronics", "electricity", "electronics/kicad".
 */
export function tagMatches(fileTag: string, tokenVal: string): boolean {
    const normFileTag = fileTag.toLowerCase();
    const normToken = tokenVal.toLowerCase();

    // Exact match or prefix match on root tag
    if (normFileTag.startsWith(normToken)) {
        return true;
    }

    // Prefix match on any sub-tag segment (e.g., #hardware/electronics matches "ele")
    const segments = normFileTag.split('/');
    return segments.some((seg) => seg.startsWith(normToken));
}

/**
 * Extracts a short snippet of text surrounding a match in the content.
 * Returns the snippet text along with the match position within the snippet.
 */
export function extractMatchSnippet(
    content: string,
    query: string,
    contextChars: number = 60,
): MatchSnippet | null {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerContent.indexOf(lowerQuery);

    if (matchIndex === -1) return null;

    // Find reasonable boundaries around the match
    let snippetStart = Math.max(0, matchIndex - contextChars);
    let snippetEnd = Math.min(content.length, matchIndex + query.length + contextChars);

    // Snap to word boundaries when possible
    if (snippetStart > 0) {
        const spaceIndex = content.indexOf(' ', snippetStart);
        if (spaceIndex !== -1 && spaceIndex < matchIndex) {
            snippetStart = spaceIndex + 1;
        }
    }
    if (snippetEnd < content.length) {
        const spaceIndex = content.lastIndexOf(' ', snippetEnd);
        if (spaceIndex !== -1 && spaceIndex > matchIndex + query.length) {
            snippetEnd = spaceIndex;
        }
    }

    let snippetText = content.slice(snippetStart, snippetEnd).trim();

    // Clean up: collapse whitespace and newlines
    snippetText = snippetText.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ');

    // Add ellipsis indicators
    const prefix = snippetStart > 0 ? '…' : '';
    const suffix = snippetEnd < content.length ? '…' : '';

    const finalSnippet = `${prefix}${snippetText}${suffix}`;

    // Recalculate the match position within the final snippet
    const lowerFinal = finalSnippet.toLowerCase();
    const newMatchStart = lowerFinal.indexOf(lowerQuery);

    if (newMatchStart === -1) return null;

    return {
        text: finalSnippet,
        matchStart: newMatchStart,
        matchEnd: newMatchStart + query.length,
    };
}

/**
 * Search service for the Universal Palette.
 * Uses MetadataCache for tag-based search and file listing for text search.
 * Supports prefix tag filtering, || OR operator, and in-note content search.
 */
export class SearchService {
    private searchVersion = 0;
    private contentCache: Map<string, string> = new Map();

    constructor(
        private app: App,
        private settings: SeamSettings,
    ) {}

    updateSettings(settings: SeamSettings): void {
        this.settings = settings;
    }

    /**
     * Execute a search query and return matching results.
     * Supports tag queries (#tag, -#tag, ||, OR) and plain text title/path/content search.
     */
    search(query: string): SearchResult[] {
        this.searchVersion++;
        const trimmed = query.trim();
        if (!trimmed) return [];

        const files = this.app.vault.getMarkdownFiles();

        // If query contains no # characters, treat as text search
        if (!trimmed.includes('#')) {
            return this.textSearch(trimmed, files);
        }

        // Otherwise, parse as tag query
        return this.tagSearch(trimmed, files);
    }

    private textSearch(query: string, files: TFile[]): SearchResult[] {
        const lowerQuery = query.toLowerCase();
        const results: SearchResult[] = [];

        for (const file of files) {
            // Match against title/path first
            const titleMatch =
                file.basename.toLowerCase().includes(lowerQuery) ||
                file.path.toLowerCase().includes(lowerQuery);

            // Try in-note content search
            let matchSnippet: MatchSnippet | undefined;
            const cachedContent = this.getCachedContent(file);

            if (cachedContent) {
                // Strip frontmatter before searching content
                const bodyContent = this.stripFrontmatter(cachedContent);
                const snippet = extractMatchSnippet(bodyContent, query);
                if (snippet) {
                    matchSnippet = snippet;
                }
            }

            if (titleMatch || matchSnippet) {
                results.push({
                    file,
                    title: file.basename,
                    path: file.path,
                    tags: getFileTags(this.app, file),
                    matchSnippet,
                });
            }
        }

        // Sort: title matches first, then content-only matches, alphabetically within each group
        results.sort((a, b) => {
            const aTitle = a.title.toLowerCase().includes(lowerQuery) ? 0 : 1;
            const bTitle = b.title.toLowerCase().includes(lowerQuery) ? 0 : 1;
            if (aTitle !== bTitle) return aTitle - bTitle;
            return a.title.localeCompare(b.title);
        });

        return results;
    }

    /**
     * Gets the cached content of a file from Obsidian's cache.
     * Uses a local Map to avoid redundant reads within the same search operation.
     */
    private getCachedContent(file: TFile): string | null {
        const cached = this.contentCache.get(file.path);
        if (cached !== undefined) return cached;

        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) return null;

        // Use vault.cachedRead via synchronous metadata approach
        // The content is available through the sections in the cache
        // but for actual text content we need to store it differently
        // We'll populate this cache lazily - return null for now and
        // rely on the synchronous cachedRead pattern
        return null;
    }

    /**
     * Asynchronous search that includes in-note content matching.
     * Call this instead of search() when content search is needed.
     */
    async searchWithContent(query: string): Promise<SearchResult[]> {
        this.searchVersion++;
        const currentVersion = this.searchVersion;
        const trimmed = query.trim();
        if (!trimmed) return [];

        const files = this.app.vault.getMarkdownFiles();

        // If query contains no # characters, treat as text search with content
        if (!trimmed.includes('#')) {
            return this.textSearchWithContent(trimmed, files, currentVersion);
        }

        // Otherwise, parse as tag query (synchronous, no content search needed)
        return this.tagSearch(trimmed, files);
    }

    private async textSearchWithContent(
        query: string,
        files: TFile[],
        searchVersion: number,
    ): Promise<SearchResult[]> {
        const lowerQuery = query.toLowerCase();
        const results: SearchResult[] = [];

        for (const file of files) {
            // Stale search guard
            if (this.searchVersion !== searchVersion) return [];

            const titleMatch =
                file.basename.toLowerCase().includes(lowerQuery) ||
                file.path.toLowerCase().includes(lowerQuery);

            let matchSnippet: MatchSnippet | undefined;

            try {
                const content = await this.app.vault.cachedRead(file);
                if (content) {
                    const bodyContent = this.stripFrontmatter(content);
                    const snippet = extractMatchSnippet(bodyContent, query);
                    if (snippet) {
                        matchSnippet = snippet;
                    }
                }
            } catch {
                // File may have been deleted/moved during search
            }

            if (titleMatch || matchSnippet) {
                results.push({
                    file,
                    title: file.basename,
                    path: file.path,
                    tags: getFileTags(this.app, file),
                    matchSnippet,
                });
            }
        }

        // Stale search guard
        if (this.searchVersion !== searchVersion) return [];

        // Sort: title matches first, then content-only matches
        results.sort((a, b) => {
            const aTitle = a.title.toLowerCase().includes(lowerQuery) ? 0 : 1;
            const bTitle = b.title.toLowerCase().includes(lowerQuery) ? 0 : 1;
            if (aTitle !== bTitle) return aTitle - bTitle;
            return a.title.localeCompare(b.title);
        });

        return results;
    }

    /**
     * Strips YAML frontmatter from note content so we only search the body text.
     */
    private stripFrontmatter(content: string): string {
        if (content.startsWith('---')) {
            const endIndex = content.indexOf('---', 3);
            if (endIndex !== -1) {
                return content.slice(endIndex + 3).trim();
            }
        }
        return content;
    }

    private tagSearch(query: string, files: TFile[]): SearchResult[] {
        const parsed = parseQuery(query);
        if (!parsed.isValid || parsed.tokens.length === 0) return [];

        // Split tokens into OR-separated segments
        const segments: QueryToken[][] = [];
        let currentSegment: QueryToken[] = [];

        for (const token of parsed.tokens) {
            if (token.type === 'or') {
                if (currentSegment.length > 0) {
                    segments.push(currentSegment);
                }
                currentSegment = [];
            } else {
                currentSegment.push(token);
            }
        }
        if (currentSegment.length > 0) {
            segments.push(currentSegment);
        }

        const results: SearchResult[] = [];

        for (const file of files) {
            const fileTags = getFileTags(this.app, file);

            // A file matches if ANY OR-segment matches
            const matches = segments.some((segment) => this.segmentMatches(segment, fileTags));

            if (matches) {
                results.push({
                    file,
                    title: file.basename,
                    path: file.path,
                    tags: fileTags,
                });
            }
        }

        results.sort((a, b) => a.title.localeCompare(b.title));
        return results;
    }

    /**
     * A segment matches if ALL positive tags match (prefix or exact)
     * AND NO negative tags match.
     */
    private segmentMatches(segment: QueryToken[], fileTags: string[]): boolean {
        if (segment.length === 0) return false;

        for (const token of segment) {
            const tokenVal = token.value.toLowerCase();

            if (token.type === 'tag') {
                // Positive tag: must match at least one file tag (prefix or exact)
                const found = fileTags.some((ft) => tagMatches(ft, tokenVal));
                if (!found) return false;
            } else if (token.type === 'negativeTag') {
                // Negative tag: must NOT match any file tag
                const found = fileTags.some((ft) => tagMatches(ft, tokenVal));
                if (found) return false;
            }
        }

        return true;
    }
}
