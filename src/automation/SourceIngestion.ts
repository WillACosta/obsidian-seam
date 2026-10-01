import { App, TFile, TFolder, moment, normalizePath, parseYaml, stringifyYaml } from 'obsidian';
import { SeamSettings, AutomationResult } from '../types';
import { t } from '../i18n';
import { DOCUMENT_EXTENSIONS, IMAGE_EXTENSIONS, EMBEDDABLE_SOURCE_EXTENSIONS } from '../utils/attachments';

const SOURCE_EXTENSIONS = new Set([...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS]);

/** Vault-relative folder paths only; never let a setting escape the vault. */
function folderPath(value: string): string {
    const path = normalizePath(value.trim().replace(/^\/+|\/+$/g, ''));
    if (path.split('/').some(part => part === '..' || part === '.')) {
        throw new Error(t().sourceInvalidFolder);
    }
    return path;
}

/** Serialized registration shared by automatic and manual ingestion. */
export class SourceIngestion {
    private tail: Promise<unknown> = Promise.resolve();
    private stopped = false;
    private renamedPaths = new Map<string, TFile>();

    constructor(private app: App, private settings: SeamSettings) {}

    updateSettings(settings: SeamSettings): void { this.settings = settings; }
    destroy(): void { this.stopped = true; this.renamedPaths.clear(); }

    onRename(file: TFile, oldPath: string): void {
        this.renamedPaths.set(oldPath, file);
    }

    isSource(file: TFile): boolean {
        try {
            const folder = folderPath(this.settings.sourcesFolder);
            return SOURCE_EXTENSIONS.has(file.extension.toLowerCase())
                && (!folder || file.path.startsWith(`${folder}/`));
        } catch { return false; }
    }

    getAttachments(): TFile[] {
        return this.app.vault.getFiles().filter(file => this.isSource(file))
            .sort((a, b) => a.path.localeCompare(b.path));
    }

    createCompanion(file: TFile, manual = false): Promise<AutomationResult> {
        const task = this.tail.then(() => this.register(file, manual));
        this.tail = task.catch(() => undefined);
        return task;
    }

    private resolvesTo(link: string, note: TFile, attachment: TFile): boolean {
        let path = link.replace(/^!?(?:\[\[)/, '').replace(/\]\]$/, '').split('|')[0].split('#')[0];
        try { path = decodeURIComponent(path); } catch { /* Keep literal filenames. */ }
        const resolved = this.app.metadataCache.getFirstLinkpathDest(path, note.path);
        if (resolved) return resolved.path === attachment.path;
        // Vault rename fires before Obsidian rewrites links and refreshes metadata.
        // Keep old paths tied to the file object during that transition.
        const relative = normalizePath(`${note.path.split('/').slice(0, -1).join('/')}/${path}`);
        for (const [oldPath, renamed] of this.renamedPaths) {
            if (renamed !== attachment) continue;
            if (path === oldPath || relative === oldPath) return true;
            if (!path.includes('/') && oldPath.split('/').pop() === path) return true;
        }
        return false;
    }

    private async findCompanion(attachment: TFile): Promise<TFile | null> {
        // Search all lifecycle folders, not just Fleeting. Read content too because
        // metadata may lag immediately after creation, sync, or a rename.
        for (const note of this.app.vault.getMarkdownFiles()) {
            const templatePath = this.settings.sourceNoteTemplate.trim();
            if (templatePath && note.path === normalizePath(templatePath.replace(/\.md$/i, '') + '.md')) continue;
            const cache = this.app.metadataCache.getFileCache(note);
            const references = [...(cache?.links ?? []), ...(cache?.embeds ?? []), ...(cache?.frontmatterLinks ?? [])];
            if (references.some(ref => this.resolvesTo(ref.link, note, attachment))) return note;
            // Indexed notes already have their links available without disk reads.
            // Newly created/synced notes fall back to their content until indexed.
            if (cache) continue;
            const content = await this.app.vault.cachedRead(note);
            const wikilinks = content.match(/!?\[\[[^\]\n]+\]\]/g) ?? [];
            if (wikilinks.some(link => this.resolvesTo(link, note, attachment))) return note;
            const markdownLinks = content.matchAll(/!?\[[^\]\n]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g);
            for (const link of markdownLinks) {
                if (this.resolvesTo(link[1] ?? link[2], note, attachment)) return note;
            }
        }
        return null;
    }

    private async ensureFolder(path: string): Promise<void> {
        if (!path) return;
        const existing = this.app.vault.getAbstractFileByPath(path);
        if (existing instanceof TFolder) return;
        if (existing) throw new Error(t().sourceFolderConflict(path));
        const parent = path.split('/').slice(0, -1).join('/');
        await this.ensureFolder(parent);
        try { await this.app.vault.createFolder(path); }
        catch (error) {
            if (!(this.app.vault.getAbstractFileByPath(path) instanceof TFolder)) throw error;
        }
    }

    private async buildContent(attachment: TFile, notePath: string): Promise<string> {
        const captured = moment().format('YYYY-MM-DD');
        const linktext = this.app.metadataCache.fileToLinktext(attachment, notePath);
        const original = `${EMBEDDABLE_SOURCE_EXTENSIONS.has(attachment.extension.toLowerCase()) ? '!' : ''}[[${linktext}]]`;
        let content = `## Original\n\n${original}\n`;
        const templatePath = this.settings.sourceNoteTemplate.trim();
        if (templatePath) {
            const template = this.app.vault.getAbstractFileByPath(normalizePath(templatePath.replace(/\.md$/i, '') + '.md'));
            if (!(template instanceof TFile) || template.extension !== 'md') throw new Error(t().sourceTemplateMissing);
            content = await this.app.vault.cachedRead(template);
            const values: Record<string, string> = {
                attachment: original, attachment_path: attachment.path,
                title: attachment.basename, date: captured,
            };
            content = content.replace(/\{\{\s*(attachment|attachment_path|title|date)\s*\}\}/g, (_, key: string) => values[key]);
            if (!content.includes(original)) content += `\n\n## Original\n\n${original}\n`;
        }
        const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
        let frontmatter: Record<string, unknown> = {};
        if (match) {
            const parsed: unknown = parseYaml(match[1]);
            if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) throw new Error(t().sourceInvalidTemplate);
            frontmatter = (parsed ?? {}) as Record<string, unknown>;
            content = content.slice(match[0].length);
        }
        const rawTags = frontmatter.tags;
        const tags = Array.isArray(rawTags) ? rawTags.map(String)
            : typeof rawTags === 'string' ? rawTags.split(',').map(tag => tag.trim()) : [];
        if (!tags.some(tag => tag.replace(/^#/, '').toLowerCase() === 'source')) tags.push('source');
        frontmatter.tags = tags;
        frontmatter.captured ??= captured;
        if (attachment.extension.toLowerCase() === 'pdf') {
            const rawClasses = frontmatter.cssclasses;
            const classes = Array.isArray(rawClasses) ? rawClasses.map(String)
                : typeof rawClasses === 'string' ? rawClasses.split(/\s+/).filter(Boolean) : [];
            frontmatter.cssclasses = [...new Set([...classes, 'seam-source-pdf'])];
        }
        return `---\n${stringifyYaml(frontmatter).trimEnd()}\n---\n\n${content.trim()}\n`;
    }

    private async register(file: TFile, manual: boolean): Promise<AutomationResult> {
        const result = (status: AutomationResult['status'], message: string, newPath?: string): AutomationResult =>
            ({ status, file, action: 'source', message, newPath });
        try {
            if (this.stopped || (!manual && !this.settings.sourceAutomation)) return result('skipped', t().sourceAutomationDisabled);
            const current = this.app.vault.getAbstractFileByPath(file.path);
            if (!(current instanceof TFile) || !this.isSource(current)) return result('skipped', t().sourceUnsupported);
            const existing = await this.findCompanion(current);
            if (existing) return result('skipped', t().sourceAlreadyRegistered, existing.path);
            const folder = folderPath(this.settings.fleetingFolder);
            await this.ensureFolder(folder);
            for (let suffix = 0; suffix < 1000; suffix++) {
                if (this.stopped || (!manual && !this.settings.sourceAutomation)) return result('skipped', t().sourceAutomationDisabled);
                if (this.app.vault.getAbstractFileByPath(current.path) !== current || !this.isSource(current)) {
                    return result('skipped', t().sourceUnsupported);
                }
                const name = `${current.basename}${suffix ? ` (${suffix})` : ''}.md`;
                const path = normalizePath(`${folder ? `${folder}/` : ''}${name}`);
                if (this.app.vault.getAbstractFileByPath(path)) continue;
                const attachmentPath = current.path;
                const content = await this.buildContent(current, path);
                if (this.stopped || (!manual && !this.settings.sourceAutomation)) return result('skipped', t().sourceAutomationDisabled);
                if (this.app.vault.getAbstractFileByPath(current.path) !== current || !this.isSource(current)) return result('skipped', t().sourceUnsupported);
                if (current.path !== attachmentPath) return this.register(current, manual);
                try { await this.app.vault.create(path, content); }
                catch (error) {
                    if (this.app.vault.getAbstractFileByPath(path)) continue;
                    throw error;
                }
                return result('success', t().sourceCreated, path);
            }
            throw new Error(t().sourceNoFilename);
        } catch (error) {
            return result('error', error instanceof Error ? error.message : t().sourceCreationFailed);
        }
    }
}
