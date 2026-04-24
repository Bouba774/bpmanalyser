/**
 * Harmonic Flow Engine™ — Intelligent DJ setlist generator
 * Builds an optimal playback order based on Camelot wheel + Energy compatibility.
 */

import { AudioFileInfo } from './audio-types';

export type MixMode = 'strict' | 'flexible' | 'creative';
export type EnergyMode = 'harmonic' | 'energy-up' | 'energy-down';
export type TransitionQuality = 'perfect' | 'good' | 'risky';

export interface HarmonicTransition {
  from: AudioFileInfo;
  to: AudioFileInfo;
  score: number;
  energyDelta: number;
  camelotRelation: string;
  quality: TransitionQuality;
}

export interface HarmonicPlaylist {
  tracks: AudioFileInfo[];
  transitions: HarmonicTransition[];
  totalScore: number;
  avgScore: number;
  mode: EnergyMode;
}

interface CamelotParsed {
  num: number;
  letter: 'A' | 'B';
}

/* ---------------- CAMELOT ---------------- */

function parseCamelot(code: string): CamelotParsed | null {
  const m = code.match(/^(\d{1,2})([AB])$/);
  if (!m) return null;
  return { num: parseInt(m[1]), letter: m[2] as 'A' | 'B' };
}

function camelotDistance(a: CamelotParsed, b: CamelotParsed): { dist: number; relation: string } {
  if (a.num === b.num && a.letter === b.letter) return { dist: 0, relation: 'Même clé' };
  if (a.num === b.num && a.letter !== b.letter) return { dist: 0.5, relation: 'Relative' };

  const diff = Math.abs(a.num - b.num);
  const wrapped = Math.min(diff, 12 - diff);

  if (a.letter === b.letter) {
    if (wrapped === 1) return { dist: 1, relation: '±1 Camelot' };
    if (wrapped === 2) return { dist: 2, relation: '±2 Camelot' };
    return { dist: wrapped, relation: `±${wrapped} Camelot` };
  }

  if (wrapped === 1) return { dist: 1.5, relation: '±1 Cross' };
  if (wrapped === 0) return { dist: 0.5, relation: 'Relative' };
  return { dist: wrapped + 0.5, relation: `±${wrapped} Cross` };
}

/* ---------------- ENERGY SORTERS ---------------- */

export function sortEnergyDown(tracks: AudioFileInfo[]) {
  return [...tracks].sort((a, b) => (b.energy ?? 0) - (a.energy ?? 0));
}

export function sortEnergyUp(tracks: AudioFileInfo[]) {
  return [...tracks].sort((a, b) => (a.energy ?? 0) - (b.energy ?? 0));
}

/* ---------------- TRANSITION SCORING ---------------- */

function scoreTransition(
  from: AudioFileInfo,
  to: AudioFileInfo,
  mode: MixMode,
  energyTolerance: number,
): { score: number; energyDelta: number; relation: string; quality: TransitionQuality } {

  let score = 0;

  const eA = from.energy ?? 0;
  const eB = to.energy ?? 0;
  const energyDelta = Math.abs(eA - eB);

  const ca = from.camelot ? parseCamelot(from.camelot) : null;
  const cb = to.camelot ? parseCamelot(to.camelot) : null;
  let relation = 'Inconnu';

  if (ca && cb) {
    const { dist, relation: rel } = camelotDistance(ca, cb);
    relation = rel;

    if (dist === 0) score += 100;
    else if (dist === 0.5) score += 90;
    else if (dist === 1) score += 80;
    else if (dist === 1.5) score += 60;
    else if (dist === 2) score += 40;
    else score -= 50;
  }

  // Energy compatibility (0–10 scale → tolerance ~1.5 default)
  if (energyDelta <= 0.5) score += 50;
  else if (energyDelta <= 1) score += 40;
  else if (energyDelta <= 1.5) score += 30;
  else if (energyDelta <= energyTolerance) score += 10;
  else {
    const penalty = mode === 'creative' ? 20 : mode === 'flexible' ? 60 : 100;
    score -= penalty;
  }

  let quality: TransitionQuality;
  if (score >= 120) quality = 'perfect';
  else if (score >= 60) quality = 'good';
  else quality = 'risky';

  return { score, energyDelta: Math.round(energyDelta * 10) / 10, relation, quality };
}

/* ---------------- PLAYLIST GENERATOR ---------------- */

export function generateHarmonicPlaylist(
  files: AudioFileInfo[],
  mode: MixMode = 'flexible',
  energyTolerance: number = 2.5,
  energyMode: EnergyMode = 'harmonic',
  startTrackId?: string,
): HarmonicPlaylist {

  const eligible = files.filter(
    f => f.energy !== null && f.camelot !== null && f.status === 'done' && f.keyStatus === 'done',
  );

  if (eligible.length === 0) {
    return { tracks: [], transitions: [], totalScore: 0, avgScore: 0, mode: energyMode };
  }

  // ENERGY SORT ONLY MODES
  if (energyMode === 'energy-down') {
    return { tracks: sortEnergyDown(eligible), transitions: [], totalScore: 0, avgScore: 0, mode: energyMode };
  }
  if (energyMode === 'energy-up') {
    return { tracks: sortEnergyUp(eligible), transitions: [], totalScore: 0, avgScore: 0, mode: energyMode };
  }

  // --- Harmonic engine ---
  let startIdx = 0;

  if (startTrackId) {
    const idx = eligible.findIndex(f => f.id === startTrackId);
    if (idx >= 0) startIdx = idx;
  } else {
    let bestConnectivity = -Infinity;
    eligible.forEach((f, i) => {
      let connectivity = 0;
      eligible.forEach((g, j) => {
        if (i === j) return;
        const { score } = scoreTransition(f, g, mode, energyTolerance);
        if (score >= 80) connectivity += score;
      });
      if (connectivity > bestConnectivity) {
        bestConnectivity = connectivity;
        startIdx = i;
      }
    });
  }

  const used = new Set<string>();
  const ordered: AudioFileInfo[] = [];
  const transitions: HarmonicTransition[] = [];

  let current = eligible[startIdx];
  ordered.push(current);
  used.add(current.id);

  while (used.size < eligible.length) {
    let bestScore = -Infinity;
    let bestTrack: AudioFileInfo | null = null;
    let bestTransition: ReturnType<typeof scoreTransition> | null = null;

    for (const candidate of eligible) {
      if (used.has(candidate.id)) continue;
      const t = scoreTransition(current, candidate, mode, energyTolerance);
      if (t.score > bestScore) {
        bestScore = t.score;
        bestTrack = candidate;
        bestTransition = t;
      }
    }

    if (!bestTrack || !bestTransition) break;

    transitions.push({
      from: current,
      to: bestTrack,
      score: bestTransition.score,
      energyDelta: bestTransition.energyDelta,
      camelotRelation: bestTransition.relation,
      quality: bestTransition.quality,
    });

    used.add(bestTrack.id);
    ordered.push(bestTrack);
    current = bestTrack;
  }

  const totalScore = transitions.reduce((s, t) => s + t.score, 0);
  const avgScore = transitions.length > 0 ? Math.round(totalScore / transitions.length) : 0;

  return { tracks: ordered, transitions, totalScore, avgScore, mode: energyMode };
}

/* ---------------- SINGLE TRANSITION ---------------- */

export function getTransitionInfo(
  from: AudioFileInfo,
  to: AudioFileInfo,
  mode: MixMode = 'flexible',
  energyTolerance: number = 2.5,
): HarmonicTransition {
  const t = scoreTransition(from, to, mode, energyTolerance);
  return {
    from,
    to,
    score: t.score,
    energyDelta: t.energyDelta,
    camelotRelation: t.relation,
    quality: t.quality,
  };
}
