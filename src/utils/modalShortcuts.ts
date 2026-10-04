/** Registers a letter shortcut without hijacking text entry fields. */
export function registerModalShortcut(modalEl: HTMLElement, key: string, handler: () => void): void {
    modalEl.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const target = event.target as Node | null;
        if (target?.instanceOf?.(HTMLElement) && target.matches('input, textarea, select, [contenteditable="true"]')) return;
        if (event.key.toLowerCase() !== key.toLowerCase()) return;

        event.preventDefault();
        handler();
    });
}
