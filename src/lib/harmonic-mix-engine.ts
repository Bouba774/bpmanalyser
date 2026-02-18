/**
 * Harmonic Flow Engine™ — Intelligent DJ setlist generator
 * Builds an optimal playback order based on Camelot wheel + BPM compatibility.
 */
import { AudioFileInfo } from './audio-types';

export type MixMode = 'strict' | 'flexible' | 'creative';
export type TransitionQuality = 'perfect' | 'good' | 'risky';

export interface HarmonicTransition {
  from: AudioFileInfo;
  to: AudioFileInfo;
  score: number;
  bpmDelta: number;
  camelotRelation: string; // e.g. "Same Key", "Relative", "+1", etc.
  quality: TransitionQuality;
}

export interface HarmonicPlaylist {
  tracks: AudioFileInfo[];
  transitions: HarmonicTransition[];
  totalScore: number;
  avgScore: number;
}

interface CamelotParsed {
  num: number;
  letter: 'A' | 'B';
}

function parseCamelot(code: string): CamelotParsed | null {
  const m = code.match(/^(\d{1,2})([AB])$/);
  if (!m) return null;
  return { num: parseInt(m[1]), letter: m[2] as 'A' | 'B' };
}

function camelotDistance(a: CamelotParsed, b: CamelotParsed): { dist: number; relation: string } {
  // Same key
  if (a.num === b.num && a.letter === b.letter) return { dist: 0, relation: 'Même clé' };
  // Relative key (A↔B same number)
  if (a.num === b.num && a.letter !== b.letter) return { dist: 0.5, relation: 'Relative' };
  
  const diff = Math.abs(a.num - b.num);
  const wrapped = Math.min(diff, 12 - diff);
  
  if (a.letter === b.letter) {
    if (wrapped === 1) return { dist: 1, relation: '±1 Camelot' };
    if (wrapped === 2) return { dist: 2, relation: '±2 Camelot' };
    return { dist: wrapped, relation: `±${wrapped} Camelot` };
  }
  
  // Cross mode
  if (wrapped === 1) return { dist: 1.5, relation: '±1 Cross' };
  if (wrapped === 0) return { dist: 0.5, relation: 'Relative' }; // already covered above
  return { dist: wrapped + 0.5, relation: `±${wrapped} Cross` };
}

/**
 * Score a single transition between two tracks.
 */
function scoreTransition(
  from: AudioFileInfo,
  to: AudioFileInfo,
  mode: MixMode,
  bpmTolerance: number,
): { score: number; bpmDelta: number; relation: string; quality: TransitionQuality } {
  let score = 0;
  const bpmDelta = Math.abs((from.bpm ?? 0) - (to.bpm ?? 0));

  // --- Harmonic scoring ---
  const ca = from.camelot ? parseCamelot(from.camelot) : null;
  const cb = to.camelot ? parseCamelot(to.camelot) : null;
  let relation = 'Inconnu';

  if (ca && cb) {
    const { dist, relation: rel } = camelotDistance(ca, cb);
    relation = rel;
    if (dist === 0) score += 100;        // Same key
    else if (dist === 0.5) score += 90;  // Relative
    else if (dist === 1) score += 80;    // ±1
    else if (dist === 1.5) score += 60;  // ±1 cross
    else if (dist === 2) score += 40;    // ±2
    else score -= 50;                    // clash
  }

  // --- BPM scoring ---
  if (bpmDelta <= 2) score += 50;
  else if (bpmDelta <= 3) score += 40;
  else if (bpmDelta <= 5) score += 30;
  else if (bpmDelta <= bpmTolerance) score += 10;
  else {
    // Penalty scales with mode
    const penalty = mode === 'creative' ? 20 : mode === 'flexible' ? 60 : 100;
    score -= penalty;
  }

  // Quality label
  let quality: TransitionQuality;
  if (score >= 120) quality = 'perfect';
  else if (score >= 60) quality = 'good';
  else quality = 'risky';

  return { score, bpmDelta, relation, quality };
}

/**
 * Greedy nearest-neighbour approach to build the optimal playlist.
 * Starts from the best "seed" track (most connections) and greedily picks
 * the highest-scoring next track.
 */
export function generateHarmonicPlaylist(
  files: AudioFileInfo[],
  mode: MixMode = 'flexible',
  bpmTolerance: number = 8,
  startTrackId?: string,
): HarmonicPlaylist {
  // Only use tracks with both BPM and Key analysed
  const eligible = files.filter(f => f.bpm !== null && f.camelot !== null && f.status === 'done' && f.keyStatus === 'done');

  if (eligible.length === 0) {
    return { tracks: [], transitions: [], totalScore: 0, avgScore: 0 };
  }

  if (eligible.length === 1) {
    return { tracks: [eligible[0]], transitions: [], totalScore: 0, avgScore: 0 };
  }

  // Pick starting track
  let startIdx = 0;
  if (startTrackId) {
    const idx = eligible.findIndex(f => f.id === startTrackId);
    if (idx >= 0) startIdx = idx;
  } else {
    // Find track with most high-score neighbours as seed
    let bestConnectivity = -Infinity;
    eligible.forEach((f, i) => {
      let connectivity = 0;
      eligible.forEach((g, j) => {
        if (i === j) return;
        const { score } = scoreTransition(f, g, mode, bpmTolerance);
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
      const t = scoreTransition(current, candidate, mode, bpmTolerance);
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

  return { tracks: ordered, transitions, totalScore, avgScore };
}

/**
 * Get transition info between two specific tracks.
 */
export function getTransitionInfo(
  from: AudioFileInfo,
  to: AudioFileInfo,
  mode: MixMode = 'flexible',
  bpmTolerance: number = 8,
): HarmonicTransition {
  const t = scoreTransition(from, to, mode, bpmTolerance);
  return {
    from, to,
    score: t.score,
    bpmDelta: t.bpmDelta,
    camelotRelation: t.relation,
    quality: t.quality,
  };
}
