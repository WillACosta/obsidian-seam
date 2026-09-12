import { TFile } from 'obsidian';

export interface SeamSettings {
    permanentFolder: string;
    archiveFolder: string;
    fleetingFolder: string;
    archiveTag: string;
    permanentTag: string;
    archivedTag: string;
    automaticProcessing: boolean;
    addArchivedState: boolean;
    enableMoveCleanup: boolean;
    moveCleanupTags: string;
    moveCleanupProperties: string;
    showIcons: boolean;
    reconciliationIntervalMinutes: number;
}

export const DEFAULT_SETTINGS: SeamSettings = {
    permanentFolder: 'Permanent',
    archiveFolder: 'Archive',
    fleetingFolder: 'Fleeting',
    archiveTag: 'archive',
    permanentTag: 'permanent',
    archivedTag: 'archived',
    automaticProcessing: true,
    addArchivedState: true,
    enableMoveCleanup: true,
    moveCleanupTags: '#permanent, #todo',
    moveCleanupProperties: 'status',
    showIcons: true,
    reconciliationIntervalMinutes: 15,
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
    type: 'note' | 'command' | 'action' | 'create';
    icon?: string;
    file?: TFile;
    tags?: string[];
    matchSnippet?: MatchSnippet;
    action?: () => void | Promise<void>;
}
