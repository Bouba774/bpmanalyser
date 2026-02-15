import { Capacitor } from '@capacitor/core';
import SAFFolderPicker from '@/plugins/saf-folder-picker';

export interface RenameEntry {
  originalName: string;
  newName: string;
  originalUri: string;
}

export interface RenameLog {
  timestamp: string;
  entries: RenameEntry[];
}

export type RenameFormat = 'numeric' | 'numeric_bpm' | 'bpm_only' | 'custom';
export type SortOrder = 'asc' | 'desc';

export interface RenameOptions {
  format: RenameFormat;
  sortOrder: SortOrder;
  customTemplate?: string;
}

const RENAME_LOG_KEY = 'bpm-analyzer-rename-logs';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function generateNewName(
  originalName: string,
  bpm: number,
  index: number,
  totalFiles: number,
  options: RenameOptions
): string {
  const ext = originalName.substring(originalName.lastIndexOf('.'));
  const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
  const paddedIndex = String(index + 1).padStart(String(totalFiles).length, '0');

  switch (options.format) {
    case 'numeric':
      return `${paddedIndex}_${baseName}${ext}`;
    case 'numeric_bpm':
      return `${paddedIndex}_${bpm}BPM_${baseName}${ext}`;
    case 'bpm_only':
      return `${bpm}BPM_${baseName}${ext}`;
    case 'custom': {
      const template = options.customTemplate || '{index}_{bpm}_{nom}';
      return template
        .replace('{index}', paddedIndex)
        .replace('{bpm}', String(bpm))
        .replace('{nom}', baseName) + ext;
    }
    default:
      return originalName;
  }
}

export async function saveBackupLog(entries: RenameEntry[]): Promise<void> {
  const log: RenameLog = {
    timestamp: new Date().toISOString(),
    entries,
  };

  let existingLogs: RenameLog[] = [];
  try {
    const stored = localStorage.getItem(RENAME_LOG_KEY);
    if (stored) existingLogs = JSON.parse(stored);
  } catch {
    // No existing logs
  }

  existingLogs.push(log);
  localStorage.setItem(RENAME_LOG_KEY, JSON.stringify(existingLogs));
}

export async function getBackupLogs(): Promise<RenameLog[]> {
  try {
    const stored = localStorage.getItem(RENAME_LOG_KEY);
    if (stored) return JSON.parse(stored);
    return [];
  } catch {
    return [];
  }
}

export async function rollbackRename(log: RenameLog): Promise<{ success: number; errors: string[] }> {
  if (!isNativePlatform()) return { success: 0, errors: ['Non disponible en mode web'] };

  let success = 0;
  const errors: string[] = [];

  for (const entry of log.entries) {
    try {
      // Use SAF rename to restore original name
      const result = await SAFFolderPicker.renameFile({
        uri: entry.originalUri,
        newName: entry.originalName,
      });

      if (result.success) {
        success++;
      } else {
        errors.push(`${entry.newName}: ${result.error || 'Échec'}`);
      }
    } catch (err) {
      errors.push(`${entry.newName}: ${(err as Error).message}`);
    }
  }

  return { success, errors };
}

export async function renameFilesNatively(
  files: { name: string; bpm: number; uri: string }[],
  options: RenameOptions
): Promise<{ success: number; errors: string[]; entries: RenameEntry[] }> {
  if (!isNativePlatform()) {
    return { success: 0, errors: ['Le renommage natif nécessite une app mobile'], entries: [] };
  }

  // Sort by BPM
  const sorted = [...files].sort((a, b) =>
    options.sortOrder === 'asc' ? a.bpm - b.bpm : b.bpm - a.bpm
  );

  const entries: RenameEntry[] = [];
  let success = 0;
  const errors: string[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const file = sorted[i];
    const newName = generateNewName(file.name, file.bpm, i, sorted.length, options);

    if (newName === file.name) {
      success++;
      continue;
    }

    try {
      // Use SAF DocumentsContract rename
      const result = await SAFFolderPicker.renameFile({
        uri: file.uri,
        newName,
      });

      if (result.success) {
        entries.push({
          originalName: file.name,
          newName,
          originalUri: file.uri,
        });
        success++;
      } else {
        errors.push(`${file.name}: ${result.error || 'Échec du renommage'}`);
      }
    } catch (err) {
      errors.push(`${file.name}: ${(err as Error).message}`);
    }
  }

  // Save backup log
  if (entries.length > 0) {
    await saveBackupLog(entries);
  }

  return { success, errors, entries };
}
