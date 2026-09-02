# Seam — Obsidian Workflow Plugin

Seam is a small, native-feeling Obsidian plugin that brings tag-driven organization and lightweight automation to your vault. Write notes, add simple tags, and let the system organize them quietly.

## Features

- **Tag-Driven Organization**: Treat tags as the primary organizational layer without manual folder maintenance.
- **Automatic Archiving**: Add `#archive` to move a note to your configured `Archive/` folder. Strips `#archive` and automatically marks it with durable state `#archived`.
- **Permanent Filing**: Add `#permanent` to route fleeting notes into your `Permanent/` folder and strip the action tag.
- **Universal Palette**: A unified floating modal (`SuggestModal`) combining live note search, tag filtering (`#electronics -#archived`), and command execution.
- **Safe & Recoverable**: Non-destructive conflict detection, atomic tag removal only after successful moves, and startup/periodic reconciliation.
- **Mobile First-Class**: Runs entirely on Obsidian's public native APIs without Node.js or desktop-only dependencies.

## Installation

### From Source

1. Clone this repository into your vault's `.obsidian/plugins/` directory:
   ```bash
   cd <your-vault>/.obsidian/plugins/
   git clone https://github.com/WillACosta/obsidian-seam.git obsidian-seam
   cd obsidian-seam
   pnpm install
   pnpm build
   ```
2. Open Obsidian and enable **Seam** under **Settings > Community plugins**.

## Development

```bash
pnpm install
pnpm dev    # Watch mode
pnpm build  # Production build
pnpm test   # Run unit test suite
```

## Specifications & Changelog

- [Development Log Registry](docs/DEVELOPMENT_LOG.md)
- [Product Specification (SDD v0.1.0)](docs/specs/main/product_v0.1.0.md)
- [Technical Companion (v0.1.0)](docs/specs/main/tech_v0.1.0.md)
- [Iteration 01 Specs](docs/specs/iteraction_01/)

## License

MIT
