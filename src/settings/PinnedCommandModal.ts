import { App, FuzzySuggestModal } from 'obsidian'
import { t } from '../i18n'

export interface PinnableCommand {
  id: string
  name: string
  icon?: string
}

/** Show Seam's full command catalog, independent of current note availability. */
export class PinnedCommandModal extends FuzzySuggestModal<PinnableCommand> {
  constructor(
    app: App,
    private commands: PinnableCommand[],
    private select: (item: PinnableCommand) => void,
  ) {
    super(app)
    this.setPlaceholder(t().settingsPinnedCommandsSearch)
  }
  getItems(): PinnableCommand[] {
    return this.commands
  }
  getItemText(item: PinnableCommand): string {
    return item.name
  }
  onChooseItem(item: PinnableCommand): void {
    this.select(item)
  }
}
