import { App, MarkdownView, TFile } from 'obsidian';

export interface NoteCompletion { total: number; unfinished: number; partial: number; completed: number; percent: number }

export function summarizeTasks(statuses: string[]): NoteCompletion {
    const total = statuses.length;
    const unfinished = statuses.filter(status => status === ' ').length;
    const partial = statuses.filter(status => status === '/').length;
    const completed = total - unfinished - partial;
    return { total, unfinished, partial, completed, percent: total ? Math.round(completed / total * 100) : 0 };
}

/** Ignore frontmatter, fenced/indented code, and comments; keep nested and quoted task lists. */
export function countNoteTasks(content: string): NoteCompletion {
    const statuses: string[] = [];
    let frontmatter = content.startsWith('---\n') || content.startsWith('---\r\n');
    let fence: string | null = null;
    let comment: string | null = null;
    const parents: { indent: number; contentIndent: number }[] = [];
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (frontmatter) { if (i > 0 && /^(---|\.\.\.)\s*$/.test(line)) frontmatter = false; continue; }
        line = line.replace(/^(?:\s*>[\t ]?)+/, '');
        const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
        if (fence) {
            if (marker && marker[0] === fence[0] && marker.length >= fence.length && /^\s*(`+|~+)\s*$/.test(line)) fence = null;
            continue;
        }
        if (!comment && marker) { fence = marker; continue; }
        // Strip comment spans while retaining visible text either side.
        let visible = '';
        while (line.length) {
            if (comment) {
                const end = line.indexOf(comment);
                if (end < 0) { line = ''; break; }
                line = line.slice(end + comment.length); comment = null;
            } else {
                const match = /<!--|%%/.exec(line);
                if (!match) { visible += line; break; }
                visible += line.slice(0, match.index);
                comment = match[0] === '<!--' ? '-->' : '%%';
                line = line.slice(match.index + match[0].length);
            }
        }
        line = visible;
        const item = /^(\s*)((?:[-+*]|\d+[.)])\s+)(?:\[([^\]])\](?:\s|$))?/.exec(line);
        const indent = (item?.[1] ?? line.match(/^\s*/)?.[0] ?? '').replace(/\t/g, '    ').length;
        if (!item) {
            if (line.trim()) while (parents.length && indent < parents[parents.length - 1].contentIndent) parents.pop();
            continue;
        }
        while (parents.length && indent <= parents[parents.length - 1].indent) parents.pop();
        const contentIndent = parents[parents.length - 1]?.contentIndent ?? 0;
        if (indent >= contentIndent + 4) continue;
        parents.push({ indent, contentIndent: indent + item[2].replace(/\t/g, '    ').length });
        if (item[3] !== undefined) statuses.push(item[3]);
    }
    return summarizeTasks(statuses);
}

export function currentNoteCompletion(app: App, file: TFile): NoteCompletion {
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.file?.path === file.path && view.getMode() === 'source') return countNoteTasks(view.editor.getValue());
    return summarizeTasks((app.metadataCache.getFileCache(file)?.listItems ?? []).flatMap(item => item.task === undefined ? [] : [item.task]));
}

export async function readNoteCompletion(app: App, file: TFile): Promise<NoteCompletion> {
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    const content = view?.file?.path === file.path && view.getMode() === 'source' ? view.editor.getValue() : await app.vault.cachedRead(file);
    return countNoteTasks(content);
}
