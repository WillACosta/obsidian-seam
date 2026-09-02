import { App, TFile } from 'obsidian';
import { SeamSettings, SearchResult, QueryToken } from '../types';
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
 * Search service for the Universal Palette.
 * Uses MetadataCache for tag-based search and file listing for text search.
 * Supports prefix tag filtering and || OR operator.
 */
export class SearchService {
    private searchVersion = 0;

    constructor(
        private app: App,
        private settings: SeamSettings,
    ) {}

    updateSettings(settings: SeamSettings): void {
        this.settings = settings;
    }

    /**
     * Execute a search query and return matching results.
     * Supports tag queries (#tag, -#tag, ||, OR) and plain text title/path search.
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
            if (
                file.basename.toLowerCase().includes(lowerQuery) ||
                file.path.toLowerCase().includes(lowerQuery)
            ) {
                results.push({
                    file,
                    title: file.basename,
                    path: file.path,
                    tags: getFileTags(this.app, file),
                });
            }
        }

        results.sort((a, b) => a.title.localeCompare(b.title));
        return results;
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
