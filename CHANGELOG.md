# Changelog

What's new and changed in each Seam release.

## [3.2.0] - 2026-10-01
<!-- iterations: iteration_10 -->

### Added

- **Source notes**: Automatically create notes linked to documents and images in your source folder.
- **Source settings**: Choose a folder and note template. Existing documents are included when you change folders or enable automation.
- **Create note from attachment**: Create a source note manually from the Universal Palette.
- **Source search**: Find your source notes with `@sources`, wherever you keep them.
- **Continuous PDF pages**: Read embedded PDFs without gaps between pages.

### Changed

- **Palette commands**: Create note from attachment appears immediately after Create a new note.

## [3.1.0] - 2026-10-01
<!-- iterations: iteration_09 -->

### Added

- **Search match navigation**: Open notes at the first matching passage, with match counts in results.
- **File search**: Find attachments and other vault files by name, path, or extension.
- **Folder filters**: Use `dir:` to narrow searches to a folder.
- **Combined searches**: Combine saved Seam searches with tags and folder filters.
- **Split navigation**: Open a result in a vertical split with `Shift + Enter`.
- **Quick note creation**: Create a note instantly using your Fleeting template.

### Changed

- **Search guidance**: Clearer prompts, shortcuts, and removable filter chips.
- **Commands**: Shown when the search is empty or when you type `>`.
- **Mobile Bases**: Browse tables and cards within the Palette's available space.

## [3.0.0] - 2026-09-23
<!-- iterations: iteration_08 -->

### Added

- **Custom Search**: Save searches for your favorite collections and pin them in the Universal Palette.
- **Obsidian Bases**: Browse your Base tables and cards directly in the Palette.
- **Search customization**: Pin, hide, and reorder special searches.
- **Task progress**: See completion percentages in `@todo` results.
- **Recent and daily searches**: Find recent files, notes from a chosen date range, and today's or yesterday's Daily Note.
- **Palette access**: Choose where the ribbon button appears and assign a shortcut for creating notes.
- **Command visibility**: Choose whether commands appear by default or only after typing `>`.

### Changed

- Requires Obsidian **1.13.0** or newer.
- Seam settings are available through Obsidian's Settings search.
- Recent files are now available through `@recent`.
- Active special searches can be removed with one `Backspace` press.
- The `@ocr` search is no longer available.

## [2.0.1] - 2026-09-23

### Changed

- Release screenshots now display in Seam's update window.

## [2.0.0] - 2026-09-23
<!-- iterations: iteration_06..iteration_07 -->

!["Seam v2 Showcase"](./docs/images/v2.0.0/seam_v2_showcase.gif)

### Added

- **Quick Add**: Create capture shortcuts with your preferred templates and folders.

!["Quick Add V2"](./docs/images/v2.0.0/quick_add_choices.png)

- **Special searches**: Find documents, images, tasks, code, and untagged notes. Search exact phrases with double quotes.

!["Special Search"](./docs/images/v2.0.0/special_search.png)

- **Exclude tags**: Use `!#tag` to leave matching notes out of your search.

!["Filtering Tags"](./docs/images/v2.0.0/filtering_tags.png)

- **Recent Files**: Browse your ten most recently modified notes.

!["Commands Listing"](./docs/images/v2.0.0/commands_listing.png)

- **Release updates**: Choose when to receive update notices and read release notes in settings.

### Changed

- **Universal Palette**: Clearer search hints and command navigation.
- **Quick Add settings**: Filter, reorder, duplicate, and customize your capture choices.

## [1.0.4] - 2026-09-15

### Changed

- Clearer English and Brazilian Portuguese guides for getting started and using Seam.

## [1.0.3] - 2026-09-14

### Added

- **Automation timing**: Organize notes when switching notes or after a short delay.
- **Shortcut settings**: See your Palette shortcut and customize it through Obsidian's Hotkeys settings.
- **Visual walkthrough**: Preview Seam's organization and search features in the documentation.
- **Project support**: New sponsorship options.

### Changed

- Seam is now licensed under the GNU General Public License v3.0.

## [1.0.2] - 2026-09-13

### Changed

- Choose your Palette shortcut in Obsidian's Hotkeys settings; no shortcut is assigned by default.
- Improved native settings appearance and support for pop-out windows.

## [1.0.1] - 2026-09-13

### Changed

- Updated Seam's plugin listing information.

## [1.0.0] - 2026-09-13
<!-- iterations: iteration_00..iteration_05 -->

Initial public release of **Seam**.

### Added

- **Automatic organization**: Move notes with `#permanent` and `#archive` on desktop and mobile.
- **Move cleanup**: Remove temporary tags and properties as notes are organized.
- **Universal Palette**: Search titles, note content, and tags from one place.
- **Fleeting notes**: Create notes instantly with an optional template.
- **Palette actions**: Open results in new tabs and run Seam commands.
- **Organization commands**: Archive notes, move them to Permanent, and process pending automations.
- **Personalization**: Customize folders, shortcuts, and search icons.
- **Languages**: English and Brazilian Portuguese.
