/**
 * Musical Key Detection Engine
 * Uses FFT-based Chroma Vector analysis with Krumhansl-Schmuckler key-finding algorithm
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Kessler key profiles (empirically derived)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export interface KeyResult {
  key: string;        // e.g. "F# minor"
  camelot: string;    // e.g. "11A"
  confidence: number; // 0-1
  root: string;       // e.g. "F#"
  mode: 'major' | 'minor';
}

export async function detectKey(file: File): Promise<KeyResult> {
  const arrayBuffer = await file.arrayBuffer();
  return detectKeyFromArrayBuffer(arrayBuffer);
}

export async function detectKeyFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<KeyResult> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Use middle section for better key detection (avoid intros/outros)
    const totalSamples = channelData.length;
    const analysisLength = Math.min(totalSamples, sampleRate * 30); // max 30s
    const startOffset = Math.floor(Math.max(0, (totalSamples - analysisLength) / 2));
    const segment = channelData.slice(startOffset, startOffset + analysisLength);

    const chromagram = computeChromagram(segment, sampleRate);
    return findKey(chromagram);
  } finally {
    await audioContext.close();
  }
}

function computeChromagram(data: Float32Array, sampleRate: number): Float32Array {
  const chroma = new Float32Array(12);

  // FFT parameters
  const fftSize = 8192;
  const hopSize = 4096;
  const numFrames = Math.floor((data.length - fftSize) / hopSize);

  if (numFrames <= 0) {
    // Very short audio — do single-frame analysis
    const frame = data.slice(0, Math.min(data.length, fftSize));
    accumulateChroma(frame, sampleRate, fftSize, chroma);
    normalizeChroma(chroma);
    return chroma;
  }

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    const frame = data.slice(start, start + fftSize);
    accumulateChroma(frame, sampleRate, fftSize, chroma);
  }

  normalizeChroma(chroma);
  return chroma;
}

function accumulateChroma(frame: Float32Array, sampleRate: number, fftSize: number, chroma: Float32Array): void {
  // Apply Hanning window
  const windowed = new Float32Array(fftSize);
  for (let i = 0; i < fftSize && i < frame.length; i++) {
    windowed[i] = frame[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  // Compute magnitude spectrum via DFT (only positive frequencies)
  // For performance, we compute only the bins we need (up to ~5kHz for harmonic content)
  const maxFreq = 5000;
  const maxBin = Math.min(Math.ceil(maxFreq * fftSize / sampleRate), fftSize / 2);

  const magnitudes = new Float32Array(maxBin);
  for (let k = 1; k < maxBin; k++) {
    let re = 0, im = 0;
    // Downsample the DFT computation for performance
    const step = Math.max(1, Math.floor(fftSize / 2048));
    for (let n = 0; n < fftSize; n += step) {
      const angle = (2 * Math.PI * k * n) / fftSize;
      re += windowed[n] * Math.cos(angle);
      im -= windowed[n] * Math.sin(angle);
    }
    magnitudes[k] = Math.sqrt(re * re + im * im);
  }

  // Map frequency bins to chroma
  for (let k = 1; k < maxBin; k++) {
    const freq = (k * sampleRate) / fftSize;
    if (freq < 65 || freq > 4200) continue; // C2 to C8 range

    // Convert frequency to MIDI note, then to chroma
    const midi = 69 + 12 * Math.log2(freq / 440);
    const chromaIndex = Math.round(midi) % 12;
    if (chromaIndex >= 0 && chromaIndex < 12) {
      chroma[chromaIndex] += magnitudes[k] * magnitudes[k]; // Use energy (squared magnitude)
    }
  }
}

function normalizeChroma(chroma: Float32Array): void {
  let max = 0;
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > max) max = chroma[i];
  }
  if (max > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= max;
    }
  }
}

function findKey(chroma: Float32Array): KeyResult {
  let bestCorr = -Infinity;
  let bestRoot = 0;
  let bestMode: 'major' | 'minor' = 'major';
  let secondBest = -Infinity;

  for (let root = 0; root < 12; root++) {
    const majorCorr = correlate(chroma, MAJOR_PROFILE, root);
    const minorCorr = correlate(chroma, MINOR_PROFILE, root);

    if (majorCorr > bestCorr) {
      secondBest = bestCorr;
      bestCorr = majorCorr;
      bestRoot = root;
      bestMode = 'major';
    } else if (majorCorr > secondBest) {
      secondBest = majorCorr;
    }

    if (minorCorr > bestCorr) {
      secondBest = bestCorr;
      bestCorr = minorCorr;
      bestRoot = root;
      bestMode = 'minor';
    } else if (minorCorr > secondBest) {
      secondBest = minorCorr;
    }
  }

  // Confidence: difference between best and second-best correlation
  const confidence = Math.min(1, Math.max(0, (bestCorr - secondBest) / Math.abs(bestCorr + 0.001)));

  const rootName = NOTE_NAMES[bestRoot];
  const key = `${rootName} ${bestMode}`;
  const camelot = toCamelot(bestRoot, bestMode);

  return { key, camelot, confidence, root: rootName, mode: bestMode };
}

function correlate(chroma: Float32Array, profile: number[], root: number): number {
  let sum = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;
  const n = 12;

  for (let i = 0; i < n; i++) {
    const x = chroma[(i + root) % 12];
    const y = profile[i];
    sum += x * y;
    sumX += x;
    sumY += y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const num = n * sum - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return den === 0 ? 0 : num / den;
}

// Camelot Wheel mapping
const CAMELOT_MAP: Record<string, string> = {
  'C major': '8B', 'G major': '9B', 'D major': '10B', 'A major': '11B',
  'E major': '12B', 'B major': '1B', 'F# major': '2B', 'C# major': '3B',
  'G# major': '4B', 'D# major': '5B', 'A# major': '6B', 'F major': '7B',
  'A minor': '8A', 'E minor': '9A', 'B minor': '10A', 'F# minor': '11A',
  'C# minor': '12A', 'G# minor': '1A', 'D# minor': '2A', 'A# minor': '3A',
  'F minor': '4A', 'C minor': '5A', 'G minor': '6A', 'D minor': '7A',
};

function toCamelot(root: number, mode: 'major' | 'minor'): string {
  const key = `${NOTE_NAMES[root]} ${mode}`;
  return CAMELOT_MAP[key] || '?';
}

export function getCamelotFromKey(key: string): string {
  return CAMELOT_MAP[key] || '?';
}
