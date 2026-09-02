import { existsSync, mkdirSync, symlinkSync, unlinkSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv } from 'node:process';
import { execSync } from 'node:child_process';

const PROJECT_ROOT = resolve(process.cwd());
const FILES_TO_LINK = ['main.js', 'manifest.json', 'styles.css'];

function expandPath(inputPath) {
    if (!inputPath) return '';
    let p = inputPath.trim();
    if (p.startsWith('~')) {
        p = join(homedir(), p.slice(1));
    }
    return resolve(p);
}

function parseDirArg() {
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--dir' && argv[i + 1]) {
            return argv[i + 1];
        }
        if (argv[i].startsWith('--dir=')) {
            return argv[i].slice('--dir='.length);
        }
    }
    return null;
}

function resolvePluginDestination(basePath) {
    const expanded = expandPath(basePath);
    if (!expanded) return null;

    // Case 1: Already points directly to the plugin directory
    if (expanded.endsWith('obsidian-seam') || expanded.endsWith('seam')) {
        return expanded;
    }

    // Case 2: Points to .obsidian/plugins
    if (expanded.endsWith('.obsidian/plugins') || expanded.endsWith('.obsidian/plugins/')) {
        return join(expanded, 'obsidian-seam');
    }

    // Case 3: Points to a vault root (has .obsidian folder or standard vault)
    return join(expanded, '.obsidian', 'plugins', 'obsidian-seam');
}

async function main() {
    console.log('\n======================================================');
    console.log('  Seam Plugin — Local Vault Symlink Utility');
    console.log('  ⚠️  NOTICE: This is intended for local development and');
    console.log('             testing purposes only.');
    console.log('======================================================\n');

    let targetDirInput = parseDirArg();

    if (!targetDirInput) {
        const rl = createInterface({ input: stdin, output: stdout });
        try {
            targetDirInput = await rl.question(
                '📁 Enter the path to your Obsidian vault (e.g. ~/Documents/MyVault): '
            );
        } finally {
            rl.close();
        }
    }

    const pluginDir = resolvePluginDestination(targetDirInput);

    if (!pluginDir) {
        console.error('❌ Error: No valid target directory provided.');
        process.exit(1);
    }

    console.log(`\n🔨 Building production bundle...`);
    try {
        execSync('node esbuild.config.mjs production', {
            cwd: PROJECT_ROOT,
            stdio: 'inherit',
        });
    } catch (e) {
        console.error('❌ Build failed. Aborting symlink creation.');
        process.exit(1);
    }

    // Ensure target directory exists
    mkdirSync(pluginDir, { recursive: true });

    console.log(`\n🔗 Creating symlinks in: ${pluginDir}\n`);

    for (const file of FILES_TO_LINK) {
        const sourcePath = join(PROJECT_ROOT, file);
        const targetPath = join(pluginDir, file);

        if (!existsSync(sourcePath)) {
            console.warn(`⚠️  Warning: Source file not found: ${sourcePath}`);
            continue;
        }

        // Remove existing file or symlink if present
        if (existsSync(targetPath) || lstatSafe(targetPath)) {
            try {
                unlinkSync(targetPath);
            } catch {
                // Ignore if failed to unlink
            }
        }

        try {
            symlinkSync(sourcePath, targetPath, 'file');
            console.log(`   ✓ Linked: ${file} -> ${targetPath}`);
        } catch (err) {
            console.error(`   ❌ Failed to link ${file}: ${err.message}`);
        }
    }

    console.log('\n✅ Symlink setup complete!');
    console.log('\nNext steps in Obsidian:');
    console.log('  1. Open Settings (Cmd + ,) > Community plugins');
    console.log('  2. Click "Reload plugins" (🔄)');
    console.log('  3. Enable "Seam"\n');
}

function lstatSafe(path) {
    try {
        return lstatSync(path);
    } catch {
        return null;
    }
}

main().catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
