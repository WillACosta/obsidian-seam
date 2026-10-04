import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockTFile } from './mocks/obsidian';
import { isFileInFolder } from '../src/utils/isFileInFolder';

describe('Contextual move visibility', () => {
    it('recognizes notes directly in and below each configured destination', () => {
        for (const folder of ['Archive', 'Permanent', 'Fleeting']) {
            assert.equal(isFileInFolder(new MockTFile(`${folder}/C4 Model.md`), folder), true);
            assert.equal(isFileInFolder(new MockTFile(`${folder}/Projects/C4 Model.md`), folder), true);
            assert.equal(isFileInFolder(new MockTFile(`${folder} Notes/C4 Model.md`), folder), false);
        }
    });

    it('uses configured nested paths and treats a blank destination as the vault root', () => {
        assert.equal(isFileInFolder(new MockTFile('Notes/Permanent/C4 Model.md'), 'Notes/Permanent/'), true);
        assert.equal(isFileInFolder(new MockTFile('Notes/Permanentish/C4 Model.md'), 'Notes/Permanent'), false);
        assert.equal(isFileInFolder(new MockTFile('C4 Model.md'), ''), true);
        assert.equal(isFileInFolder(new MockTFile('Fleeting/C4 Model.md'), ''), false);
    });
});
