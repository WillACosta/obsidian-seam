import { App, Modal, Notice } from 'obsidian'
import { t } from '../i18n'
import {
  isSetupConfigured,
  SeamInitializer,
  SetupGroup,
  SetupItem,
  SetupPlan,
  SetupReport,
} from './SeamInitializer'

export class SetupModal extends Modal {
  private applying = false
  get isApplying(): boolean {
    return this.applying
  }
  constructor(
    app: App,
    private readonly initializer: SeamInitializer,
    private readonly done?: () => void,
  ) {
    super(app)
  }
  onOpen(): void {
    this.modalEl.addClass('seam-setup-modal')
    this.setTitle(t().setupTitle)
    this.contentEl.createEl('p', { text: t().setupLoading })
    void this.initializer
      .preview()
      .then((plan) => {
        if (this.contentEl.isConnected) this.renderPlan(plan)
      })
      .catch((error: unknown) => {
        this.contentEl.empty()
        this.contentEl.createEl('p', {
          text: `${t().setupFailed}: ${error instanceof Error ? error.message : String(error)}`,
        })
      })
  }
  private renderItem(parent: HTMLElement, item: SetupItem): void {
    const row = parent.createEl('li', { cls: `seam-setup-item seam-setup-${item.status}` })
    row.createSpan({ cls: 'seam-setup-status', text: t().setupStatuses[item.status] })
    row.createSpan({ text: item.target })
    if (item.reason) row.createEl('p', { text: t().setupReasons[item.reason] })
    if (item.details?.length) {
      const details = row.createEl('ul')
      for (const text of item.details) details.createEl('li', { text })
    }
  }
  private renderPlan(plan: SetupPlan): void {
    this.contentEl.empty()
    const hasChanges = plan.items.some(
      (item) => item.status === 'create' || item.status === 'update',
    )
    const configured = isSetupConfigured(plan)
    this.setTitle(configured ? t().setupStatuses.existing : t().setupTitle)
    if (configured) this.contentEl.createEl('p', { text: t().setupConfiguredMessage })
    else if (hasChanges) {
      this.contentEl.createEl('p', { cls: 'seam-setup-warning', text: t().setupWarning })
      this.contentEl.createEl('p', { text: t().setupRestartWarning })
    } else this.contentEl.createEl('p', { text: t().setupNothingToApply })
    for (const group of ['resources', 'obsidian', 'searches'] as SetupGroup[]) {
      const items = plan.items.filter((item) => item.group === group)
      const section = this.contentEl.createEl('section')
      section.createEl('h3', { text: t().setupGroups[group] })
      const changes = section.createEl('ul', { cls: 'seam-setup-list' })
      items
        .filter((item) => item.status !== 'existing')
        .forEach((item) => this.renderItem(changes, item))
      const existing = items.filter((item) => item.status === 'existing')
      if (existing.length) {
        const details = section.createEl('details')
        details.createEl('summary', { text: `${t().setupStatuses.existing} (${existing.length})` })
        const list = details.createEl('ul', { cls: 'seam-setup-list' })
        existing.forEach((item) => this.renderItem(list, item))
      }
    }
    const actions = this.contentEl.createDiv({ cls: 'seam-setup-actions' })
    if (!hasChanges) {
      const ok = actions.createEl('button', { text: t().setupOk, cls: 'mod-cta' })
      ok.addEventListener('click', () => this.close())
      ok.focus()
      return
    }
    const cancel = actions.createEl('button', { text: t().setupCancel })
    cancel.addEventListener('click', () => this.close())
    const apply = actions.createEl('button', { text: t().setupApply, cls: 'mod-cta' })
    apply.addEventListener('click', () => {
      if (this.applying) return
      this.applying = true
      apply.disabled = true
      cancel.disabled = true
      apply.textContent = t().setupApplying
      void this.initializer
        .apply(plan)
        .then(async (report) => {
          let configured = false
          if (!report.results.some((result) => result.outcome === 'failed')) {
            try {
              configured = isSetupConfigured(await this.initializer.preview())
            } catch {
              /* Keep the report when the final state cannot be verified. */
            }
          }
          this.applying = false
          if (!this.contentEl.isConnected) return
          this.renderReport(report, configured)
          this.done?.()
        })
        .catch((error: unknown) => {
          this.applying = false
          cancel.disabled = false
          new Notice(
            `${t().setupFailed}: ${error instanceof Error ? error.message : String(error)}`,
          )
        })
    })
    cancel.focus()
  }
  private renderReport(report: SetupReport, configured: boolean): void {
    this.contentEl.empty()
    this.setTitle(configured ? t().setupStatuses.existing : t().setupComplete)
    if (configured) this.contentEl.createEl('p', { text: t().setupConfiguredMessage })
    const counts = report.results.reduce(
      (counts, result) => {
        counts[result.outcome]++
        return counts
      },
      { applied: 0, skipped: 0, failed: 0 },
    )
    this.contentEl.createEl('p', {
      text: t().setupCounts(counts.applied, counts.skipped, counts.failed),
    })
    if (report.results.some((result) => result.restart))
      this.contentEl.createEl('p', { cls: 'seam-setup-warning', text: t().setupRestartWarning })
    if (report.backupDir)
      this.contentEl.createEl('p', { text: `${t().setupBackups}: ${report.backupDir}` })
    const list = this.contentEl.createEl('ul', { cls: 'seam-setup-list' })
    for (const result of report.results) {
      const row = list.createEl('li', { cls: `seam-setup-item seam-setup-${result.outcome}` })
      row.createSpan({ cls: 'seam-setup-status', text: t().setupOutcomes[result.outcome] })
      row.createSpan({ text: result.target })
      if (result.reason) row.createEl('p', { text: t().setupReasons[result.reason] })
      if (result.error) row.createEl('p', { text: result.error })
    }
    const close = this.contentEl.createEl('button', {
      text: configured ? t().setupOk : t().setupClose,
      cls: 'mod-cta',
    })
    close.addEventListener('click', () => this.close())
    close.focus()
  }
  close(): void {
    if (!this.applying) super.close()
  }
  dispose(): void {
    super.close()
  }
  onClose(): void {
    this.contentEl.empty()
  }
}
