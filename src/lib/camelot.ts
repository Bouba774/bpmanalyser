/**
 * Camelot Wheel & Harmonic Mixing Engine
 */

import { MusicalKey, KeyMode } from './audio-types';

// Camelot notation: number + letter (A=minor, B=major)
const CAMELOT_MAP: Record<string, string> = {
  // Minor keys (A)
  'A-minor': '1A', 'E-minor': '2A', 'B-minor': '3A', 'F#-minor': '4A',
  'C#-minor': '5A', 'G#-minor': '6A', 'D#-minor': '7A', 'A#-minor': '8A',
  'F-minor': '9A', 'C-minor': '10A', 'G-minor': '11A', 'D-minor': '12A',
  // Major keys (B)
  'C-major': '1B', 'G-major': '2B', 'D-major': '3B', 'A-major': '4B',
  'E-major': '5B', 'B-major': '6B', 'F#-major': '7B', 'C#-major': '8B',
  'G#-major': '9B', 'D#-major': '10B', 'A#-major': '11B', 'F-major': '12B',
};

export function getCamelotCode(key: MusicalKey, mode: KeyMode): string {
  return CAMELOT_MAP[`${key}-${mode}`] || '?';
}

export function getCompatibleKeys(camelot: string): string[] {
  if (!camelot || camelot === '?') return [];
  
  const num = parseInt(camelot);
  const letter = camelot.slice(-1);
  
  const compatible: string[] = [
    camelot, // Same key
    `${num}${letter === 'A' ? 'B' : 'A'}`, // Relative major/minor
    `${((num - 2 + 12) % 12) + 1}${letter}`, // -1 semitone on wheel
    `${(num % 12) + 1}${letter}`, // +1 semitone on wheel
  ];
  
  return compatible;
}

export function isHarmonicMatch(camelot1: string, camelot2: string): boolean {
  if (!camelot1 || !camelot2 || camelot1 === '?' || camelot2 === '?') return false;
  return getCompatibleKeys(camelot1).includes(camelot2);
}

export function getCamelotColor(camelot: string): string {
  if (!camelot || camelot === '?') return 'hsl(0, 0%, 40%)';
  const num = parseInt(camelot);
  const hue = ((num - 1) * 30) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

// All Camelot codes for the wheel visualization
export const CAMELOT_WHEEL = [
  { code: '1A', key: 'Am', num: 1, letter: 'A' },
  { code: '1B', key: 'C', num: 1, letter: 'B' },
  { code: '2A', key: 'Em', num: 2, letter: 'A' },
  { code: '2B', key: 'G', num: 2, letter: 'B' },
  { code: '3A', key: 'Bm', num: 3, letter: 'A' },
  { code: '3B', key: 'D', num: 3, letter: 'B' },
  { code: '4A', key: 'F#m', num: 4, letter: 'A' },
  { code: '4B', key: 'A', num: 4, letter: 'B' },
  { code: '5A', key: 'C#m', num: 5, letter: 'A' },
  { code: '5B', key: 'E', num: 5, letter: 'B' },
  { code: '6A', key: 'G#m', num: 6, letter: 'A' },
  { code: '6B', key: 'B', num: 6, letter: 'B' },
  { code: '7A', key: 'D#m', num: 7, letter: 'A' },
  { code: '7B', key: 'F#', num: 7, letter: 'B' },
  { code: '8A', key: 'A#m', num: 8, letter: 'A' },
  { code: '8B', key: 'C#', num: 8, letter: 'B' },
  { code: '9A', key: 'Fm', num: 9, letter: 'A' },
  { code: '9B', key: 'G#', num: 9, letter: 'B' },
  { code: '10A', key: 'Cm', num: 10, letter: 'A' },
  { code: '10B', key: 'D#', num: 10, letter: 'B' },
  { code: '11A', key: 'Gm', num: 11, letter: 'A' },
  { code: '11B', key: 'A#', num: 11, letter: 'B' },
  { code: '12A', key: 'Dm', num: 12, letter: 'A' },
  { code: '12B', key: 'F', num: 12, letter: 'B' },
];
