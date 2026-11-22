# Editor & media integration

Move the unreleased standalone Seam Utility features into Seam. Preserve the standalone
repository's completed work in a commit before migrating; no installed-user migration is needed.

- Keep the implementation in dedicated internal modules with Seam-owned registrations and settings.
- Replace cross-plugin DOM events with direct, typed Universal Palette integration.
- Group features under Editor & media, with individual toggles and no listeners/renderers for
  disabled features. URL metadata requests must remain opt-in; task movement is opt-in too.
- Preserve `seam-embed` and `seam-layout` syntax, caption behavior, folding, layouts, mobile
  confirmation actions, keyboard hints, and drag reordering.
- Keep the committed standalone checkout as a reference, but remove its default workspace build
  and install tasks. Do not read its settings or implement released-installation compatibility.
- Use Seam's English/PT-BR localization and public Obsidian APIs. Validate with all existing and
  transferred tests, quality checks, builds, and live workflows in `seam_test_vault`.
