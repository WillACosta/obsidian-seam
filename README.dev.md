# Seam — Developer Guide

Quick reference for developing Seam and releasing new versions.

---

## 1. Quickstart

```bash
# Install dependencies
pnpm install

# Watch mode / Build
pnpm run dev
pnpm run build

# Run unit tests
pnpm test

# Link compiled plugin to test vault (seam_test_vault/)
pnpm run symlink
```

Test against `seam_test_vault/` using the Obsidian CLI:
```bash
obsidian plugin:reload id=seam
obsidian dev:errors
```

---

## 2. Spec-Driven Development (SDD)

### How to develop a new feature using SDD?

1. Create a new folder for the next iteration under `docs/specs`. Spec files for the iterations should be versioned, as the AI agent needs them as additional context during implementations.
2. Add individual spec files for each `feature` or `fix`.
3. Instruct your AI agent to implement the spec definitions in the specified directory.
4. The AI agent will take care of the rest, such as:

- Extracting Seam's context from past iteration files.
- Understanding the rules defined in the `AGENTS.md` file.
- Generating an `iteration_$number.md` file under `docs/dev_iterations` to generate the `CHANGELOG`.
- Updating `CHANGELOG.md` based on the iteration files.

---

## 3. How the Changelog Tracks Iterations

Each release in [`CHANGELOG.md`](CHANGELOG.md) stores an iteration range marker:

```markdown
## [1.0.0] - 2026-09-13
<!-- iterations: iteration_00..iteration_05 -->
```

### Automatic Iteration Grouping
The release script (`scripts/changelog.mjs`) reads this marker to determine where the previous release ended. When generating notes for the next release, it **automatically detects and groups all newer iteration files**:

```bash
# Auto-detects all unreleased iterations (e.g. iteration_06, iteration_07)
# and prepends the new section to CHANGELOG.md:
pnpm run changelog:generate 1.1.0 --update
```

You can also target specific ranges manually if needed:
```bash
# Group iterations starting after iteration_05:
pnpm run changelog:generate 1.1.0 --since iteration_05 --update

# Or specify a precise range:
pnpm run changelog:generate 1.1.0 --from 6 --to 8 --update
```

---

## 4. Releasing a New Version (GitHub Actions)

Releases are automated by the [merged version PR workflow](.github/workflows/tag-version-pr.yml) and the [Release Pipeline](.github/workflows/release.yml). Do not build or package release assets manually.

> **Version branch naming rule:** Create each new version branch as `feat/<major>.<minor>.<patch>`, for example `feat/3.0.0`.

> **Release naming rule:** Seam release versions and Git tags must use plain semantic versions without a leading `v`, such as `3.0.0` (never `v3.0.0`). The GitHub release name must match the same unprefixed version. The plugin display name in `manifest.json` remains `Seam`.

### Prepare the Version PR

1. **Bump the version**:
   Update `"version"` in:
   - `manifest.json`
   - `package.json`
   - `versions.json` (`"<new-version>": "1.5.0"`)

2. **Generate the Changelog entry**:
   ```bash
   pnpm run changelog:generate <new-version> --update
   ```

3. **Open a PR** from `feat/<new-version>` into `main` with the version files and changelog committed. Merge it after review. Do not create the release tag manually.

### What GitHub Actions Does Automatically
After a `feat/x.y.z` PR is merged into `main`, the merged version PR workflow:
1. Verifies the branch name, merged commit, release files, typecheck, lint, tests, and build.
2. Creates and pushes the unprefixed version tag on the merged commit.
3. Starts the Release Pipeline for that tag. The Release Pipeline validates the version again, extracts release notes, and publishes the GitHub Release with `main.js`, `manifest.json`, and `styles.css`.
