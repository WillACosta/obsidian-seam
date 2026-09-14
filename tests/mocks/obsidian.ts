import Module from 'node:module';

// When running tests in Node.js, mock 'obsidian' runtime exports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalResolve = (Module as any)._resolveFilename;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
    if (request === 'obsidian') {
        return 'obsidian';
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return originalResolve.call(this, request, parent, isMain, options);
};

require.cache['obsidian'] = {
    id: 'obsidian',
    filename: 'obsidian',
    loaded: true,
    exports: {
        Platform: {
            isMacOS: process.platform === 'darwin',
            isDesktop: true,
            isMobile: false,
        },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
