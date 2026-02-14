export type MusicalKey = 
  | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export type KeyMode = 'major' | 'minor';

export type EnergyLevel = 'low' | 'medium' | 'high';

export type MoodTag = 
  | 'chill' | 'dark' | 'happy' | 'aggressive' 
  | 'melancholic' | 'euphoric' | 'dreamy' | 'intense';

export type GenreTag = 
  | 'house' | 'techno' | 'trance' | 'dnb' | 'dubstep'
  | 'hip-hop' | 'pop' | 'rock' | 'ambient' | 'other';

export interface AudioFileInfo {
  id: string;
  name: string;
  path: string;
  format: string;
  size: number;
  duration: number;
  bpm: number | null;
  key: MusicalKey | null;
  mode: KeyMode | null;
  camelot: string | null;
  energy: EnergyLevel | null;
  mood: MoodTag | null;
  genre: GenreTag | null;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  error?: string;
  file: File;
}

export interface AnalysisResult {
  bpm: number;
  duration: number;
  key: MusicalKey;
  mode: KeyMode;
  camelot: string;
  energy: EnergyLevel;
  mood: MoodTag;
  genre: GenreTag;
}

export type SortKey = 'name' | 'bpm' | 'duration' | 'format' | 'key' | 'energy' | 'mood' | 'genre';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

export interface MultiSortConfig {
  rules: SortConfig[];
}

export interface FilterConfig {
  search: string;
  bpmMin: number | null;
  bpmMax: number | null;
  energy: EnergyLevel | null;
  mood: MoodTag | null;
  key: MusicalKey | null;
  genre: GenreTag | null;
}

export type ClusterMode = 'bpm' | 'energy' | 'mood' | 'key' | 'genre' | 'hybrid';

export const BPM_GROUPS = [
  { label: '< 90 BPM', min: 0, max: 89, colorClass: 'text-bpm-slow' },
  { label: '90–110 BPM', min: 90, max: 110, colorClass: 'text-bpm-medium' },
  { label: '110–125 BPM', min: 110, max: 125, colorClass: 'text-bpm-fast' },
  { label: '125–140 BPM', min: 125, max: 140, colorClass: 'text-bpm-faster' },
  { label: '> 140 BPM', min: 140, max: Infinity, colorClass: 'text-bpm-fastest' },
] as const;

export const SUPPORTED_FORMATS = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'webm'];

export const ALL_KEYS: MusicalKey[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const ALL_ENERGIES: EnergyLevel[] = ['low', 'medium', 'high'];
export const ALL_MOODS: MoodTag[] = ['chill', 'dark', 'happy', 'aggressive', 'melancholic', 'euphoric', 'dreamy', 'intense'];
export const ALL_GENRES: GenreTag[] = ['house', 'techno', 'trance', 'dnb', 'dubstep', 'hip-hop', 'pop', 'rock', 'ambient', 'other'];

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

export function getEnergyColor(energy: EnergyLevel): string {
  switch (energy) {
    case 'low': return 'hsl(200, 80%, 55%)';
    case 'medium': return 'hsl(40, 90%, 55%)';
    case 'high': return 'hsl(0, 80%, 55%)';
  }
}

export function getMoodColor(mood: MoodTag): string {
  const colors: Record<MoodTag, string> = {
    chill: 'hsl(200, 70%, 55%)',
    dark: 'hsl(270, 50%, 45%)',
    happy: 'hsl(45, 90%, 55%)',
    aggressive: 'hsl(0, 80%, 50%)',
    melancholic: 'hsl(220, 60%, 50%)',
    euphoric: 'hsl(320, 80%, 60%)',
    dreamy: 'hsl(260, 60%, 65%)',
    intense: 'hsl(15, 90%, 55%)',
  };
  return colors[mood];
}
