import { TFile } from 'obsidian';

export type AutomationDelayMode = 'on-switch' | '2000' | '5000' | '1000';
export type UpdateAnnouncementMode = 'major' | 'all' | 'never';

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
    quickAddChoices: QuickAddChoice[];
    persistQuickAddDrafts: boolean;
    reconciliationIntervalMinutes: number;
    updateAnnouncementMode: UpdateAnnouncementMode;
    lastAnnouncedVersion: string;
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
    quickAddChoices: [],
    persistQuickAddDrafts: false,
    reconciliationIntervalMinutes: 15,
    updateAnnouncementMode: 'major',
    lastAnnouncedVersion: '',
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

export interface QueryToken {
    type: QueryTokenType;
    value: string;
}

export interface ParsedQuery {
    tokens: QueryToken[];
    isValid: boolean;
    error?: string;
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
    type: 'note' | 'command' | 'action' | 'create' | 'tag';
    icon?: string;
    file?: TFile;
    tags?: string[];
    matchSnippet?: MatchSnippet;
    tagMode?: 'include' | 'exclude';
    action?: () => void | Promise<void>;
}
