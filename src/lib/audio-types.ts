import type { EnergyLevel } from './energy-detector';

export interface AudioFileInfo {
  id: string;
  name: string;
  path: string;
  format: string;
  size: number;
  duration: number;
  // Tonality
  key: string | null;             // e.g. "F# minor"
  camelot: string | null;         // e.g. "11A"
  keyConfidence: number | null;
  keyStatus: 'idle' | 'pending' | 'analyzing' | 'done' | 'error';
  // Energy
  energy: number | null;          // 0–10
  energyLevel: EnergyLevel | null;
  // Misc
  status: 'pending' | 'analyzing' | 'done' | 'error';
  error?: string;
  keyError?: string;
  file: File;
  safUri?: string;
}

export type SortKey = 'name' | 'duration' | 'format' | 'key' | 'camelot' | 'energy';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

export interface FilterConfig {
  search: string;
  keyFilter: string | null;       // specific key like "F# minor"
  modeFilter: 'major' | 'minor' | null;
  camelotFilter: string | null;   // e.g. "8A"
  energyMin: number | null;       // 0–10
  energyMax: number | null;
}

export const ENERGY_GROUPS = [
  { label: '❄️ Chill (0–3)', min: 0, max: 3, colorClass: 'text-bpm-slow' },
  { label: '🌊 Medium (3–5.5)', min: 3, max: 5.5, colorClass: 'text-bpm-medium' },
  { label: '🔥 High (5.5–8)', min: 5.5, max: 8, colorClass: 'text-bpm-faster' },
  { label: '⚡ Peak (8–10)', min: 8, max: 10, colorClass: 'text-bpm-fastest' },
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

export function getEnergyGroup(energy: number) {
  if (energy < 3) return ENERGY_GROUPS[0];
  if (energy < 5.5) return ENERGY_GROUPS[1];
  if (energy < 8) return ENERGY_GROUPS[2];
  return ENERGY_GROUPS[3];
}
