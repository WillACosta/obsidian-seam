import { App, TFile } from "obsidian";
import { AutomationDelayMode } from "../types";

export class AutomationQueue {
    private app: App;
    private processCallback: (file: TFile) => Promise<void>;
    private delayMode: AutomationDelayMode;
    private timers: Map<string, number> = new Map();
    private processing: Set<string> = new Set();
    private pending: Set<string> = new Set();
    private pendingOnSwitch: Set<string> = new Set();

    constructor(
        app: App,
        processCallback: (file: TFile) => Promise<void>,
        delayMode: AutomationDelayMode = 'on-switch',
    ) {
        this.app = app;
        this.processCallback = processCallback;
        this.delayMode = delayMode;
    }

    setDelayMode(mode: AutomationDelayMode): void {
        this.delayMode = mode;
    }

    enqueue(file: TFile): void {
        const path = file.path;
        this.pending.add(path);

        const isActive = this.app.workspace.getActiveFile()?.path === path;

        if (this.delayMode === 'on-switch' && isActive) {
            // If active and on-switch mode, hold execution until user switches away
            const existingTimer = this.timers.get(path);
            if (existingTimer !== undefined) {
                window.clearTimeout(existingTimer);
                this.timers.delete(path);
            }
            this.pendingOnSwitch.add(path);
            return;
        }

        // For timed modes, or inactive files in on-switch mode (e.g. background sync)
        const delayMs = this.delayMode === 'on-switch'
            ? 2000
            : parseInt(this.delayMode, 10) || 2000;

        const existingTimer = this.timers.get(path);
        if (existingTimer !== undefined) {
            window.clearTimeout(existingTimer);
        }

        const timer = window.setTimeout(() => {
            void this.processFile(path);
        }, delayMs) as unknown as number;

        this.timers.set(path, timer);
    }

    onActiveFileChange(newActiveFile: TFile | null): void {
        const newPath = newActiveFile?.path;

        // Process notes waiting for switch away
        for (const path of Array.from(this.pendingOnSwitch)) {
            if (path !== newPath) {
                this.pendingOnSwitch.delete(path);
                void this.processFile(path);
            }
        }

        // Process or hold notes with running timers
        for (const [path, timer] of Array.from(this.timers.entries())) {
            if (path !== newPath) {
                // Navigated away: execute immediately for a seamless transition
                window.clearTimeout(timer);
                this.timers.delete(path);
                void this.processFile(path);
            } else if (this.delayMode === 'on-switch') {
                // Navigated INTO a pending timed note: hold so it doesn't move during viewing
                window.clearTimeout(timer);
                this.timers.delete(path);
                this.pendingOnSwitch.add(path);
            }
        }
    }

    private async processFile(path: string): Promise<void> {
        const timer = this.timers.get(path);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            this.timers.delete(path);
        }
        this.pendingOnSwitch.delete(path);
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
        for (const timer of this.timers.values()) {
            window.clearTimeout(timer);
        }
        this.timers.clear();

        const pathsToProcess = Array.from(this.pending);
        this.pendingOnSwitch.clear();

        for (const path of pathsToProcess) {
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
        this.pendingOnSwitch.clear();
        this.pending.clear();
        this.processing.clear();
    }
}
