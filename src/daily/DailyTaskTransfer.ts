import { App, MarkdownView, moment, TFile } from 'obsidian';
import { createDailyNote, dailyNoteDate, dailyNotePath, DailyNoteSettings, readDailyNoteSettings } from './DailyNotes';
import { extractPendingTasks, hasPendingTasksInCache } from './PendingTasks';

export interface DailyTaskAvailability { tomorrow: boolean; yesterday: boolean }

export class DailyTaskTransfer {
    private busy = false;
    constructor(private app: App) {}

    private openViews(file: TFile): MarkdownView[] {
        return this.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view)
            .filter((view): view is MarkdownView => view instanceof MarkdownView && view.file?.path === file.path);
    }

    canTransfer(activeFile: TFile, direction: 'tomorrow' | 'yesterday', settings: DailyNoteSettings): boolean {
        const date = dailyNoteDate(activeFile, settings);
        if (!date?.isSame(moment(), 'day')) return false;
        const source = direction === 'tomorrow' ? activeFile
            : this.app.vault.getAbstractFileByPath(dailyNotePath(date.clone().subtract(1, 'day'), settings));
        if (!(source instanceof TFile)) return false;
        const view = this.openViews(source)[0];
        if (view) return Boolean(extractPendingTasks(view.editor.getValue()).pending);
        return hasPendingTasksInCache(this.app.metadataCache.getFileCache(source)?.listItems ?? []);
    }

    async getAvailability(activeFile: TFile | null): Promise<DailyTaskAvailability> {
        const unavailable = { tomorrow: false, yesterday: false };
        if (!activeFile) return unavailable;
        try {
            const settings = await readDailyNoteSettings(this.app);
            const date = dailyNoteDate(activeFile, settings);
            if (!date?.isSame(moment(), 'day')) return unavailable;
            const yesterday = this.app.vault.getAbstractFileByPath(dailyNotePath(date.clone().subtract(1, 'day'), settings));
            const hasPending = async (file: TFile): Promise<boolean> => {
                try {
                    const content = this.openViews(file)[0]?.editor.getValue() ?? await this.app.vault.cachedRead(file);
                    return Boolean(extractPendingTasks(content).pending);
                } catch { return false; }
            };
            const [tomorrow, previous] = await Promise.all([
                hasPending(activeFile), yesterday instanceof TFile ? hasPending(yesterday) : false,
            ]);
            return { tomorrow, yesterday: previous };
        } catch { return unavailable; }
    }

    async transfer(activeFile: TFile, direction: 'tomorrow' | 'yesterday'): Promise<number> {
        if (this.busy) throw new Error('A daily note transfer is already running.');
        this.busy = true;
        try {
            const settings = await readDailyNoteSettings(this.app);
            const date = dailyNoteDate(activeFile, settings);
            if (!date) throw new Error('Open a daily note first.');
            const sourceDate = direction === 'yesterday' ? date.clone().subtract(1, 'day') : date;
            const destinationDate = direction === 'tomorrow' ? date.clone().add(1, 'day') : date;
            const source = this.app.vault.getAbstractFileByPath(dailyNotePath(sourceDate, settings));
            if (!(source instanceof TFile)) return 0;
            if (dailyNotePath(destinationDate, settings) === source.path) throw new Error('Daily Note format must distinguish consecutive days.');
            for (const view of this.openViews(source)) await view.save();
            const original = await this.app.vault.read(source);
            const { remaining, pending, count } = extractPendingTasks(original);
            if (!pending) return 0;
            const destination = await createDailyNote(this.app, destinationDate, settings);
            for (const view of this.openViews(destination)) await view.save();
            let before = '';
            const appended = await this.app.vault.process(destination, content => {
                before = content;
                const newline = content.includes('\r\n') ? '\r\n' : '\n';
                return content + (content ? (content.endsWith(newline) ? newline : newline + newline) : '') + pending.replace(/\r?\n/g, newline) + newline;
            });
            try {
                await this.app.vault.process(source, content => {
                    if (content !== original || this.openViews(source).some(view => view.editor.getValue() !== original)) {
                        throw new Error('The source note changed during transfer. Try again.');
                    }
                    return remaining;
                });
            } catch (error) {
                // Roll back only if no subsequent edit would be overwritten.
                await this.app.vault.process(destination, content => {
                    if (content !== appended || this.openViews(destination).some(view => view.editor.getValue() !== appended)) {
                        throw new Error('Source was preserved; destination also changed. Review both notes before retrying.');
                    }
                    return before;
                });
                throw error;
            }
            return count;
        } finally { this.busy = false; }
    }
}
