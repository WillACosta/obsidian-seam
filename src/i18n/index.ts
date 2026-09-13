import { en, Translations } from './locales/en';
import { ptBr } from './locales/pt-br';

export type Locale = 'en' | 'pt-br';

let testLocale: Locale | null = null;

/**
 * Explicitly sets a test locale for unit tests or manual override.
 * Pass null to revert to automatic Obsidian detection.
 */
export function setTestLocale(locale: Locale | null): void {
    testLocale = locale;
}

/**
 * Detects the currently configured Obsidian language.
 * Falls back to 'en' for any unsupported languages.
 */
export function detectLocale(): Locale {
    if (testLocale) return testLocale;

    let lang = 'en';
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const obsidian = require('obsidian');
        if (typeof obsidian.getLanguage === 'function') {
            lang = obsidian.getLanguage();
        } else if (typeof window !== 'undefined' && window.localStorage) {
            lang = window.localStorage.getItem('language') || 'en';
        } else if (
            typeof (globalThis as any).moment !== 'undefined' &&
            typeof (globalThis as any).moment.locale === 'function'
        ) {
            lang = (globalThis as any).moment.locale();
        }
    } catch {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                lang = window.localStorage.getItem('language') || 'en';
            }
        } catch {
            lang = 'en';
        }
    }

    const normalized = (lang || '').toLowerCase().trim();
    if (normalized.startsWith('pt')) {
        return 'pt-br';
    }

    return 'en';
}

/**
 * Returns the current localized strings dictionary.
 */
export function t(): Translations {
    const locale = detectLocale();
    return locale === 'pt-br' ? ptBr : en;
}

export { en, ptBr, Translations };
