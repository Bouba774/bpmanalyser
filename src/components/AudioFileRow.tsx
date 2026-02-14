import { motion } from 'framer-motion';
import { AudioFileInfo, formatDuration, getBpmColor, getBpmGroup, getEnergyColor, getMoodColor } from '@/lib/audio-types';
import { getCamelotColor } from '@/lib/camelot';
import { Music, Loader2, AlertCircle } from 'lucide-react';

interface AudioFileRowProps {
  file: AudioFileInfo;
  index: number;
}

export function AudioFileRow({ file, index }: AudioFileRowProps) {
  const bpmGroup = file.bpm !== null ? getBpmGroup(file.bpm) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.5), duration: 0.25 }}
      className="grid grid-cols-[1fr_60px_70px_50px_60px_70px_70px_60px_auto] gap-3 items-center px-3 py-2.5 bg-card hover:bg-surface-hover rounded-lg border border-border/50 transition-colors"
    >
      {/* File name */}
      <div className="flex items-center gap-2 min-w-0">
        <Music className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <p className="text-sm font-medium truncate">{file.name}</p>
      </div>

      {/* BPM */}
      <div className="text-center">
        {file.status === 'analyzing' && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary mx-auto" />}
        {file.status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-destructive mx-auto" />}
        {file.status === 'done' && file.bpm !== null && (
          <span className="font-mono font-bold text-xs" style={{ color: getBpmColor(file.bpm) }}>
            {file.bpm}
          </span>
        )}
        {file.status === 'pending' && <span className="text-xs text-muted-foreground">—</span>}
      </div>

      {/* Key + Camelot */}
      <div className="text-center">
        {file.key && file.mode ? (
          <div className="flex flex-col items-center">
            <span className="text-xs font-medium">{file.key}{file.mode === 'minor' ? 'm' : ''}</span>
            <span className="text-[10px] font-mono" style={{ color: getCamelotColor(file.camelot || '') }}>
              {file.camelot}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Energy */}
      <div className="text-center">
        {file.energy ? (
          <span className="text-[10px] font-bold uppercase" style={{ color: getEnergyColor(file.energy) }}>
            {file.energy === 'low' ? 'LOW' : file.energy === 'medium' ? 'MED' : 'HIGH'}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Mood */}
      <div className="text-center">
        {file.mood ? (
          <span className="text-[10px] font-medium capitalize" style={{ color: getMoodColor(file.mood) }}>
            {file.mood}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Genre */}
      <div className="text-center">
        {file.genre ? (
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
            {file.genre}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Duration */}
      <div className="text-center font-mono text-xs text-muted-foreground">
        {file.duration > 0 ? formatDuration(file.duration) : '—'}
      </div>

      {/* Format */}
      <div className="text-center">
        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
          {file.format}
        </span>
      </div>

      {/* Category */}
      <div className="text-right min-w-[80px]">
        {bpmGroup && (
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ color: getBpmColor(file.bpm!), backgroundColor: `${getBpmColor(file.bpm!)}15` }}
          >
            {bpmGroup.label}
          </span>
        )}
      </div>
    </motion.div>
  );
}
