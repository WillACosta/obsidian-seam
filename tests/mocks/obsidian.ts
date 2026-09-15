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

if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = globalThis;
}

export class MockTAbstractFile {
    path: string;
    name: string;
    constructor(path: string = '') {
        this.path = path;
        this.name = path.split('/').pop() || '';
    }
}

export class MockTFile extends MockTAbstractFile {
    extension: string;
    basename: string;
    constructor(path: string = '') {
        super(path);
        const parts = this.name.split('.');
        this.extension = parts.length > 1 ? parts.pop() || '' : '';
        this.basename = parts.join('.');
    }
}

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
        TAbstractFile: MockTAbstractFile,
        TFile: MockTFile,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
