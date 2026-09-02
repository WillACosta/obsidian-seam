# Seam — Technical Implementation Context

**Document:** Technical Implementation Companion  
**Version:** 0.1.0  
**Status:** Draft  
**Related specification:** `SDD_v0.1.0.md`

---

## 1. Purpose

This document is a technical companion to `SDD_v0.1.0.md`.

The SDD is the authoritative source for product behavior, user workflow, tag semantics, automation rules, search semantics, UX intent, safety rules, and acceptance criteria.

This document does **not** redefine those rules.

Its purpose is to give the implementation agent the technical context needed to implement the SDD correctly inside the current Obsidian plugin architecture.

When this document and the SDD appear to conflict, **the SDD wins**.

The implementation agent should use this document as a guardrail against common Obsidian plugin mistakes, especially around lifecycle, mobile compatibility, file operations, UI construction, performance, and maintainability.

---

## 2. Project Context

Working plugin name:

> **Seam**

The plugin is intended to feel like an invisible layer over Obsidian rather than a separate application.

The implementation should preserve Obsidian's core strengths:

- Markdown files
- native vault
- native metadata
- native search capabilities where practical
- native plugin lifecycle
- native mobile compatibility

The plugin should add behavior rather than establish a parallel application architecture.

A useful implementation mindset is:

```text
Obsidian
   +
small behavioral layer
   =
Seam
```

Avoid:

```text
Obsidian
   +
second database
   +
second search engine
   +
second metadata model
   +
second filesystem abstraction
```

---

# 3. Technical Principles

## 3.1 Prefer native Obsidian APIs

Use public Obsidian APIs wherever possible.

Do not bypass the application abstraction simply because direct filesystem or DOM access appears easier.

In particular:

- prefer `Vault` APIs over `Adapter` APIs;
- use `FileManager` for file-management operations;
- use `FileManager.processFrontMatter()` for frontmatter changes;
- use `Vault.process()` when changing file content;
- use `Plugin.loadData()` / `Plugin.saveData()` for plugin settings;
- use `normalizePath()` for user-provided paths.

These choices align with the current Obsidian developer guidance.

---

## 3.2 Mobile compatibility is architectural

The plugin must be designed as mobile-compatible from the beginning.

`manifest.json` should use:

```json
"isDesktopOnly": false
```

The implementation must not depend on:

- Electron APIs
- Node.js filesystem modules
- desktop-only globals
- OS-level schedulers
- background daemons
- platform-specific filesystem paths

Do not write the desktop version first and "make it mobile later."

The same core services should run on desktop and mobile.

Only presentation and platform-specific capability detection should vary.

---

# 4. Plugin Lifecycle

The plugin should have a very small `onload()`.

`onload()` should primarily:

- load persisted settings;
- instantiate lightweight services;
- register commands;
- register settings;
- register the Universal Palette command;
- register cleanup through Obsidian lifecycle helpers.

Expensive work should not happen immediately during `onload()`.

Current Obsidian guidance recommends deferring startup work until `workspace.onLayoutReady()`.

## 4.1 Layout-ready initialization

Conceptually:

```text
onload()
   ↓
load settings
   ↓
register commands
register settings
register lightweight services
   ↓
workspace.onLayoutReady()
   ↓
register vault event handlers
initialize reconciliation
initialize automation queue
```

This prevents the plugin from treating Obsidian's own startup population of the vault as new user activity.

---

# 5. Event Handling

Use Obsidian vault events as the primary automation trigger.

Relevant events are primarily:

```text
create
modify
rename
delete
```

The plugin does not need to react to every event type equally.

At minimum, modifications and renames need to be handled safely.

## 5.1 Do not process on every keystroke directly

A Markdown editor can generate frequent `modify` events.

Do not execute archive/permanent logic immediately for every event.

Use a debounced queue:

```text
modify event
     ↓
queue file
     ↓
deduplicate
     ↓
debounce
     ↓
process latest state
```

The queue should process the current state of the file, not an old event snapshot.

---

# 6. Automation Queue

Create one centralized queue abstraction.

Conceptually:

```ts
AutomationQueue
    enqueue(file)
    enqueuePath(path)
    flush()
    isPending(path)
```

Responsibilities:

- deduplicate paths;
- debounce repeated events;
- serialize conflicting operations on the same file;
- tolerate files disappearing;
- ensure a file is processed against its latest state;
- expose pending/error status to the UI.

The queue should not contain action-specific behavior.

That belongs in `AutomationService` and individual actions.

---

# 7. Automation Service

Create a single authoritative service responsible for deciding what should happen to a file.

Conceptually:

```text
AutomationService
    inspect(file)
    process(file)
```

The service should:

1. obtain the current file state;
2. detect relevant action tags;
3. determine whether an action is required;
4. delegate to the appropriate action implementation;
5. return a structured result.

Manual commands and automatic events must call the same service.

Prefer:

```text
events ──────┐
startup ─────┼──> AutomationService
manual ──────┘
```

rather than duplicating automation logic across several entry points.

---

# 8. Action Abstraction

Archive and Permanent should be implemented as independent action modules rather than embedded in one large conditional function.

Conceptually:

```ts
interface AutomationAction {
    canApply(file): Promise<boolean>
    apply(file): Promise<AutomationResult>
}
```

The exact interface may differ during implementation.

The architectural goal is:

```text
AutomationService
      │
      ├── ArchiveAction
      └── PermanentAction
```

This leaves a clean extension point for future actions without requiring speculative framework code.

---

# 9. File Movement

Use Obsidian's file-management APIs.

Do not manipulate the filesystem directly.

Before moving a file:

1. normalize the destination path;
2. ensure the destination folder exists;
3. verify whether a collision exists;
4. perform the move;
5. only after success, mutate the action tag/state.

The mutation order matters.

Bad:

```text
remove #archive
    ↓
move file
    ↓
move fails
```

Good:

```text
move file
    ↓
move succeeds
    ↓
remove #archive
```

This preserves recoverability.

---

# 10. Frontmatter and Tag Mutation

When tags are stored in YAML/frontmatter, use:

```text
FileManager.processFrontMatter()
```

rather than manually reading and reconstructing YAML.

Do not rewrite the entire Markdown file simply to remove one frontmatter tag.

Where tags are present inline in note content rather than frontmatter, use the least destructive text-processing strategy possible.

The implementation must preserve:

- unrelated content;
- formatting where practical;
- frontmatter;
- unrelated metadata;
- unrelated tags.

Only the required workflow mutation should occur.

---

# 11. Tag Detection

Prefer Obsidian's metadata cache for tag detection rather than repeatedly parsing every Markdown file from disk.

Use cached metadata for:

- detecting action tags;
- finding bulk-automation candidates;
- identifying candidates for tag search where sufficient.

Reserve content reads for cases where the cache cannot answer the question.

---

# 12. Reconciliation Strategy

Provide a reusable reconciler.

Conceptually:

```ts
Reconciler
    scan()
    enqueuePending()
```

Startup sequence:

```text
layout ready
    ↓
inspect relevant metadata
    ↓
find files with action tags
    ↓
enqueue
    ↓
AutomationService
```

The reconciler should only discover pending work.

It should not duplicate action logic.

## 12.1 Periodic reconciliation

A low-frequency timer may be used as a safety net while Obsidian is running.

It must not be the primary mechanism.

Priority:

```text
1. vault events
2. startup reconciliation
3. periodic reconciliation
```

Use Obsidian lifecycle-aware timer registration so the timer is cleaned up automatically when the plugin unloads.

---

# 13. Mobile Lifecycle

The plugin can only execute while its Obsidian runtime is active.

It cannot guarantee processing while the application is fully terminated.

Therefore:

```text
User adds action tag
        ↓
Obsidian active?
   ┌────┴────┐
   yes       no
   ↓          ↓
process     reconcile
now         next launch
```

Do not attempt to emulate a background daemon with platform-specific APIs.

---

# 14. Search Engine Strategy

The Universal Palette should not immediately introduce a proprietary search engine.

The first implementation should translate the simplified query language into Obsidian-native search semantics where practical.

Conceptually:

```text
User query
   ↓
Simplified QueryParser
   ↓
Normalized Query
   ↓
Obsidian-compatible search
   ↓
Results
```

The parser should be independent of the UI.

---

# 15. Query Parser

Keep the parser small.

Initial syntax:

```text
#tag
-#tag
#tag1 #tag2
#tag1 OR #tag2
```

The parser should produce a small structured representation rather than scattering string concatenation across UI code.

A minimal AST is sufficient.

Do not introduce a full grammar framework for a deliberately small query language.

---

# 16. Live Search and Debouncing

The intended flow:

```text
keystroke
   ↓
debounce
   ↓
execute query
   ↓
update modal
```

Use a short debounce for live search.

Do not start an asynchronous search for every keystroke without control.

The implementation must also prevent stale results from overwriting newer results.

A simple monotonically increasing request ID/version counter is enough.

---

# 17. Search Result Model

Use a small internal result model.

Example:

```ts
interface SearchResult {
    file: TFile;
    title: string;
    path: string;
    tags: string[];
    snippet?: string;
}
```

Only compute information needed by the current UI.

Do not retain full note contents in search results.

---

# 18. Universal Palette

The Universal Palette is the primary plugin UI.

Build on Obsidian's modal/suggestion primitives, particularly the patterns provided by `SuggestModal`, instead of creating a separate windowing system.

The palette should remain a normal Obsidian modal.

This improves:

- desktop compatibility;
- mobile compatibility;
- keyboard navigation;
- accessibility;
- theme integration.

---

# 19. Palette Architecture

Keep UI logic separate from search and command execution.

Conceptually:

```text
UniversalPalette
       │
       ├── CommandProvider
       ├── NoteSearchProvider
       ├── TagSearchProvider
       └── ActionProvider
```

The palette decides what input means and what results to display.

Providers/services decide what results exist and what action should execute.

Avoid turning the modal into the application's central business-logic class.

---

# 20. Modal Interaction

The initial implementation should prioritize:

- typing;
- keyboard navigation;
- Enter;
- Escape;
- touch-friendly selection.

Do not depend on hover states.

Core functionality must work on mobile without a hardware keyboard.

---

# 21. Pop-out / Cross-window Safety

Obsidian desktop supports pop-out windows.

The plugin should avoid global DOM assumptions when manipulating elements that may belong to another Obsidian window.

Current Obsidian guidance provides window/document accessors and cross-window-safe helpers for such scenarios.

The first release does not need special pop-out features, but its UI implementation should not accidentally break when rendered in a different Obsidian window.

Prefer Obsidian's UI abstractions wherever possible.

---

# 22. Settings

Use a typed settings object and Obsidian's plugin-data persistence.

Conceptually:

```ts
interface SeamSettings {
    permanentFolder: string;
    archiveFolder: string;
    archiveTag: string;
    permanentTag: string;
    archivedTag: string;
    automaticProcessing: boolean;
    addArchivedState: boolean;
    reconciliationIntervalMinutes: number;
}
```

Persist using:

```text
Plugin.loadData()
Plugin.saveData()
```

Do not create a custom JSON file in the vault.

Keep the visible settings surface intentionally small.

---

# 23. Manifest

The manifest must comply with current Obsidian requirements.

At minimum it needs the normal plugin metadata plus:

```json
"isDesktopOnly": false
```

The plugin ID must follow Obsidian's current naming constraints: lowercase letters/hyphens, no `obsidian`, and not ending in `plugin`.

The exact `minAppVersion` should be selected from the APIs actually used by the implementation rather than guessed in advance.

---

# 24. Dependency Policy

Prefer:

```text
Obsidian API
TypeScript
minimal utility dependencies
```

Do not introduce a frontend framework, state-management library, second database, second search engine, or parser framework unless implementation evidence shows the native platform is insufficient.

A small plugin should stay small.

---

# 25. State Management

Persistent state should remain minimal.

Persist configuration only, plus small recovery metadata if a concrete implementation need is discovered.

Do not persist:

- a complete vault index;
- note contents;
- duplicated metadata;
- cached search results;
- a second copy of the tag graph.

Transient runtime state should remain in memory.

---

# 26. Error and Recovery Model

Operations should favor safe retryability.

Example:

```text
#archive detected
     ↓
move fails
     ↓
#archive remains
     ↓
error recorded
     ↓
future reconciliation retries
```

Prefer this over removing the action tag before the operation has succeeded.

The plugin should keep processing other notes when one note fails.

---

# 27. Notifications and Logging

Use Obsidian notices for meaningful user-facing events.

Avoid notification spam.

Good:

```text
Archived 8 notes.
```

Bad:

```text
Archived Note 1.
Archived Note 2.
Archived Note 3.
...
```

Automatic successful processing should normally be silent.

Errors and unresolved conflicts should be visible.

Do not leave development `console.log()` statements in production code. Debug logging, when necessary, should be explicitly gated.

---

# 28. Performance

The plugin should feel invisible.

Avoid:

- expensive synchronous work;
- repeated complete-vault reads;
- full-file reads for every search keystroke;
- rebuilding all indexes after every modification;
- expensive work inside `onload()`.

Start with native metadata/cache capabilities and profile before introducing additional indexes.

Use `getMarkdownFiles()` or equivalent native collection APIs for vault-wide enumeration rather than repeatedly searching for files by manually traversing filesystem paths.

---

# 29. Testing Strategy

Use a dedicated development vault.

Obsidian's official plugin documentation explicitly recommends not developing directly against the main vault.

Use three levels of validation:

### Unit tests

- query parsing;
- tag matching;
- path normalization;
- action selection;
- conflict detection.

### Integration tests

- create/modify/rename;
- file movement;
- frontmatter mutation;
- reconciliation;
- manual command execution.

### Manual platform tests

- desktop;
- iOS;
- Android.

Correctness is more important than exhaustive coverage in the initial release.

---

# 30. Test Fixtures

Maintain repeatable fixtures such as:

```text
Fleeting/
    Electronics Idea.md
    Archived Idea.md
    Permanent Idea.md

Permanent/
Archive/

Projects/
    Dormin.md
```

Include both frontmatter and inline-tag examples.

Example:

```markdown
---
tags:
  - electronics
---

# Electronics Idea
```

and:

```markdown
#electronics
#archive
```

and:

```markdown
#electronics
#permanent
```

---

# 31. Development Workflow

Recommended loop:

```text
Implement small change
    ↓
Build
    ↓
Reload plugin
    ↓
Run focused test
    ↓
Check desktop
    ↓
Check mobile
    ↓
Commit
```

Recommended implementation order:

```text
foundation
   ↓
automation
   ↓
reconciliation
   ↓
query parser
   ↓
palette
   ↓
polish
```

Do not build the full UI before the automation engine is reliable.

---

# 32. Suggested Repository Structure

The exact structure is implementation-dependent, but a separation similar to this is recommended:

```text
src/
├── main.ts
├── types.ts
│
├── automation/
│   ├── AutomationService.ts
│   ├── AutomationQueue.ts
│   ├── Reconciler.ts
│   └── actions/
│       ├── ArchiveAction.ts
│       └── PermanentAction.ts
│
├── search/
│   ├── QueryParser.ts
│   ├── SearchService.ts
│   └── types.ts
│
├── ui/
│   ├── UniversalPalette.ts
│   ├── providers/
│   └── components/
│
├── settings/
│   └── SettingsTab.ts
│
└── utils/
```

Avoid fragmenting trivial logic into unnecessary files.

The objective is separation of responsibility.

---

# 33. API Boundaries

Maintain these conceptual boundaries:

```text
UI
  ↓
Application services
  ↓
Obsidian APIs
```

Examples:

```text
UniversalPalette
       ↓
SearchService
       ↓
Obsidian metadata/search

UniversalPalette
       ↓
AutomationService
       ↓
FileManager / Vault

Vault Events
       ↓
AutomationQueue
       ↓
AutomationService
```

The UI should not move files directly.

The queue should not parse search queries.

The parser should not manipulate the vault.

---

# 34. Avoid Premature Abstraction

Do not build generic infrastructure for hypothetical requirements.

Avoid speculative systems such as:

```text
GenericRuleEngine
GenericWorkflowEngine
GenericEventBus
GenericTaskScheduler
UniversalDataStore
```

The initial project has only a few concrete operations.

Simple code is preferable until duplication becomes real.

---

# 35. Future-Proofing Without Overbuilding

Leave clean extension points for:

- additional action tags;
- additional search operators;
- pinned tags;
- tag workspaces;
- richer palette providers.

Do this through clean module boundaries, not speculative frameworks.

---

# 36. What the Agent Should Not Do

Unless explicitly requested in a later SDD revision, do not:

- rewrite the user's vault structure;
- migrate existing notes;
- rename existing organizational tags;
- convert folders into tags;
- add dashboards;
- introduce AI features;
- add semantic search;
- add cloud services;
- add telemetry;
- add sync services;
- replace QuickAdd;
- replace Templater;
- replace Bases;
- replace Dataview;
- generate a second database.

The initial implementation is a focused workflow layer.

---

# 37. Current Obsidian Documentation

The implementation agent should consult the current official Obsidian developer documentation and installed TypeScript definitions before relying on remembered API signatures.

Particularly relevant areas are:

- plugin manifest;
- plugin lifecycle;
- workspace readiness;
- Vault API;
- FileManager API;
- metadata cache;
- modal/suggestion APIs;
- plugin data persistence;
- mobile compatibility;
- release/version requirements.

The coding agent should prefer APIs exposed by the actual target `obsidian` type package used by the project.

---

# 38. Technical Acceptance Gate

Before declaring the implementation complete, verify:

```text
[ ] Desktop works
[ ] Mobile works
[ ] isDesktopOnly = false
[ ] No Electron dependency
[ ] No Node filesystem dependency
[ ] No direct filesystem manipulation
[ ] Uses Vault/FileManager APIs
[ ] Uses processFrontMatter for frontmatter changes
[ ] Uses loadData/saveData for settings
[ ] Uses normalized user paths
[ ] Event handlers initialize after layout readiness
[ ] Automation is debounced
[ ] Automation is retryable/idempotent
[ ] Startup reconciliation exists
[ ] Manual automation uses the same service
[ ] Search is live
[ ] Search does not use a second database
[ ] Universal Palette is the primary UI
[ ] Errors are recoverable
[ ] No destructive conflict behavior
[ ] No production debug logging
[ ] No telemetry/network dependency
```

---

# 39. Final Implementation Guidance

The implementation agent should keep one distinction clear:

**The SDD defines what Seam does.**

**This document defines how to approach building it safely inside Obsidian.**

Do not use technical complexity to solve a problem that the SDD intentionally keeps simple.

The desired codebase should feel like the desired product:

```text
small
predictable
native
quiet
recoverable
mobile-friendly
```

The implementation is successful when the plugin feels almost invisible to the user.

---

## Official references used for this companion document

- Obsidian Developer Documentation — Plugin guidance and current API documentation
- Obsidian Developer Documentation — Plugin manifest
- Obsidian Developer Documentation — Vault API
- Obsidian Developer Documentation — Plugin load-time and lifecycle guidance
- Obsidian Developer Documentation — Pop-out window compatibility
- Obsidian Developer Documentation — Plugin release/version guidance
