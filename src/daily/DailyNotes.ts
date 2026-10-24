import { App, moment, normalizePath, TFile } from 'obsidian';
import type { Moment } from 'moment';

export interface DailyNoteSettings { folder: string; format: string; template: string }
export const DEFAULT_DAILY_SETTINGS: DailyNoteSettings = { folder: '', format: 'YYYY-MM-DD', template: '' };

/** Read core Daily Notes preferences through the public vault adapter. */
export async function readDailyNoteSettings(app: App): Promise<DailyNoteSettings> {
    const path = normalizePath(`${app.vault.configDir}/daily-notes.json`);
    if (!await app.vault.adapter.exists(path)) return { ...DEFAULT_DAILY_SETTINGS };
    const data: unknown = JSON.parse(await app.vault.adapter.read(path));
    if (!data || typeof data !== 'object') throw new Error('Invalid Daily Notes settings.');
    const values = data as Record<string, unknown>;
    return {
        folder: typeof values.folder === 'string' ? values.folder : '',
        format: typeof values.format === 'string' && values.format.trim() ? values.format : 'YYYY-MM-DD',
        template: typeof values.template === 'string' ? values.template : '',
    };
}

export function dailyNotePath(date: Moment, settings: DailyNoteSettings): string {
    return normalizePath([settings.folder.replace(/^\/+|\/+$/g, ''), date.format(settings.format) + '.md'].filter(Boolean).join('/'));
}

export function dailyNoteDate(file: TFile, settings: DailyNoteSettings): Moment | null {
    if (file.extension !== 'md') return null;
    const folder = settings.folder.replace(/^\/+|\/+$/g, '');
    const prefix = folder ? folder + '/' : '';
    if (!file.path.startsWith(prefix)) return null;
    const relative = file.path.slice(prefix.length, -3);
    const date = moment(relative, settings.format, true);
    return date.isValid() && dailyNotePath(date, settings) === file.path ? date : null;
}

/** Offer creation only when the actual daily-note path is unoccupied. */
export async function getMissingDailyNote(app: App, search: 'today' | 'yesterday'): Promise<{
    date: Moment; settings: DailyNoteSettings; path: string;
} | null> {
    const settings = await readDailyNoteSettings(app);
    const date = moment();
    if (search === 'yesterday') date.subtract(1, 'day');
    const path = dailyNotePath(date, settings);
    return app.vault.getAbstractFileByPath(path) ? null : { date, settings, path };
}

export async function createDailyNote(app: App, date: Moment, settings: DailyNoteSettings): Promise<TFile> {
    const path = dailyNotePath(date, settings);
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    if (existing) throw new Error(`Daily note path is occupied: ${path}`);
    let content = '';
    if (settings.template.trim()) {
        const templatePath = normalizePath(settings.template.replace(/\.md$/i, '') + '.md');
        const template = app.vault.getAbstractFileByPath(templatePath);
        if (!(template instanceof TFile)) throw new Error(`Daily Note template not found: ${templatePath}`);
        content = await app.vault.read(template);
        content = content.replace(/{{\s*(date|time|title)\s*(?::([^}]+))?}}/gi, (_match, token: string, format?: string) => {
            if (token.toLowerCase() === 'title') return date.format(settings.format).split('/').pop() ?? '';
            return (token.toLowerCase() === 'time' ? moment() : date).format(format?.trim() || (token.toLowerCase() === 'time' ? 'HH:mm' : settings.format));
        });
    }
    const parts = path.split('/');
    parts.pop();
    let folder = '';
    for (const part of parts) {
        folder = folder ? `${folder}/${part}` : part;
        if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
    }
    return app.vault.create(path, content);
}
