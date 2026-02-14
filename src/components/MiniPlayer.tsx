import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, X } from 'lucide-react';

interface MiniPlayerProps {
  file: File | null;
  fileName: string;
  isPlaying: boolean;
  onStop: () => void;
  onToggle: () => void;
}

export function MiniPlayer({ file, fileName, isPlaying, onStop, onToggle }: MiniPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Create/destroy audio element when file changes
  useEffect(() => {
    if (!file) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const url = URL.createObjectURL(file);
    urlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration > 0) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    });

    audio.addEventListener('ended', () => {
      onStop();
    });

    audio.play();

    return () => {
      audio.pause();
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Sync play/pause state
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
  }, [duration]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {file && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border px-4 py-3 safe-area-bottom"
        >
          <div className="container flex items-center gap-3 max-w-3xl mx-auto">
            {/* Play/Pause */}
            <button
              onClick={onToggle}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground shrink-0 hover:opacity-90 transition-opacity"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>

            {/* Info + Progress */}
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <div
                className="h-1.5 bg-secondary rounded-full cursor-pointer"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-primary rounded-full transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Close */}
            <button
              onClick={onStop}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
