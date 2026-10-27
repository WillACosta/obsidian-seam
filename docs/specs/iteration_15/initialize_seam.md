# Initialize Seam — Implementation Specification

**Target:** Obsidian Seam plugin (`WillACosta/obsidian-seam`), not the standalone Seam app.

## Goal

Provide a user-initiated **Initialize Seam** action that configures a vault for Seam's recommended tag-driven workflow. Reuse the existing settings, Universal Palette, custom searches, and Bases support. This is an optional initializer, not a migration or first-run requirement.

## Entry point and UX

- Add a compact **Initialize Seam** section in **Seam Settings**, with a short description and **Preview setup** / **Initialize Seam** action. Also register an Obsidian/Seam command to open the same setup flow.
- Never run automatically, including during plugin installation or upgrade.
- Before applying, show a confirmation modal with grouped changes: **Folders and files**, **Obsidian settings**, **Seam searches**. Distinguish _create_, _update_, _already configured_, _skip/conflict_, and _unsupported_.
- Tell users: **Existing notes will not be moved, deleted, or edited. This changes vault folders and selected Obsidian/Seam preferences. There is no one-click undo.** Make any overwrite of existing settings explicit.
- Provide **Cancel** and **Apply setup** actions. On completion, display a concise report listing applied, skipped, failed, and restart/reload-required items.
- A second run should preview only missing or drifted settings. Do not reset user-customized templates, queries, or Base files.
- If every item is already configured, show **Already configured**, a short message confirming that the vault matches the recommendations, and one **OK** button. Keep configured resources available in collapsed groups, and omit apply/overwrite warnings.
- After applying setup, verify the current plan again before showing the configured state. Keep the result details and restart requirement visible. Determine completion from the vault's current configuration rather than a saved one-time flag, so missing or drifted settings can still be reviewed and applied later.
- If no changes are applicable but conflicts or unsupported items remain, provide **OK** and explain that those items need review; do not label the vault fully configured.

## 1. Default vault structure

Create missing directories only:

```text
Fleeting/
Permanent/
Resources/
  Archive/
  Attachments/
  Daily/
  Sources/
  Templates/
    Fleeting Note Template.md
    Daily Note Template.md
    Book Template.md
  Bases/
    Bookshelf.base
```

**Note:** Configure Seam's archive destination as `Resources/Archive`. Preserve any existing root-level `Archive/` folder and its notes without moving them. `Attachments` corrects the original typo; all configured paths must match exactly.

Do not move or modify any existing notes. If a target template or `.base` file already exists, preserve its content and mark it as existing; do not overwrite it during subsequent runs.

### Default templates

Create minimal, useful Markdown templates:

- **Fleeting Note:** a basic capture note, with a created date (Obsidian template placeholder) and no forced permanent/archive action tag.
- **Daily Note:** date heading, short notes and tasks sections; use Obsidian Templates-compatible placeholders.
- **Book:** frontmatter properties compatible with Bookshelf: `tags: [books]`, `authors: []`, `status: unread`, `priority: medium`, `cover: ""`, `start_date`, `end_date`, `current_page: 0`, `total_pages: 0`, `rating`, `summary`. Keep blank values blank where their numeric/date type would otherwise be misleading.

Avoid creating sample user notes. Files in the templates directory are the only note content created by the setup.

## 2. Recommended Obsidian configuration

Apply only these specified keys, preserving all other keys/settings. Resolve the vault's actual config directory using Obsidian's APIs where possible; never hardcode `.obsidian`.

### `app.json`

```json
{
  "newFileLocation": "folder",
  "newFileFolderPath": "Fleeting",
  "attachmentFolderPath": "Resources/Attachments",
  "mobileQuickRibbonItem": "",
  "mobilePullAction": "seam:open-palette"
}
```

These are requested defaults, **not permission to blindly write potentially unsupported settings**. Confirm each key is supported by the target Obsidian version. Validate the `mobilePullAction` command ID and behavior. Skip and report unsupported/unavailable values rather than writing unverified config.

### Daily Notes configuration

`daily-notes.json` (under the Obsidian core-plugin config directory, as resolved at runtime):

```json
{
  "folder": "Resources/Daily",
  "template": "Resources/Templates/Daily Note Template.md"
}
```

### Templates configuration

`templates.json` (under the Obsidian core-plugin config directory):

```json
{
  "folder": "Resources/Templates"
}
```

### `hotkeys.json`

Recommend `Mod+K` for `seam:open-palette`:

```json
{
  "seam:open-palette": [{ "modifiers": ["Mod"], "key": "K" }]
}
```

Preserve all other commands. Detect if `Mod+K` is already assigned to another command; surface the conflict in the preview and do not silently remove or override the other binding. Validate Obsidian's shortcut serialization and command ID.

### Core plugins

Enable **Daily notes**, **Templates**, and **Bases** if available, without disabling anything else. Inspect the actual `core-plugins.json` format; it may be an array of enabled plugin IDs rather than the object from the original proposal. Prefer supported runtime APIs for enabling plugins where available, and handle reload requirements.

### `types.json`

Merge only the following `types` entries:

```json
{
  "types": {
    "start_date": "date",
    "end_date": "date",
    "current_page": "number",
    "total_pages": "number",
    "authors": "multitext",
    "rating": "number",
    "priority": "text",
    "cover": "text",
    "summary": "text",
    "status": "text"
  }
}
```

Preserve unrelated registered property types. If an existing type differs, show the change in the preview before replacing it; avoid silent type changes that could affect other notes.

## 3. Bookshelf Base

Create `Resources/Bases/Bookshelf.base`, using valid native Obsidian Bases YAML and the existing Seam Bases integration.

### Global filters

- Markdown notes only, tagged `#books`.
- Exclude files from `Resources/Templates/` by folder path, rather than filtering filenames containing `Template`.

### Fields and formulas

- `cover`: use the native card `image: note.cover` property, not a generated Markdown embed as the image source.
- `reading_time`: approximate reading hours from `total_pages / 40`, rounded, only when `total_pages > 0`.
- `rating`: display `★ N/10` only when a rating exists; zero must remain a valid rating.
- `priority_ui`: map `highest`, `high`, `medium`, `low`, `lowest` to ascending/descending chevron or minus icons.
- `priority_value`: map priority to `5, 4, 3, 2, 1`, with default `0`.
- `progress_value`: percentage from `current_page / total_pages`, clamped to `0–100`, when `total_pages > 0`; otherwise `0`.
- `progress`: a 5-segment text progress bar using filled/empty symbols plus rounded percentage, without negative or overflowing segments.

Use only functions and syntax supported by the project's minimum Obsidian/Bases version. Validate formulas in a real Base view, particularly string repetition and icon support.

### Native cards views

All four views use cards, `image: note.cover`, `imageFit: contain`, `imageAspectRatio: 1.5`, `cardSize: 150`, ordered by `priority_value` descending unless otherwise noted.

| View          | Additional filter                                              | Visible fields                                      | Sort                   |
| ------------- | -------------------------------------------------------------- | --------------------------------------------------- | ---------------------- |
| **Bookshelf** | All `#books` notes                                             | Filename, rating, reading time, authors, priority   | Priority ↓             |
| **Reading**   | `#reading`, `current_page > 0`, `current_page < total_pages`   | Filename, authors, priority, progress, reading time | Priority ↓, progress ↓ |
| **Stopped**   | `#stopped`, `current_page > 0`, `current_page < total_pages`   | Same as Reading                                     | Priority ↓, progress ↓ |
| **Unread**    | `status` is `unread` or empty; `current_page` is absent or `0` | Filename, authors, priority, reading time           | Priority ↓             |

The `Unread` view **must not** require `current_page > 0`. All views inherit the global `#books` and template-directory filters. `Reading` and `Stopped` remain tag-based as in the proposal. Use `authors` consistently in the Base and template (not `author`).

## 4. Seam Universal Palette integration

Register custom searches via **Seam's existing custom-search settings and Bases provider**:

| Alias        | Base file                        | View        |
| ------------ | -------------------------------- | ----------- |
| `@bookshelf` | `Resources/Bases/Bookshelf.base` | `Bookshelf` |
| `@reading`   | `Resources/Bases/Bookshelf.base` | `Reading`   |

- Use existing custom-search data models and presentation. Avoid special-casing the aliases in the search engine.
- Do not duplicate searches on re-run. Preserve existing user-defined searches that already use either alias; identify the collision in the preview and skip without replacing.
- Searches should render the corresponding native Base view in the Universal Palette, using its current navigation/selection behavior.
- If Bases is unavailable or cannot be enabled, report that limitation and skip the dependent search registrations without failing unrelated setup tasks.

## 5. Safe application and compatibility

- **Plan first, apply second:** generate an explicit change plan before writing. Use the same plan for preview and execution.
- Create absent folders/files via Obsidian's vault APIs. Avoid rewriting user-authored files.
- Merge JSON structurally; do not replace whole config files or drop unknown keys. Preserve existing arrays/object shapes and all unrelated settings.
- Prefer public Obsidian APIs for runtime changes. Obsidian preferences/core-plugin configuration are not all exposed through stable public APIs: isolate any internal or config-file access, check platform/version compatibility, and do not assume a filesystem Node API on mobile.
- Handle missing config files, corrupted JSON, read-only vaults, synchronization conflicts, and partial failures with clear errors; do not overwrite invalid files with empty JSON.
- Before config writes, create recoverable snapshots where feasible. Do not promise an automatic rollback. If a setting cannot be safely applied while Obsidian is running, report that a restart is needed instead of pretending it was applied live.
- No note scanning, existing-note moves, deletion, or frontmatter migration is in scope.
- Keep new UI text translatable using Seam's existing English and Portuguese locale structure.

## Acceptance criteria

1. Preview accurately distinguishes planned changes, existing resources, conflicts, and unsupported options.
2. Cancel writes nothing; confirm applies only previewed, supported operations.
3. Fresh vault receives the specified folders, three templates, one usable four-view `.base`, recommended settings, and two Palette aliases.
4. Existing vault retains all unrelated files, notes, plugin settings, hotkeys, custom searches, and registered property types.
5. Re-running setup creates no duplicates and never overwrites customized templates or `Bookshelf.base`.
6. `@bookshelf` and `@reading` display the correct Base views; a newly created book template is excluded from results.
7. Empty page counts, unread books, missing covers, and missing property values do not break the views.
8. Desktop and mobile behavior is tested where configuration APIs differ; failures are accurately reported, not silently ignored.

## Out of scope

Automatic onboarding, moving/renaming existing notes, applying changes to other vaults, importing a sample library, undo UI.
