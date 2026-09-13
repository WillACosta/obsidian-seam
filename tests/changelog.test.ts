import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeVersion,
    extractReleaseNotes,
    parseIterationDoc,
    aggregateIterations,
    formatChangelogSection,
    parseRecordedIterations,
    extractIterationNumber,
} from '../scripts/changelog.mjs';

describe('Changelog Automation — Iteration Tracking', () => {
    it('extracts numerical iteration IDs', () => {
        assert.equal(extractIterationNumber('iteration_05.md'), 5);
        assert.equal(extractIterationNumber('iteration_00'), 0);
        assert.equal(extractIterationNumber('iteration_12'), 12);
        assert.equal(extractIterationNumber('7'), 7);
        assert.equal(extractIterationNumber('other.md'), null);
    });

    it('parses recorded iteration ranges from changelog', () => {
        const text = `
## [0.1.0] - 2026-09-13
<!-- iterations: iteration_00..iteration_05 -->

Content...
`;
        const recorded = parseRecordedIterations(text);
        assert.equal(recorded.has('iteration_00'), true);
        assert.equal(recorded.has('iteration_03'), true);
        assert.equal(recorded.has('iteration_05'), true);
        assert.equal(recorded.has('iteration_06'), false);
    });

    it('parses recorded comma-separated iteration lists', () => {
        const text = `
## [0.2.0] - 2026-10-01
<!-- iterations: iteration_06, iteration_07 -->
`;
        const recorded = parseRecordedIterations(text);
        assert.equal(recorded.has('iteration_06'), true);
        assert.equal(recorded.has('iteration_07'), true);
        assert.equal(recorded.has('iteration_08'), false);
    });
});

describe('Changelog Automation — Version Normalization', () => {
    it('normalizes version tags correctly', () => {
        assert.equal(normalizeVersion('0.1.0'), '0.1.0');
        assert.equal(normalizeVersion('v0.1.0'), '0.1.0');
        assert.equal(normalizeVersion('V1.2.3'), '1.2.3');
        assert.equal(normalizeVersion('  v0.1.0  '), '0.1.0');
        assert.equal(normalizeVersion(''), '');
    });
});

describe('Changelog Automation — Release Notes Extraction', () => {
    const sampleChangelog = `# Changelog

All notable changes are documented here.

## [0.2.0] - 2026-10-01

### Added
- New awesome feature.

## [0.1.0] - 2026-09-13

Initial release of Seam.

### Added
- Core automation engine.
- Universal palette.

### Fixed
- Fixed minor bug.

## [0.0.1] - 2026-08-01

### Added
- Prototype.
`;

    it('extracts specific version notes cleanly', () => {
        const notes = extractReleaseNotes(sampleChangelog, '0.1.0');
        assert.ok(notes.includes('Initial release of Seam.'));
        assert.ok(notes.includes('Core automation engine.'));
        assert.ok(notes.includes('Fixed minor bug.'));
        assert.equal(notes.includes('New awesome feature.'), false);
        assert.equal(notes.includes('Prototype.'), false);
    });

    it('extracts version with v prefix', () => {
        const notes = extractReleaseNotes(sampleChangelog, 'v0.1.0');
        assert.ok(notes.includes('Initial release of Seam.'));
    });

    it('extracts the latest version at the top', () => {
        const notes = extractReleaseNotes(sampleChangelog, '0.2.0');
        assert.ok(notes.includes('New awesome feature.'));
        assert.equal(notes.includes('Initial release of Seam.'), false);
    });

    it('extracts the oldest version at the bottom', () => {
        const notes = extractReleaseNotes(sampleChangelog, '0.0.1');
        assert.ok(notes.includes('Prototype.'));
        assert.equal(notes.includes('Core automation engine.'), false);
    });

    it('throws when target version does not exist', () => {
        assert.throws(
            () => extractReleaseNotes(sampleChangelog, '9.9.9'),
            /Version "9\.9\.9" not found in CHANGELOG\.md/
        );
    });
});

describe('Changelog Automation — Iteration Doc Parsing & Aggregation', () => {
    const iterDoc1 = `# Development Log — Iteration 01

## Summary of Changes

### Added
- Feature A in iter 01.
- Feature B with multi-line
  continuation description.

### Fixed
- Bug 1 in iter 01.
`;

    const iterDoc2 = `# Development Log — Iteration 02

## Summary of Changes

### Added
- Feature C in iter 02.

### Changed
- Refactored settings structure.

### Fixed
- Bug 2 in iter 02.
`;

    it('parses individual iteration doc sections', () => {
        const parsed = parseIterationDoc(iterDoc1);
        assert.equal(parsed.Added.length, 2);
        assert.equal(parsed.Added[0], 'Feature A in iter 01.');
        assert.ok(parsed.Added[1].includes('multi-line'));
        assert.equal(parsed.Fixed.length, 1);
        assert.equal(parsed.Fixed[0], 'Bug 1 in iter 01.');
        assert.equal(parsed.Changed.length, 0);
    });

    it('aggregates multiple iteration docs and preserves categories', () => {
        const aggregated = aggregateIterations([iterDoc1, iterDoc2]);
        assert.equal(aggregated.Added.length, 3);
        assert.equal(aggregated.Changed.length, 1);
        assert.equal(aggregated.Fixed.length, 2);
    });

    it('formats aggregated sections into Keep a Changelog standard', () => {
        const aggregated = aggregateIterations([iterDoc1, iterDoc2]);
        const formatted = formatChangelogSection('0.2.0', aggregated, '2026-10-01');

        assert.ok(formatted.startsWith('## [0.2.0] - 2026-10-01'));
        assert.ok(formatted.includes('### Added\n- Feature A in iter 01.'));
        assert.ok(formatted.includes('### Changed\n- Refactored settings structure.'));
        assert.ok(formatted.includes('### Fixed\n- Bug 1 in iter 01.'));
    });
});
