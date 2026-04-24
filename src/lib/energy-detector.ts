/**
 * Audio Energy Detector
 * Computes a perceptual "energy" score (0–10) from a decoded audio buffer.
 *
 * Combines:
 *  - RMS loudness (overall power)
 *  - Spectral centroid (brightness)
 *  - Onset density / attack rate (rhythmic intensity)
 */

export type EnergyLevel = 'chill' | 'medium' | 'high' | 'peak';

export interface EnergyResult {
  energy: number;       // 0–10 score
  level: EnergyLevel;
  rms: number;          // 0–1
  brightness: number;   // 0–1 (normalized spectral centroid)
}

/**
 * Analyze energy from a Float32Array PCM mono channel.
 * Returns a 0–10 score.
 */
export function analyzeEnergy(channelData: Float32Array, sampleRate: number): EnergyResult {
  // Take a 30s window from the middle for perceptual stability
  const windowSec = 30;
  const total = channelData.length;
  const windowLen = Math.min(total, sampleRate * windowSec);
  const start = Math.max(0, Math.floor((total - windowLen) / 2));
  const segment = channelData.subarray(start, start + windowLen);

  // ── RMS loudness ──
  let sumSq = 0;
  for (let i = 0; i < segment.length; i++) sumSq += segment[i] * segment[i];
  const rms = Math.sqrt(sumSq / segment.length);

  // ── Spectral brightness (lightweight, frame-based) ──
  const frameSize = 2048;
  const hop = 1024;
  const numFrames = Math.max(1, Math.floor((segment.length - frameSize) / hop));
  let centroidSum = 0;
  let centroidCount = 0;
  let onsetEnergy = 0;
  let prevEnergy = 0;

  for (let f = 0; f < numFrames; f++) {
    const off = f * hop;
    let frameEnergy = 0;
    let weightedFreq = 0;
    let totalMag = 0;

    // Cheap "spectral" approximation using zero-crossing-rate weighting
    let zc = 0;
    for (let i = 1; i < frameSize; i++) {
      const a = segment[off + i - 1];
      const b = segment[off + i];
      frameEnergy += b * b;
      if ((a >= 0) !== (b >= 0)) zc++;
    }

    // ZCR ≈ 2·spectralCentroid / sampleRate (rough proxy, normalized 0–1)
    const zcr = zc / frameSize;
    const brightness = Math.min(1, zcr * 2); // 0–1
    centroidSum += brightness;
    centroidCount++;

    // Onset = positive jump in frame energy
    if (frameEnergy > prevEnergy) onsetEnergy += frameEnergy - prevEnergy;
    prevEnergy = frameEnergy;
  }

  const brightness = centroidCount > 0 ? centroidSum / centroidCount : 0;
  const onsetRate = onsetEnergy / Math.max(1, numFrames);

  // ── Combine into a 0–10 score ──
  // RMS is usually small (<0.3 for music). Scale generously.
  const rmsScore = Math.min(1, rms * 4);                 // 0–1
  const brightnessScore = Math.min(1, brightness * 1.4); // 0–1
  const onsetScore = Math.min(1, Math.sqrt(onsetRate) * 3); // 0–1

  // Weighted blend → loudness dominates, brightness + onsets shape it
  const blend = rmsScore * 0.5 + brightnessScore * 0.25 + onsetScore * 0.25;
  const energy = Math.round(blend * 100) / 10; // 0–10, one decimal

  let level: EnergyLevel;
  if (energy < 3) level = 'chill';
  else if (energy < 5.5) level = 'medium';
  else if (energy < 8) level = 'high';
  else level = 'peak';

  return { energy, level, rms, brightness };
}

/** Color associated with each energy level (HSL via CSS tokens isn't possible inline → return raw HSL string) */
export function energyColor(energy: number): string {
  if (energy < 3) return 'hsl(200, 80%, 55%)';      // cool blue
  if (energy < 5.5) return 'hsl(160, 70%, 45%)';    // teal
  if (energy < 8) return 'hsl(40, 90%, 55%)';       // amber
  return 'hsl(0, 80%, 55%)';                        // hot red
}

export function energyIcon(energy: number): string {
  if (energy < 3) return '❄️';
  if (energy < 5.5) return '🌊';
  if (energy < 8) return '🔥';
  return '⚡';
}

export function energyLabel(level: EnergyLevel): string {
  switch (level) {
    case 'chill': return 'Chill';
    case 'medium': return 'Medium';
    case 'high': return 'High';
    case 'peak': return 'Peak';
  }
}
