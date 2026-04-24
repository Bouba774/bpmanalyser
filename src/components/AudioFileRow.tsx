import { motion } from 'framer-motion';
import { AudioFileInfo, formatDuration } from '@/lib/audio-types';
import { energyColor, energyIcon, energyLabel } from '@/lib/energy-detector';
import { Loader2, AlertCircle, Play, Pause } from 'lucide-react';
import { getKeyColor } from '@/lib/key-utils';

interface AudioFileRowProps {
  file: AudioFileInfo;
  index: number;
  playingId: string | null;
  onPlay: (id: string, file: File) => void;
  onStop: () => void;
}

export function AudioFileRow({ file, index, playingId, onPlay, onStop }: AudioFileRowProps) {
  const isPlaying = playingId === file.id;

  const handleTogglePlay = () => {
    if (isPlaying) onStop();
    else onPlay(file.id, file.file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.5), duration: 0.25 }}
      className="flex items-start gap-3 px-4 py-3 bg-card rounded-xl border border-border/50 transition-colors active:bg-surface-hover"
      onClick={handleTogglePlay}
      role="button"
      tabIndex={0}
    >
      <button
        className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary transition-colors shrink-0 touch-target"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm font-medium leading-tight truncate">{file.name}</p>

        <div className="flex items-center gap-3 flex-wrap">
          {file.status === 'analyzing' && (
            <span className="flex items-center gap-1 text-xs text-primary">
              <Loader2 className="h-3 w-3 animate-spin" /> Analyse...
            </span>
          )}
          {file.status === 'error' && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" /> Erreur
            </span>
          )}
          {file.status === 'pending' && (
            <span className="text-xs text-muted-foreground">En attente</span>
          )}

          {/* Key + Camelot */}
          {file.keyStatus === 'done' && file.key && (
            <>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  color: getKeyColor(file.camelot || ''),
                  backgroundColor: `${getKeyColor(file.camelot || '')}20`,
                }}
              >
                {file.camelot}
              </span>
              <span className="text-xs text-muted-foreground font-mono">{file.key}</span>
            </>
          )}

          {/* Energy */}
          {file.energy !== null && (
            <span
              className="text-xs font-mono font-bold flex items-center gap-1"
              style={{ color: energyColor(file.energy) }}
            >
              <span>{energyIcon(file.energy)}</span>
              <span>{file.energy.toFixed(1)}</span>
              {file.energyLevel && (
                <span className="opacity-70 text-[10px]">{energyLabel(file.energyLevel)}</span>
              )}
            </span>
          )}

          {file.duration > 0 && (
            <span className="text-xs font-mono text-muted-foreground">
              {formatDuration(file.duration)}
            </span>
          )}

          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
            {file.format}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
