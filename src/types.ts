import { TFile } from 'obsidian';

export type AutomationDelayMode = 'on-switch' | '2000' | '5000' | '1000';
export type UpdateAnnouncementMode = 'major' | 'all' | 'never';
export type PaletteRibbonMode = 'both' | 'mobile' | 'hidden';

export interface SeamSettings {
    permanentFolder: string;
    archiveFolder: string;
    fleetingFolder: string;
    fleetingNoteTemplate: string;
    archiveTag: string;
    permanentTag: string;
    archivedTag: string;
    automaticProcessing: boolean;
    automationDelay: AutomationDelayMode;
    addArchivedState: boolean;
    enableMoveCleanup: boolean;
    moveCleanupTags: string;
    moveCleanupProperties: string;
    showIcons: boolean;
    showCommandsByDefault: boolean;
    quickAddChoices: QuickAddChoice[];
    persistQuickAddDrafts: boolean;
    reconciliationIntervalMinutes: number;
    updateAnnouncementMode: UpdateAnnouncementMode;
    lastAnnouncedVersion: string;
    customSpecialSearches: CustomSpecialSearch[];
    showSpecialSearchDescriptions: boolean;
    specialSearchPreferences: SpecialSearchPreference[];
    specialSearchOrder: string[];
    showTodoCompletionPercent: boolean;
    paletteRibbonMode: PaletteRibbonMode;
}

export interface SpecialSearchPreference {
    search: SpecialSearch;
    pinned: boolean;
    hidden: boolean;
}

export type QuickAddLocation = 'default' | 'specific';
export type QuickAddOpenBehavior = 'tab' | 'current' | 'split';
export type QuickAddConflictBehavior = 'ask' | 'replace' | 'create-new';

export interface QuickAddChoice {
    id: string;
    name: string;
    templatePath: string;
    location: QuickAddLocation;
    folderPath: string;
    open: boolean;
    openBehavior: QuickAddOpenBehavior;
    focus: boolean;
    icon: string;
    conflictBehavior: QuickAddConflictBehavior;
}

export interface CustomSpecialSearch {
    id: string;
    identifier: string;
    icon: string;
    mode: 'base' | 'tags';
    basePath: string;
    baseView: string;
    expandModal?: boolean;
    filterQuery: string;
    pinned: boolean;
    hidden: boolean;
}

export const DEFAULT_SETTINGS: SeamSettings = {
    permanentFolder: 'Permanent',
    archiveFolder: 'Archive',
    fleetingFolder: 'Fleeting',
    fleetingNoteTemplate: '',
    archiveTag: 'archive',
    permanentTag: 'permanent',
    archivedTag: 'archived',
    automaticProcessing: true,
    automationDelay: 'on-switch',
    addArchivedState: true,
    enableMoveCleanup: true,
    moveCleanupTags: '#permanent, #todo',
    moveCleanupProperties: 'status',
    showIcons: true,
    showCommandsByDefault: true,
    quickAddChoices: [],
    persistQuickAddDrafts: false,
    reconciliationIntervalMinutes: 15,
    updateAnnouncementMode: 'major',
    lastAnnouncedVersion: '',
    customSpecialSearches: [],
    showSpecialSearchDescriptions: true,
    specialSearchPreferences: [
        { search: 'today', pinned: false, hidden: false },
        { search: 'yesterday', pinned: false, hidden: false },
        { search: 'recent', pinned: false, hidden: false },
        { search: 'lastDays', pinned: false, hidden: false },
        { search: 'untagged', pinned: false, hidden: false },
        { search: 'docs', pinned: false, hidden: false },
        { search: 'images', pinned: false, hidden: false },
        { search: 'task', pinned: false, hidden: false },
        { search: 'todo', pinned: false, hidden: false },
        { search: 'done', pinned: false, hidden: false },
        { search: 'code', pinned: false, hidden: false },
    ],
    specialSearchOrder: [
        'builtin:today', 'builtin:yesterday',
        'builtin:recent', 'builtin:lastDays',
        'builtin:untagged', 'builtin:docs', 'builtin:images',
        'builtin:task', 'builtin:todo', 'builtin:done', 'builtin:code',
    ],
    showTodoCompletionPercent: true,
    paletteRibbonMode: 'both',
};

export type AutomationResultStatus = 'success' | 'conflict' | 'error' | 'skipped';

export interface AutomationResult {
    status: AutomationResultStatus;
    file: TFile;
    action: string;
    message: string;
    newPath?: string;
}

export interface SearchResult {
    file: TFile;
    title: string;
    path: string;
    tags: string[];
    snippet?: string;
    matchSnippet?: MatchSnippet;
}

export interface MatchSnippet {
    text: string;
    matchStart: number;
    matchEnd: number;
}

export type QueryTokenType = 'tag' | 'negativeTag' | 'or' | 'text';

export type SpecialSearch = 'today' | 'yesterday' | 'recent' | 'lastDays' | 'untagged' | 'docs' | 'images' | 'task' | 'todo' | 'done' | 'code';
export const SPECIAL_SEARCH_ICONS: Record<SpecialSearch, string> = {
    today: 'calendar-days',
    yesterday: 'history',
    recent: 'clock-3',
    lastDays: 'calendar-days',
    untagged: 'tag',
    docs: 'file-text',
    images: 'image',
    task: 'list-checks',
    todo: 'square-check-big',
    done: 'list-checks',
    code: 'code',
};

export const SPECIAL_SEARCH_LABELS: Record<SpecialSearch, string> = {
    today: '@today',
    yesterday: '@yesterday',
    recent: '@recent',
    lastDays: '@lastXdays',
    untagged: '@untagged',
    docs: '@docs',
    images: '@images',
    task: '@task',
    todo: '@todo',
    done: '@done',
    code: '@code',
};

export interface QueryToken {
    type: QueryTokenType;
    value: string;
}

export interface ParsedQuery {
    tokens: QueryToken[];
    isValid: boolean;
    error?: string;
}

export interface SpecialSearchOption {
    search: SpecialSearch;
    label: string;
    description: string;
}

export interface AutomationStatus {
    pending: number;
    processed: number;
    failed: number;
    errors: AutomationError[];
}

export interface AutomationError {
    filePath: string;
    action: string;
    message: string;
    timestamp: number;
}

export interface PaletteItem {
    id: string;
    title: string;
    description: string;
    type: 'note' | 'command' | 'action' | 'create' | 'tag' | 'special' | 'base';
    icon?: string;
    file?: TFile;
    tags?: string[];
    matchSnippet?: MatchSnippet;
    taskCompletionPercent?: number;
    tagMode?: 'include' | 'exclude';
    specialSearch?: SpecialSearch;
    specialSearchInput?: string;
    customSearchId?: string;
    basePath?: string;
    baseView?: string;
    baseContent?: string;
    baseSearchText?: string;
    action?: () => void | Promise<void>;
}
