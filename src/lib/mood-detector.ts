/**
 * Mood Detection Engine
 * Heuristic mood estimation from audio features
 */

import { EnergyLevel, KeyMode, MoodTag } from './audio-types';

export function detectMood(bpm: number, energy: EnergyLevel, mode: KeyMode): MoodTag {
  const isMinor = mode === 'minor';
  const isSlow = bpm < 100;
  const isMid = bpm >= 100 && bpm <= 128;
  const isFast = bpm > 128;

  if (energy === 'high') {
    if (isFast && isMinor) return 'aggressive';
    if (isFast && !isMinor) return 'euphoric';
    if (isMid && isMinor) return 'intense';
    if (isMid && !isMinor) return 'happy';
    return 'intense';
  }

  if (energy === 'medium') {
    if (isMinor && isSlow) return 'melancholic';
    if (isMinor && isMid) return 'dark';
    if (!isMinor && isSlow) return 'dreamy';
    if (!isMinor && isMid) return 'happy';
    if (isFast && isMinor) return 'dark';
    return 'happy';
  }

  // low energy
  if (isMinor) return isSlow ? 'melancholic' : 'dark';
  return isSlow ? 'chill' : 'dreamy';
}
