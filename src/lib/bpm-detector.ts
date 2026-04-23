/**
 * BPM Detection Engine
 * Uses Vamp SDK "Fixed Tempo Estimator" algorithm reimplemented in TS.
 * Always re-analyzes audio (ignores existing ID3 TBPM tag) and writes
 * the result back to the tag for DiscDJ compatibility.
 */

export interface BpmResult {
  bpm: number;
  duration: number;
  source: 'tag' | 'analyzed';
}

/**
 * Write BPM to ID3 TBPM tag using browser-id3-writer
 */
export async function writeBpmTag(arrayBuffer: ArrayBuffer, bpm: number): Promise<ArrayBuffer> {
  try {
    const { ID3Writer } = await import('browser-id3-writer');
    const writer = new (ID3Writer as any)(arrayBuffer);
    writer.setFrame('TBPM', String(Math.round(bpm)));
    writer.addTag();
    return writer.arrayBuffer as ArrayBuffer;
  } catch (e) {
    console.warn('Failed to write ID3 BPM tag:', e);
    return arrayBuffer;
  }
}

/**
 * Detect BPM from a File object (web path)
 */
export async function detectBpm(file: File): Promise<BpmResult> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const duration = audioBuffer.duration;

    // Always run Fixed Tempo Estimator (ignore any existing ID3 tag)
    const bpm = analyzeTempoFallback(audioBuffer);

    // Write BPM back to tag (best-effort, non-blocking)
    writeBpmTag(arrayBuffer.slice(0), bpm).catch(() => {});

    return { bpm, duration, source: 'analyzed' };
  } finally {
    await audioContext.close();
  }
}

/**
 * Detect BPM from an ArrayBuffer (native/SAF path)
 */
export async function detectBpmFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<BpmResult> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const duration = audioBuffer.duration;

    // Always run Fixed Tempo Estimator (ignore any existing ID3 tag)
    const bpm = analyzeTempoFallback(audioBuffer);

    // Write BPM back to tag (best-effort, non-blocking)
    writeBpmTag(arrayBuffer.slice(0), bpm).catch(() => {});

    return { bpm, duration, source: 'analyzed' };
  } finally {
    await audioContext.close();
  }
}

/**
 * Fixed Tempo Estimator (Vamp SDK compatible)
 *
 * Steps:
 *  1. Mono PCM → STFT (window 2048, hop 512)
 *  2. Spectral flux onset detection (half-wave rectified)
 *  3. Autocorrelation of onset function
 *  4. Peak search in 60-180 BPM range with 120 BPM preference weighting
 *  5. Return integer BPM
 */
function analyzeTempoFallback(audioBuffer: AudioBuffer): number {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  return fixedTempoEstimator(channelData, sampleRate);
}

function fixedTempoEstimator(data: Float32Array, sampleRate: number): number {
  const windowSize = 2048;
  const hopSize = 512;
  const numBins = windowSize / 2 + 1; // 1025

  // --- Step 1 & 2: STFT + Spectral Flux ---
  const numFrames = Math.floor((data.length - windowSize) / hopSize);
  if (numFrames < 2) return 120;

  // Hann window
  const hannWindow = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
  }

  // Compute magnitude spectra frame by frame, build spectral flux
  let prevMagnitudes = new Float32Array(numBins);
  const onsetFunction = new Float32Array(numFrames);

  // Reusable buffers
  const real = new Float32Array(windowSize);
  const imag = new Float32Array(windowSize);

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize;

    // Apply window
    for (let i = 0; i < windowSize; i++) {
      real[i] = data[offset + i] * hannWindow[i];
      imag[i] = 0;
    }

    // In-place FFT
    fftInPlace(real, imag, windowSize);

    // Compute magnitudes and spectral flux (half-wave rectified)
    let flux = 0;
    for (let bin = 0; bin < numBins; bin++) {
      const mag = Math.sqrt(real[bin] * real[bin] + imag[bin] * imag[bin]);
      const diff = mag - prevMagnitudes[bin];
      if (diff > 0) flux += diff; // half-wave rectification
      prevMagnitudes[bin] = mag;
    }
    onsetFunction[frame] = flux;
  }

  // --- Step 3: Autocorrelation of onset function ---
  const onsetRate = sampleRate / hopSize; // frames per second
  const minBpm = 60;
  const maxBpm = 180;
  const minLag = Math.floor((60 / maxBpm) * onsetRate);
  const maxLag = Math.min(
    Math.floor((60 / minBpm) * onsetRate),
    numFrames - 1
  );

  if (minLag >= maxLag) return 120;

  // Normalize onset function (zero-mean)
  let mean = 0;
  for (let i = 0; i < numFrames; i++) mean += onsetFunction[i];
  mean /= numFrames;
  for (let i = 0; i < numFrames; i++) onsetFunction[i] -= mean;

  const acf = new Float32Array(maxLag + 1);
  const corrLen = numFrames;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < corrLen - lag; i++) {
      sum += onsetFunction[i] * onsetFunction[i + lag];
    }
    acf[lag] = sum / (corrLen - lag);
  }

  // --- Step 4 & 5: Peak search with tempo preference weighting ---
  // Gaussian weighting centered at 120 BPM (sigma ~40 BPM)
  let bestLag = minLag;
  let bestVal = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpmAtLag = (60 * onsetRate) / lag;
    // Gaussian preference: peak at 120 BPM, sigma=40
    const diff = bpmAtLag - 120;
    const weight = Math.exp(-(diff * diff) / (2 * 40 * 40));

    // Also boost integer multiples/sub-multiples for consistency
    const halfLag = lag * 2;
    let harmonicBoost = 1.0;
    if (halfLag <= maxLag && acf[halfLag] > 0) {
      harmonicBoost = 1.05;
    }

    const weighted = acf[lag] * weight * harmonicBoost;
    if (weighted > bestVal) {
      bestVal = weighted;
      bestLag = lag;
    }
  }

  const rawBpm = (60 * onsetRate) / bestLag;
  // Return integer BPM as DiscDJ does
  return Math.round(rawBpm);
}

// ============= Radix-2 Cooley-Tukey FFT (in-place) =============

function fftInPlace(real: Float32Array, imag: Float32Array, n: number): void {
  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      let tmp = real[i]; real[i] = real[j]; real[j] = tmp;
      tmp = imag[i]; imag[i] = imag[j]; imag[j] = tmp;
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }

  // Butterfly stages
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angleStep = -2 * Math.PI / size;
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < halfSize; k++) {
        const angle = angleStep * k;
        const twiddleRe = Math.cos(angle);
        const twiddleIm = Math.sin(angle);
        const evenIdx = i + k;
        const oddIdx = i + k + halfSize;
        const tRe = twiddleRe * real[oddIdx] - twiddleIm * imag[oddIdx];
        const tIm = twiddleRe * imag[oddIdx] + twiddleIm * real[oddIdx];
        real[oddIdx] = real[evenIdx] - tRe;
        imag[oddIdx] = imag[evenIdx] - tIm;
        real[evenIdx] += tRe;
        imag[evenIdx] += tIm;
      }
    }
  }
}
