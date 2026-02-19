import { useMemo } from 'react';
import { AudioFileInfo } from '@/lib/audio-types';
import { getKeyColor, ALL_CAMELOT_CODES } from '@/lib/key-utils';

interface CamelotWheelProps {
  tracks: AudioFileInfo[];
  transitions?: { from: AudioFileInfo; to: AudioFileInfo; quality: 'perfect' | 'good' | 'risky' }[];
}

const WHEEL_SIZE = 300;
const CENTER = WHEEL_SIZE / 2;
const OUTER_R = 130;
const INNER_R = 90;
const LABEL_R = 110;

// 12 positions, each with A (minor/inner) and B (major/outer)
const SEGMENTS = ALL_CAMELOT_CODES.map(code => {
  const num = parseInt(code);
  const letter = code.replace(/\d+/, '') as 'A' | 'B';
  const angle = ((num - 1) * 30 - 90) * (Math.PI / 180); // start at top
  return { code, num, letter, angle };
});

function polarToXY(angle: number, radius: number) {
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

export function CamelotWheel({ tracks, transitions = [] }: CamelotWheelProps) {
  // Count tracks per camelot code
  const trackCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tracks.forEach(t => {
      if (t.camelot) counts[t.camelot] = (counts[t.camelot] || 0) + 1;
    });
    return counts;
  }, [tracks]);

  // Build transition lines
  const lines = useMemo(() => {
    return transitions
      .filter(t => t.from.camelot && t.to.camelot && t.from.camelot !== t.to.camelot)
      .map((t, i) => {
        const fromSeg = SEGMENTS.find(s => s.code === t.from.camelot);
        const toSeg = SEGMENTS.find(s => s.code === t.to.camelot);
        if (!fromSeg || !toSeg) return null;
        const fromR = fromSeg.letter === 'B' ? OUTER_R : INNER_R;
        const toR = toSeg.letter === 'B' ? OUTER_R : INNER_R;
        const from = polarToXY(fromSeg.angle, fromR);
        const to = polarToXY(toSeg.angle, toR);
        const color = t.quality === 'perfect' ? 'hsl(145,70%,45%)' : t.quality === 'good' ? 'hsl(45,90%,50%)' : 'hsl(0,70%,50%)';
        return { ...from, x2: to.x, y2: to.y, color, key: i };
      })
      .filter(Boolean);
  }, [transitions]);

  return (
    <div className="flex items-center justify-center">
      <svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
        {/* Outer ring (B - Major) */}
        <circle cx={CENTER} cy={CENTER} r={OUTER_R} fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
        <circle cx={CENTER} cy={CENTER} r={INNER_R} fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
        <circle cx={CENTER} cy={CENTER} r={INNER_R - 20} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />

        {/* Transition lines */}
        {lines.map(l => l && (
          <line
            key={l.key}
            x1={l.x}
            y1={l.y}
            x2={l.x2}
            y2={l.y2}
            stroke={l.color}
            strokeWidth="2"
            opacity="0.6"
            strokeLinecap="round"
          />
        ))}

        {/* Segments */}
        {SEGMENTS.map(seg => {
          const r = seg.letter === 'B' ? OUTER_R : INNER_R;
          const labelPos = polarToXY(seg.angle, seg.letter === 'B' ? LABEL_R + 10 : LABEL_R - 25);
          const dotPos = polarToXY(seg.angle, r);
          const count = trackCounts[seg.code] || 0;
          const hasTrack = count > 0;
          const color = getKeyColor(seg.code);
          const dotR = hasTrack ? Math.min(6 + count * 2, 14) : 3;

          return (
            <g key={seg.code}>
              {/* Dot */}
              <circle
                cx={dotPos.x}
                cy={dotPos.y}
                r={dotR}
                fill={hasTrack ? color : 'hsl(var(--muted))'}
                opacity={hasTrack ? 1 : 0.3}
                stroke={hasTrack ? color : 'none'}
                strokeWidth="2"
                strokeOpacity="0.3"
              />
              {/* Count */}
              {hasTrack && count > 1 && (
                <text
                  x={dotPos.x}
                  y={dotPos.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[8px] font-bold"
                  fill="white"
                >
                  {count}
                </text>
              )}
              {/* Label */}
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[9px] font-mono"
                fill={hasTrack ? color : 'hsl(var(--muted-foreground))'}
                opacity={hasTrack ? 1 : 0.5}
                fontWeight={hasTrack ? 700 : 400}
              >
                {seg.code}
              </text>
            </g>
          );
        })}

        {/* Center label */}
        <text
          x={CENTER}
          y={CENTER - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[10px] font-bold"
          fill="hsl(var(--primary))"
        >
          CAMELOT
        </text>
        <text
          x={CENTER}
          y={CENTER + 6}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[8px]"
          fill="hsl(var(--muted-foreground))"
        >
          {tracks.length} tracks
        </text>
      </svg>
    </div>
  );
}
