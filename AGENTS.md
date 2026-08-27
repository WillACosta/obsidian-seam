# Seam — AI Agent Instructions

**Version:** 0.1.0
**Product specification:** `docs/specs/product_v0.1.0.md`
**Technical companion:** `docs/specs/tech_v0.1.0.md`

## 1. Mission

Implement Seam as a small, native-feeling Obsidian plugin. The product principle is:

> **Simplicity is the new Luxury.**

The user should be able to capture, write, tag, and forget about organization. Do not turn Seam into a general-purpose productivity framework.

## 2. Source-of-Truth Hierarchy

Use this hierarchy:

1. **`docs/SDD_v0.1.0.md`** — authoritative product behavior, UX, logic, safety rules, and acceptance criteria.
2. **`docs/Seam_Tech_v0.1.0.md`** — technical architecture, implementation constraints, lifecycle, mobile, performance, and testing guidance.
3. **Official Obsidian Developer Documentation** — current platform/API truth: https://docs.obsidian.md/
4. **`obsidian-skills`** — agent/development aid: https://github.com/kepano/obsidian-skills
5. Agent's own prior knowledge.

If documents conflict, the Product SDD wins. Verify current API signatures against official docs and the installed `obsidian` TypeScript definitions rather than relying on memory.

## 3. Agent Mental Model

```text
                         AGENTS.md
                             │
                             ▼
                      How to work
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
       Product SDD                       Tech SDD
          WHAT                             HOW
              │                             │
              └──────────────┬──────────────┘
                             ▼
                  Official Obsidian Docs
                             │
                             ▼
                   Current API / Types
                             │
                             ▼
                       Implementation
                             │
                             ▼
                    Obsidian Skills
                             │
                             ▼
                  Real-vault validation
```

And:

```text
                     Obsidian
                        │
                  native APIs
                        ▼
                 ┌────────────┐
                 │   Seam     │
                 └────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
      Automation      Search       Palette
          │             │             │
          └─────────────┴─────────────┘
                        │
                        ▼
                     Vault
```

Do not build a second application inside Obsidian.

## 4. Required Reading

Before implementation, read:

```text
docs/specs/product_v0.1.0.md
docs/specs/tech_v0.1.0.md
```

Then consult the relevant current official Obsidian docs and skills.

Relevant skills:

- `obsidian-cli`
- `obsidian-markdown`

The `obsidian-cli` skill is particularly important because it supports plugin reload, error inspection, screenshots, DOM inspection, console inspection, JavaScript evaluation, and mobile emulation.

## 5. Mandatory Test Vault

Never develop or test against the user's production vault.

Obsidian's official plugin documentation recommends a separate development vault.

Create:

```text
seam_test_vault/
```

at the **root of this project**:

```text
Seam/
├── docs/
├── src/
├── tests/
├── seam_test_vault/
├── AGENTS.md
└── ...
```

The directory must be Git-ignored:

```gitignore
seam_test_vault/
```

Do not commit the test vault or its `.obsidian` directory.

The test vault must be a real Obsidian vault opened by a running Obsidian instance, not merely a filesystem fixture.

## 6. Obsidian CLI Is Mandatory for Validation

Use the current `obsidian-skills` `obsidian-cli` skill.

The CLI requires a running Obsidian instance. Verify its current commands with:

```bash
obsidian help
```

Use the CLI to:

- create/read/modify test notes;
- search the test vault;
- reload Seam;
- inspect errors;
- inspect console output;
- inspect DOM;
- take screenshots;
- run diagnostics;
- test mobile emulation where useful.

After meaningful plugin changes, use a cycle like:

```text
Modify code
  ↓
Build
  ↓
Ensure seam_test_vault is open
  ↓
Reload Seam with Obsidian CLI
  ↓
Check errors
  ↓
Run focused test
  ↓
Inspect UI/console where relevant
  ↓
Fix
  ↓
Repeat
```

Typical commands include:

```bash
obsidian plugin:reload id=<seam-plugin-id>
obsidian dev:errors
obsidian dev:console level=error
```

Check `obsidian help` for the exact current syntax before use.

The CLI is for **testing and controlling the development environment**. Seam itself must use the Obsidian TypeScript API, not invoke the CLI at runtime.

## 7. Test the Real Workflow

Validate the actual product behavior, not only compilation.

Example:

```text
Create Fleeting Note
  ↓
Write
  ↓
Add #electronics
  ↓
Add #permanent
  ↓
Wait for automation
  ↓
Verify Permanent/ movement
  ↓
Verify #permanent removed
  ↓
Verify #electronics remains
```

Archive:

```text
Add #archive
  ↓
Verify Archive/ movement
  ↓
Verify #archive removed
  ↓
Verify #archived state when enabled
```

Search:

```text
Open Universal Palette
  ↓
Type #electronics -#archived
  ↓
Verify live results
```

Manual automation:

```text
Open Universal Palette
  ↓
Run archive-all action
  ↓
Verify every matching note
```

## 8. Mobile Is First-Class

The plugin must remain:

```text
isDesktopOnly = false
```

Do not depend on:

- Electron;
- Node.js filesystem modules;
- desktop-only globals;
- OS schedulers;
- background daemons;
- platform-specific filesystem paths.

Use the same core services on desktop and mobile.

Follow the SDD's lifecycle behavior when Obsidian is suspended or terminated.

## 9. Native API Rules

Prefer current public Obsidian APIs:

```text
Vault
FileManager
MetadataCache
Workspace
Plugin
Modal / SuggestModal
Notice
```

Use `FileManager.processFrontMatter()` for frontmatter changes and Obsidian's Vault/FileManager APIs for file operations.

Use `Plugin.loadData()` / `saveData()` for settings.

Use `normalizePath()` for user-configured paths.

Do not use direct filesystem manipulation, Electron APIs, or Node-only runtime modules.

## 10. Lifecycle

Keep `onload()` lightweight.

Defer expensive initialization until:

```text
workspace.onLayoutReady()
```

Use Obsidian lifecycle registration helpers so events, timers, observers, and other resources are cleaned up when the plugin unloads.

Automation should be event-driven with startup/periodic reconciliation as described by the Tech SDD.

## 11. Automation Architecture

There must be one authoritative automation path:

```text
Vault Events ─────┐
Startup Scan ─────┼──> AutomationQueue
Manual Commands ──┘
                         │
                         ▼
                 AutomationService
                         │
                  ┌──────┴──────┐
                  ▼             ▼
             ArchiveAction  PermanentAction
```

Do not duplicate archive/permanent logic across event handlers, commands, timers, and startup scanning.

Automation must favor safe retryability:

- never remove an action tag before the operation succeeds;
- never silently overwrite conflicts;
- never delete notes as normal automation;
- never modify unrelated content or metadata.

## 12. Search Architecture

Do not immediately build a proprietary database or search engine.

Prefer:

```text
User query
  ↓
QueryParser
  ↓
SearchService
  ↓
Obsidian native search / metadata
```

Keep the initial query language intentionally small.

The parser should be independent from the UI.

Live search must be debounced and stale asynchronous results must not overwrite newer results.

## 13. Universal Palette

The Universal Palette is the primary Seam UI.

Prefer Obsidian's native modal/suggestion primitives.

Keep business logic outside UI classes:

```text
Palette
  ↓
Service
  ↓
Obsidian API
```

The palette must support keyboard, mouse, and touch. Do not make core functionality depend on hover or right-click.

## 14. Code Quality

Prefer:

- explicit TypeScript types;
- small modules;
- `async`/`await`;
- clear error handling;
- meaningful names;
- early returns;
- testable services.

Avoid:

- `any`;
- giant `main.ts`;
- giant modal classes;
- speculative abstractions;
- unnecessary dependencies;
- dead code;
- unexplained magic constants.

Follow the current Obsidian plugin self-review guidance.

## 15. Dependency and State Policy

Keep dependencies minimal.

Do not introduce a framework merely for convenience.

Do not create:

- a second database;
- a second metadata model;
- a full-vault persistent index;
- a cloud service;
- telemetry;
- analytics.

Persistent state should primarily be plugin settings. Runtime queues, search state, and caches should remain in memory unless the SDD explicitly requires persistence.

## 16. No Feature Creep

Do not silently add:

- AI;
- semantic search;
- dashboards;
- cloud services;
- telemetry;
- sync;
- folder-taxonomy automation;
- unrelated productivity features.

Record interesting future ideas rather than implementing them without specification.

## 17. Handling Ambiguity

If implementation details are unspecified but product behavior is clear:

1. choose the smallest sound implementation;
2. prefer native Obsidian APIs;
3. preserve mobile compatibility;
4. avoid new user-facing complexity;
5. document material architectural decisions.

If product behavior itself is ambiguous, do not invent a new product rule. Follow the Product SDD or surface the ambiguity.

## 18. Current API Verification

Before using an unfamiliar API:

1. check current official Obsidian documentation;
2. inspect the installed `obsidian` TypeScript definitions;
3. check the relevant `obsidian-skills` guidance;
4. implement;
5. compile;
6. test in the real Obsidian runtime.

Do not assume an API exists because an older plugin example uses it.

## 19. Visual Validation

When changing the Universal Palette or other UI:

1. reload the plugin;
2. open the UI in the real test vault;
3. inspect it visually;
4. use `dev:screenshot` where useful;
5. use `dev:dom` where useful;
6. inspect console errors;
7. test keyboard navigation;
8. test touch/mobile behavior where possible.

Compilation is not sufficient UI validation.

## 20. Git Hygiene

Ignore:

```gitignore
seam_test_vault/
```

Do not commit:

- the test vault;
- generated runtime screenshots;
- debug dumps;
- local secrets;
- unnecessary build artifacts.

If a fixture is important, represent it as a minimal automated test or documented test case instead of committing the entire test vault.

## 21. Recommended Development Sequence

```text
1. Read Product SDD
2. Read Tech SDD
3. Inspect repository
4. Consult current Obsidian docs
5. Read relevant Obsidian Skills
6. Create seam_test_vault
7. Git-ignore seam_test_vault
8. Establish plugin foundation
9. Implement automation
10. Implement reconciliation
11. Implement query parser/search
12. Implement Universal Palette
13. Integrate commands
14. Validate with Obsidian CLI
15. Validate mobile behavior
16. Review against both SDDs
17. Clean repository
```

Do not polish the UI before core automation is reliable.

## 22. Official References

Official Obsidian Developer Documentation:

```text
https://docs.obsidian.md/
```

Build a plugin:

```text
https://docs.obsidian.md/Plugins/Getting%20started/Build%20a%20plugin
```

Obsidian Agent Skills:

```text
https://github.com/kepano/obsidian-skills
```

Obsidian CLI Skill:

```text
https://github.com/kepano/obsidian-skills/tree/main/skills/obsidian-cli
```

Obsidian Markdown Skill:

```text
https://github.com/kepano/obsidian-skills/tree/main/skills/obsidian-markdown
```

Use the current versions of these resources.

## 23. Final Acceptance Gate

Before declaring v0.1.0 complete:

```text
[ ] Product SDD requirements implemented
[ ] Tech SDD constraints respected
[ ] Desktop tested
[ ] Mobile behavior tested
[ ] seam_test_vault used
[ ] seam_test_vault is gitignored
[ ] Obsidian CLI used for runtime validation
[ ] Plugin reload tested through CLI
[ ] dev:errors checked
[ ] console errors checked
[ ] Universal Palette tested
[ ] Live search tested
[ ] Archive automation tested
[ ] Permanent automation tested
[ ] Startup reconciliation tested
[ ] Failure/retry behavior tested
[ ] Filename conflict tested
[ ] No unrelated note mutations
[ ] No direct filesystem runtime access
[ ] No Electron runtime dependency
[ ] No telemetry/network dependency
[ ] No unnecessary dependencies
[ ] Production debug logs removed
[ ] Plugin unload cleans up resources
```

## 24. Final Principle

The codebase should embody the product philosophy:

```text
small
predictable
native
quiet
recoverable
mobile-friendly
```

Do not solve simplicity with complexity.

Do not make the user manage the system.

The implementation is successful when Seam feels like:

> **Obsidian got simpler without losing its power.**
