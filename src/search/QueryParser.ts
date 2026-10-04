import { ParsedQuery, QueryToken } from '../types';

/**
 * Parses simplified search query expressions.
 * Supports:
 * - Positive tags: #tag
 * - Negative tags: -#tag or !#tag
 * - OR operators: ||, |, or OR
 * - Plain text tokens
 */
export function parseQuery(input: string): ParsedQuery {
    const trimmed = input.trim();
    if (!trimmed) {
        return { tokens: [], isValid: true };
    }

    // Normalize OR symbols like || and single | to have surrounding whitespace
    const normalized = trimmed
        .replace(/\|\|/g, ' || ')
        .replace(/(^|\s)\|(\s|$)/g, ' || ');

    const rawTokens = normalized.match(/(?:dir:|\/)"[^"]*"|\S+/g) ?? [];
    const tokens: QueryToken[] = [];
    let isValid = true;

    for (let i = 0; i < rawTokens.length; i++) {
        const t = rawTokens[i];
        if (t.startsWith('/') || t.toLowerCase().startsWith('dir:')) {
            const value = t.slice(t.startsWith('/') ? 1 : 4).replace(/^"|"$/g, '');
            if (!value) isValid = false;
            tokens.push({ type: 'directory', value });
        } else if (t.startsWith('-#')) {
            tokens.push({ type: 'negativeTag', value: t.substring(2) });
        } else if (t.startsWith('!#')) {
            tokens.push({ type: 'negativeTag', value: t.substring(2) });
        } else if (t.startsWith('#')) {
            tokens.push({ type: 'tag', value: t.substring(1) });
        } else if (t === '||' || t === '|' || t.toLowerCase() === 'or') {
            tokens.push({ type: 'or', value: 'or' });
        } else {
            tokens.push({ type: 'text', value: t });
        }
    }

    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type === 'or') {
            if (i === 0 || i === tokens.length - 1) {
                isValid = false;
            } else {
                const prev = tokens[i - 1].type;
                const next = tokens[i + 1].type;
                const validPrev = prev === 'tag' || prev === 'negativeTag' || prev === 'text' || prev === 'directory';
                const validNext = next === 'tag' || next === 'negativeTag' || next === 'text' || next === 'directory';
                if (!validPrev || !validNext) {
                    isValid = false;
                }
            }
        }
    }

    return { tokens, isValid };
}

/** Matches a folder filter at a query-token boundary, including saved legacy filters. */
export function hasDirectoryFilter(query: string): boolean {
    return /(?:^|\s)(?:\/|dir:)/i.test(query);
}
