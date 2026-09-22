import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery } from '../src/search/QueryParser';

describe('QueryParser', () => {
    it('parses empty query', () => {
        const result = parseQuery('');
        assert.equal(result.isValid, true);
        assert.equal(result.tokens.length, 0);
    });

    it('parses single positive tag', () => {
        const result = parseQuery('#electronics');
        assert.equal(result.isValid, true);
        assert.deepEqual(result.tokens, [{ type: 'tag', value: 'electronics' }]);
    });

    it('parses partial/prefix tag', () => {
        const result = parseQuery('#ele');
        assert.equal(result.isValid, true);
        assert.deepEqual(result.tokens, [{ type: 'tag', value: 'ele' }]);
    });

    it('parses negative tag', () => {
        const result = parseQuery('-#archived');
        assert.equal(result.isValid, true);
        assert.deepEqual(result.tokens, [{ type: 'negativeTag', value: 'archived' }]);
    });

    it('parses exclamation-prefixed negative tags', () => {
        const result = parseQuery('#projects/seam #todo !#archived');
        assert.equal(result.isValid, true);
        assert.deepEqual(result.tokens, [
            { type: 'tag', value: 'projects/seam' },
            { type: 'tag', value: 'todo' },
            { type: 'negativeTag', value: 'archived' },
        ]);
    });

    it('parses multiple tags (AND logic)', () => {
        const result = parseQuery('#electronics -#archived #kicad');
        assert.equal(result.isValid, true);
        assert.deepEqual(result.tokens, [
            { type: 'tag', value: 'electronics' },
            { type: 'negativeTag', value: 'archived' },
            { type: 'tag', value: 'kicad' },
        ]);
    });

    it('parses OR queries with || operator', () => {
        const result = parseQuery('#electronics || #zmk');
        assert.equal(result.isValid, true);
        assert.deepEqual(result.tokens, [
            { type: 'tag', value: 'electronics' },
            { type: 'or', value: 'or' },
            { type: 'tag', value: 'zmk' },
        ]);
    });

    it('parses || operator without spaces (#a||#b)', () => {
        const result = parseQuery('#electronics||#zmk');
        assert.equal(result.isValid, true);
        assert.deepEqual(result.tokens, [
            { type: 'tag', value: 'electronics' },
            { type: 'or', value: 'or' },
            { type: 'tag', value: 'zmk' },
        ]);
    });

    it('parses single | operator', () => {
        const result = parseQuery('#electronics | #zmk');
        assert.equal(result.isValid, true);
        assert.deepEqual(result.tokens, [
            { type: 'tag', value: 'electronics' },
            { type: 'or', value: 'or' },
            { type: 'tag', value: 'zmk' },
        ]);
    });

    it('parses OR queries with text OR', () => {
        const result = parseQuery('#electronics OR #zmk');
        assert.equal(result.isValid, true);
        assert.deepEqual(result.tokens, [
            { type: 'tag', value: 'electronics' },
            { type: 'or', value: 'or' },
            { type: 'tag', value: 'zmk' },
        ]);
    });

    it('handles case-insensitive OR operator', () => {
        const result = parseQuery('#electronics or #zmk');
        assert.equal(result.isValid, true);
        assert.deepEqual(result.tokens, [
            { type: 'tag', value: 'electronics' },
            { type: 'or', value: 'or' },
            { type: 'tag', value: 'zmk' },
        ]);
    });

    it('flags invalid queries starting with ||', () => {
        const result = parseQuery('|| #electronics');
        assert.equal(result.isValid, false);
    });

    it('flags invalid queries ending with ||', () => {
        const result = parseQuery('#electronics ||');
        assert.equal(result.isValid, false);
    });

    it('flags consecutive || operators', () => {
        const result = parseQuery('#a || || #b');
        assert.equal(result.isValid, false);
    });

    it('parses plain text search', () => {
        const result = parseQuery('Dormin Note');
        assert.equal(result.isValid, true);
        assert.deepEqual(result.tokens, [
            { type: 'text', value: 'Dormin' },
            { type: 'text', value: 'Note' },
        ]);
    });
});
