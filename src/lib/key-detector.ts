/**
 * Key Detection Engine
 * Uses chromagram analysis with Krumhansl-Kessler key profiles
 */

import { MusicalKey, KeyMode } from './audio-types';

// Krumhansl-Kessler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const NOTE_NAMES: MusicalKey[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function detectKey(channelData: Float32Array, sampleRate: number): { key: MusicalKey; mode: KeyMode } {
  const chromagram = computeChromagram(channelData, sampleRate);
  return matchKeyProfile(chromagram);
}

function computeChromagram(data: Float32Array, sampleRate: number): number[] {
  const fftSize = 8192;
  const chromagram = new Array(12).fill(0);
  const numFrames = Math.floor(data.length / fftSize);
  const maxFrames = Math.min(numFrames, 300); // Limit for performance

  for (let frame = 0; frame < maxFrames; frame++) {
    const offset = frame * fftSize;
    const segment = data.slice(offset, offset + fftSize);
    
    // Apply Hanning window
    const windowed = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      windowed[i] = segment[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }
    
    // Simple DFT for relevant frequency bins (A1=55Hz to C8=4186Hz)
    const minBin = Math.floor(55 * fftSize / sampleRate);
    const maxBin = Math.min(Math.floor(4200 * fftSize / sampleRate), fftSize / 2);
    
    const magnitudes = new Float32Array(maxBin + 1);
    for (let k = minBin; k <= maxBin; k++) {
      let re = 0, im = 0;
      // Subsample for speed
      const step = 4;
      for (let n = 0; n < fftSize; n += step) {
        const angle = (2 * Math.PI * k * n) / fftSize;
        re += windowed[n] * Math.cos(angle);
        im -= windowed[n] * Math.sin(angle);
      }
      magnitudes[k] = Math.sqrt(re * re + im * im);
    }
    
    // Map to pitch classes
    for (let k = minBin; k <= maxBin; k++) {
      const freq = (k * sampleRate) / fftSize;
      if (freq < 50 || freq > 4200) continue;
      const midi = 12 * Math.log2(freq / 440) + 69;
      const pitchClass = Math.round(midi) % 12;
      if (pitchClass >= 0 && pitchClass < 12) {
        chromagram[pitchClass] += magnitudes[k];
      }
    }
  }

  // Normalize
  const max = Math.max(...chromagram);
  if (max > 0) {
    for (let i = 0; i < 12; i++) chromagram[i] /= max;
  }

  return chromagram;
}

function matchKeyProfile(chromagram: number[]): { key: MusicalKey; mode: KeyMode } {
  let bestKey = 0;
  let bestMode: KeyMode = 'major';
  let bestCorr = -Infinity;

  for (let shift = 0; shift < 12; shift++) {
    const rotated = rotate(chromagram, shift);
    
    const corrMajor = pearsonCorrelation(rotated, MAJOR_PROFILE);
    const corrMinor = pearsonCorrelation(rotated, MINOR_PROFILE);
    
    if (corrMajor > bestCorr) {
      bestCorr = corrMajor;
      bestKey = shift;
      bestMode = 'major';
    }
    if (corrMinor > bestCorr) {
      bestCorr = corrMinor;
      bestKey = shift;
      bestMode = 'minor';
    }
  }

  return { key: NOTE_NAMES[bestKey], mode: bestMode };
}

function rotate(arr: number[], shift: number): number[] {
  const result = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    result[i] = arr[(i + shift) % arr.length];
  }
  return result;
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}
