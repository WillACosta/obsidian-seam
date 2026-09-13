# Seam — Development Log Registry

This document serves as the master registry and index for Seam's development logs. Each development iteration is documented in detail in its own dedicated log file under [`docs/development_logs/`](development_logs/).

---

## Iterations Index

| Iteration | Date | Specs | Log File |
|:---|:---|:---|:---|
| **[Iteration 03](development_logs/iteration_03.md)** | 2026-09-12 | [`docs/specs/iteraction_03/`](specs/iteraction_03/) | [`iteration_03.md`](development_logs/iteration_03.md) |
| **[Iteration 02](development_logs/iteration_02.md)** | 2026-09-11 | [`docs/specs/iteraction_02/`](specs/iteraction_02/) | [`iteration_02.md`](development_logs/iteration_02.md) |
| **[Iteration 01](development_logs/iteration_01.md)** | 2026-09-02 | [`docs/specs/iteraction_01/`](specs/iteraction_01/) | [`iteration_01.md`](development_logs/iteration_01.md) |
| **[Iteration 00](development_logs/iteration_00.md)** | 2026-08-26 | [`docs/specs/main/`](specs/main/) | [`iteration_00.md`](development_logs/iteration_00.md) |

---

## Iteration Summaries

### [Iteration 03 — 2026-09-12](development_logs/iteration_03.md)
- Tag suggestion mode in Universal Palette (`#` swaps to tag listing).
- Dynamic tag filtering with interactive chips UI (`[ #tag × ]`).
- Note search by active tag chips with multi-tag `AND` combination.
- Fleeting note template configuration.
- Full details: [`docs/development_logs/iteration_03.md`](development_logs/iteration_03.md)

### [Iteration 02 — 2026-09-11](development_logs/iteration_02.md)
- In-note content search with highlighted snippet extraction.
- Create new note from search query when no results found.
- Open note in new tab via `Cmd+Enter` / `Ctrl+Enter`.
- Contextual commands: `archive-current-note` and `move-to-permanent`.
- Tag intellisense preservation via `.tag-registry.md`.
- Expanded moving cleanup behavior (archive + permanent).
- Full details: [`docs/development_logs/iteration_02.md`](development_logs/iteration_02.md)

### [Iteration 01 — 2026-09-02](development_logs/iteration_01.md)
- Tag prefix & live filter matching (`#ele` matches `#electronics`).
- Universal `||` and `|` OR query operators.
- Post-archive tag and frontmatter property cleanup.
- Universal Palette visual styling (icons, folder paths).
- Full details: [`docs/development_logs/iteration_01.md`](development_logs/iteration_01.md)

### [Iteration 00 — 2026-08-26 (v0.1.0 Initial Foundation)](development_logs/iteration_00.md)
- Core automation engine and queue (`AutomationService`, `AutomationQueue`).
- Tag-driven routing (`#archive`, `#permanent`).
- Startup and periodic reconciliation (`Reconciler`).
- Universal Palette foundation (`SuggestModal`).
- Safety rules, non-destructive conflict handling, and mobile first-class.
- Full details: [`docs/development_logs/iteration_00.md`](development_logs/iteration_00.md)
