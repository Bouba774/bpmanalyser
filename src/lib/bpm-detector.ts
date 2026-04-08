/**
 * BPM Detection Engine
 * 1. Reads BPM from ID3 TBPM tag (priority)
 * 2. Falls back to essentia.js RhythmExtractor2013
 * 3. Falls back to multi-pass autocorrelation
 * 4. Writes detected BPM back to ID3 tag
 */

import * as mm from 'music-metadata-browser';

export interface BpmResult {
  bpm: number;
  duration: number;
  source: 'tag' | 'analyzed';
}

/**
 * Try to load essentia.js dynamically. Returns null if unavailable.
 */
let essentiaInstance: any = null;
let essentiaLoading: Promise<any> | null = null;

async function getEssentia(): Promise<any> {
  if (essentiaInstance) return essentiaInstance;
  if (essentiaLoading) return essentiaLoading;

  essentiaLoading = (async () => {
    try {
      const [{ default: Essentia }, { EssentiaWASM }] = await Promise.all([
        import('essentia.js/dist/essentia.js-core.es.js'),
        import('essentia.js/dist/essentia-wasm.web.js'),
      ]);
      essentiaInstance = new Essentia(EssentiaWASM);
      return essentiaInstance;
    } catch (e) {
      console.warn('Essentia.js unavailable, using fallback BPM detection:', e);
      return null;
    }
  })();

  return essentiaLoading;
}

// Pre-load essentia on module import
getEssentia();

/**
 * Read BPM from ID3 TBPM tag
 */
async function readBpmFromTag(blob: Blob): Promise<number | null> {
  try {
    const metadata = await mm.parseBlob(blob);
    const bpm = metadata.common.bpm;
    if (bpm && bpm > 0) {
      return Math.round(bpm * 10) / 10;
    }
    return null;
  } catch {
    return null;
  }
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
  // Step 1: Try ID3 tag
  const tagBpm = await readBpmFromTag(file);

  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const duration = audioBuffer.duration;

    if (tagBpm) {
      return { bpm: tagBpm, duration, source: 'tag' };
    }

    // Step 2: Try essentia.js
    const bpm = await detectBpmWithEssentia(audioBuffer) ?? analyzeTempoFallback(audioBuffer);

    // Step 3: Write BPM back to tag (best-effort, non-blocking)
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
  // Step 1: Try ID3 tag
  const blob = new Blob([arrayBuffer]);
  const tagBpm = await readBpmFromTag(blob);

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const duration = audioBuffer.duration;

    if (tagBpm) {
      return { bpm: tagBpm, duration, source: 'tag' };
    }

    // Step 2: Try essentia.js
    const bpm = await detectBpmWithEssentia(audioBuffer) ?? analyzeTempoFallback(audioBuffer);

    // Step 3: Write BPM back to tag
    writeBpmTag(arrayBuffer.slice(0), bpm).catch(() => {});

    return { bpm, duration, source: 'analyzed' };
  } finally {
    await audioContext.close();
  }
}

/**
 * Use essentia.js RhythmExtractor2013 for BPM detection
 */
async function detectBpmWithEssentia(audioBuffer: AudioBuffer): Promise<number | null> {
  try {
    const essentia = await getEssentia();
    if (!essentia) return null;

    // Get mono channel data
    const channelData = audioBuffer.getChannelData(0);

    // Create essentia vector from channel data
    const signal = essentia.arrayToVector(channelData);

    // Use RhythmExtractor2013
    const result = essentia.RhythmExtractor2013(signal);
    const bpm = result.bpm;

    if (bpm && bpm > 0) {
      // Normalize to DJ range
      let normalized = bpm;
      if (normalized < 60) normalized *= 2;
      if (normalized > 200) normalized /= 2;
      return Math.round(normalized * 10) / 10;
    }
    return null;
  } catch (e) {
    console.warn('Essentia BPM detection failed:', e);
    return null;
  }
}

/**
 * Fallback: multi-pass autocorrelation BPM detection
 */
function analyzeTempoFallback(audioBuffer: AudioBuffer): number {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  return analyzeTempo(channelData, sampleRate);
}

// ============= Original multi-pass fallback algorithm =============

function analyzeTempo(data: Float32Array, sampleRate: number): number {
  const results: number[] = [];
  results.push(singlePassTempo(data, sampleRate, 200));
  results.push(singlePassTempo(data, sampleRate, 150));
  results.push(singlePassTempo(data, sampleRate, 300));

  const median = results.sort((a, b) => a - b)[Math.floor(results.length / 2)];
  const agreeing = results.filter(r => Math.abs(r - median) <= 10 || Math.abs(r * 2 - median) <= 10 || Math.abs(r - median * 2) <= 10);

  const bpm = agreeing.length > 0
    ? agreeing.reduce((s, v) => s + v, 0) / agreeing.length
    : median;

  return Math.round(bpm * 10) / 10;
}

function singlePassTempo(data: Float32Array, sampleRate: number, cutoff: number): number {
  const filtered = lowPassFilter(data, sampleRate, cutoff);
  const hopSize = Math.floor(sampleRate * 0.01);
  const windowSize = Math.floor(sampleRate * 0.02);
  const envelope = getEnergyEnvelope(filtered, windowSize, hopSize);

  const onsetSignal = new Float32Array(envelope.length);
  for (let i = 1; i < envelope.length; i++) {
    onsetSignal[i] = Math.max(0, envelope[i] - envelope[i - 1]);
  }

  const envelopeSampleRate = sampleRate / hopSize;
  const minBpm = 60;
  const maxBpm = 200;
  const minLag = Math.floor((60 / maxBpm) * envelopeSampleRate);
  const maxLag = Math.floor((60 / minBpm) * envelopeSampleRate);

  const correlations = new Float32Array(maxLag + 1);
  const len = Math.min(onsetSignal.length, Math.floor(envelopeSampleRate * 30));

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < len - lag; i++) {
      sum += onsetSignal[i] * onsetSignal[i + lag];
      count++;
    }
    correlations[lag] = count > 0 ? sum / count : 0;
  }

  let bestLag = minLag;
  let bestVal = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpmAtLag = (60 * envelopeSampleRate) / lag;
    let weight = 1;
    if (bpmAtLag >= 90 && bpmAtLag <= 150) weight = 1.15;
    if (bpmAtLag >= 100 && bpmAtLag <= 140) weight = 1.3;
    if (bpmAtLag >= 115 && bpmAtLag <= 135) weight = 1.5;

    const halfLag = lag * 2;
    if (halfLag <= maxLag && correlations[halfLag] > 0) {
      weight *= 1.1;
    }

    const weighted = correlations[lag] * weight;
    if (weighted > bestVal) {
      bestVal = weighted;
      bestLag = lag;
    }
  }

  const rawBpm = (60 * envelopeSampleRate) / bestLag;
  let bpm = rawBpm;
  if (bpm < 80 && bpm * 2 <= 200) bpm *= 2;
  if (bpm > 160 && bpm / 2 >= 60) bpm /= 2;

  return Math.round(bpm * 10) / 10;
}

function lowPassFilter(data: Float32Array, sampleRate: number, cutoff: number): Float32Array {
  const rc = 1.0 / (cutoff * 2 * Math.PI);
  const dt = 1.0 / sampleRate;
  const alpha = dt / (rc + dt);

  const filtered = new Float32Array(data.length);
  filtered[0] = data[0];

  for (let i = 1; i < data.length; i++) {
    filtered[i] = filtered[i - 1] + alpha * (data[i] - filtered[i - 1]);
  }

  return filtered;
}

function getEnergyEnvelope(data: Float32Array, windowSize: number, hopSize: number): Float32Array {
  const numFrames = Math.floor((data.length - windowSize) / hopSize);
  const envelope = new Float32Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    let sum = 0;
    for (let j = start; j < start + windowSize && j < data.length; j++) {
      sum += data[j] * data[j];
    }
    envelope[i] = Math.sqrt(sum / windowSize);
  }

  return envelope;
}
