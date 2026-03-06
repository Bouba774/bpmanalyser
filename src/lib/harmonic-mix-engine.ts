/**
 * Harmonic Flow Engine™ — Intelligent DJ setlist generator
 * Builds an optimal playback order based on Camelot wheel + BPM compatibility.
 * + Thermal Energy Sorting (Hot/Cold)
 */

import { AudioFileInfo, djBpmDelta } from './audio-types';

export type MixMode = 'strict' | 'flexible' | 'creative';
export type EnergyMode = 'harmonic' | 'hot-cold' | 'cold-hot';
export type TransitionQuality = 'perfect' | 'good' | 'risky';

export interface HarmonicTransition {
  from: AudioFileInfo;
  to: AudioFileInfo;
  score: number;
  bpmDelta: number;
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

/* ---------------- CAMEL0T ---------------- */

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

/* ---------------- THERMAL ENERGY ---------------- */

// 🔥 Thermal / Energy scoring system
export function thermalScore(track: AudioFileInfo): number {
  let score = 0;

  if (!track.camelot) return 0;

  // Major / Minor
  if (track.camelot.endsWith('B')) score += 2; // Major = chaud
  if (track.camelot.endsWith('A')) score -= 2; // Minor = froid

  // Camelot zone
  const parsed = parseCamelot(track.camelot);
  if (parsed) {
    if (parsed.num >= 9) score += 2;   // bright zone
    if (parsed.num <= 4) score -= 2;   // dark zone
  }

  // BPM energy
  if (track.bpm !== null) {
    if (track.bpm > 128) score += 3;
    else if (track.bpm > 122) score += 2;
    else if (track.bpm < 100) score -= 3;
    else if (track.bpm < 110) score -= 2;
  }

  return score;
}

export function sortHotToCold(tracks: AudioFileInfo[]) {
  return [...tracks].sort((a, b) => thermalScore(b) - thermalScore(a));
}

export function sortColdToHot(tracks: AudioFileInfo[]) {
  return [...tracks].sort((a, b) => thermalScore(a) - thermalScore(b));
}

/* ---------------- TRANSITION SCORING ---------------- */

function scoreTransition(
  from: AudioFileInfo,
  to: AudioFileInfo,
  mode: MixMode,
  bpmTolerance: number,
  useDjBpm: boolean = false,
): { score: number; bpmDelta: number; relation: string; quality: TransitionQuality } {

  let score = 0;

  // Use DJ BPM delta (considers half/double tempo) when DJ mode is on
  const bpmA = useDjBpm ? (from.djBpm ?? from.bpm ?? 0) : (from.bpm ?? 0);
  const bpmB = useDjBpm ? (to.djBpm ?? to.bpm ?? 0) : (to.bpm ?? 0);
  const bpmDelta = useDjBpm
    ? djBpmDelta(from.bpm ?? 0, to.bpm ?? 0)
    : Math.abs(bpmA - bpmB);

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

  if (bpmDelta <= 2) score += 50;
  else if (bpmDelta <= 3) score += 40;
  else if (bpmDelta <= 5) score += 30;
  else if (bpmDelta <= bpmTolerance) score += 10;
  else {
    const penalty = mode === 'creative' ? 20 : mode === 'flexible' ? 60 : 100;
    score -= penalty;
  }

  let quality: TransitionQuality;
  if (score >= 120) quality = 'perfect';
  else if (score >= 60) quality = 'good';
  else quality = 'risky';

  return { score, bpmDelta, relation, quality };
}

/* ---------------- PLAYLIST GENERATOR ---------------- */

export function generateHarmonicPlaylist(
  files: AudioFileInfo[],
  mode: MixMode = 'flexible',
  bpmTolerance: number = 8,
  energyMode: EnergyMode = 'harmonic',
  startTrackId?: string,
  useDjBpm: boolean = false,
): HarmonicPlaylist {

  const eligible = files.filter(
    f => f.bpm !== null && f.camelot !== null && f.status === 'done' && f.keyStatus === 'done'
  );

  if (eligible.length === 0) {
    return { tracks: [], transitions: [], totalScore: 0, avgScore: 0, mode: energyMode };
  }

  // ENERGY SORT ONLY MODES
  if (energyMode === 'hot-cold') {
    const ordered = sortHotToCold(eligible);
    return { tracks: ordered, transitions: [], totalScore: 0, avgScore: 0, mode: energyMode };
  }

  if (energyMode === 'cold-hot') {
    const ordered = sortColdToHot(eligible);
    return { tracks: ordered, transitions: [], totalScore: 0, avgScore: 0, mode: energyMode };
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
        const { score } = scoreTransition(f, g, mode, bpmTolerance, useDjBpm);
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
      const t = scoreTransition(current, candidate, mode, bpmTolerance, useDjBpm);
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
      bpmDelta: bestTransition.bpmDelta,
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
  bpmTolerance: number = 8,
  useDjBpm: boolean = false,
): HarmonicTransition {

  const t = scoreTransition(from, to, mode, bpmTolerance, useDjBpm);

  return {
    from,
    to,
    score: t.score,
    bpmDelta: t.bpmDelta,
    camelotRelation: t.relation,
    quality: t.quality,
  };
}