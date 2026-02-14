/**
 * Genre Detection Engine
 * Heuristic genre estimation from BPM, energy and spectral characteristics
 */

import { EnergyLevel, GenreTag } from './audio-types';

export function detectGenre(bpm: number, energy: EnergyLevel): GenreTag {
  // BPM-based heuristics with energy refinement
  if (bpm < 85) {
    if (energy === 'low') return 'ambient';
    if (energy === 'medium') return 'hip-hop';
    return 'hip-hop';
  }
  
  if (bpm >= 85 && bpm < 100) {
    if (energy === 'low') return 'ambient';
    if (energy === 'medium') return 'hip-hop';
    return 'pop';
  }
  
  if (bpm >= 100 && bpm < 115) {
    if (energy === 'high') return 'rock';
    return 'pop';
  }
  
  if (bpm >= 115 && bpm < 130) {
    if (energy === 'high') return 'house';
    if (energy === 'medium') return 'house';
    return 'pop';
  }
  
  if (bpm >= 130 && bpm < 140) {
    if (energy === 'high') return 'techno';
    return 'trance';
  }
  
  if (bpm >= 140 && bpm < 160) {
    if (energy === 'high') return 'techno';
    return 'trance';
  }
  
  if (bpm >= 160 && bpm < 180) {
    return energy === 'high' ? 'dnb' : 'dubstep';
  }
  
  return 'dnb';
}
