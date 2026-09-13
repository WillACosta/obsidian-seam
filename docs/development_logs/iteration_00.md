# Development Log — Iteration 00 (v0.1.0 Initial Foundation)

- **Iteration ID:** `iteraction_00`
- **Date:** `2026-08-26`
- **Specs Directory:** [`docs/specs/main`](../specs/main/)
  - `product_v0.1.0.md`
  - `tech_v0.1.0.md`

## Summary of Changes

### Added
- **Core Automation Engine**: Implemented `AutomationService` and `AutomationQueue` with 750ms debounce and serialization to prevent concurrent mutations.
- **Tag-Driven Routing**:
  - `#permanent` moves notes to `Permanent/` and strips the action tag.
  - `#archive` moves notes to `Archive/`, strips `#archive`, and adds `#archived` state tag.
- **Safety & Conflict Handling**:
  - Dual action tag conflicts (`#archive` + `#permanent`) are preserved untouched and flagged.
  - Destination filename collisions prevent overwrites and register non-destructive error states.
  - Action tags are only stripped after file move transactions succeed.
- **Startup & Periodic Reconciliation**: Implemented `Reconciler` to scan the vault using `MetadataCache` on workspace readiness and at a 15-minute periodic interval.
- **Universal Palette**: Floating `SuggestModal` providing unified note search, tag search, and command execution.
- **Query Parser**: Custom parser supporting positive tags (`#tag`), negative tags (`-#tag`), AND combinations, and plain text search.
- **Settings Tab**: `SeamSettingsTab` for configuring folders, automation toggle, durable state tags, and reconciliation frequency.
- **Commands**: Registered `Open Universal Palette`, `Archive all notes with #archive`, `Process pending automations`, and `Show automation status`.
- **Mobile First-Class**: Designed with zero Node.js/Electron dependencies (`isDesktopOnly: false`).
- **Test Suite**: Automated unit tests using Node.js test runner covering query parsing, tag logic, and regex stripping.
