import { motion } from 'framer-motion';
import { AudioFileInfo, formatDuration, formatFileSize, getBpmGroup, getBpmColor } from '@/lib/audio-types';
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
      className="grid grid-cols-[1fr_60px_60px_50px] sm:grid-cols-[1fr_80px_100px_70px_auto] gap-2 sm:gap-4 items-center px-3 sm:px-4 py-3 bg-card hover:bg-surface-hover rounded-lg border border-border/50 transition-colors group"
    >
      {/* File name */}
      <div className="flex items-center gap-3 min-w-0">
        <Music className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0 overflow-hidden">
          <p className="text-sm font-medium truncate">{file.name}</p>
        </div>
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
          <span
            className="font-mono font-bold text-sm"
            style={{ color: getBpmColor(file.bpm) }}
          >
            {file.bpm}
          </span>
        )}
        {file.status === 'pending' && (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Duration */}
      <div className="text-center font-mono text-sm text-muted-foreground">
        {file.duration > 0 ? formatDuration(file.duration) : '—'}
      </div>

      {/* Format */}
      <div className="text-center hidden sm:block">
        <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
          {file.format}
        </span>
      </div>

      {/* BPM Category */}
      <div className="text-right min-w-[80px] hidden sm:block">
        {bpmGroup && (
          <span
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{
              color: getBpmColor(file.bpm!),
              backgroundColor: `${getBpmColor(file.bpm!)}15`,
            }}
          >
            {bpmGroup.label}
          </span>
        )}
      </div>
    </motion.div>
  );
}
