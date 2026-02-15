import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

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

const BACKUP_DIR = 'bpm-analyzer-backups';
const BACKUP_FILE = 'rename-log.json';

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
  if (!isNativePlatform()) return;

  const log: RenameLog = {
    timestamp: new Date().toISOString(),
    entries,
  };

  // Try to load existing logs
  let existingLogs: RenameLog[] = [];
  try {
    const result = await Filesystem.readFile({
      path: `${BACKUP_DIR}/${BACKUP_FILE}`,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    existingLogs = JSON.parse(result.data as string);
  } catch {
    // No existing log file
  }

  existingLogs.push(log);

  await Filesystem.writeFile({
    path: `${BACKUP_DIR}/${BACKUP_FILE}`,
    data: JSON.stringify(existingLogs, null, 2),
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
}

export async function getBackupLogs(): Promise<RenameLog[]> {
  if (!isNativePlatform()) return [];
  try {
    const result = await Filesystem.readFile({
      path: `${BACKUP_DIR}/${BACKUP_FILE}`,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return JSON.parse(result.data as string);
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
      const dirPath = entry.originalUri.substring(0, entry.originalUri.lastIndexOf('/'));
      await Filesystem.rename({
        from: `${dirPath}/${entry.newName}`,
        to: entry.originalUri,
      });
      success++;
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

    const dirPath = file.uri.substring(0, file.uri.lastIndexOf('/'));
    const newUri = `${dirPath}/${newName}`;

    try {
      await Filesystem.rename({
        from: file.uri,
        to: newUri,
      });

      entries.push({
        originalName: file.name,
        newName,
        originalUri: file.uri,
      });
      success++;
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
