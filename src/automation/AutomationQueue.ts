import { App, TFile } from "obsidian";

export class AutomationQueue {
    private app: App;
    private processCallback: (file: TFile) => Promise<void>;
    private debounceMs: number;
    private timers: Map<string, number> = new Map();
    private processing: Set<string> = new Set();
    private pending: Set<string> = new Set();

    constructor(app: App, processCallback: (file: TFile) => Promise<void>, debounceMs: number = 750) {
        this.app = app;
        this.processCallback = processCallback;
        this.debounceMs = debounceMs;
    }

    enqueue(file: TFile): void {
        const path = file.path;
        this.pending.add(path);

        const existingTimer = this.timers.get(path);
        if (existingTimer !== undefined) {
            window.clearTimeout(existingTimer);
        }

        const timer = window.setTimeout(() => {
            void this.processFile(path);
        }, this.debounceMs);

        this.timers.set(path, timer);
    }

    private async processFile(path: string): Promise<void> {
        this.timers.delete(path);
        this.pending.delete(path);

        if (this.processing.has(path)) {
            return;
        }

        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file || !(file instanceof TFile)) {
            return;
        }

        this.processing.add(path);
        try {
            await this.processCallback(file);
        } finally {
            this.processing.delete(path);
        }
    }

    async flush(): Promise<void> {
        const pathsToProcess = Array.from(this.timers.keys());
        for (const path of pathsToProcess) {
            const timer = this.timers.get(path);
            if (timer !== undefined) {
                window.clearTimeout(timer);
            }
            await this.processFile(path);
        }
    }

    isPending(path: string): boolean {
        return this.pending.has(path);
    }

    destroy(): void {
        for (const timer of this.timers.values()) {
            window.clearTimeout(timer);
        }
        this.timers.clear();
        this.pending.clear();
        this.processing.clear();
    }
}
