# Image Layout

Run **Image Layout** from either Obsidian's command palette or Seam's Universal Palette. Choose Grid, Flex, or Masonry, add optional images, and adjust the live preview. Open **Appearance** to customize the layout; its fields use two columns in a wide editor and one column in a narrow editor. The content scrolls beneath the header's check action (Insert layout or Save layout) and Dismiss control. Tab moves between controls; Enter inserts from the header or activates a focused button; Cmd+[ / Ctrl+[ goes back; Escape dismisses.

**Add images** expands three source tabs: **Vault** searches all vault images, **Current note** searches only images referenced in the source note, and **URL or path** adds a vault image path or HTTP(S) image URL. Each searchable source keeps its own filter. Selected images stay selected across tabs. Use Left/Right or Home/End on the tab row, then Tab into its content. External image URLs load directly from their hosts. Click or tap a selected thumbnail to toggle its caption and crop/fit options; the open image has an accent border. Use the grip’s **Drag to rearrange** action with a mouse or touch, or focus the grip and use Left/Right for keyboard reordering. The **Delete** action removes an image. Grip and Delete icons appear on desktop hover or keyboard focus and remain visible on mobile. While dragging, a placeholder marks the insertion slot and neighboring thumbnails shift into their prospective positions. The grip sits to the right of Delete.

All configuration and images are stored in one Markdown code block. No additional JSON file is created.

```seam-layout
type: grid
columns: 3
gap: 8

![[image-1.png|First image]]
![Second image](<Images/image 2.png>)
```

```seam-layout
type: flex
gap: 8
height: 180

![[image-1.png]]
![[image-2.png]]
```

```seam-layout
type: masonry
gap: 12
fit: cover
captions: true

![[image-1.png|First image]]
![[image-2.png|Second image]]
```

| Property   | Values                         | Default      |
| ---------- | ------------------------------ | ------------ |
| `type`     | `grid`, `flex`, `masonry`      | `grid`       |
| `columns`  | Positive integer or `auto`     | `auto`       |
| `gap`      | Pixels, 0–128                  | `8`          |
| `height`   | Pixels, 16–2000, or `auto`     | `auto`       |
| `fit`      | `cover`, `contain`             | `cover`      |
| `radius`   | Pixels, 0–256                  | Theme radius |
| `caption`  | Caption for the whole layout   | None         |
| `captions` | Show individual image captions | `false`      |

Images retain their natural proportions when height is automatic. An explicit Grid/Masonry height or per-image crop requests a fixed image box; `fit` then controls cropping or letterboxing. Flex uses its height as the row-image height and preserves image proportions. Narrow screens adapt columns to the available width.

The optional `imageOptions` YAML list stores individual crop/fit overrides by zero-based image index, for example `imageOptions: [{ index: 0, crop: true, fit: contain }]`. The editor updates those indexes when images are reordered. Per-image captions remain in the ordinary image alias or alt text.

Each rendered block exposes a Lucide `grid` **Edit layout** icon on hover or keyboard focus, also available through the context menu (including touch-and-hold). It reopens the same configuration. Use Obsidian’s native code action to edit the block syntax. Edits validate the original block before replacing it and refuse to overwrite a changed block. Images resolve relative to the source note. Missing images show their filenames, and available images open on click.

Embed URL and caption-entry views also provide a labeled check action in the header, so confirmation never requires a hardware keyboard. The Image Layout editor sizes to its content and scrolls only when it reaches the viewport limit.
