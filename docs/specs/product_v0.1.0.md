# Obsidian Seam Workflow Plugin — SDD

**Document:** Software Design Document (SDD)
**Version:** 0.1.0
**Status:** Draft
**Target:** Obsidian desktop + mobile
**Design principle:** **Simplicity is the new Luxury.**

> **Related technical document:** `Seam_Tech_v0.1.0.md` is the technical companion to this SDD. The two documents should be read together: this SDD defines the product behavior, UX, logic, and decision rules, while the Tech SDD provides implementation guidance and technical constraints. **When there is any conflict, this product SDD is authoritative.**

---

## 1. Purpose

This document defines the core product behavior, architecture, design decisions, and implementation constraints for a custom Obsidian community plugin designed to make a Markdown vault behave more like Bear while preserving Obsidian's strengths:

- Markdown files owned by the user
- Obsidian's native vault and metadata model
- Tag-driven organization
- Fast, frictionless capture
- Live tag-based search
- Minimal visible UI
- Desktop and mobile support
- Automation that does not require the user to manually maintain the system

The plugin should reduce the amount of organizational thinking required from the user.

The desired experience is:

> **Write first. Add a simple tag. The system takes care of organization.**

The plugin should not introduce another complex knowledge-management framework.

---

# 2. Goals

## 2.1 Primary goals

1. Create a seamless tag-driven organization experience.
2. Treat tags as the primary organizational mechanism.
3. Provide lightweight automation driven by special tags.
4. Automatically archive notes tagged `#archive`.
5. Automatically move notes tagged `#permanent` to a configurable permanent folder.
6. Remove transient automation tags after their action succeeds.
7. Provide a simplified live search syntax such as:

```text
#electronics -#archived
```

8. Present plugin interaction through a single floating modal inspired by Obsidian's Command Palette and Quick Switcher.
9. Make search and commands available from the same interface.
10. Work on both desktop and mobile.
11. Avoid dependence on Electron, Node.js, filesystem APIs, or external schedulers.
12. Keep the plugin small, predictable, and easy to maintain.

---

# 3. Non-Goals

The plugin must explicitly avoid becoming a general-purpose productivity framework.

It will not:

- Replace Obsidian's Markdown format.
- Create a proprietary database.
- Replace Obsidian's native search engine unless necessary.
- Introduce a new metadata language.
- Require Dataview or Bases.
- Require a specific folder hierarchy.
- Automatically reorganize every note based on arbitrary tags.
- Modify unrelated frontmatter.
- Use an external service.
- Use telemetry.
- Require an internet connection.
- Depend on desktop-only Electron APIs.
- Require a background OS daemon or scheduler.
- Attempt to execute while Obsidian itself is completely closed.

---

# 4. Core UX Principle

## Simplicity is the new Luxury

The user should not have to think about:

- Which folder should contain a note?
- Whether the note needs to be moved manually.
- Which command performs a search.
- Which pane contains the tag.
- Which automation needs to be run.
- Whether a temporary workflow tag should remain afterward.

The desired workflow is:

```text
New idea
   ↓
Create Fleeting Note
   ↓
Write
   ↓
Add tags
   ↓
Done
```

The system handles organization afterward.

---

# 5. User Workflow

## 5.1 Fleeting note

The existing QuickAdd workflow remains responsible for creating the note.

Example:

```text
QuickAdd
  ↓
Fleeting Note Template
  ↓
Write content
  ↓
Add #electronics
```

The custom plugin does not need to replace QuickAdd.

The plugin should integrate with the existing workflow rather than forcing a new capture mechanism.

---

## 5.2 Permanent note

The user writes:

```markdown
#permanent
```

The plugin detects the tag and:

1. Determines the configured permanent folder.
2. Ensures the destination folder exists.
3. Moves the note.
4. Removes `#permanent`.
5. Leaves all other tags untouched.
6. Does not otherwise modify the note.

Example:

```text
Before:

Fleeting/My Idea.md
#permanent
#electronics
#kicad

After:

Permanent/My Idea.md
#electronics
#kicad
```

`#permanent` is a **workflow command**, not permanent metadata.

---

## 5.3 Archive

The user writes:

```markdown
#archive
```

The plugin detects the tag and:

1. Determines the configured archive folder.
2. Ensures the destination folder exists.
3. Moves the note.
4. Removes `#archive`.
5. Optionally adds `#archived` as a durable state tag.
6. Leaves all other tags untouched.

Recommended default behavior:

```text
#archive  →  move to Archive/  →  remove #archive  →  add #archived
```

This creates an important semantic distinction:

- `#archive` = action/request
- `#archived` = resulting state

This is preferable to leaving `#archive` permanently because it prevents an action tag from being confused with a state tag.

Example:

```text
Before:

Fleeting/Old Idea.md
#archive
#electronics

After:

Archive/Old Idea.md
#archived
#electronics
```

If the user disables the "add archived state" option, the result should simply omit `#archived`.

---

# 6. Special Tags

The initial special-tag set is intentionally small.

| Tag | Type | Behavior |
|---|---|---|
| `#archive` | Action | Move to archive, remove tag |
| `#permanent` | Action | Move to permanent folder, remove tag |
| `#archived` | State | Durable marker indicating archived status |

These tags must be configurable in settings.

However, the default configuration should remain exactly as above.

The plugin should not ship with a large collection of predefined workflow tags.

---

# 7. Automation Model

## 7.1 Important design decision

The automation must **not depend on an OS scheduler**.

Reason:

- OS schedulers are desktop-specific.
- They cannot reliably access a mobile Obsidian vault.
- They introduce additional permissions and deployment complexity.
- They violate the goal of a self-contained plugin.
- Obsidian already provides vault events and timers.

The plugin should use an **event-driven + reconciliation** architecture.

---

## 7.2 Event-driven processing

The plugin should listen for relevant vault events after Obsidian's workspace is ready.

Relevant events include:

- file creation
- file modification
- file rename
- file deletion, where appropriate

Obsidian recommends registering vault event handlers after `workspace.onLayoutReady()` so plugin initialization does not accidentally process every file during vault startup.

When a Markdown file changes, the plugin should schedule it for processing.

It should not immediately execute multiple operations for every keystroke.

---

# 8. Debounced Automation Queue

Typing can generate many modification events.

Therefore:

```text
File modified
      ↓
Add file to queue
      ↓
Debounce
      ↓
Process once
```

Recommended initial debounce:

```text
500–1000 ms
```

The exact value should be configurable only if implementation experience shows a real need.

The default should not expose unnecessary settings.

The queue must:

- deduplicate paths
- process files sequentially or with controlled concurrency
- avoid processing the same file simultaneously
- tolerate a file disappearing or being renamed
- re-check the current file state before applying an action

---

# 9. Startup Reconciliation

Event-driven processing alone is insufficient.

A note may have been modified while the plugin was disabled, or an event may not have been observed.

Therefore, after the workspace is ready, the plugin should perform a lightweight reconciliation pass.

The pass should:

1. Enumerate Markdown files.
2. Identify files containing special action tags.
3. Queue only matching files.
4. Process them using the same automation pipeline.

This guarantees eventual consistency.

The startup scan should not read every file's complete content if Obsidian's metadata cache already provides the relevant tag information.

---

# 10. Mobile Strategy

## 10.1 Mobile is a first-class target

The plugin manifest must not be desktop-only.

`isDesktopOnly` must be `false`.

The implementation must follow Obsidian's mobile development constraints:

- Do not import Node.js/Electron modules at the top level.
- Do not use `fs`, `path`, or Electron APIs.
- Do not use `process.platform`.
- Do not assume `Vault.adapter` is a desktop filesystem adapter.
- Prefer Obsidian's Vault/FileManager APIs.
- Use `normalizePath()` for user-configured paths.

Obsidian's current plugin guidance explicitly calls out these requirements for mobile-compatible plugins.

---

## 10.2 What "automatic" means on mobile

A plugin cannot guarantee execution while the Obsidian mobile app is completely terminated.

Therefore automation has two layers:

### While Obsidian is running

Use vault events and a timer-based reconciliation loop.

### When Obsidian is opened again

Run startup reconciliation.

Therefore:

```text
User adds #archive
       ↓
Obsidian running?
   ┌───┴───┐
   │       │
  yes      no
   │       │
process   process on
now       next startup
```

This is the correct cross-platform behavior.

The plugin must never claim to provide a true background daemon.

---

# 11. Reconciliation Interval

A periodic reconciliation timer may be used while Obsidian is active.

Recommended default:

```text
15 minutes
```

However, this timer is a safety net, not the primary mechanism.

Primary:

```text
Vault events
```

Secondary:

```text
Startup reconciliation
```

Tertiary:

```text
Periodic reconciliation
```

The interval should be implemented using Obsidian's plugin timer registration so it is automatically cleaned up when the plugin unloads.

---

# 12. File Operations

The plugin must use Obsidian's APIs rather than directly manipulating the filesystem.

For moving files:

```text
FileManager.renameFile()
```

or the appropriate current Obsidian file-management API.

For modifying frontmatter:

```text
FileManager.processFrontMatter()
```

must be preferred over manually parsing and rewriting YAML.

For content modifications where necessary:

```text
Vault.process()
```

should be preferred over a read/modify/write sequence.

For user-defined paths:

```text
normalizePath()
```

must be used.

The plugin must not directly modify `.obsidian` or access the operating system filesystem.

---

# 13. Automation Transaction

Every automated action should behave as an idempotent transaction.

## Permanent

```text
Detect #permanent
      ↓
Check file still exists
      ↓
Check destination
      ↓
Move file
      ↓
Remove #permanent
```

If the process is interrupted:

- the next reconciliation must safely retry;
- it must not duplicate the note;
- it must not remove the tag before the move succeeds.

## Archive

```text
Detect #archive
      ↓
Check file still exists
      ↓
Move file
      ↓
Remove #archive
      ↓
Optionally add #archived
```

The action tag must only be removed after the move succeeds.

---

# 14. Destination Folders

Default configuration:

```text
Permanent folder: Permanent/
Archive folder: Archive/
```

These paths are vault-relative.

The user may change them.

The plugin should automatically create the destination folder if it does not exist.

The plugin must not require these folders to exist beforehand.

---

# 15. Conflict Handling

If a destination already contains a file with the same name, the plugin must never silently overwrite it.

Recommended behavior:

1. Detect conflict.
2. Keep the source note unchanged.
3. Keep the action tag.
4. Record a pending automation state internally.
5. Notify the user through a lightweight Obsidian Notice.
6. Allow the user to resolve the conflict through the plugin modal.

Possible resolution strategies:

```text
Keep source
Rename destination
Rename source
Cancel
```

The first implementation may support only a safe automatic filename suffix such as:

```text
My Note 2.md
```

if the user explicitly enables it.

Default behavior should be **no silent conflict resolution**.

---

# 16. Search

The plugin should provide a simplified search syntax.

Examples:

```text
#electronics
```

```text
#electronics -#archived
```

```text
#todo #electronics
```

```text
#todo -#archived
```

```text
#electronics OR #zmk
```

The first implementation should support:

### Positive tags

```text
#tag
```

### Negative tags

```text
-#tag
```

### Multiple positive tags

```text
#tag1 #tag2
```

meaning AND.

### OR

```text
#tag1 OR #tag2
```

The plugin should translate this simplified syntax into Obsidian's native search syntax whenever practical.

Do not create a second independent search index unless performance requirements justify it.

---

# 17. Live Search

Search must be live.

The user should type:

```text
#electronics -#archived
```

and see results update without pressing Enter.

The modal should display:

```text
8 notes
```

and update as the query changes.

A debounce should be applied to prevent excessive searches while typing.

Recommended initial search debounce:

```text
100–200 ms
```

---

# 18. Universal Floating Modal

All plugin interactions should happen inside one primary floating modal.

The modal is conceptually:

```text
Universal Palette
```

It combines:

- commands
- note search
- tag search
- live search
- actions

The user should be able to invoke it through a single command/hotkey.

The plugin should use Obsidian's modal/suggestion UI primitives rather than implementing a completely independent window system.

---

# 19. Universal Palette Modes

The palette should support implicit modes.

## Default

```text
⌘K

Search notes, #tags or run Seam commands...
```

Typing:

```text
Dormin
```

searches notes.

Typing:

```text
#electronics
```

performs tag search.

Typing:

```text
#todo -#archived
```

performs live filtered search.

Typing a command phrase may surface registered actions.

---

## Explicit prefixes

Optional prefixes may be introduced later:

```text
>
```

commands

```text
#
```

tags

```text
/
```

notes/paths

These should not be required for normal use.

The default experience should remain simple.

---

# 20. Command Actions

The plugin should register commands that can also be surfaced inside the Universal Palette.

Initial commands:

### Archive all notes with `#archive`

This command scans the vault for notes containing `#archive` and processes them through the same automation pipeline.

Important:

It must reuse the normal automation service rather than implementing separate archive logic.

```text
Command
  ↓
Find matching files
  ↓
Queue
  ↓
Automation service
```

This prevents behavior differences between automatic and manual execution.

---

### Process pending automations

Manually triggers reconciliation.

Useful for debugging and recovery.

---

### Open Universal Palette

Opens the floating interface.

---

### Show automation status

Displays a compact result:

```text
Automation

Pending: 2
Processed: 18
Failed: 1
```

---

# 21. Automation Feedback

The system should be quiet by default.

Successful automation should not produce intrusive notifications for every note.

For example, processing 20 archived notes should not generate 20 notices.

Instead:

```text
Archived 20 notes
```

may be shown as a single summary notice when triggered manually.

Automatic background processing should normally remain silent.

Errors should be visible.

---

# 22. Error Handling

Errors must never result in destructive behavior.

Examples:

- destination unavailable
- filename collision
- file deleted during processing
- file renamed during processing
- malformed frontmatter
- permission failure

The plugin should:

1. Leave the original action tag intact when the operation has not completed.
2. Record the error in an internal pending/error collection.
3. Continue processing other notes.
4. Show a non-blocking notice if appropriate.
5. Retry on the next reconciliation.

---

# 23. Settings

The initial settings surface should be intentionally small.

## Folders

```text
Permanent folder
Archive folder
```

## Automation

```text
Enable automatic processing
```

## Archive behavior

```text
Add #archived after archiving
```

## Timing

Potentially:

```text
Reconciliation interval
```

This should only be exposed if the implementation needs user control.

Do not expose debounce values or internal queue settings unless necessary.

---

# 24. Configuration Defaults

```yaml
permanentFolder: Permanent/
archiveFolder: Archive/
archiveTag: archive
permanentTag: permanent
archivedTag: archived
automaticProcessing: true
addArchivedState: true
reconciliationIntervalMinutes: 15
```

The plugin's internal configuration should use structured TypeScript types.

Do not manually manage a separate configuration file.

Use Obsidian's plugin data APIs.

---

# 25. Tag Semantics

The plugin should treat tags as belonging to three conceptual classes:

### Organization tags

Examples:

```text
#electronics
#electronics/kicad
#programming
#programming/ai
```

These remain permanently attached to the note.

### Action tags

Examples:

```text
#archive
#permanent
```

These request an operation and are removed after successful execution.

### State tags

Examples:

```text
#archived
```

These describe the resulting state and remain attached.

This distinction is central to the design.

---

# 26. Tag Hierarchy

The plugin should understand Obsidian's nested tag syntax:

```text
#electronics
#electronics/kicad
#electronics/zmk
```

The plugin should not physically convert these into folders.

Tags remain the conceptual organization layer.

Physical folders are used only when a workflow action explicitly requests a move.

This preserves the Bear-like experience while retaining Obsidian's filesystem model.

---

# 27. Search Semantics

The plugin should define predictable semantics.

Given:

```text
#electronics -#archived
```

the result is:

```text
notes tagged electronics
AND
notes not tagged archived
```

Given:

```text
#electronics #kicad
```

the result is:

```text
notes tagged electronics
AND
notes tagged kicad
```

Given:

```text
#electronics OR #zmk
```

the result is:

```text
notes tagged electronics
OR
notes tagged zmk
```

The parser must reject malformed expressions gracefully rather than silently returning misleading results.

---

# 28. Search Result UX

Each result should display:

```text
Note title
Parent folder
Relevant tags
Optional short context/snippet
```

Example:

```text
Review SK6812 Mini-E

Electronics / ZMK

#electronics
#zmk
#led
```

The user can:

- open the note
- open the containing folder
- copy the path
- invoke note actions
- add/remove tags

These actions may be implemented incrementally.

---

# 29. Performance Strategy

The plugin should prioritize Obsidian's existing metadata cache.

Avoid:

```text
Read every Markdown file on every search keystroke
```

Prefer:

```text
Query
  ↓
Metadata/tag cache
  ↓
Candidate files
  ↓
Search only when content inspection is necessary
```

A custom index may be introduced later if profiling demonstrates that native APIs are insufficient.

Do not prematurely build a database.

---

# 30. Event and Cache Consistency

Relevant events should invalidate or refresh cached search information.

The plugin should account for:

- create
- modify
- rename
- delete

When a file is moved, its new path must become the canonical path immediately.

When a file is renamed externally, the plugin must not retain stale references.

---

# 31. Plugin Architecture

Recommended logical modules:

```text
src/
├── main.ts
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
│   ├── QueryEngine.ts
│   └── SearchResult.ts
│
├── ui/
│   ├── UniversalPalette.ts
│   ├── SearchRenderer.ts
│   └── CommandRenderer.ts
│
├── tags/
│   ├── TagService.ts
│   └── TagUtils.ts
│
├── settings/
│   ├── Settings.ts
│   └── SettingsTab.ts
│
└── utils/
    ├── PathUtils.ts
    └── NoticeUtils.ts
```

The exact filenames are implementation details. The separation of responsibilities is the important architectural requirement.

---

# 32. Automation Service

There must be one authoritative automation service.

Example conceptual API:

```ts
processFile(file: TFile): Promise<AutomationResult>
```

It determines:

```text
Does file contain #permanent?
Does file contain #archive?
```

and executes the appropriate action.

Manual commands, event handlers, startup reconciliation, and periodic reconciliation must all call this service.

No duplicated automation logic.

---

# 33. Priority Rules

If a note contains both:

```text
#archive
#permanent
```

the plugin must have deterministic behavior.

Recommended priority:

```text
#archive > #permanent
```

Reason:

Archive is an explicit terminal workflow action.

The plugin should process archive and then remove both action tags as applicable.

Alternatively, the implementation may treat this as a conflict and leave both tags untouched.

**Recommended for v0.1:** treat it as a conflict and do not automatically move the note.

This is safer than guessing the user's intent.

The Universal Palette should expose a clear conflict message.

---

# 34. Safety Rules

The plugin must follow these rules:

1. Never overwrite an existing file silently.
2. Never delete a note as part of normal automation.
3. Never remove an action tag before the requested action succeeds.
4. Never modify unrelated tags.
5. Never modify unrelated frontmatter.
6. Never create duplicate notes.
7. Never use direct filesystem operations.
8. Never depend on desktop-only APIs.
9. Never require network access.
10. Never collect telemetry.

---

# 35. Mobile-Specific UX

The floating modal must work with touch input.

Do not depend exclusively on:

- hover states
- right-click
- keyboard-only shortcuts
- desktop ribbon controls

The Universal Palette must be accessible through:

- command palette
- mobile command interface
- optional ribbon icon if useful

The primary interaction should remain the same on desktop and mobile.

---

# 36. Accessibility

The modal should:

- use Obsidian's native input and suggestion patterns where possible;
- preserve keyboard navigation;
- support Enter/Escape;
- provide visible focus;
- provide touch-friendly result rows;
- avoid relying on color alone.

---

# 37. Privacy

The plugin operates entirely inside the vault.

It must not:

- send note contents anywhere;
- use analytics;
- use telemetry;
- call external APIs;
- require an account.

This is particularly important because the vault may contain private personal information.

---

# 38. Dependencies

The preferred dependency strategy is:

```text
Obsidian API
+
TypeScript
+
minimal runtime dependencies
```

Do not introduce a UI framework unless the native Obsidian APIs become demonstrably insufficient.

Do not introduce a separate search engine in v0.1.

The fewer dependencies, the better.

---

# 39. Development Requirements

Development must use a separate test vault.

Do not initially develop against the user's production vault.

The test suite should include:

### Automation

- create note with `#archive`
- create note with `#permanent`
- modify existing note to add action tag
- remove action tag before processing
- conflicting action tags
- duplicate filename
- nested destination folder
- missing destination folder
- renamed note
- deleted note
- malformed frontmatter

### Search

- single tag
- multiple tags
- negative tag
- AND
- OR
- malformed query
- zero results
- many results
- tag hierarchy

### Platform

- desktop
- iOS
- Android

### Lifecycle

- plugin enabled
- plugin disabled
- Obsidian startup
- workspace becoming ready
- vault reload
- app suspension/resume where applicable

---

# 40. Acceptance Criteria

The plugin is considered successful when the following workflow works without manual intervention:

```text
1. Create Fleeting Note with QuickAdd.
2. Write a note.
3. Add #electronics.
4. Continue writing.
5. Add #permanent.
6. Stop thinking about organization.
7. Plugin moves note to Permanent/.
8. Plugin removes #permanent.
9. #electronics remains.
```

Archive:

```text
1. Add #archive.
2. Plugin moves note to Archive/.
3. Plugin removes #archive.
4. Plugin adds #archived.
```

Search:

```text
Open Universal Palette
↓
Type:
#electronics -#archived
↓
Results update live.
```

Manual automation:

```text
Open Universal Palette
↓
Archive all notes with #archive
↓
Plugin processes all matching notes.
```

Mobile:

```text
Add #archive on mobile
↓
If Obsidian is active: process automatically.
If app is suspended/closed: process during next startup/reconciliation.
```

---

# 41. Recommended Implementation Phases

## Phase 1 — Core automation

Implement:

- settings
- special tags
- archive action
- permanent action
- safe file movement
- frontmatter/tag modification
- event listener
- startup reconciliation
- queue/debounce

Do not implement the search UI yet.

---

## Phase 2 — Universal Palette

Implement:

- floating modal
- live search input
- result rendering
- command results
- note opening
- tag filtering

---

## Phase 3 — Query parser

Implement:

```text
#tag
-#tag
#tag1 #tag2
#tag1 OR #tag2
```

and translate to native Obsidian search where possible.

---

## Phase 4 — Command integration

Add:

- Archive all
- Process pending
- Open palette
- automation status
- future tag actions

---

## Phase 5 — Mobile hardening

Test:

- iOS
- Android
- touch interaction
- lifecycle behavior
- suspension/resume
- vault synchronization
- conflict handling

---

## Phase 6 — Refinement

Only after real-world usage:

- improve ranking
- add tag suggestions
- add pinned tags
- add recent searches
- add optional aliases
- optimize indexing

Do not add these features before the basic workflow feels effortless.

---

# 42. Future Features

Potential future versions may add:

### v0.2

- pinned tags
- recent searches
- tag browser
- richer command palette
- better search result previews

### v0.3

- tag-based workspaces
- configurable action tags
- bulk tag actions
- "move to tag" command

### v0.4+

Potential custom index if performance requires it.

Potential support for richer query operators.

Potential integration with Bases.

These are explicitly outside the v0.1 core.

---

# 43. Design Decisions Summary

| Decision | Choice |
|---|---|
| Organization model | Tags first |
| Physical folders | Secondary |
| Archive trigger | `#archive` |
| Permanent trigger | `#permanent` |
| Archived state | `#archived` |
| Archive folder | `Archive/` |
| Permanent folder | `Permanent/` |
| Action tag removal | After successful operation |
| Automation | Event-driven + reconciliation |
| OS scheduler | No |
| Background daemon | No |
| Mobile | First-class |
| Search | Native Obsidian-compatible |
| Search UI | Floating Universal Palette |
| Search | Live |
| Query syntax | Simplified tag syntax |
| Database | No |
| Telemetry | No |
| Network | No |
| UI framework | Native Obsidian APIs preferred |
| Dependencies | Minimal |
| Manual automation | Supported |
| Conflict handling | Safe failure, no overwrite |
| Development | Separate test vault |

---

# 44. Core Philosophy

The plugin should follow one rule above all others:

> **The user should not have to manage the system.**

A note is not a database record.

A tag is not a configuration problem.

A folder is not a taxonomy exercise.

The user should be able to:

```text
Capture
  ↓
Write
  ↓
Tag
  ↓
Forget about organization
```

The plugin exists to make the vault quietly maintain itself.

The best implementation is therefore not the one with the most features.

It is the one that makes the user **think about Obsidian less**.

---

# 45. Versioning

This document is **SDD v0.1.0**.

Future revisions must increment the version according to semantic intent:

- `0.1.x` — clarification, typo fixes, non-behavioral changes
- `0.2.x` — additional design details without changing the core architecture
- `0.x.0` — meaningful feature/design changes before stable release
- `1.0.0` — first implementation considered stable

Any change to the following requires an explicit SDD revision:

- tag semantics
- automation behavior
- search semantics
- file movement rules
- mobile strategy
- data persistence model
- conflict handling
- Universal Palette interaction model

---

# 46. Implementation Guidance for the AI Agent

The implementing agent should treat this document as the source of truth for **behavior and architecture**, not as a mandate for exact filenames or code structure.

The agent should:

1. Inspect the current Obsidian TypeScript API documentation before using APIs.
2. Prefer current public Obsidian APIs.
3. Avoid deprecated APIs.
4. Follow current Obsidian mobile-plugin requirements.
5. Keep the implementation modular.
6. Use `async`/`await`.
7. Register events through the plugin lifecycle.
8. Initialize expensive work after `workspace.onLayoutReady()`.
9. Use `Plugin.loadData()` / `saveData()` for plugin settings.
10. Use `FileManager.processFrontMatter()` for frontmatter modifications.
11. Use safe Vault/FileManager operations for file changes.
12. Never directly manipulate the filesystem.
13. Never assume the desktop environment.
14. Add tests for automation before implementing advanced UI.
15. Prefer a small implementation over speculative abstractions.

The agent must not add major features merely because they are technically possible.

If a feature is not necessary for the workflow described in this SDD, defer it.

**Primary success metric:**

> A user can capture a note, add a normal organizational tag or a workflow tag, and never need to think about where the note belongs again.
