import { AbstractInputSuggest, App, Modal, Notice, parseYaml, Setting, TFile, normalizePath } from 'obsidian';
import { SearchService } from '../search/SearchService';
import { CustomSpecialSearch } from '../types';
import { t } from '../i18n';
import { VaultPathSuggest } from '../ui/VaultPathSuggest';
import { TagFilterSuggest } from '../ui/TagFilterSuggest';
import { registerModalShortcut } from '../utils/modalShortcuts';

type SaveSearch = (search: CustomSpecialSearch) => Promise<void>;

interface BaseViewDefinition { name: string; type: string; }

function normalizeIdentifier(value: string): string {
    const identifier = value.trim().replace(/^@+/, '');
    return identifier ? `@${identifier}` : '';
}

async function readBaseViews(app: App, path: string): Promise<BaseViewDefinition[]> {
    const file = app.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile) || file.extension !== 'base') return [];
    try {
        const parsed = parseYaml(await app.vault.cachedRead(file)) as { views?: Array<{ name?: unknown; type?: unknown }> } | null;
        return (parsed?.views ?? [])
            .filter((view) => typeof view.name === 'string' && typeof view.type === 'string')
            .map((view) => ({ name: view.name as string, type: view.type as string }));
    } catch { return []; }
}

class BaseViewSuggest extends AbstractInputSuggest<BaseViewDefinition> {
    constructor(app: App, inputEl: HTMLInputElement, private readonly getBasePath: () => string, private readonly onSelectView: (view: BaseViewDefinition) => void) {
        super(app, inputEl);
    }
    async getSuggestions(query: string): Promise<BaseViewDefinition[]> {
        const needle = query.toLowerCase();
        return (await readBaseViews(this.app, this.getBasePath()))
            .filter((view) => view.name.toLowerCase().includes(needle) || view.type.toLowerCase().includes(needle));
    }
    renderSuggestion(view: BaseViewDefinition, el: HTMLElement): void { el.createSpan({ text: `${view.name} (${view.type})` }); }
    selectSuggestion(view: BaseViewDefinition, evt: MouseEvent | KeyboardEvent): void {
        this.setValue(view.name);
        this.onSelectView(view);
        super.selectSuggestion(view, evt);
    }
}

export class CustomSpecialSearchModal extends Modal {
    private search: CustomSpecialSearch;
    private baseSetting: Setting | null = null;
    private viewSetting: Setting | null = null;
    private toolbarSetting: Setting | null = null;
    private filterSetting: Setting | null = null;
    private baseViewSuggest: BaseViewSuggest | null = null;
    private baseViewInput: HTMLInputElement | null = null;

    constructor(app: App, existing: CustomSpecialSearch | null, private readonly onSave: SaveSearch, private readonly searchService?: SearchService, private readonly showIcons = true) {
        super(app);
        this.search = existing ? { ...existing, mode: existing.mode ?? (existing.basePath ? 'base' : 'tags') } : {
            id: crypto.randomUUID(), identifier: '', mode: 'tags', basePath: '', baseView: '', showBaseToolbar: false,
            filterQuery: '', pinned: false, hidden: false,
        };
    }

    onOpen(): void {
        this.modalEl.addClass('seam-custom-search-modal');
        this.setTitle(this.search.identifier ? t().customSearchModalEdit : t().customSearchModalNew);
        const identifierSetting = new Setting(this.contentEl).setName(t().customSearchModalIdentifier).setDesc(t().customSearchModalIdentifierDesc);
        identifierSetting.settingEl.addClass('seam-custom-search-text-setting');
        identifierSetting
            .addText((text) => text.setValue(this.search.identifier).onChange((value) => { this.search.identifier = value; }));
        new Setting(this.contentEl).setName(t().customSearchModalMode).setDesc(t().customSearchModalModeDesc)
            .addDropdown((dropdown) => dropdown.addOption('base', t().customSearchModalModeBase).addOption('tags', t().customSearchModalModeTags)
                .setValue(this.search.mode).onChange((value) => { this.search.mode = value as CustomSpecialSearch['mode']; this.updateModeVisibility(); }));

        this.baseSetting = new Setting(this.contentEl).setName(t().customSearchModalBase).setDesc(t().customSearchModalBaseDesc);
        this.baseSetting.settingEl.addClass('seam-custom-search-text-setting');
        this.baseSetting.addText((text) => {
            text.setPlaceholder('Resources/Books.base').setValue(this.search.basePath);
            new VaultPathSuggest(this.app, text.inputEl, 'file', (value) => {
                this.search.basePath = normalizePath(value); this.search.mode = 'base'; this.updateModeVisibility();
            }, (file) => file.extension === 'base');
            text.onChange((value) => { this.search.basePath = normalizePath(value); void this.refreshBaseViewSuggestions(); });
        });

        this.viewSetting = new Setting(this.contentEl).setName(t().customSearchModalView).setDesc(t().customSearchModalViewDesc);
        this.viewSetting.settingEl.addClass('seam-custom-search-text-setting');
        this.viewSetting.addText((text) => {
            text.setPlaceholder(t().customSearchModalViewPlaceholder).setValue(this.search.baseView);
            this.baseViewInput = text.inputEl;
            this.baseViewSuggest = new BaseViewSuggest(this.app, text.inputEl, () => this.search.basePath, (view) => { this.search.baseView = view.name; });
            text.onChange((value) => { this.search.baseView = value; });
        });

        this.toolbarSetting = new Setting(this.contentEl).setName(t().customSearchModalToolbar).setDesc(t().customSearchModalToolbarDesc)
            .addToggle((toggle) => toggle.setValue(this.search.showBaseToolbar).onChange((value) => { this.search.showBaseToolbar = value; }));

        this.filterSetting = new Setting(this.contentEl).setName(t().customSearchModalFilter).setDesc(t().customSearchModalFilterDesc);
        this.filterSetting.settingEl.addClass('seam-custom-search-text-setting');
        this.filterSetting.addText((text) => {
            text.setPlaceholder('#books #reading !#archived').setValue(this.search.filterQuery).onChange((value) => { this.search.filterQuery = value; });
            if (this.searchService) new TagFilterSuggest(this.app, text.inputEl, this.searchService, (value) => { this.search.filterQuery = value; }, this.showIcons);
        });

        const save = async (): Promise<void> => {
            const identifier = normalizeIdentifier(this.search.identifier);
            if (!identifier) return;
            this.search.identifier = identifier;
            this.search.basePath = normalizePath(this.search.basePath.trim());
            this.search.filterQuery = this.search.filterQuery.trim();
            if (this.search.mode === 'base') await this.refreshBaseViewSuggestions();
            if (this.search.mode === 'base' && (!this.search.basePath || !this.search.baseView)) { new Notice(t().customSearchModalBaseRequirement); return; }
            if (this.search.mode === 'tags' && !this.search.filterQuery) { new Notice(t().customSearchModalTagRequirement); return; }
            if (this.search.mode === 'base') this.search.filterQuery = '';
            if (this.search.mode === 'tags') { this.search.basePath = ''; this.search.baseView = ''; }
            void this.onSave({ ...this.search }).then(() => this.close());
        };
        new Setting(this.contentEl).addButton((button) => button.setButtonText(t().customSearchModalCancel).onClick(() => this.close()))
            .addButton((button) => button.setButtonText(t().customSearchModalSave).setCta().onClick(() => { void save(); }));
        registerModalShortcut(this.modalEl, 's', () => { void save(); });
        this.updateModeVisibility();
    }

    private updateModeVisibility(): void {
        this.baseSetting?.settingEl.toggle(this.search.mode === 'base');
        this.viewSetting?.settingEl.toggle(this.search.mode === 'base');
        this.toolbarSetting?.settingEl.toggle(this.search.mode === 'base');
        this.filterSetting?.settingEl.toggle(this.search.mode === 'tags');
        if (this.search.mode === 'base') void this.refreshBaseViewSuggestions();
    }

    private async refreshBaseViewSuggestions(): Promise<void> {
        if (!this.baseViewSuggest) return;
        const views = await readBaseViews(this.app, this.search.basePath);
        if (!views.some((view) => view.name === this.search.baseView)) {
            this.search.baseView = views[0]?.name ?? '';
            if (this.baseViewInput) this.baseViewInput.value = this.search.baseView;
        }
    }
}
