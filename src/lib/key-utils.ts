/**
 * Harmonic Mixing Utilities — Camelot Wheel compatibility
 */

export type HarmonicLevel = 'compatible' | 'acceptable' | 'clash';

// Parse Camelot code into number + letter
function parseCamelot(code: string): { num: number; letter: 'A' | 'B' } | null {
  const match = code.match(/^(\d{1,2})([AB])$/);
  if (!match) return null;
  return { num: parseInt(match[1]), letter: match[2] as 'A' | 'B' };
}

/**
 * Check harmonic compatibility between two Camelot codes.
 * Compatible: same key, ±1 on wheel, parallel key (A↔B same number)
 * Acceptable: ±2, energy boost (+7 semitones / dominant)
 */
export function getHarmonicCompatibility(camelot1: string, camelot2: string): HarmonicLevel {
  const a = parseCamelot(camelot1);
  const b = parseCamelot(camelot2);
  if (!a || !b) return 'clash';

  // Same key
  if (a.num === b.num && a.letter === b.letter) return 'compatible';

  // Relative key (same number, different letter)
  if (a.num === b.num && a.letter !== b.letter) return 'compatible';

  // Adjacent on wheel (same letter)
  if (a.letter === b.letter) {
    const diff = Math.abs(a.num - b.num);
    const wrappedDiff = Math.min(diff, 12 - diff);
    if (wrappedDiff === 1) return 'compatible';
    if (wrappedDiff === 2) return 'acceptable';
  }

  // Adjacent on wheel (different letter, ±1)
  if (a.letter !== b.letter) {
    const diff = Math.abs(a.num - b.num);
    const wrappedDiff = Math.min(diff, 12 - diff);
    if (wrappedDiff === 1) return 'acceptable';
  }

  // Dominant (perfect fifth) — +7 semitones = +1 on Camelot for same letter
  // Already covered by adjacent check

  return 'clash';
}

export function getHarmonicColor(level: HarmonicLevel): string {
  switch (level) {
    case 'compatible': return 'hsl(145, 70%, 45%)';
    case 'acceptable': return 'hsl(45, 90%, 50%)';
    case 'clash': return 'hsl(0, 70%, 50%)';
  }
}

export function getHarmonicLabel(level: HarmonicLevel): string {
  switch (level) {
    case 'compatible': return 'Compatible';
    case 'acceptable': return 'Acceptable';
    case 'clash': return 'Non harmonique';
  }
}

// Sort keys in Camelot order
export function camelotSortValue(camelot: string): number {
  const parsed = parseCamelot(camelot);
  if (!parsed) return 999;
  return parsed.num * 2 + (parsed.letter === 'B' ? 1 : 0);
}

// Key color based on Camelot position (hue wheel)
export function getKeyColor(camelot: string): string {
  const parsed = parseCamelot(camelot);
  if (!parsed) return 'hsl(0, 0%, 50%)';
  const hue = ((parsed.num - 1) * 30) % 360;
  const sat = parsed.letter === 'B' ? '75%' : '60%';
  const light = parsed.letter === 'B' ? '55%' : '50%';
  return `hsl(${hue}, ${sat}, ${light})`;
}

// All Camelot codes for filter dropdown
export const ALL_CAMELOT_CODES = [
  '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B',
  '5A', '5B', '6A', '6B', '7A', '7B', '8A', '8B',
  '9A', '9B', '10A', '10B', '11A', '11B', '12A', '12B',
];
