import { TFile } from 'obsidian';
import { detectLocale, t } from '../i18n';
import { NoteCompletion } from '../statistics/NoteCompletion';

export function renderNoteCompletion(host: HTMLElement, file: TFile, report: NoteCompletion): void {
    host.empty();
    host.addClass('seam-note-completion');
    const header = host.createEl('header', { cls: 'seam-note-statistics-header' });
    header.createEl('h2', { text: t().completionTitle });
    header.createEl('h3', { cls: 'seam-note-statistics-title', text: file.basename });
    header.createEl('p', { cls: 'seam-note-statistics-path', text: file.path });
    if (!report.total) { host.createEl('p', { text: t().completionEmpty }); return; }
    const percent = new Intl.NumberFormat(detectLocale(), { style: 'percent' }).format(report.percent / 100);
    const summary = host.createDiv({ cls: 'seam-note-completion-summary' });
    summary.createEl('strong', { text: percent, cls: 'seam-note-completion-percent' });
    summary.createSpan({ text: t().completionCompleted, cls: 'seam-note-statistics-label' });
    host.createEl('progress', { cls: 'seam-note-completion-bar', attr: {
        max: '100', value: String(report.percent), 'aria-label': t().completionTitle, 'aria-valuetext': percent,
    } });
    const counts = host.createEl('dl', { cls: 'seam-note-completion-counts' });
    const number = new Intl.NumberFormat(detectLocale());
    for (const [label, value] of [[t().completionUnfinished, report.unfinished], [t().completionPartial, report.partial],
        [t().completionCompleted, report.completed], [t().completionTotal, report.total]] as const) {
        const block = counts.createDiv({ cls: 'seam-note-completion-count' });
        block.createEl('dt', { text: label });
        block.createEl('dd', { text: number.format(value) });
    }
}
