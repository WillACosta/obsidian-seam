import { App, TFile } from "obsidian";

export class AutomationQueue {
    private app: App;
    private processCallback: (file: TFile) => Promise<void>;
    private debounceMs: number;
    private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
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
        
        if (this.timers.has(path)) {
            clearTimeout(this.timers.get(path)!);
        }
        
        const timer = setTimeout(() => {
            this.processFile(path);
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
            clearTimeout(this.timers.get(path)!);
            await this.processFile(path);
        }
    }

    isPending(path: string): boolean {
        return this.pending.has(path);
    }

    destroy(): void {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
        this.pending.clear();
        this.processing.clear();
    }
}
