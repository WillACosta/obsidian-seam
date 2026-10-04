import { App, MarkdownView } from 'obsidian';
import { PaletteItem } from '../types';
import { findSearchMatches } from './SearchService';

/** Open at the first match using Obsidian's temporary selection state. */
export async function openSearchResult(app: App, item: PaletteItem, newLeaf: false | 'tab' | 'split' = false): Promise<void> {
    if (!item.file) return;
    const leaf = newLeaf === 'split' ? app.workspace.getLeaf('split', 'vertical') : app.workspace.getLeaf(newLeaf);
    if (item.file.extension !== 'md') {
        await leaf.openFile(item.file);
        return;
    }
    let content = '';
    try {
        if (item.searchTerms?.length) content = await app.vault.cachedRead(item.file);
    } catch {
        // The file may have changed since the result was listed; still open it.
    }
    const match = findSearchMatches(content, item.searchTerms ?? [])[0];
    const position = (offset: number) => {
        const lines = content.slice(0, offset).split('\n');
        return { line: lines.length - 1, ch: lines[lines.length - 1].length };
    };
    const start = match ? position(match.start) : undefined;
    const end = match ? position(match.end) : undefined;
    const eState = start && end ? { line: start.line, startLoc: start, endLoc: end } : {};
    if (newLeaf === 'split') await leaf.openFile(item.file, { eState });
    else await app.workspace.openLinkText(item.file.path, '', newLeaf, { eState });
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.file === item.file && start && end && view.getMode() === 'source') {
        view.editor.setSelection(start, end);
        view.editor.scrollIntoView({ from: start, to: end }, true);
    }
}
