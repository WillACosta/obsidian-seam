import { App, TFile } from 'obsidian';
import { SeamSettings, SearchResult } from '../types';
import { parseQuery } from './QueryParser';
import { QueryToken } from '../types';

/**
 * Extracts all tags from a file using Obsidian's MetadataCache.
 * Returns normalized tag names (lowercase, without # prefix).
 */
function getFileTags(app: App, file: TFile): string[] {
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
 * Search service for the Universal Palette.
 * Uses MetadataCache for tag-based search and file listing for text search.
 * Does not build a separate search index.
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
     * Supports tag queries (#tag, -#tag, OR) and plain text title/path search.
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
     * A segment matches if ALL positive tags are present
     * AND NO negative tags are present.
     */
    private segmentMatches(segment: QueryToken[], fileTags: string[]): boolean {
        if (segment.length === 0) return false;

        for (const token of segment) {
            const tokenVal = token.value.toLowerCase();

            if (token.type === 'tag') {
                // Positive tag: must be present (supports parent match for nested tags)
                const found = fileTags.some(
                    (ft) => ft === tokenVal || ft.startsWith(tokenVal + '/'),
                );
                if (!found) return false;
            } else if (token.type === 'negativeTag') {
                // Negative tag: must NOT be present
                const found = fileTags.some(
                    (ft) => ft === tokenVal || ft.startsWith(tokenVal + '/'),
                );
                if (found) return false;
            }
            // 'text' tokens in a tag query are ignored (user likely meant a tag)
        }

        return true;
    }
}
