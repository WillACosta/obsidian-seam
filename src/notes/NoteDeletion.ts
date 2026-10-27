import { App, TFile } from 'obsidian'

/** Explicit user action only; delegate confirmation and deletion policy to Obsidian. */
export class NoteDeletion {
  private pending = new Set<TFile>()

  constructor(private app: App) {}

  async delete(file: TFile): Promise<void> {
    if (
      file.extension !== 'md' ||
      this.app.workspace.getActiveFile() !== file ||
      this.pending.has(file)
    )
      return
    this.pending.add(file)
    try {
      // This native method also performs deletion; never call trashFile again afterward.
      await this.app.fileManager.promptForDeletion(file)
    } finally {
      this.pending.delete(file)
    }
  }
}
