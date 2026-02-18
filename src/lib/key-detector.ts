/**
 * Musical Key Detection Engine — Optimized
 * Uses radix-2 Cooley-Tukey FFT with Krumhansl-Schmuckler key-finding algorithm
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Kessler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export interface KeyResult {
  key: string;
  camelot: string;
  confidence: number;
  root: string;
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

    // Use 15s from the middle (enough for key, much faster)
    const totalSamples = channelData.length;
    const analysisLength = Math.min(totalSamples, sampleRate * 15);
    const startOffset = Math.floor(Math.max(0, (totalSamples - analysisLength) / 2));
    const segment = channelData.slice(startOffset, startOffset + analysisLength);

    const chromagram = computeChromagram(segment, sampleRate);
    return findKey(chromagram);
  } finally {
    await audioContext.close();
  }
}

// ── Radix-2 Cooley-Tukey FFT (in-place) ──────────────────────────────

function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
      tmp = im[i]; im[i] = im[j]; im[j] = tmp;
    }
  }
  // Butterfly stages
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = -2 * Math.PI / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < halfLen; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + halfLen] * curRe - im[i + j + halfLen] * curIm;
        const vIm = re[i + j + halfLen] * curIm + im[i + j + halfLen] * curRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + halfLen] = uRe - vRe;
        im[i + j + halfLen] = uIm - vIm;
        const newCurRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = newCurRe;
      }
    }
  }
}

// ── Chroma computation ────────────────────────────────────────────────

function computeChromagram(data: Float32Array, sampleRate: number): Float32Array {
  const chroma = new Float32Array(12);
  const fftSize = 4096; // smaller = faster, still good resolution at 44.1k
  const hopSize = 2048;
  const numFrames = Math.floor((data.length - fftSize) / hopSize);

  if (numFrames <= 0) {
    const paddedSize = nextPow2(Math.min(data.length, fftSize));
    accumulateChromaFFT(data.slice(0, paddedSize), sampleRate, paddedSize, chroma);
    normalizeChroma(chroma);
    return chroma;
  }

  // Pre-compute Hanning window
  const window = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
  }

  // Pre-compute bin → chroma index mapping
  const maxFreq = 5000;
  const maxBin = Math.min(Math.ceil(maxFreq * fftSize / sampleRate), fftSize / 2);
  const binChroma = new Int8Array(maxBin);
  binChroma.fill(-1);
  for (let k = 1; k < maxBin; k++) {
    const freq = (k * sampleRate) / fftSize;
    if (freq < 65 || freq > 4200) continue;
    const midi = 69 + 12 * Math.log2(freq / 440);
    const idx = ((Math.round(midi) % 12) + 12) % 12;
    binChroma[k] = idx;
  }

  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    // Apply window and copy into re, zero im
    for (let i = 0; i < fftSize; i++) {
      re[i] = data[start + i] * window[i];
      im[i] = 0;
    }
    fft(re, im);

    // Accumulate chroma from magnitudes squared
    for (let k = 1; k < maxBin; k++) {
      const ci = binChroma[k];
      if (ci >= 0) {
        chroma[ci] += re[k] * re[k] + im[k] * im[k];
      }
    }
  }

  normalizeChroma(chroma);
  return chroma;
}

function accumulateChromaFFT(data: Float32Array, sampleRate: number, size: number, chroma: Float32Array): void {
  const n = nextPow2(size);
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < data.length && i < n; i++) {
    re[i] = data[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  fft(re, im);

  const maxBin = Math.min(Math.ceil(5000 * n / sampleRate), n / 2);
  for (let k = 1; k < maxBin; k++) {
    const freq = (k * sampleRate) / n;
    if (freq < 65 || freq > 4200) continue;
    const midi = 69 + 12 * Math.log2(freq / 440);
    const idx = ((Math.round(midi) % 12) + 12) % 12;
    chroma[idx] += re[k] * re[k] + im[k] * im[k];
  }
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function normalizeChroma(chroma: Float32Array): void {
  let max = 0;
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > max) max = chroma[i];
  }
  if (max > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= max;
  }
}

// ── Key finding ───────────────────────────────────────────────────────

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

  const confidence = Math.min(1, Math.max(0, (bestCorr - secondBest) / Math.abs(bestCorr + 0.001)));
  const rootName = NOTE_NAMES[bestRoot];
  const key = `${rootName} ${bestMode}`;
  const camelot = toCamelot(bestRoot, bestMode);

  return { key, camelot, confidence, root: rootName, mode: bestMode };
}

function correlate(chroma: Float32Array, profile: number[], root: number): number {
  let sum = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < 12; i++) {
    const x = chroma[(i + root) % 12];
    const y = profile[i];
    sum += x * y;
    sumX += x;
    sumY += y;
    sumX2 += x * x;
    sumY2 += y * y;
  }
  const num = 12 * sum - sumX * sumY;
  const den = Math.sqrt((12 * sumX2 - sumX * sumX) * (12 * sumY2 - sumY * sumY));
  return den === 0 ? 0 : num / den;
}

// ── Camelot Wheel ─────────────────────────────────────────────────────

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
