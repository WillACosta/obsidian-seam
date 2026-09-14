import { ParsedQuery, QueryToken, QueryTokenType } from '../types';

/**
 * Parses simplified search query expressions.
 * Supports:
 * - Positive tags: #tag
 * - Negative tags: -#tag
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

    const rawTokens = normalized.split(/\s+/).filter((t) => t.length > 0);
    const tokens: QueryToken[] = [];
    let isValid = true;

    for (let i = 0; i < rawTokens.length; i++) {
        const t = rawTokens[i];
        if (t.startsWith('-#')) {
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
                const validPrev = prev === 'tag' || prev === 'negativeTag' || prev === 'text';
                const validNext = next === 'tag' || next === 'negativeTag' || next === 'text';
                if (!validPrev || !validNext) {
                    isValid = false;
                }
            }
        }
    }

    return { tokens, isValid };
}
