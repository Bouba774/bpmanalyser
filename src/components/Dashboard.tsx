import { useMemo } from 'react';
import { AudioFileInfo, getBpmColor, getEnergyColor, getMoodColor } from '@/lib/audio-types';
import { getCamelotColor, CAMELOT_WHEEL, isHarmonicMatch } from '@/lib/camelot';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardProps {
  files: AudioFileInfo[];
}

export function Dashboard({ files }: DashboardProps) {
  const doneFiles = useMemo(() => files.filter(f => f.status === 'done'), [files]);

  const bpmDistribution = useMemo(() => {
    const groups = [
      { range: '<90', count: 0, color: getBpmColor(60) },
      { range: '90-110', count: 0, color: getBpmColor(100) },
      { range: '110-125', count: 0, color: getBpmColor(118) },
      { range: '125-140', count: 0, color: getBpmColor(132) },
      { range: '>140', count: 0, color: getBpmColor(150) },
    ];
    doneFiles.forEach(f => {
      if (!f.bpm) return;
      if (f.bpm < 90) groups[0].count++;
      else if (f.bpm <= 110) groups[1].count++;
      else if (f.bpm <= 125) groups[2].count++;
      else if (f.bpm <= 140) groups[3].count++;
      else groups[4].count++;
    });
    return groups;
  }, [doneFiles]);

  const energyDistribution = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0 };
    doneFiles.forEach(f => { if (f.energy) counts[f.energy]++; });
    return [
      { name: 'Low', value: counts.low, color: getEnergyColor('low') },
      { name: 'Medium', value: counts.medium, color: getEnergyColor('medium') },
      { name: 'High', value: counts.high, color: getEnergyColor('high') },
    ].filter(d => d.value > 0);
  }, [doneFiles]);

  const moodDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    doneFiles.forEach(f => { if (f.mood) counts[f.mood] = (counts[f.mood] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, color: getMoodColor(name as any) }))
      .sort((a, b) => b.value - a.value);
  }, [doneFiles]);

  const genreDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    doneFiles.forEach(f => { if (f.genre) counts[f.genre] = (counts[f.genre] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [doneFiles]);

  const avgBpm = useMemo(() => {
    const bpms = doneFiles.filter(f => f.bpm).map(f => f.bpm!);
    return bpms.length > 0 ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : 0;
  }, [doneFiles]);

  // Camelot wheel counts
  const camelotCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    doneFiles.forEach(f => { if (f.camelot) counts[f.camelot] = (counts[f.camelot] || 0) + 1; });
    return counts;
  }, [doneFiles]);

  if (doneFiles.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Fichiers" value={doneFiles.length.toString()} />
        <StatCard label="BPM moyen" value={`${avgBpm}`} accent />
        <StatCard label="Tonalités" value={`${Object.keys(camelotCounts).length}`} />
        <StatCard label="Genres" value={`${genreDistribution.length}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* BPM Distribution */}
        <div className="bg-card border border-border/50 rounded-lg p-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Distribution BPM</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={bpmDistribution}>
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }} />
              <Tooltip contentStyle={{ background: 'hsl(240, 15%, 8%)', border: '1px solid hsl(240, 12%, 16%)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {bpmDistribution.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Energy Pie */}
        <div className="bg-card border border-border/50 rounded-lg p-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Énergie</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={energyDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {energyDistribution.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(240, 15%, 8%)', border: '1px solid hsl(240, 12%, 16%)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Mood Distribution */}
        <div className="bg-card border border-border/50 rounded-lg p-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Mood</h3>
          <div className="flex flex-wrap gap-2">
            {moodDistribution.map(m => (
              <div key={m.name} className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border/50" style={{ borderColor: m.color + '40' }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                <span className="text-xs capitalize">{m.name}</span>
                <span className="text-[10px] text-muted-foreground">{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Camelot Wheel Mini */}
        <div className="bg-card border border-border/50 rounded-lg p-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Camelot Wheel</h3>
          <div className="grid grid-cols-6 gap-1">
            {CAMELOT_WHEEL.map(item => {
              const count = camelotCounts[item.code] || 0;
              return (
                <div
                  key={item.code}
                  className="flex flex-col items-center justify-center p-1 rounded text-center"
                  style={{
                    backgroundColor: count > 0 ? getCamelotColor(item.code) + '20' : 'transparent',
                    border: count > 0 ? `1px solid ${getCamelotColor(item.code)}40` : '1px solid transparent',
                  }}
                >
                  <span className="text-[9px] font-mono font-bold" style={{ color: count > 0 ? getCamelotColor(item.code) : 'hsl(215, 15%, 35%)' }}>
                    {item.code}
                  </span>
                  {count > 0 && <span className="text-[8px] text-muted-foreground">{count}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Genre bar */}
      {genreDistribution.length > 0 && (
        <div className="bg-card border border-border/50 rounded-lg p-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Genres</h3>
          <div className="flex gap-2 flex-wrap">
            {genreDistribution.map(g => (
              <div key={g.name} className="px-3 py-1.5 rounded-md bg-secondary border border-border/50">
                <span className="text-xs font-mono uppercase">{g.name}</span>
                <span className="text-[10px] text-muted-foreground ml-2">{g.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-card border border-border/50 rounded-lg p-3 text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-mono font-bold ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
