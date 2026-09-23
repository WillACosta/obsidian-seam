# Future Iteration: Cross-Platform OCR Attachment Search

## Findings

True OCR search is technically feasible in an Obsidian plugin, but it is not a small text-search extension. The implementation would need an attachment extraction pipeline, an OCR engine, background work, result caching, cancellation, and mobile-specific resource limits.

Obsidian Mobile does not provide Node.js or Electron APIs. A mobile-compatible solution must use browser APIs, WebAssembly, Web Workers, and Obsidian's public `Vault` APIs for reading attachment data. The plugin must not depend on filesystem paths, native binaries, or desktop-only APIs.

### Candidate libraries

| Use case | Candidate | Findings |
| --- | --- | --- |
| Image OCR | Tesseract.js | Runs in browsers through WebAssembly and Web Workers. It is suitable for local image OCR, but it does not parse PDFs directly. |
| PDF text extraction and rendering | PDF.js | Can parse PDF data in the browser. Text-native PDFs should use extraction; scanned PDFs must be rendered page-by-page before OCR. |
| DOCX text extraction | Mammoth.js | Supports browser `ArrayBuffer` input and raw-text extraction from `.docx` files. |
| Images and PDFs in one pipeline | Scribe.js | Provides browser OCR and PDF extraction, but is AGPL-licensed and has stricter same-origin asset requirements. License compatibility must be reviewed before adoption. |

### Mobile considerations

- OCR is CPU-, memory-, and battery-intensive, especially for multi-page PDFs and high-resolution images.
- Language data and WebAssembly workers add download and storage costs.
- iOS and Android webviews may differ in worker limits, memory pressure, and background execution behavior.
- OCR should be lazy: do not scan the entire vault during plugin startup.
- A search should be cancellable when the query changes or the palette closes.
- Results should be cached by attachment path, modification time, OCR language, and engine version.
- The plugin should expose file-size/page-count limits and a clear progress state.
- OCR data should remain local by default; cloud OCR would introduce privacy, network, and credential-management concerns.

## Recommendation

Use a phased, local-first implementation:

1. **Phase 1 — Image OCR spike**: Bundle Tesseract.js, process one image in a Web Worker, and validate performance on desktop, iOS, and Android.
2. **Phase 2 — Text-native documents**: Add PDF.js extraction for text PDFs and Mammoth.js for DOCX. Add format-specific parsers only when there is a demonstrated use case.
3. **Phase 3 — Scanned PDFs**: Render PDF pages with PDF.js and OCR only the pages needed by the search/indexing policy.
4. **Phase 4 — Search integration**: Reintroduce `@ocr` only after the cache, cancellation, progress, and mobile limits are stable.

The first production version should search indexed OCR text, not run OCR synchronously for every keystroke. A practical cache record would contain the attachment path, file modification time, OCR language, engine version, extracted text, and optional confidence metadata.

## Open decisions

- Which languages should be bundled initially, and should users opt into additional language data?
- Should OCR text be stored in plugin data, a hidden vault file, or a per-attachment sidecar?
- What maximum image dimensions, PDF pages, and attachment sizes are acceptable on mobile?
- Should OCR results be ephemeral, or should Seam provide a command to persist searchable text?
- Is Scribe.js's AGPL license acceptable, or should Seam use Apache-compatible components such as Tesseract.js and PDF.js with separate format parsers?

## Sources

- [Obsidian mobile development](https://docs.obsidian.md/Plugins/Getting%20started/Mobile%20development)
- [Tesseract.js](https://github.com/naptha/tesseract.js)
- [Tesseract.js FAQ](https://github.com/naptha/tesseract.js/blob/master/docs/faq.md)
- [PDF.js getting started](https://mozilla.github.io/pdf.js/getting_started/)
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js)
- [Scribe.js](https://github.com/scribeocr/scribe.js)
