/**
 * Energy Detection Engine
 * Analyzes RMS energy and spectral characteristics
 */

import { EnergyLevel } from './audio-types';

export function detectEnergy(channelData: Float32Array, sampleRate: number): EnergyLevel {
  const rms = computeRMS(channelData);
  const spectralCentroid = computeSpectralCentroid(channelData, sampleRate);
  const dynamicRange = computeDynamicRange(channelData, sampleRate);
  
  // Combine metrics: high RMS + high spectral centroid + high dynamic range = high energy
  const rmsScore = normalizeRMS(rms);
  const spectralScore = normalizeSpectral(spectralCentroid);
  const dynamicScore = normalizeDynamic(dynamicRange);
  
  const energyScore = rmsScore * 0.4 + spectralScore * 0.35 + dynamicScore * 0.25;
  
  if (energyScore > 0.6) return 'high';
  if (energyScore > 0.35) return 'medium';
  return 'low';
}

function computeRMS(data: Float32Array): number {
  let sum = 0;
  const step = 4; // subsample for speed
  let count = 0;
  for (let i = 0; i < data.length; i += step) {
    sum += data[i] * data[i];
    count++;
  }
  return Math.sqrt(sum / count);
}

function computeSpectralCentroid(data: Float32Array, sampleRate: number): number {
  const fftSize = 4096;
  const numFrames = Math.min(Math.floor(data.length / fftSize), 100);
  let totalCentroid = 0;
  
  for (let frame = 0; frame < numFrames; frame++) {
    const offset = Math.floor(frame * data.length / numFrames);
    const segment = data.slice(offset, offset + fftSize);
    
    let weightedSum = 0, magSum = 0;
    const step = 8;
    for (let k = 1; k < fftSize / 2; k += step) {
      let re = 0, im = 0;
      for (let n = 0; n < fftSize; n += 4) {
        const angle = (2 * Math.PI * k * n) / fftSize;
        re += segment[n] * Math.cos(angle);
        im -= segment[n] * Math.sin(angle);
      }
      const mag = Math.sqrt(re * re + im * im);
      const freq = (k * sampleRate) / fftSize;
      weightedSum += freq * mag;
      magSum += mag;
    }
    
    if (magSum > 0) totalCentroid += weightedSum / magSum;
  }
  
  return numFrames > 0 ? totalCentroid / numFrames : 0;
}

function computeDynamicRange(data: Float32Array, sampleRate: number): number {
  const windowSize = Math.floor(sampleRate * 0.05);
  const hop = windowSize * 2;
  const rmsValues: number[] = [];
  
  for (let i = 0; i < data.length - windowSize; i += hop) {
    let sum = 0;
    for (let j = i; j < i + windowSize; j++) {
      sum += data[j] * data[j];
    }
    rmsValues.push(Math.sqrt(sum / windowSize));
  }
  
  if (rmsValues.length < 2) return 0;
  rmsValues.sort((a, b) => a - b);
  
  const p10 = rmsValues[Math.floor(rmsValues.length * 0.1)];
  const p90 = rmsValues[Math.floor(rmsValues.length * 0.9)];
  
  return p90 - p10;
}

function normalizeRMS(rms: number): number {
  // Typical RMS for normalized audio: 0.05-0.3
  return Math.min(1, Math.max(0, (rms - 0.02) / 0.25));
}

function normalizeSpectral(centroid: number): number {
  // Typical centroid: 500-4000Hz
  return Math.min(1, Math.max(0, (centroid - 300) / 3500));
}

function normalizeDynamic(range: number): number {
  return Math.min(1, Math.max(0, range / 0.3));
}
