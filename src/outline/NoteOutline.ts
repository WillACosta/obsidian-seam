import { App, TFile } from 'obsidian';
import { PaletteItem } from '../types';

/** Use Obsidian's Markdown metadata so fenced code and Setext headings follow the native outline. */
export function getNoteOutline(app: App, file: TFile): PaletteItem[] {
    const leaf = app.workspace.getLeaf(false);
    return (app.metadataCache.getFileCache(file)?.headings ?? []).map(heading => ({
        id: `heading-${heading.position.start.line}`,
        title: heading.heading,
        description: '',
        type: 'heading',
        headingLevel: heading.level,
        action: async () => {
            await leaf.openFile(file, { active: true, eState: { line: heading.position.start.line, focus: true } });
        },
    }));
}
