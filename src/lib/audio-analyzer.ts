/**
 * Master Audio Analyzer
 * Orchestrates all analysis engines for a single file
 */

import { AnalysisResult } from './audio-types';
import { detectKey } from './key-detector';
import { detectEnergy } from './energy-detector';
import { detectMood } from './mood-detector';
import { detectGenre } from './genre-detector';
import { getCamelotCode } from './camelot';

export async function analyzeAudioFile(file: File): Promise<AnalysisResult> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // BPM detection (reuse existing logic inline)
    const bpm = analyzeTempo(channelData, sampleRate);

    // Key detection
    const { key, mode } = detectKey(channelData, sampleRate);
    const camelot = getCamelotCode(key, mode);

    // Energy detection
    const energy = detectEnergy(channelData, sampleRate);

    // Mood detection (heuristic)
    const mood = detectMood(bpm, energy, mode);

    // Genre detection (heuristic)
    const genre = detectGenre(bpm, energy);

    return { bpm, duration, key, mode, camelot, energy, mood, genre };
  } finally {
    await audioContext.close();
  }
}

// Inlined BPM analysis (from bpm-detector.ts)
function analyzeTempo(data: Float32Array, sampleRate: number): number {
  const rc = 1.0 / (200 * 2 * Math.PI);
  const dt = 1.0 / sampleRate;
  const alpha = dt / (rc + dt);
  const filtered = new Float32Array(data.length);
  filtered[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    filtered[i] = filtered[i - 1] + alpha * (data[i] - filtered[i - 1]);
  }

  const hopSize = Math.floor(sampleRate * 0.01);
  const windowSize = Math.floor(sampleRate * 0.02);
  const numFrames = Math.floor((filtered.length - windowSize) / hopSize);
  const envelope = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    let sum = 0;
    for (let j = start; j < start + windowSize && j < filtered.length; j++) {
      sum += filtered[j] * filtered[j];
    }
    envelope[i] = Math.sqrt(sum / windowSize);
  }

  const onsetSignal = new Float32Array(envelope.length);
  for (let i = 1; i < envelope.length; i++) {
    onsetSignal[i] = Math.max(0, envelope[i] - envelope[i - 1]);
  }

  const envelopeSampleRate = sampleRate / hopSize;
  const minLag = Math.floor((60 / 200) * envelopeSampleRate);
  const maxLag = Math.floor((60 / 60) * envelopeSampleRate);
  const correlations = new Float32Array(maxLag + 1);
  const len = Math.min(onsetSignal.length, Math.floor(envelopeSampleRate * 30));

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0, count = 0;
    for (let i = 0; i < len - lag; i++) {
      sum += onsetSignal[i] * onsetSignal[i + lag];
      count++;
    }
    correlations[lag] = count > 0 ? sum / count : 0;
  }

  let bestLag = minLag, bestVal = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpmAtLag = (60 * envelopeSampleRate) / lag;
    let weight = 1;
    if (bpmAtLag >= 100 && bpmAtLag <= 140) weight = 1.2;
    if (bpmAtLag >= 115 && bpmAtLag <= 135) weight = 1.4;
    const weighted = correlations[lag] * weight;
    if (weighted > bestVal) { bestVal = weighted; bestLag = lag; }
  }

  let bpm = (60 * envelopeSampleRate) / bestLag;
  if (bpm < 80 && bpm * 2 <= 200) bpm *= 2;
  if (bpm > 160 && bpm / 2 >= 60) bpm /= 2;
  return Math.round(bpm * 10) / 10;
}
