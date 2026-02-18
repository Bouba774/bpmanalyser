import { motion } from 'framer-motion';
import { AudioFileInfo, formatDuration, getBpmColor } from '@/lib/audio-types';
import { Loader2, AlertCircle, Play, Pause, Music } from 'lucide-react';
import { getKeyColor } from '@/lib/key-utils';

interface AudioFileRowProps {
  file: AudioFileInfo;
  index: number;
  playingId: string | null;
  onPlay: (id: string, file: File) => void;
  onStop: () => void;
  showKey?: boolean;
}

export function AudioFileRow({ file, index, playingId, onPlay, onStop, showKey }: AudioFileRowProps) {
  const isPlaying = playingId === file.id;

  const handleTogglePlay = () => {
    if (isPlaying) {
      onStop();
    } else {
      onPlay(file.id, file.file);
    }
  };

  const gridCols = showKey
    ? 'grid-cols-[28px_1fr_60px] sm:grid-cols-[28px_1fr_70px_80px_50px_90px_70px]'
    : 'grid-cols-[28px_1fr_60px] sm:grid-cols-[28px_1fr_80px_100px_70px_auto]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.5), duration: 0.25 }}
      className={`grid ${gridCols} gap-2 sm:gap-3 items-center px-3 sm:px-4 py-3 bg-card hover:bg-surface-hover rounded-lg border border-border/50 transition-colors group`}
    >
      {/* Play button */}
      <button
        onClick={handleTogglePlay}
        className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors shrink-0"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>

      {/* File name */}
      <div className="min-w-0 overflow-hidden">
        <p className="text-sm font-medium truncate">{file.name}</p>
      </div>

      {/* BPM */}
      <div className="text-center">
        {file.status === 'analyzing' && (
          <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" />
        )}
        {file.status === 'error' && (
          <AlertCircle className="h-4 w-4 text-destructive mx-auto" />
        )}
        {file.status === 'done' && file.bpm !== null && (
          <span className="font-mono font-bold text-sm" style={{ color: getBpmColor(file.bpm) }}>
            {file.bpm}
          </span>
        )}
        {file.status === 'pending' && (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Key + Camelot (shown when showKey) */}
      {showKey && (
        <div className="text-center hidden sm:block">
          {file.keyStatus === 'analyzing' && (
            <Loader2 className="h-4 w-4 animate-spin text-accent mx-auto" />
          )}
          {file.keyStatus === 'error' && (
            <AlertCircle className="h-4 w-4 text-destructive mx-auto" />
          )}
          {file.keyStatus === 'done' && file.key && (
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded"
              style={{
                color: getKeyColor(file.camelot || ''),
                backgroundColor: `${getKeyColor(file.camelot || '')}15`,
              }}
            >
              {file.camelot}
            </span>
          )}
          {file.keyStatus === 'idle' && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      )}

      {/* Camelot badge on mobile when key shown */}
      {showKey && (
        <div className="text-center hidden sm:block">
          {file.keyStatus === 'done' && file.key && (
            <span className="text-[11px] font-mono text-muted-foreground truncate">
              {file.key}
            </span>
          )}
        </div>
      )}

      {/* Duration */}
      <div className="text-center font-mono text-sm text-muted-foreground hidden sm:block">
        {file.duration > 0 ? formatDuration(file.duration) : '—'}
      </div>

      {/* Format */}
      <div className="text-center hidden sm:block">
        <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
          {file.format}
        </span>
      </div>

      {/* BPM Category (only in non-key mode) */}
      {!showKey && (
        <div className="text-right min-w-[80px] hidden sm:block">
          {file.bpm !== null && file.status === 'done' && (
            <span
              className="text-xs font-medium px-2 py-1 rounded-full"
              style={{
                color: getBpmColor(file.bpm),
                backgroundColor: `${getBpmColor(file.bpm)}15`,
              }}
            >
              {file.bpm < 90 ? '< 90' : file.bpm <= 110 ? '90–110' : file.bpm <= 125 ? '110–125' : file.bpm <= 140 ? '125–140' : '> 140'} BPM
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
