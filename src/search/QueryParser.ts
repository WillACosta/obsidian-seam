import { ParsedQuery, QueryToken, QueryTokenType } from '../types';

export function parseQuery(input: string): ParsedQuery {
    const trimmed = input.trim();
    if (!trimmed) {
        return { tokens: [], isValid: true };
    }

    const rawTokens = trimmed.split(/\s+/);
    const tokens: QueryToken[] = [];
    let isValid = true;

    for (let i = 0; i < rawTokens.length; i++) {
        const t = rawTokens[i];
        if (t.startsWith('-#')) {
            tokens.push({ type: 'negativeTag' as QueryTokenType, value: t.substring(2) });
        } else if (t.startsWith('#')) {
            tokens.push({ type: 'tag' as QueryTokenType, value: t.substring(1) });
        } else if (t.toLowerCase() === 'or') {
            tokens.push({ type: 'or' as QueryTokenType, value: 'or' });
        } else {
            tokens.push({ type: 'text' as QueryTokenType, value: t });
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
