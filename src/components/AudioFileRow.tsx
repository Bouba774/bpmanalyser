import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AudioFileInfo, formatDuration, getBpmGroup, getBpmColor } from '@/lib/audio-types';
import { Music, Loader2, AlertCircle, Play, Pause } from 'lucide-react';

interface AudioFileRowProps {
  file: AudioFileInfo;
  index: number;
  playingId: string | null;
  onPlay: (id: string, file: File) => void;
  onStop: () => void;
}

export function AudioFileRow({ file, index, playingId, onPlay, onStop }: AudioFileRowProps) {
  const bpmGroup = file.bpm !== null ? getBpmGroup(file.bpm) : null;
  const isPlaying = playingId === file.id;

  const handleTogglePlay = () => {
    if (isPlaying) {
      onStop();
    } else {
      onPlay(file.id, file.file);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.5), duration: 0.25 }}
      className="grid grid-cols-[28px_1fr_60px] sm:grid-cols-[28px_1fr_80px_100px_70px_auto] gap-2 sm:gap-4 items-center px-3 sm:px-4 py-3 bg-card hover:bg-surface-hover rounded-lg border border-border/50 transition-colors group"
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
      <div className="text-center font-mono text-sm text-muted-foreground hidden sm:block">
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
