/**
 * BPM Detection Engine
 * Uses Web Audio API with autocorrelation-based tempo detection
 */

export async function detectBpm(file: File): Promise<{ bpm: number; duration: number }> {
  const arrayBuffer = await file.arrayBuffer();
  return detectBpmFromArrayBuffer(arrayBuffer);
}

export async function detectBpmFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<{ bpm: number; duration: number }> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    
    // Get mono channel data
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    const bpm = analyzeTempo(channelData, sampleRate);
    
    return { bpm, duration };
  } finally {
    await audioContext.close();
  }
}

function analyzeTempo(data: Float32Array, sampleRate: number): number {
  // Multi-pass detection with different filter settings for reliability
  const results: number[] = [];

  // Pass 1: Standard low-pass at 200Hz
  results.push(singlePassTempo(data, sampleRate, 200));

  // Pass 2: Lower cutoff at 150Hz (more bass-focused)
  results.push(singlePassTempo(data, sampleRate, 150));

  // Pass 3: Higher cutoff at 300Hz (captures snares)
  results.push(singlePassTempo(data, sampleRate, 300));

  // Average results that are within reasonable agreement
  const median = results.sort((a, b) => a - b)[Math.floor(results.length / 2)];
  const agreeing = results.filter(r => Math.abs(r - median) <= 10 || Math.abs(r * 2 - median) <= 10 || Math.abs(r - median * 2) <= 10);

  const bpm = agreeing.length > 0
    ? agreeing.reduce((s, v) => s + v, 0) / agreeing.length
    : median;

  return Math.round(bpm * 10) / 10;
}

function singlePassTempo(data: Float32Array, sampleRate: number, cutoff: number): number {
  // Low-pass filter the signal to focus on beats
  const filtered = lowPassFilter(data, sampleRate, cutoff);
  
  // Get energy envelope
  const hopSize = Math.floor(sampleRate * 0.01); // 10ms hops
  const windowSize = Math.floor(sampleRate * 0.02); // 20ms window
  const envelope = getEnergyEnvelope(filtered, windowSize, hopSize);
  
  // Differentiate to find onsets
  const onsetSignal = new Float32Array(envelope.length);
  for (let i = 1; i < envelope.length; i++) {
    onsetSignal[i] = Math.max(0, envelope[i] - envelope[i - 1]);
  }
  
  // Autocorrelation to find periodicity
  const envelopeSampleRate = sampleRate / hopSize;
  const minBpm = 60;
  const maxBpm = 200;
  const minLag = Math.floor((60 / maxBpm) * envelopeSampleRate);
  const maxLag = Math.floor((60 / minBpm) * envelopeSampleRate);
  
  const correlations = new Float32Array(maxLag + 1);
  const len = Math.min(onsetSignal.length, Math.floor(envelopeSampleRate * 30)); // use max 30s
  
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < len - lag; i++) {
      sum += onsetSignal[i] * onsetSignal[i + lag];
      count++;
    }
    correlations[lag] = count > 0 ? sum / count : 0;
  }
  
  // Find peaks in autocorrelation
  let bestLag = minLag;
  let bestVal = 0;
  
  for (let lag = minLag; lag <= maxLag; lag++) {
    // Weight towards common DJ tempos (100-140 BPM range)
    const bpmAtLag = (60 * envelopeSampleRate) / lag;
    let weight = 1;
    if (bpmAtLag >= 90 && bpmAtLag <= 150) weight = 1.15;
    if (bpmAtLag >= 100 && bpmAtLag <= 140) weight = 1.3;
    if (bpmAtLag >= 115 && bpmAtLag <= 135) weight = 1.5;
    
    // Also check for sub-harmonics (half tempo confirmation)
    const halfLag = lag * 2;
    if (halfLag <= maxLag && correlations[halfLag] > 0) {
      // If half-tempo also has a peak, boost confidence
      weight *= 1.1;
    }
    
    const weighted = correlations[lag] * weight;
    if (weighted > bestVal) {
      bestVal = weighted;
      bestLag = lag;
    }
  }
  
  // Check for half/double time
  const rawBpm = (60 * envelopeSampleRate) / bestLag;
  
  // Prefer BPM in 80-160 range
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
