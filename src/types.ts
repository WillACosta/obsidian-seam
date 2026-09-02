import { TFile } from 'obsidian';

export interface SeamSettings {
    permanentFolder: string;
    archiveFolder: string;
    archiveTag: string;
    permanentTag: string;
    archivedTag: string;
    automaticProcessing: boolean;
    addArchivedState: boolean;
    enableArchiveCleanup: boolean;
    archiveCleanupTags: string;
    archiveCleanupProperties: string;
    showIcons: boolean;
    reconciliationIntervalMinutes: number;
}

export const DEFAULT_SETTINGS: SeamSettings = {
    permanentFolder: 'Permanent',
    archiveFolder: 'Archive',
    archiveTag: 'archive',
    permanentTag: 'permanent',
    archivedTag: 'archived',
    automaticProcessing: true,
    addArchivedState: true,
    enableArchiveCleanup: true,
    archiveCleanupTags: '#permanent, #todo',
    archiveCleanupProperties: 'status',
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
    type: 'note' | 'command' | 'action';
    icon?: string;
    file?: TFile;
    tags?: string[];
    action?: () => void | Promise<void>;
}
