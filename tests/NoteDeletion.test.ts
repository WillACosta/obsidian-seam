import './mocks/obsidian';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { App, TFile } from 'obsidian';
import { NoteDeletion } from '../src/notes/NoteDeletion';

const note = { path: 'Note.md', extension: 'md' } as TFile;
function fixture(prompt: (file: TFile) => Promise<boolean>, active: TFile | null = note) {
    const app = {
        workspace: { getActiveFile: () => active },
        fileManager: { promptForDeletion: prompt, trashFile: () => assert.fail('Native prompt already handles deletion') },
        vault: { delete: () => assert.fail('Must respect native deletion policy') },
    } as unknown as App;
    return new NoteDeletion(app);
}

describe('Explicit note deletion', () => {
    it('delegates once to native deletion for both confirmation and cancellation', async () => {
        for (const confirmed of [true, false]) {
            let calls = 0;
            const service = fixture(async file => { assert.equal(file, note); calls++; return confirmed; });
            await service.delete(note);
            assert.equal(calls, 1);
        }
    });
    it('ignores empty views, attachments, and a stale Palette target after switching notes', async () => {
        for (const active of [null, { path: 'Other.md', extension: 'md' } as TFile]) {
            await fixture(async () => assert.fail('Must not delete a stale note'), active).delete(note);
        }
        const attachment = { path: 'Image.png', extension: 'png' } as TFile;
        await fixture(async () => assert.fail('Must not delete an attachment'), attachment).delete(attachment);
    });
    it('prevents concurrent prompts for the same note and permits a later retry after cancellation', async () => {
        let resolve!: (confirmed: boolean) => void;
        let calls = 0;
        const service = fixture(() => { calls++; return new Promise<boolean>(done => { resolve = done; }); });
        const first = service.delete(note);
        await service.delete(note);
        assert.equal(calls, 1);
        resolve(false);
        await first;
        const retry = service.delete(note);
        assert.equal(calls, 2);
        resolve(false);
        await retry;
    });
    it('propagates native errors and clears the pending state for a retry', async () => {
        let calls = 0;
        const service = fixture(async () => { if (++calls === 1) throw new Error('Trash unavailable'); return true; });
        await assert.rejects(service.delete(note), /Trash unavailable/);
        await service.delete(note);
        assert.equal(calls, 2);
    });
});
