import { App, Modifier, Scope } from 'obsidian';
import { BaseNavigationDirection, BaseResultNavigation } from './BaseResultNavigation';

/** Focus stays on a stable host while native Bases recycles result nodes. */
export class BaseNavigationMode {
    private scope: Scope;
    private scopeActive = false;
    private readonly focus = (): void => {
        if (!this.results.isSupported || this.scopeActive) return;
        this.scopeActive = true;
        this.app.keymap.pushScope(this.scope);
        this.host.addClass('seam-palette-base-navigation-active');
        this.refresh();
        this.changed();
    };
    private readonly blur = (): void => this.exit(false);

    constructor(private readonly app: App, private readonly host: HTMLElement, private readonly input: HTMLInputElement,
        private readonly results: BaseResultNavigation, parentScope: Scope, label: string,
        private readonly open: (event: KeyboardEvent) => boolean, private readonly changed: () => void) {
        this.scope = new Scope(parentScope);
        for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape']) {
            this.scope.register([], key, event => this.handleKey(event) ? false : true);
        }
        const combinations: Modifier[][] = [['Mod'], ['Shift'], ['Mod', 'Shift']];
        for (const modifiers of combinations) {
            this.scope.register(modifiers, 'Enter', event => this.handleKey(event) ? false : true);
        }
        host.setAttribute('tabindex', '0');
        host.setAttribute('role', 'group');
        host.setAttribute('aria-label', label);
        host.addEventListener('focus', this.focus);
        host.addEventListener('blur', this.blur);
    }

    get active(): boolean { return this.scopeActive; }

    handleKey(event: KeyboardEvent): boolean {
        if (!this.results.isSupported || event.isComposing || event.altKey) return false;
        if (event.target === this.input) {
            if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                this.consume(event);
                this.host.focus({ preventScroll: true });
                return true;
            }
            if (event.key === 'Enter') { this.consume(event); this.open(event); return true; }
            return false;
        }
        if (event.target !== this.host || !this.active) return false;
        if (event.key === 'Enter') { this.consume(event); this.open(event); return true; }
        if (event.ctrlKey || event.metaKey || event.shiftKey) return false;
        if (event.key === 'Escape') {
            this.consume(event); this.exit(); return true;
        }
        const direction = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as Record<string, BaseNavigationDirection>)[event.key];
        if (!direction) return false;
        this.consume(event);
        this.results.moveSelection(direction);
        this.refresh();
        return true;
    }

    refresh(): void {
        const id = this.results.activeElementId;
        if (id) {
            this.host.setAttribute('aria-activedescendant', id);
            this.input.setAttribute('aria-activedescendant', id);
        } else {
            this.host.removeAttribute('aria-activedescendant');
            this.input.removeAttribute('aria-activedescendant');
        }
    }
    private consume(event: KeyboardEvent): void { event.preventDefault(); event.stopImmediatePropagation(); }
    private exit(focusInput = true): void {
        if (this.scopeActive) {
            this.app.keymap.popScope(this.scope); this.scopeActive = false;
            this.host.removeClass('seam-palette-base-navigation-active');
            this.changed();
        }
        if (focusInput) this.input.focus({ preventScroll: true });
    }
    destroy(): void {
        this.exit(false);
        this.host.removeEventListener('focus', this.focus);
        this.host.removeEventListener('blur', this.blur);
        for (const attr of ['tabindex', 'role', 'aria-label', 'aria-activedescendant']) this.host.removeAttribute(attr);
    }
}
