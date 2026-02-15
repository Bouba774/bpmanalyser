export interface AudioFileInfo {
  id: string;
  name: string;
  path: string;
  format: string;
  size: number;
  duration: number;
  bpm: number | null;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  error?: string;
  file: File;
  safUri?: string; // SAF document URI for native rename
}

export type SortKey = 'name' | 'bpm' | 'duration' | 'format';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

export interface FilterConfig {
  search: string;
  bpmMin: number | null;
  bpmMax: number | null;
}

export const BPM_GROUPS = [
  { label: '< 90 BPM', min: 0, max: 89, colorClass: 'text-bpm-slow' },
  { label: '90–110 BPM', min: 90, max: 110, colorClass: 'text-bpm-medium' },
  { label: '110–125 BPM', min: 110, max: 125, colorClass: 'text-bpm-fast' },
  { label: '125–140 BPM', min: 125, max: 140, colorClass: 'text-bpm-faster' },
  { label: '> 140 BPM', min: 140, max: Infinity, colorClass: 'text-bpm-fastest' },
] as const;

export const SUPPORTED_FORMATS = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'webm'];

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function isAudioFile(filename: string): boolean {
  return SUPPORTED_FORMATS.includes(getFileExtension(filename));
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getBpmGroup(bpm: number) {
  if (bpm < 90) return BPM_GROUPS[0];
  if (bpm <= 110) return BPM_GROUPS[1];
  if (bpm <= 125) return BPM_GROUPS[2];
  if (bpm <= 140) return BPM_GROUPS[3];
  return BPM_GROUPS[4];
}

export function getBpmColor(bpm: number): string {
  if (bpm < 90) return 'hsl(200, 80%, 55%)';
  if (bpm <= 110) return 'hsl(160, 70%, 45%)';
  if (bpm <= 125) return 'hsl(40, 90%, 55%)';
  if (bpm <= 140) return 'hsl(20, 90%, 55%)';
  return 'hsl(0, 80%, 55%)';
}
