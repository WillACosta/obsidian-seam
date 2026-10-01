/** Common source documents; Markdown is handled as a note by Seam's lifecycle. */
export const DOCUMENT_EXTENSIONS = new Set([
    'doc', 'docm', 'docx', 'dot', 'dotm', 'dotx', 'odt', 'ott', 'pdf', 'rtf', 'tex', 'txt',
    'csv', 'tsv', 'xls', 'xlsm', 'xlsx', 'xlt', 'xltm', 'xltx', 'ods', 'ots',
    'ppt', 'pptm', 'pptx', 'pot', 'potm', 'potx', 'pps', 'ppsm', 'ppsx', 'odp', 'otp',
    'epub', 'html', 'htm', 'pages', 'numbers', 'key',
]);

export const IMAGE_EXTENSIONS = new Set([
    'avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'tif', 'tiff', 'webp',
]);

/** Native Obsidian document/image embeds; other originals use a regular link. */
export const EMBEDDABLE_SOURCE_EXTENSIONS = new Set([
    'pdf', 'avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp',
]);
