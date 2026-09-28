import { AbstractInputSuggest, App, Modal, Setting } from 'obsidian';
import {
    CustomSpecialSearch,
    SpecialSearchPipeline,
    SpecialSearchPipelineNode,
} from '../types';
import { t } from '../i18n';
import { registerModalShortcut } from '../utils/modalShortcuts';
import { buildPipelineCanvas } from '../utils/pipelineCanvas';

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
        this.close();
    }
}

function createNodes(queryIds: string[]): SpecialSearchPipelineNode[] {
    return queryIds.map((queryId, index) => ({ queryId, x: 30 + (index % 3) * 260, y: 30 + Math.floor(index / 3) * 150 }));
}

export class SpecialSearchPipelineModal extends Modal {
    private pipeline: SpecialSearchPipeline;
    private canvasEl: HTMLElement | null = null;
    private canvasSurfaceEl: HTMLElement | null = null;
    private svgEl: SVGSVGElement | null = null;
    private queryChipsEl: HTMLElement | null = null;
    private queryInputEl: HTMLInputElement | null = null;
    private querySuggest: PipelineQuerySuggest | null = null;
    private pointerMoveHandler: ((event: PointerEvent) => void) | null = null;
    private pointerUpHandler: ((event: PointerEvent) => void) | null = null;

    constructor(app: App, existing: SpecialSearchPipeline | null, private readonly queries: CustomSpecialSearch[], private readonly onSave: SavePipeline) {
        super(app);
        if (existing) {
            const queryIds = [...existing.queryIds];
            this.pipeline = {
                ...existing,
                queryIds,
                nodes: existing.nodes?.length ? existing.nodes.map((node) => ({ ...node })) : createNodes(queryIds),
                connections: existing.connections ? existing.connections.map((connection) => ({ ...connection })) : queryIds.slice(1).map((queryId, index) => ({ from: queryIds[index], to: queryId })),
            };
        } else {
            this.pipeline = { id: crypto.randomUUID(), name: '', queryIds: [], pinned: false, hidden: false, nodes: [], connections: [] };
        }
    }

    onOpen(): void {
        this.modalEl.addClass('seam-custom-search-pipeline-modal');
        this.setTitle(this.pipeline.name ? t().pipelineModalEdit : t().pipelineModalNew);
        const nameSetting = new Setting(this.contentEl).setName(t().pipelineModalName).setDesc(t().pipelineModalNameDesc);
        nameSetting.settingEl.addClass('seam-custom-search-text-setting');
        nameSetting.addText((text) => text.setValue(this.pipeline.name).onChange((value) => { this.pipeline.name = value; }));

        const querySetting = new Setting(this.contentEl).setName(t().pipelineModalQueries).setDesc(t().pipelineModalQueriesDesc);
        querySetting.settingEl.addClass('seam-custom-search-text-setting');
        const selector = querySetting.controlEl.createDiv({ cls: 'seam-pipeline-query-selector' });
        this.queryChipsEl = selector.createDiv({ cls: 'seam-pipeline-query-chips' });
        this.queryInputEl = selector.createEl('input', { type: 'text', placeholder: t().pipelineModalQueryPlaceholder });
        this.querySuggest = new PipelineQuerySuggest(this.app, this.queryInputEl, () => this.availableOptions(), (option) => this.addQuery(option.id));
        this.querySuggest.onSelect(() => this.renderQueryChips());
        this.queryInputEl.addEventListener('input', () => this.renderQueryChips());
        this.renderQueryChips();

        new Setting(this.contentEl).setName(t().pipelineModalCanvas).setDesc(t().pipelineModalCanvasDesc);
        this.canvasEl = this.contentEl.createDiv({ cls: 'seam-pipeline-canvas', attr: { 'aria-label': t().pipelineModalCanvas } });
        this.canvasSurfaceEl = this.canvasEl.createDiv({ cls: 'seam-pipeline-canvas-surface' });
        this.svgEl = this.canvasSurfaceEl.createSvg('svg', { cls: 'seam-pipeline-canvas-edges', attr: { 'aria-hidden': 'true' } });
        const defs = this.svgEl.createSvg('defs');
        const marker = defs.createSvg('marker', { attr: { id: 'seam-pipeline-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' } });
        marker.createSvg('path', { attr: { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--text-muted)' } });
        this.renderCanvas();

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

    onClose(): void {
        this.stopConnectionGesture();
        this.querySuggest?.close();
        this.contentEl.empty();
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
        this.pipeline.nodes.push({ queryId, x: 30 + (index % 3) * 260, y: 30 + Math.floor(index / 3) * 150 });
        this.renderQueryChips();
        this.renderCanvas();
    }

    private removeQuery(queryId: string): void {
        this.pipeline.queryIds = this.pipeline.queryIds.filter((id) => id !== queryId);
        this.pipeline.nodes = this.pipeline.nodes.filter((node) => node.queryId !== queryId);
        this.pipeline.connections = this.pipeline.connections.filter((connection) => connection.from !== queryId && connection.to !== queryId);
        this.renderQueryChips();
        this.renderCanvas();
    }

    private renderQueryChips(): void {
        if (!this.queryChipsEl || !this.queryInputEl) return;
        this.queryChipsEl.empty();
        for (const queryId of this.pipeline.queryIds) {
            const label = this.optionForId(queryId)?.label ?? queryId;
            const chip = this.queryChipsEl.createSpan({ cls: 'seam-pipeline-query-chip' });
            chip.createSpan({ text: label });
            const remove = chip.createEl('button', { text: '×', attr: { 'aria-label': `Remove ${label}` } });
            remove.addEventListener('click', () => { this.removeQuery(queryId); this.queryInputEl?.focus(); });
        }
    }

    private optionForId(id: string): PipelineQueryOption | undefined {
        return this.queries.map((query) => ({ id: query.id, label: query.identifier, description: query.filterQuery })).find((option) => option.id === id)
            ?? BUILTIN_QUERIES.find((option) => option.id === id);
    }

    private renderCanvas(): void {
        if (!this.canvasEl || !this.canvasSurfaceEl || !this.svgEl) return;
        this.canvasSurfaceEl.querySelectorAll('.seam-pipeline-canvas-node').forEach((node) => node.remove());
        const graph = buildPipelineCanvas(this.pipeline, (queryId) => this.optionForId(queryId)?.label ?? queryId);
        const width = Math.max(640, ...graph.nodes.map((node) => node.x + node.width + 20));
        const height = Math.max(260, ...graph.nodes.map((node) => node.y + node.height + 28));
        this.canvasSurfaceEl.style.width = `${Math.min(width, 1600)}px`;
        this.canvasSurfaceEl.style.height = `${Math.min(height, 900)}px`;
        this.svgEl.setAttribute('width', String(width));
        this.svgEl.setAttribute('height', String(height));
        this.svgEl.querySelectorAll('.seam-pipeline-canvas-edge, .seam-pipeline-canvas-preview').forEach((edge) => edge.remove());

        for (const edge of graph.edges) this.drawEdge(edge.fromNode, edge.toNode);
        for (const node of graph.nodes) this.renderNode({ queryId: node.id, x: node.x, y: node.y });
    }

    private renderNode(node: SpecialSearchPipelineNode): void {
        if (!this.canvasSurfaceEl) return;
        const label = this.optionForId(node.queryId)?.label ?? node.queryId;
        const card = this.canvasSurfaceEl.createDiv({ cls: 'seam-pipeline-canvas-node', attr: { 'data-query-id': node.queryId, role: 'group', 'aria-label': label } });
        card.setCssStyles({ left: `${node.x}px`, top: `${node.y}px` });
        card.createSpan({ cls: 'seam-pipeline-node-label', text: label });
        const remove = card.createEl('button', { cls: 'seam-pipeline-node-remove', text: '×', attr: { 'aria-label': `Remove ${label}` } });
        remove.addEventListener('click', (event) => { event.stopPropagation(); this.removeQuery(node.queryId); });
        const input = card.createEl('button', { cls: 'seam-pipeline-node-port seam-pipeline-node-port-in', attr: { 'aria-label': `Connect into ${label}`, 'data-port': 'in', type: 'button' } });
        const output = card.createEl('button', { cls: 'seam-pipeline-node-port seam-pipeline-node-port-out', attr: { 'aria-label': `Connect from ${label}`, 'data-port': 'out', type: 'button' } });
        input.addEventListener('pointerup', (event) => this.finishConnectionGesture(node.queryId, event));
        output.addEventListener('pointerdown', (event) => this.startConnectionGesture(node.queryId, event));
        card.addEventListener('pointerdown', (event) => {
            if ((event.target as HTMLElement).closest('button')) return;
            event.preventDefault();
            const startX = event.clientX;
            const startY = event.clientY;
            const originX = node.x;
            const originY = node.y;
            const move = (moveEvent: PointerEvent): void => {
                node.x = Math.max(10, originX + moveEvent.clientX - startX);
                node.y = Math.max(10, originY + moveEvent.clientY - startY);
                card.style.left = `${node.x}px`;
                card.style.top = `${node.y}px`;
                this.updateEdges();
            };
            const stop = (): void => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', stop);
                this.renderCanvas();
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', stop, { once: true });
        });
    }

    private startConnectionGesture(from: string, event: PointerEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.stopConnectionGesture();
        this.pointerMoveHandler = (moveEvent): void => this.drawPreview(from, moveEvent);
        this.pointerUpHandler = (): void => this.stopConnectionGesture();
        window.addEventListener('pointermove', this.pointerMoveHandler);
        window.addEventListener('pointerup', this.pointerUpHandler, { once: true });
        this.drawPreview(from, event);
    }

    private finishConnectionGesture(to: string, event: PointerEvent): void {
        if (!this.pointerMoveHandler || !this.pointerUpHandler) return;
        event.preventDefault();
        event.stopPropagation();
        const fromPort = this.canvasSurfaceEl?.querySelector<HTMLElement>('.seam-pipeline-node-port-out.is-connecting');
        const from = fromPort?.closest<HTMLElement>('.seam-pipeline-canvas-node')?.dataset.queryId;
        this.stopConnectionGesture();
        if (!from || from === to || this.pipeline.connections.some((edge) => edge.from === from && edge.to === to)) { this.updateEdges(); return; }
        this.pipeline.connections.push({ from, to });
        this.renderCanvas();
    }

    private stopConnectionGesture(): void {
        if (this.pointerMoveHandler) window.removeEventListener('pointermove', this.pointerMoveHandler);
        if (this.pointerUpHandler) window.removeEventListener('pointerup', this.pointerUpHandler);
        this.pointerMoveHandler = null;
        this.pointerUpHandler = null;
        this.canvasSurfaceEl?.querySelectorAll('.is-connecting').forEach((el) => el.removeClass('is-connecting'));
        this.canvasSurfaceEl?.querySelector('.seam-pipeline-canvas-preview')?.remove();
    }

    private drawPreview(from: string, event: PointerEvent): void {
        const fromPort = this.canvasEl?.querySelector<HTMLElement>(`.seam-pipeline-canvas-node[data-query-id="${CSS.escape(from)}"] .seam-pipeline-node-port-out`);
        if (!fromPort || !this.canvasEl || !this.svgEl) return;
        fromPort.addClass('is-connecting');
        const start = this.pointInCanvas(fromPort);
        const rect = this.canvasEl.getBoundingClientRect();
        const end = { x: event.clientX - rect.left + this.canvasEl.scrollLeft, y: event.clientY - rect.top + this.canvasEl.scrollTop };
        this.svgEl.querySelector('.seam-pipeline-canvas-preview')?.remove();
        this.svgEl.createSvg('path', { cls: 'seam-pipeline-canvas-preview', attr: { d: this.pathData(start.x, start.y, end.x, end.y) } });
    }

    private updateEdges(): void {
        if (!this.svgEl) return;
        this.svgEl.querySelectorAll<SVGPathElement>('.seam-pipeline-canvas-edge').forEach((path) => {
            const from = path.dataset.from;
            const to = path.dataset.to;
            if (!from || !to) return;
            const start = this.pointForNode(from, 'out');
            const end = this.pointForNode(to, 'in');
            if (start && end) path.setAttribute('d', this.pathData(start.x, start.y, end.x, end.y));
        });
    }

    private drawEdge(from: string, to: string): void {
        if (!this.svgEl) return;
        const start = this.pointForNode(from, 'out');
        const end = this.pointForNode(to, 'in');
        if (!start || !end) return;
        const path = this.svgEl.createSvg('path', { cls: 'seam-pipeline-canvas-edge', attr: { d: this.pathData(start.x, start.y, end.x, end.y), 'data-from': from, 'data-to': to, 'marker-end': 'url(#seam-pipeline-arrow)', tabindex: '0', role: 'button', 'aria-label': `Remove connection from ${this.optionForId(from)?.label ?? from} to ${this.optionForId(to)?.label ?? to}` } });
        path.addEventListener('click', () => {
            this.pipeline.connections = this.pipeline.connections.filter((edge) => edge.from !== from || edge.to !== to);
            this.renderCanvas();
        });
        path.addEventListener('keydown', (event) => {
            if (event.key !== 'Backspace' && event.key !== 'Delete') return;
            event.preventDefault();
            this.pipeline.connections = this.pipeline.connections.filter((edge) => edge.from !== from || edge.to !== to);
            this.renderCanvas();
        });
    }

    private pointForNode(queryId: string, port: 'in' | 'out'): { x: number; y: number } | null {
        const node = this.pipeline.nodes.find((entry) => entry.queryId === queryId);
        return node ? { x: node.x + (port === 'out' ? 220 : 0), y: node.y + 44 } : null;
    }

    private pointInCanvas(element: HTMLElement): { x: number; y: number } {
        const rect = element.getBoundingClientRect();
        const canvasRect = this.canvasSurfaceEl!.getBoundingClientRect();
        return { x: rect.left + rect.width / 2 - canvasRect.left + this.canvasEl!.scrollLeft, y: rect.top + rect.height / 2 - canvasRect.top + this.canvasEl!.scrollTop };
    }

    private pathData(x1: number, y1: number, x2: number, y2: number): string {
        const bend = Math.max(36, Math.abs(x2 - x1) / 2);
        return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
    }
}
