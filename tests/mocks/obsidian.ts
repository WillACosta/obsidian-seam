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

function mockMoment() {
    const date = new Date();
    return {
        subtract(amount: number, unit: string) {
            if (unit === 'day' || unit === 'days') date.setDate(date.getDate() - amount);
            return this;
        },
        format(pattern: string) {
            const year = String(date.getFullYear());
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return pattern.replace(/YYYY/g, year).replace(/MM/g, month).replace(/DD/g, day);
        },
    };
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
        moment: mockMoment,
        normalizePath: (path: string) => path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, ''),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
