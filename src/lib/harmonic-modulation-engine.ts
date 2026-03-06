/**
 * Harmonic Modulation Engine — Bridge incompatible keys via pivot tracks
 * Uses BFS on the Camelot graph to find shortest harmonic paths
 */

import { AudioFileInfo } from './audio-types';

export type ModulationQuality = 'perfect' | 'smooth' | 'controlled' | 'tense';

export interface ModulationStep {
  camelot: string;
  track: AudioFileInfo | null; // null = no track available for this key
  relation: string;
}

export interface ModulationPath {
  from: AudioFileInfo;
  to: AudioFileInfo;
  steps: ModulationStep[];
  pivotTracks: AudioFileInfo[];
  totalDistance: number;
  quality: ModulationQuality;
  isDirect: boolean;
}

interface CamelotNode {
  code: string;
  num: number;
  letter: 'A' | 'B';
}

/* ---- Camelot graph adjacency ---- */

const ALL_CODES: CamelotNode[] = [];
for (let n = 1; n <= 12; n++) {
  ALL_CODES.push({ code: `${n}A`, num: n, letter: 'A' });
  ALL_CODES.push({ code: `${n}B`, num: n, letter: 'B' });
}

function wrap12(n: number): number {
  return ((n - 1 + 12) % 12) + 1;
}

/** Get all directly compatible Camelot codes (distance 1 on the wheel) */
function getAdjacentCodes(code: string): string[] {
  const m = code.match(/^(\d{1,2})([AB])$/);
  if (!m) return [];
  const num = parseInt(m[1]);
  const letter = m[2] as 'A' | 'B';

  const adj: string[] = [];
  // Same key
  // Relative (same num, other letter)
  adj.push(`${num}${letter === 'A' ? 'B' : 'A'}`);
  // +1 same letter
  adj.push(`${wrap12(num + 1)}${letter}`);
  // -1 same letter
  adj.push(`${wrap12(num - 1)}${letter}`);

  return adj;
}

/* ---- BFS shortest path on Camelot wheel ---- */

export function findCamelotPath(fromCode: string, toCode: string, maxSteps: number = 6): string[] | null {
  if (fromCode === toCode) return [fromCode];

  const queue: string[][] = [[fromCode]];
  const visited = new Set<string>([fromCode]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];

    for (const neighbor of getAdjacentCodes(current)) {
      if (visited.has(neighbor)) continue;
      const newPath = [...path, neighbor];

      if (neighbor === toCode) return newPath;

      if (newPath.length < maxSteps + 1) {
        visited.add(neighbor);
        queue.push(newPath);
      }
    }
  }

  return null;
}

/** Describe the relation between two adjacent Camelot codes */
function describeRelation(a: string, b: string): string {
  const ma = a.match(/^(\d{1,2})([AB])$/);
  const mb = b.match(/^(\d{1,2})([AB])$/);
  if (!ma || !mb) return '?';

  const numA = parseInt(ma[1]), letA = ma[2];
  const numB = parseInt(mb[1]), letB = mb[2];

  if (numA === numB && letA !== letB) return 'Relative';
  if (letA === letB) {
    const diff = numB - numA;
    const wrapped = ((diff + 11) % 12) - 11 + 1; // normalized
    if (Math.abs(wrap12(numA + 1) === numB ? 1 : wrap12(numA - 1) === numB ? -1 : 0) <= 1) {
      return wrap12(numA + 1) === numB ? '+1 Camelot' : '-1 Camelot';
    }
  }
  return '±1 Cross';
}

/* ---- Build modulation with actual tracks ---- */

export function buildModulationPath(
  from: AudioFileInfo,
  to: AudioFileInfo,
  library: AudioFileInfo[],
  maxPivots: number = 4,
  bpmTolerance: number = 10,
): ModulationPath | null {
  if (!from.camelot || !to.camelot) return null;

  const camelotPath = findCamelotPath(from.camelot, to.camelot, maxPivots + 2);
  if (!camelotPath) return null;

  const isDirect = camelotPath.length <= 2;

  // Build track index by camelot code
  const tracksByKey = new Map<string, AudioFileInfo[]>();
  for (const t of library) {
    if (!t.camelot || t.status !== 'done' || t.keyStatus !== 'done') continue;
    if (t.id === from.id || t.id === to.id) continue;
    const list = tracksByKey.get(t.camelot) || [];
    list.push(t);
    tracksByKey.set(t.camelot, list);
  }

  // For intermediate steps, find best pivot tracks (closest BPM)
  const steps: ModulationStep[] = [];
  const pivotTracks: AudioFileInfo[] = [];
  const usedIds = new Set([from.id, to.id]);

  // Interpolate target BPM linearly from→to
  const fromBpm = from.bpm ?? 120;
  const toBpm = to.bpm ?? 120;

  for (let i = 0; i < camelotPath.length; i++) {
    const code = camelotPath[i];
    const relation = i === 0 ? 'Start' : describeRelation(camelotPath[i - 1], code);

    if (i === 0) {
      steps.push({ camelot: code, track: from, relation });
      continue;
    }
    if (i === camelotPath.length - 1) {
      steps.push({ camelot: code, track: to, relation });
      continue;
    }

    // Find best pivot: closest to interpolated BPM
    const targetBpm = fromBpm + (toBpm - fromBpm) * (i / (camelotPath.length - 1));
    const candidates = (tracksByKey.get(code) || [])
      .filter(t => !usedIds.has(t.id))
      .filter(t => t.bpm !== null && Math.abs(t.bpm - targetBpm) <= bpmTolerance);

    // Sort by BPM proximity
    candidates.sort((a, b) =>
      Math.abs((a.bpm ?? 0) - targetBpm) - Math.abs((b.bpm ?? 0) - targetBpm)
    );

    const pivot = candidates[0] || null;
    if (pivot) {
      usedIds.add(pivot.id);
      pivotTracks.push(pivot);
    }

    steps.push({ camelot: code, track: pivot, relation });
  }

  const totalDistance = camelotPath.length - 1;
  const hasMissingPivots = steps.some((s, i) => i > 0 && i < steps.length - 1 && !s.track);

  let quality: ModulationQuality;
  if (isDirect) quality = 'perfect';
  else if (totalDistance <= 2 && !hasMissingPivots) quality = 'smooth';
  else if (totalDistance <= 4 && !hasMissingPivots) quality = 'controlled';
  else quality = 'tense';

  return {
    from,
    to,
    steps,
    pivotTracks,
    totalDistance,
    quality,
    isDirect,
  };
}

/** Get quality color */
export function modulationColor(q: ModulationQuality): string {
  switch (q) {
    case 'perfect': return 'hsl(145, 70%, 45%)';
    case 'smooth': return 'hsl(80, 70%, 45%)';
    case 'controlled': return 'hsl(35, 90%, 50%)';
    case 'tense': return 'hsl(0, 70%, 50%)';
  }
}

export function modulationIcon(q: ModulationQuality): string {
  switch (q) {
    case 'perfect': return '🟢';
    case 'smooth': return '🟡';
    case 'controlled': return '🟠';
    case 'tense': return '🔴';
  }
}

export function modulationLabel(q: ModulationQuality): string {
  switch (q) {
    case 'perfect': return 'Parfaite';
    case 'smooth': return 'Douce';
    case 'controlled': return 'Contrôlée';
    case 'tense': return 'Tendue';
  }
}
