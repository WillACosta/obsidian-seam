import { AbstractInputSuggest, App, Modal, Setting } from 'obsidian';
import {
    CustomSpecialSearch,
    PipelineDirection,
    SpecialSearchPipeline,
    SpecialSearchPipelineNode,
} from '../types';
import { t } from '../i18n';
import { registerModalShortcut } from '../utils/modalShortcuts';

type SavePipeline = (pipeline: SpecialSearchPipeline) => Promise<void>;

interface PipelineQueryOption { id: string; label: string; description: string; }

const BUILTIN_QUERIES: PipelineQueryOption[] = [
    { id: '@untagged', label: '@untagged', description: 'Notes without tags' },
    { id: '@docs', label: '@docs', description: 'Notes with document attachments' },
    { id: '@images', label: '@images', description: 'Notes with image attachments' },
    { id: '@task', label: '@task', description: 'Notes with tasks' },
    { id: '@todo', label: '@todo', description: 'Notes with incomplete tasks' },
    { id: '@done', label: '@done', description: 'Notes with completed tasks' },
    { id: '@code', label: '@code', description: 'Notes with code snippets' },
];

class PipelineQuerySuggest extends AbstractInputSuggest<PipelineQueryOption> {
    constructor(app: App, inputEl: HTMLInputElement, private readonly options: () => PipelineQueryOption[], private readonly onSelectQuery: (query: PipelineQueryOption) => void) {
        super(app, inputEl);
    }
    getSuggestions(query: string): PipelineQueryOption[] {
        const needle = query.toLowerCase();
        return this.options().filter((option) => option.label.toLowerCase().includes(needle));
    }
    renderSuggestion(option: PipelineQueryOption, el: HTMLElement): void {
        el.createDiv({ text: option.label });
        el.createDiv({ cls: 'setting-item-description', text: option.description });
    }
    selectSuggestion(option: PipelineQueryOption, evt: MouseEvent | KeyboardEvent): void {
        this.onSelectQuery(option);
        this.setValue('');
        super.selectSuggestion(option, evt);
    }
}

function createNodes(queryIds: string[]): SpecialSearchPipelineNode[] {
    return queryIds.map((queryId, index) => ({ queryId, x: 20 + (index % 3) * 220, y: 20 + Math.floor(index / 3) * 100 }));
}

export class SpecialSearchPipelineModal extends Modal {
    private pipeline: SpecialSearchPipeline;
    private canvasEl: HTMLElement | null = null;
    private fromSelect: HTMLSelectElement | null = null;
    private toSelect: HTMLSelectElement | null = null;

    constructor(app: App, existing: SpecialSearchPipeline | null, private readonly queries: CustomSpecialSearch[], private readonly onSave: SavePipeline) {
        super(app);
        if (existing) {
            const queryIds = [...existing.queryIds];
            this.pipeline = {
                ...existing,
                queryIds,
                nodes: existing.nodes?.length ? existing.nodes.map((node) => ({ ...node })) : createNodes(queryIds),
                connections: existing.connections?.length ? existing.connections.map((connection) => ({ ...connection })) : queryIds.slice(1).map((queryId, index) => ({ from: queryIds[index], to: queryId })),
            };
        } else {
            this.pipeline = { id: crypto.randomUUID(), name: '', queryIds: [], direction: 'right', nodes: [], connections: [] };
        }
    }

    onOpen(): void {
        this.modalEl.addClass('seam-custom-search-pipeline-modal');
        this.setTitle(this.pipeline.name ? t().pipelineModalEdit : t().pipelineModalNew);
        new Setting(this.contentEl).setName(t().pipelineModalName).setDesc(t().pipelineModalNameDesc)
            .addText((text) => text.setValue(this.pipeline.name).onChange((value) => { this.pipeline.name = value; }));

        const querySetting = new Setting(this.contentEl).setName(t().pipelineModalQueries).setDesc(t().pipelineModalQueriesDesc);
        const queryControl = querySetting.controlEl.createDiv({ cls: 'seam-pipeline-query-selector' });
        const chips = queryControl.createDiv({ cls: 'seam-pipeline-query-chips' });
        const input = queryControl.createEl('input', { type: 'text', placeholder: t().pipelineModalQueryPlaceholder });
        new PipelineQuerySuggest(this.app, input, () => this.availableOptions(), (option) => this.addQuery(option.id)).onSelect(() => this.renderQueryChips(chips, input));
        input.addEventListener('input', () => this.renderQueryChips(chips, input));
        this.renderQueryChips(chips, input);

        new Setting(this.contentEl).setName(t().pipelineModalDirection).setDesc(t().pipelineModalDirectionDesc)
            .addDropdown((dropdown) => dropdown.addOption('right', t().pipelineModalDirectionRight).addOption('left', t().pipelineModalDirectionLeft)
                .setValue(this.pipeline.direction).onChange((value) => { this.pipeline.direction = value as PipelineDirection; }));

        new Setting(this.contentEl).setName(t().pipelineModalCanvas).setDesc(t().pipelineModalCanvasDesc);
        this.canvasEl = this.contentEl.createDiv({ cls: 'seam-pipeline-canvas' });
        this.renderCanvas();
        this.renderConnectionControls();

        const save = (): void => {
            this.pipeline.name = this.pipeline.name.trim().replace(/^@+/, '');
            if (!this.pipeline.name || this.pipeline.queryIds.length < 2) return;
            this.pipeline.name = `@${this.pipeline.name}`;
            void this.onSave({ ...this.pipeline, nodes: this.pipeline.nodes.map((node) => ({ ...node })), connections: this.pipeline.connections.map((connection) => ({ ...connection })) }).then(() => this.close());
        };
        new Setting(this.contentEl).addButton((button) => button.setButtonText(t().customSearchModalCancel).onClick(() => this.close()))
            .addButton((button) => button.setButtonText(t().pipelineModalSave).setCta().onClick(save));
        registerModalShortcut(this.modalEl, 's', save);
    }

    private availableOptions(): PipelineQueryOption[] {
        return [
            ...this.queries.map((query) => ({ id: query.id, label: query.identifier, description: query.basePath || query.filterQuery })),
            ...BUILTIN_QUERIES,
        ].filter((option) => !this.pipeline.queryIds.includes(option.id));
    }

    private addQuery(queryId: string): void {
        if (this.pipeline.queryIds.includes(queryId)) return;
        this.pipeline.queryIds.push(queryId);
        const index = this.pipeline.nodes.length;
        this.pipeline.nodes.push({ queryId, x: 20 + (index % 3) * 220, y: 20 + Math.floor(index / 3) * 100 });
        this.renderCanvas();
        this.renderConnectionControls();
    }

    private removeQuery(queryId: string): void {
        this.pipeline.queryIds = this.pipeline.queryIds.filter((id) => id !== queryId);
        this.pipeline.nodes = this.pipeline.nodes.filter((node) => node.queryId !== queryId);
        this.pipeline.connections = this.pipeline.connections.filter((connection) => connection.from !== queryId && connection.to !== queryId);
        this.renderCanvas();
        this.renderConnectionControls();
    }

    private renderQueryChips(chips: HTMLElement, input: HTMLInputElement): void {
        chips.empty();
        for (const queryId of this.pipeline.queryIds) {
            const option = this.optionForId(queryId);
            const chip = chips.createSpan({ cls: 'seam-pipeline-query-chip', text: option?.label ?? queryId });
            const remove = chip.createEl('button', { text: '×', attr: { 'aria-label': `Remove ${option?.label ?? queryId}` } });
            remove.addEventListener('click', () => { this.removeQuery(queryId); input.focus(); });
        }
    }

    private optionForId(id: string): PipelineQueryOption | undefined {
        return this.availableOptions().find((option) => option.id === id) ?? this.queries.map((query) => ({ id: query.id, label: query.identifier, description: query.filterQuery })).find((option) => option.id === id) ?? BUILTIN_QUERIES.find((option) => option.id === id);
    }

    private renderCanvas(): void {
        if (!this.canvasEl) return;
        this.canvasEl.empty();
        for (const connection of this.pipeline.connections) {
            const from = this.pipeline.nodes.find((node) => node.queryId === connection.from);
            const to = this.pipeline.nodes.find((node) => node.queryId === connection.to);
            if (!from || !to) continue;
            const edge = this.canvasEl.createDiv({ cls: 'seam-pipeline-canvas-edge', text: `${this.optionForId(connection.from)?.label ?? connection.from} → ${this.optionForId(connection.to)?.label ?? connection.to}` });
            edge.setCssStyles({ left: `${Math.min(from.x, to.x) + 90}px`, top: `${Math.min(from.y, to.y) + 38}px` });
        }
        for (const node of this.pipeline.nodes) this.renderNode(node);
    }

    private renderNode(node: SpecialSearchPipelineNode): void {
        if (!this.canvasEl) return;
        const option = this.optionForId(node.queryId);
        const card = this.canvasEl.createDiv({ cls: 'seam-pipeline-canvas-node', text: option?.label ?? node.queryId });
        card.setCssStyles({ left: `${node.x}px`, top: `${node.y}px` });
        card.setAttribute('data-query-id', node.queryId);
        card.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            card.setPointerCapture(event.pointerId);
            const startX = event.clientX;
            const startY = event.clientY;
            const originX = node.x;
            const originY = node.y;
            const move = (moveEvent: PointerEvent) => {
                node.x = Math.max(0, originX + moveEvent.clientX - startX);
                node.y = Math.max(0, originY + moveEvent.clientY - startY);
                this.renderCanvas();
            };
            const stop = () => { card.removeEventListener('pointermove', move); card.removeEventListener('pointerup', stop); };
            card.addEventListener('pointermove', move);
            card.addEventListener('pointerup', stop, { once: true });
        });
    }

    private renderConnectionControls(): void {
        this.contentEl.querySelector('.seam-pipeline-connections')?.remove();
        const section = this.contentEl.createDiv({ cls: 'seam-pipeline-connections' });
        const add = new Setting(section).setName(t().pipelineModalAddConnection);
        this.fromSelect = add.controlEl.createEl('select');
        this.toSelect = add.controlEl.createEl('select');
        this.populateSelect(this.fromSelect);
        this.populateSelect(this.toSelect);
        add.addButton((button) => button.setButtonText(t().pipelineModalAddConnection).onClick(() => {
            const from = this.fromSelect?.value;
            const to = this.toSelect?.value;
            if (!from || !to || from === to || this.pipeline.connections.some((edge) => edge.from === from && edge.to === to)) return;
            this.pipeline.connections.push({ from, to });
            this.renderCanvas();
            this.renderConnectionControls();
        }));
        for (const connection of this.pipeline.connections) {
            const row = section.createDiv({ cls: 'seam-pipeline-connection-row', text: `${this.optionForId(connection.from)?.label ?? connection.from} → ${this.optionForId(connection.to)?.label ?? connection.to}` });
            row.createEl('button', { text: '×', attr: { 'aria-label': t().pipelineModalRemoveConnection } }).addEventListener('click', () => {
                this.pipeline.connections = this.pipeline.connections.filter((edge) => edge !== connection);
                this.renderCanvas();
                this.renderConnectionControls();
            });
        }
    }

    private populateSelect(select: HTMLSelectElement): void {
        for (const queryId of this.pipeline.queryIds) select.createEl('option', { value: queryId, text: this.optionForId(queryId)?.label ?? queryId });
    }
}
