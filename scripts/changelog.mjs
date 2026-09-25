#!/usr/bin/env node

/**
 * Changelog & Release Notes Automation for Seam.
 *
 * Supported commands:
 *   extract [version] [--out <file>]
 *     Extracts the release notes for a specific version from CHANGELOG.md.
 *     If version is omitted, reads version from manifest.json.
 *
 *   generate <version> [files...] [--out <file>]
 *     Parses one or more docs/dev_iterations/iteration_*.md files,
 *     aggregates Added/Changed/Fixed/Removed sections, and outputs
 *     or prepends the new release section to CHANGELOG.md.
 *
 *   validate [version]
 *     Validates that package.json, manifest.json, versions.json, and CHANGELOG.md
 *     all agree on the release version.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const CHANGELOG_PATH = path.join(ROOT_DIR, 'CHANGELOG.md');
const MANIFEST_PATH = path.join(ROOT_DIR, 'manifest.json');
const PACKAGE_PATH = path.join(ROOT_DIR, 'package.json');
const VERSIONS_PATH = path.join(ROOT_DIR, 'versions.json');
const DEV_ITERATIONS_DIR = path.join(ROOT_DIR, 'docs', 'dev_iterations');

/**
 * Normalizes version strings by trimming and stripping leading 'v'.
 */
export function normalizeVersion(ver) {
    if (!ver) return '';
    return ver.trim().replace(/^v/i, '');
}

/**
 * Extracts the release notes for a specific version from CHANGELOG.md markdown.
 */
export function extractReleaseNotes(changelogContent, targetVersion) {
    const cleanVer = normalizeVersion(targetVersion);
    if (!cleanVer) {
        throw new Error('Target version must be specified.');
    }

    // Match ## [0.1.0] or ## 0.1.0 or ## [v0.1.0] with optional date
    const escapedVer = cleanVer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const headerRegex = new RegExp(
        `^##\\s+\\[?v?${escapedVer}\\]?(?:\\s*-\\s*\\S+)?\\s*$`,
        'm'
    );

    const match = headerRegex.exec(changelogContent);
    if (!match) {
        throw new Error(`Version "${cleanVer}" not found in CHANGELOG.md.`);
    }

    const startIndex = match.index + match[0].length;
    // Find next "## " header or end of file
    const nextHeaderRegex = /^##\s+/m;
    const rest = changelogContent.slice(startIndex);
    const nextMatch = nextHeaderRegex.exec(rest);

    const sectionBody = nextMatch ? rest.slice(0, nextMatch.index) : rest;
    return sectionBody.trim();
}

/**
 * Parses an iteration markdown file to extract categorized changes:
 * { Added: string[], Changed: string[], Fixed: string[], Removed: string[], Security: string[] }
 */
export function parseIterationDoc(content) {
    const categories = {
        Added: [],
        Changed: [],
        Fixed: [],
        Deprecated: [],
        Removed: [],
        Security: [],
    };

    let currentCategory = null;
    let currentBullet = null;

    const lines = content.split('\n');
    for (const line of lines) {
        const h3Match = line.match(/^###\s+(Added|Changed|Fixed|Deprecated|Removed|Security)/i);
        if (h3Match) {
            // Save pending bullet
            if (currentCategory && currentBullet) {
                categories[currentCategory].push(currentBullet);
                currentBullet = null;
            }
            const catName = Object.keys(categories).find(
                (c) => c.toLowerCase() === h3Match[1].toLowerCase()
            );
            currentCategory = catName || null;
            continue;
        }

        // Stop collecting when the iteration document reaches another h3
        // section such as "Tests" that is not a changelog category.
        if (line.match(/^###\s+/)) {
            if (currentCategory && currentBullet) {
                categories[currentCategory].push(currentBullet);
                currentBullet = null;
            }
            currentCategory = null;
            continue;
        }

        // Check if leaving section (e.g. ## or another heading)
        if (line.match(/^##\s+/) || line.match(/^#[^#]/)) {
            if (currentCategory && currentBullet) {
                categories[currentCategory].push(currentBullet);
                currentBullet = null;
            }
            currentCategory = null;
            continue;
        }

        if (!currentCategory) continue;

        const bulletMatch = line.match(/^[-*]\s+(.*)$/);
        if (bulletMatch) {
            if (currentBullet) {
                categories[currentCategory].push(currentBullet);
            }
            currentBullet = bulletMatch[1].trim();
        } else if (currentBullet && line.match(/^\s{2,}/)) {
            // Continuation line of multi-line bullet
            currentBullet += '\n' + line;
        }
    }

    if (currentCategory && currentBullet) {
        categories[currentCategory].push(currentBullet);
    }

    return categories;
}

/**
 * Aggregates categories across multiple iteration files.
 */
export function aggregateIterations(iterationContents) {
    const aggregated = {
        Added: [],
        Changed: [],
        Fixed: [],
        Deprecated: [],
        Removed: [],
        Security: [],
    };

    for (const content of iterationContents) {
        const parsed = parseIterationDoc(content);
        for (const [cat, items] of Object.entries(parsed)) {
            for (const item of items) {
                if (!aggregated[cat].includes(item)) {
                    aggregated[cat].push(item);
                }
            }
        }
    }

    return aggregated;
}

/**
 * Extracts all iteration IDs (e.g. 'iteration_00', 'iteration_05') recorded in CHANGELOG.md.
 */
export function parseRecordedIterations(changelogContent) {
    const recorded = new Set();
    const markerRegex = /<!--\s*iterations:\s*([^>]+)\s*-->/gi;
    let match;
    while ((match = markerRegex.exec(changelogContent)) !== null) {
        const raw = match[1].trim();
        const rangeMatch = raw.match(/^iteration_(\d+)\.\.iteration_(\d+)$/i);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = parseInt(rangeMatch[2], 10);
            for (let i = start; i <= end; i++) {
                const pad = String(i).padStart(2, '0');
                recorded.add(`iteration_${pad}`);
            }
        } else {
            const items = raw.split(/[,\s]+/).filter(Boolean);
            for (const item of items) {
                if (/^iteration_\d+/i.test(item)) {
                    recorded.add(item.toLowerCase());
                }
            }
        }
    }
    return recorded;
}

/**
 * Extracts numerical iteration ID from a filename or string.
 * e.g. 'iteration_05.md' -> 5, 'iteration_2' -> 2
 */
export function extractIterationNumber(str) {
    if (!str) return null;
    const m = str.match(/iteration_(\d+)/i) || str.match(/^(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
}

/**
 * Formats aggregated categories into a Keep a Changelog version section.
 */
export function formatChangelogSection(
    version,
    aggregated,
    date = new Date().toISOString().slice(0, 10),
    iterationIds = []
) {
    const cleanVer = normalizeVersion(version);
    let output = `## [${cleanVer}] - ${date}\n`;

    if (iterationIds && iterationIds.length > 0) {
        const sorted = [...iterationIds].sort(
            (a, b) => (extractIterationNumber(a) ?? 0) - (extractIterationNumber(b) ?? 0)
        );
        const marker =
            sorted.length > 1 ? `${sorted[0]}..${sorted[sorted.length - 1]}` : sorted[0];
        output += `<!-- iterations: ${marker} -->\n\n`;
    } else {
        output += '\n';
    }

    const categoryOrder = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

    let hasContent = false;
    for (const cat of categoryOrder) {
        const items = aggregated[cat];
        if (items && items.length > 0) {
            hasContent = true;
            output += `### ${cat}\n`;
            for (const item of items) {
                output += `- ${item}\n`;
            }
            output += '\n';
        }
    }

    if (!hasContent) {
        output += `Initial release.\n\n`;
    }

    return output.trim();
}

/**
 * CLI Command: Extract release notes
 */
function cmdExtract(args) {
    let version = null;
    let outFile = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--out' && args[i + 1]) {
            outFile = args[i + 1];
            i++;
        } else if (!args[i].startsWith('--') && !version) {
            version = args[i];
        }
    }

    if (!version) {
        if (fs.existsSync(MANIFEST_PATH)) {
            const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
            version = manifest.version;
        } else {
            throw new Error('No version specified and manifest.json not found.');
        }
    }

    if (!fs.existsSync(CHANGELOG_PATH)) {
        throw new Error(`CHANGELOG.md not found at ${CHANGELOG_PATH}`);
    }

    const changelogContent = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    const notes = extractReleaseNotes(changelogContent, version);

    if (outFile) {
        const resolvedOut = path.resolve(process.cwd(), outFile);
        fs.writeFileSync(resolvedOut, notes + '\n', 'utf8');
        console.log(`Release notes for v${normalizeVersion(version)} written to ${resolvedOut}`);
    } else {
        process.stdout.write(notes + '\n');
    }
}

/**
 * CLI Command: Generate changelog from iteration docs
 */
function cmdGenerate(args) {
    let version = null;
    let outFile = null;
    let updateChangelog = false;
    let sinceNum = null;
    let fromNum = null;
    let toNum = null;
    const filePaths = [];

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--out' && args[i + 1]) {
            outFile = args[i + 1];
            i++;
        } else if (args[i] === '--since' && args[i + 1]) {
            sinceNum = extractIterationNumber(args[i + 1]);
            i++;
        } else if (args[i] === '--from' && args[i + 1]) {
            fromNum = extractIterationNumber(args[i + 1]);
            i++;
        } else if (args[i] === '--to' && args[i + 1]) {
            toNum = extractIterationNumber(args[i + 1]);
            i++;
        } else if (args[i] === '--update' || args[i] === '-u') {
            updateChangelog = true;
        } else if (!args[i].startsWith('--') && !version) {
            version = args[i];
        } else if (!args[i].startsWith('--')) {
            filePaths.push(args[i]);
        }
    }

    if (!version) {
        if (fs.existsSync(MANIFEST_PATH)) {
            const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
            version = manifest.version;
        } else {
            throw new Error('Version must be specified.');
        }
    }

    // Determine target iteration files
    let targetFiles = filePaths;
    if (targetFiles.length === 0 && fs.existsSync(DEV_ITERATIONS_DIR)) {
        const allFiles = fs
            .readdirSync(DEV_ITERATIONS_DIR)
            .filter((f) => f.startsWith('iteration_') && f.endsWith('.md'))
            .sort((a, b) => (extractIterationNumber(a) ?? 0) - (extractIterationNumber(b) ?? 0));

        let recorded = new Set();
        if (fs.existsSync(CHANGELOG_PATH)) {
            recorded = parseRecordedIterations(fs.readFileSync(CHANGELOG_PATH, 'utf8'));
        }

        targetFiles = allFiles
            .filter((f) => {
                const id = f.replace(/\.md$/i, '').toLowerCase();
                const num = extractIterationNumber(f);

                if (sinceNum !== null && num !== null) return num > sinceNum;
                if (fromNum !== null && num !== null) return num >= fromNum;
                if (toNum !== null && num !== null) return num <= toNum;

                // Auto-detect: only include iterations not yet recorded in CHANGELOG.md
                return !recorded.has(id);
            })
            .map((f) => path.join(DEV_ITERATIONS_DIR, f));

        if (targetFiles.length === 0) {
            // Fallback: if no unrecorded found and no range specified, load all
            if (recorded.size === 0 && sinceNum === null && fromNum === null) {
                targetFiles = allFiles.map((f) => path.join(DEV_ITERATIONS_DIR, f));
            } else {
                console.warn('No unreleased iterations found. All available iterations are already recorded in CHANGELOG.md.');
                return;
            }
        }
    }

    const iterationIds = targetFiles.map((f) => path.basename(f, '.md'));
    console.log(`Processing ${targetFiles.length} iteration(s): ${iterationIds.join(', ')}`);

    const contents = targetFiles.map((file) => {
        const absPath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(absPath)) {
            throw new Error(`Iteration file not found: ${absPath}`);
        }
        return fs.readFileSync(absPath, 'utf8');
    });

    const aggregated = aggregateIterations(contents);
    const formatted = formatChangelogSection(version, aggregated, undefined, iterationIds);

    if (updateChangelog) {
        let existing = '';
        if (fs.existsSync(CHANGELOG_PATH)) {
            existing = fs.readFileSync(CHANGELOG_PATH, 'utf8');
        }

        let updated = '';
        const cleanVer = normalizeVersion(version);
        // If version already exists in CHANGELOG, replace that section
        const escapedVer = cleanVer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const verHeaderRegex = new RegExp(`^##\\s+\\[?v?${escapedVer}\\]?.*$`, 'm');

        if (verHeaderRegex.test(existing)) {
            // Replace existing section
            const startMatch = verHeaderRegex.exec(existing);
            const startIndex = startMatch.index;
            const nextHeaderRegex = /^##\s+/m;
            const rest = existing.slice(startIndex + startMatch[0].length);
            const nextMatch = nextHeaderRegex.exec(rest);
            const endIndex = nextMatch ? startIndex + startMatch[0].length + nextMatch.index : existing.length;

            updated = existing.slice(0, startIndex) + formatted + '\n\n' + existing.slice(endIndex).trimStart();
        } else {
            // Insert after top header
            const headerEndMatch = existing.match(/^# [^\n]*\n+/);
            if (headerEndMatch) {
                const insertPos = headerEndMatch[0].length;
                updated = existing.slice(0, insertPos) + formatted + '\n\n' + existing.slice(insertPos);
            } else {
                updated = `# Changelog\n\nAll notable changes to Seam are documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),\nand this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n${formatted}\n\n${existing}`;
            }
        }

        fs.writeFileSync(CHANGELOG_PATH, updated.trimEnd() + '\n', 'utf8');
        console.log(`CHANGELOG.md updated for version ${cleanVer}`);
    } else if (outFile) {
        const resolvedOut = path.resolve(process.cwd(), outFile);
        fs.writeFileSync(resolvedOut, formatted + '\n', 'utf8');
        console.log(`Generated changelog for v${normalizeVersion(version)} written to ${resolvedOut}`);
    } else {
        process.stdout.write(formatted + '\n');
    }
}

/**
 * CLI Command: Validate release version consistency across files
 */
function cmdValidate(args) {
    const targetVersion = args[0] ? normalizeVersion(args[0]) : null;

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
    const versions = JSON.parse(fs.readFileSync(VERSIONS_PATH, 'utf8'));
    const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');

    const manifestVer = normalizeVersion(manifest.version);
    const pkgVer = normalizeVersion(pkg.version);
    const expectedVer = targetVersion || manifestVer;

    console.log(`Validating release consistency for version: ${expectedVer}`);

    let errors = 0;

    if (manifestVer !== expectedVer) {
        console.error(`❌ manifest.json version (${manifestVer}) does not match expected (${expectedVer})`);
        errors++;
    } else {
        console.log(`✅ manifest.json: ${manifestVer}`);
    }

    if (pkgVer !== expectedVer) {
        console.error(`❌ package.json version (${pkgVer}) does not match expected (${expectedVer})`);
        errors++;
    } else {
        console.log(`✅ package.json: ${pkgVer}`);
    }

    if (!versions[expectedVer]) {
        console.error(`❌ versions.json is missing entry for version "${expectedVer}"`);
        errors++;
    } else {
        console.log(`✅ versions.json: "${expectedVer}": "${versions[expectedVer]}"`);
    }

    try {
        const notes = extractReleaseNotes(changelog, expectedVer);
        if (!notes || notes.trim().length === 0) {
            console.error(`❌ CHANGELOG.md entry for version "${expectedVer}" is empty.`);
            errors++;
        } else {
            console.log(`✅ CHANGELOG.md: entry found (${notes.split('\n').length} lines)`);
        }
    } catch (err) {
        console.error(`❌ CHANGELOG.md: ${err.message}`);
        errors++;
    }

    if (errors > 0) {
        process.exit(1);
    } else {
        console.log(`\n🎉 All release consistency checks passed! Ready for release v${expectedVer}`);
    }
}

function showHelp() {
    console.log(`
Seam Changelog & Release Utility

Usage:
  node scripts/changelog.mjs extract [version] [--out <file>]
    Extract release notes for version (defaults to manifest.json version).

  node scripts/changelog.mjs generate <version> [iterationFiles...] [--update] [--out <file>]
    Parse iteration docs and output or update CHANGELOG.md.

  node scripts/changelog.mjs validate [version]
    Validate version consistency across manifest, package, versions.json, and CHANGELOG.md.
`);
}

// Main CLI router: only execute if invoked directly from CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [command, ...rest] = process.argv.slice(2);

    switch (command) {
        case 'extract':
            cmdExtract(rest);
            break;
        case 'generate':
            cmdGenerate(rest);
            break;
        case 'validate':
            cmdValidate(rest);
            break;
        case '--help':
        case '-h':
        case 'help':
            showHelp();
            break;
        default:
            if (!command) {
                showHelp();
            } else {
                console.error(`Unknown command: ${command}`);
                showHelp();
                process.exit(1);
            }
    }
}
