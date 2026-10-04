
**Context**:

We can use documents as sources, e.g., handwritten notes as raw draft files when studying or taking notes in a class, meeting, etc. Without paying attention to structure or organization, we want the freedom of sketching ideas.

When something needs to be ingested or turned into a structured permanent note, it will be exported from the digital handwritten app (e.g., ProDrafts, GoodNotes, etc.) to the `Sources/` directory of Obsidian's Vault.

Then Seam automation will observe from time to time whether any new entries have been added to the pipeline.

The pipeline is:

```
Sketch on Digital App -> Export as .pdf to Sources/ -> Seam verifies if it already has a companion note on Fleeting/ -> If not, create a new one.
```

When detecting a new handwritten note that has not been attached to a companion `.md` note, Seam creates a new one:

```
---
tags:
  - source
source_app: ProDrafts
captured: 2026-09-29
---

## Original
![[2026-09-29-api-orchestration.pdf]]
```

1. Add an option to set a custom template for the companion notes; if not set, Seam uses the above layout by default.
2. Add an option to disable the automation of watching and creating companion notes.
3. Add a new Seam command to manually "Create note from attachment"; when selected, it lists all available files in the defined `Sources/` dir.
4. Add an option to set a different folder to look for handwritten files (`Sources/` by default).
5. The new automation system should reuse the existing Seam workflow used for the tags automation; remember that it should also work on mobile, so it can't depend on desktop-only APIs.

| Stage    | Seam’s responsibility                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| Import   | Watch a configured vault folder for new PDFs and images; offer a manual **“Create note from attachment”** command too |
| Register | Create one companion note per export, with a link to the attachment and enough metadata to avoid duplicates           |
| Review   | Expose an `@sources` to palette view as a built-in special search to find source companion notes                      |
| File     | Reuse Seam’s existing tag based `Fleeting` → `Permanent` → `Archive` flow                                             |
