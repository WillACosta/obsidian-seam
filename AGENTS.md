# Seam — AI Agent Instructions

**Project:** Seam (Obsidian Plugin)
**Philosophy:** *"Simplicity is the new Luxury."*
**Dev Instructions:** README.dev.md

---

## 1. Project Overview

Seam is a small, native-feeling Obsidian plugin for tag-driven capture, automated note lifecycle organization, and rapid search.
Users write and tag freely; Seam quietly manages note placement and state:

- **Capture & Organization:** Moves notes automatically based on workflow tags (e.g., `#permanent` moves to `Permanent/`, `#archive` moves to `Archive/` with optional tag/property cleanup).
- **Universal Palette:** A fast, native modal providing tag/text search, prefix matching, boolean operators (`||`, `OR`, `-`), instant note navigation, and action commands.
- **Native & Minimal:** Built strictly on public Obsidian APIs. No external database, no telemetry, no cloud services, and zero desktop-only lock-in.

---

## 2. How to Implement New Iterations

When the user requests work on a new iteration, follow this standard process:

1. **Locate and Read Specs:**
   - Read all specification files in the specified directory under `docs/specs/**` (e.g. `docs/specs/iteration_06/`).
   - The iteration spec is the primary source of truth for the desired product behavior.

2. **Survey Existing Codebase:**
   - Review past iteration logs in `docs/dev_iterations/` and existing source files in `src/` to understand existing architecture and conventions.
   - Keep business logic in dedicated services (`src/automation/`, `src/search/`) rather than bloating UI modals or `main.ts`.

3. **Verify Obsidian APIs:**
   - Verify all API signatures against official documentation and the installed `obsidian` TypeScript definitions (`node_modules/obsidian/obsidian.d.ts`).
   - Never guess APIs or use outdated patterns.

4. **Implement Cleanly:**
   - Write explicit, typed TypeScript with early returns and clear error handling.
   - Respect mobile compatibility (`isDesktopOnly = false`).

5. **Test & Validate:**
   - Run unit tests: `pnpm test`.
   - Validate in the real development vault using Obsidian CLI (see Section 3).

6. **Generate Post-Iteration Deliverable:**
   - Generate `docs/dev_iterations/iteration_$id.md` summarizing the changes (see Section 4).
   - Update the changelog with `pnpm run changelog:generate`.

---

## 3. Obsidian Docs, CLI, and Skills

### Official Resources
- **Obsidian Developer Documentation:** [https://docs.obsidian.md/](https://docs.obsidian.md/)
- **Obsidian Skills:** `obsidian-skills` repository (`obsidian-cli`, `obsidian-markdown`).

### Mandatory Test Vault
- Always test against the dedicated development vault: `seam_test_vault/` at project root.
- **Never** develop or test against a user's production vault.
- `seam_test_vault/` must remain Git-ignored.

### Obsidian CLI Validation Cycle
Always validate code changes against the running test vault:

```bash
# 1. Build plugin
pnpm build

# 2. Reload Seam in the test vault
obsidian plugin:reload id=seam

# 3. Check for runtime errors
obsidian dev:errors

# 4. Check console errors
obsidian dev:console level=error
```

Execute workflow tests (creating notes, tagging `#permanent` / `#archive`, testing Universal Palette search) to confirm expected runtime behavior.

---

## 4. Post-Iteration Deliverable: `iteration_$id.md`

Upon completing an iteration, you **must** create a new summary file under `docs/dev_iterations/iteration_$id.md` (e.g., `iteration_06.md`).

### Required Structure

The file must strictly adhere to the following template, as the automated changelog tool (`scripts/changelog.mjs`) parses these exact headings:

```markdown
# Development Log — Iteration <ID>

- **Iteration ID:** `iteration_<ID>`
- **Date:** `YYYY-MM-DD`
- **Specs Directory:** [`docs/specs/iteration_<ID>`](../specs/iteration_<ID>/)
  - `spec_file_1.md`
  - `spec_file_2.md`

## Summary of Changes

### Added
- **Feature Name**: Description of new capability or user-facing addition.

### Changed
- **Component or Behavior**: Description of modified architecture or UI behavior.

### Fixed
- **Bug or Issue Fixed**:
  - **Root Cause**: What caused the defect.
  - **Fix**: Summary of code changes that resolved it.
  - **Verified Scenarios**: How the fix was validated.

### Tests
- Summary of new automated unit tests and runtime CLI verifications performed.
```

### Update Changelog
Immediately after creating `iteration_$id.md`, update the changelog:

```bash
pnpm run changelog:generate
```

Verify that `CHANGELOG.md` reflects the changes cleanly.

---

## 5. Architectural & Safety Guardrails

- **Mobile First-Class:** Keep `isDesktopOnly = false`. Never use Node.js filesystem modules (`fs`), Electron APIs, OS schedulers, or desktop-only globals.
- **Public Native APIs Only:** Use `Vault`, `FileManager`, `MetadataCache`, `Workspace`, `Plugin`, and `Modal`/`SuggestModal`. Use `FileManager.processFrontMatter()` for frontmatter and `normalizePath()` for paths.
- **Safe Automation:**
  - Never remove an action tag until file movement/mutation succeeds.
  - Never delete notes as part of normal automation.
  - Never silently overwrite filename conflicts (use numerical disambiguation or abort safely).
- **Lightweight Lifecycle:** Keep `onload()` minimal; defer heavy indexing or reconciliation to `workspace.onLayoutReady()`. Clean up all event listeners, timers, and DOM nodes on `onunload()`.
- **No Feature Creep:** Do not add external sync, databases, cloud telemetry, or complex productivity frameworks outside the specs.
