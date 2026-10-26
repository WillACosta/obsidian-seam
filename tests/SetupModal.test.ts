import './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { App } from 'obsidian';
import type { SeamInitializer, SetupPlan, SetupReport, SetupStatus } from '../src/setup/SeamInitializer';

class ElementHost {
    children: ElementHost[] = [];
    events = new Map<string, () => void>();
    isConnected = true;
    disabled = false;
    textContent: string;
    constructor(readonly tag = 'div', options: { text?: string } = {}) { this.textContent = options.text ?? ''; }
    createEl(tag: string, options: { text?: string } = {}) { const child = new ElementHost(tag, options); this.children.push(child); return child; }
    createDiv(options = {}) { return this.createEl('div', options); }
    createSpan(options = {}) { return this.createEl('span', options); }
    addClass() {} focus() {}
    empty() { this.children = []; }
    addEventListener(event: string, callback: () => void) { this.events.set(event, callback); }
    get all(): ElementHost[] { return [this, ...this.children.flatMap(child => child.all)]; }
}
class ModalHost {
    contentEl = new ElementHost(); modalEl = new ElementHost(); title = ''; closed = false;
    setTitle(title: string) { this.title = title; }
    close() { this.closed = true; this.contentEl.isConnected = false; }
}
Object.assign(require.cache['obsidian']!.exports, { Modal: ModalHost, Notice: class {} });
const { SetupModal } = require('../src/setup/SetupModal') as typeof import('../src/setup/SetupModal');
const tick = () => new Promise(resolve => setImmediate(resolve));
const plan = (...statuses: SetupStatus[]): SetupPlan => ({ id: 'preview', configDir: '.config', items: statuses.map((status, index) => ({ target: `Item ${index}`, group: 'resources', status })) });

async function fixture(initial: SetupPlan, after = initial, report: SetupReport = { results: [], backupDir: null }, failVerification = false) {
    let previewCalls = 0; let applyCalls = 0; let doneCalls = 0;
    const service = { preview: async () => {
        previewCalls++;
        if (previewCalls > 1 && failVerification) throw new Error('Read failed');
        return previewCalls === 1 ? initial : after;
    }, apply: async () => { applyCalls++; return report; } } as unknown as SeamInitializer;
    const modal = new SetupModal({} as App, service, () => doneCalls++);
    modal.onOpen(); await tick();
    const host = modal as unknown as ModalHost;
    const text = () => host.contentEl.all.map(item => item.textContent).join('\n');
    const buttons = () => host.contentEl.all.filter(item => item.tag === 'button').map(item => item.textContent);
    const click = async (text: string) => {
        const button = host.contentEl.all.find(item => item.tag === 'button' && item.textContent === text);
        assert.ok(button, `Missing button: ${text}`); button.events.get('click')!(); await tick();
    };
    return { host, text, buttons, click, get previewCalls() { return previewCalls; }, get applyCalls() { return applyCalls; }, get doneCalls() { return doneCalls; } };
}

describe('Setup completion UI', () => {
    it('shows Already configured and an OK dismissal without an apply action or mutation warnings', async () => {
        const f = await fixture(plan('existing', 'existing'));
        assert.equal(f.host.title, 'Already configured');
        assert.ok(f.text().includes('This vault matches Seam’s recommended setup. No changes are needed.'));
        assert.ok(!f.text().includes('There is no one-click undo.'));
        assert.deepEqual(f.buttons(), ['OK']);
        await f.click('OK'); assert.ok(f.host.closed); assert.equal(f.applyCalls, 0);
    });
    it('offers review and apply again when the current plan contains missing or drifted settings', async () => {
        const f = await fixture(plan('existing', 'update', 'create'));
        assert.equal(f.host.title, 'Initialize Seam'); assert.deepEqual(f.buttons(), ['Cancel', 'Apply setup']);
        assert.ok(f.text().includes('There is no one-click undo.')); assert.equal(f.applyCalls, 0);
    });
    it('does not call unresolved conflicts and unsupported items fully configured', async () => {
        const f = await fixture(plan('existing', 'conflict', 'unsupported'));
        assert.equal(f.host.title, 'Initialize Seam'); assert.deepEqual(f.buttons(), ['OK']);
        assert.ok(f.text().includes('Review the skipped or unsupported items below.'));
        assert.ok(!f.text().includes('No changes are needed.'));
    });
    it('verifies the final plan after Apply and retains restart guidance in the configured report', async () => {
        const f = await fixture(plan('update'), plan('existing'), { results: [{ target: '.config/app.json', outcome: 'applied', restart: true }], backupDir: '.config/backups/one' });
        await f.click('Apply setup');
        assert.equal(f.applyCalls, 1); assert.equal(f.previewCalls, 2); assert.equal(f.doneCalls, 1);
        assert.equal(f.host.title, 'Already configured'); assert.deepEqual(f.buttons(), ['OK']);
        assert.ok(f.text().includes('1 applied · 0 skipped · 0 failed'));
        assert.ok(f.text().includes('require a restart')); assert.ok(f.text().includes('.config/backups/one'));
    });
    it('keeps partial failures in the report without claiming completion', async () => {
        const f = await fixture(plan('update'), plan('existing'), { results: [{ target: '.config/app.json', outcome: 'failed', error: 'Read-only target' }], backupDir: null });
        await f.click('Apply setup');
        assert.equal(f.host.title, 'Setup report'); assert.equal(f.previewCalls, 1);
        assert.deepEqual(f.buttons(), ['Close']); assert.ok(f.text().includes('Read-only target'));
    });
    it('keeps the normal report when the post-apply state is unresolved or cannot be verified', async () => {
        for (const failVerification of [false, true]) {
            const f = await fixture(plan('update'), plan('conflict'), { results: [{ target: 'Config', outcome: 'applied' }], backupDir: null }, failVerification);
            await f.click('Apply setup');
            assert.equal(f.host.title, 'Setup report'); assert.deepEqual(f.buttons(), ['Close']);
            assert.ok(!f.text().includes('No changes are needed.'));
        }
    });
});
