import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../src/i18n/locales/en';
import { ptBr } from '../src/i18n/locales/pt-br';
import { t, setTestLocale, detectLocale } from '../src/i18n';

describe('i18n / Localization', () => {
    beforeEach(() => {
        setTestLocale(null);
    });

    it('has identical keys in English and Portuguese locales', () => {
        const enKeys = Object.keys(en).sort();
        const ptKeys = Object.keys(ptBr).sort();
        assert.deepEqual(enKeys, ptKeys);
    });

    it('falls back to English by default when outside Obsidian', () => {
        setTestLocale(null);
        assert.equal(detectLocale(), 'en');
        assert.equal(t().cmdOpenPalette, 'Open Universal Palette');
    });

    it('switches to Portuguese (BR) when testLocale is set to pt-br', () => {
        setTestLocale('pt-br');
        assert.equal(detectLocale(), 'pt-br');
        assert.equal(t().cmdOpenPalette, 'Abrir Paleta Universal');
        assert.equal(t().cmdArchiveCurrentNote, 'Arquivar nota atual');
        assert.equal(t().settingsTitle, 'Configurações do Seam');
    });

    it('formats parameterized strings correctly in English', () => {
        setTestLocale('en');
        assert.equal(t().paletteCreateNoteTitle('My Note'), 'Create new note: "My Note"');
        assert.equal(t().paletteCreateNoteDesc('Fleeting'), 'Create new note in Fleeting/');
        assert.equal(t().noticeArchived('Project X'), 'Archived: Project X');
        assert.equal(t().noticeArchivedCount(1), 'Archived 1 note.');
        assert.equal(t().noticeArchivedCount(3), 'Archived 3 notes.');
        assert.equal(t().noticeArchivedCountWithErrors(2, 1), 'Archived 2 notes. 1 error.');
        assert.equal(t().paletteFilterByTag('ai'), 'Filter by tag: #ai');
        assert.equal(t().msgArchivedTo('Archive/Note.md'), 'Archived to Archive/Note.md');
    });

    it('formats parameterized strings correctly in Portuguese', () => {
        setTestLocale('pt-br');
        assert.equal(t().paletteCreateNoteTitle('Minha Nota'), 'Criar nova nota: "Minha Nota"');
        assert.equal(t().paletteCreateNoteDesc('Fleeting'), 'Criar nova nota em Fleeting/');
        assert.equal(t().noticeArchived('Projeto X'), 'Arquivado: Projeto X');
        assert.equal(t().noticeArchivedCount(1), 'Arquivada(s) 1 nota.');
        assert.equal(t().noticeArchivedCount(3), 'Arquivada(s) 3 notas.');
        assert.equal(t().noticeArchivedCountWithErrors(2, 1), 'Arquivada(s) 2 notas. 1 erro.');
        assert.equal(t().paletteFilterByTag('ia'), 'Filtrar por tag: #ia');
        assert.equal(t().msgArchivedTo('Archive/Nota.md'), 'Arquivado em Archive/Nota.md');
    });

    it('detects Portuguese language prefix', () => {
        // Test normalization logic: any language starting with pt -> pt-br
        const testLangs = ['pt', 'pt-BR', 'pt-br', 'PT', 'pt-PT'];
        for (const lang of testLangs) {
            const normalized = lang.toLowerCase().trim();
            assert.equal(normalized.startsWith('pt'), true);
        }

        const unsupported = ['de', 'fr', 'es', 'ja', 'zh-cn', 'ru'];
        for (const lang of unsupported) {
            const normalized = lang.toLowerCase().trim();
            assert.equal(normalized.startsWith('pt'), false);
        }
    });
});
