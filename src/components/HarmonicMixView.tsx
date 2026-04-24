import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Headphones, Play, Square, Download, Zap, ChevronDown, ChevronUp, Music, FolderSync, Circle, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AudioFileInfo, formatDuration } from '@/lib/audio-types';
import {
  generateHarmonicPlaylist,
  MixMode,
  HarmonicPlaylist,
  TransitionQuality,
} from '@/lib/harmonic-mix-engine';
import { getKeyColor } from '@/lib/key-utils';
import { exportHarmonicPdf } from '@/lib/pdf-export-harmonic';
import { CamelotWheel } from '@/components/CamelotWheel';
import { ModulationPathView } from '@/components/ModulationPathView';
import { isNativePlatform, renameFilesNatively } from '@/lib/native-file-service';
import { toast } from 'sonner';

interface HarmonicMixViewProps {
  files: AudioFileInfo[];
  onBack: () => void;
  onPlay: (id: string, file: File) => void;
  onStop: () => void;
  playingId: string | null;
}

const MODE_LABELS: Record<MixMode, { label: string; desc: string }> = {
  strict: { label: 'Strict', desc: 'Énergie ≤1, clé parfaite' },
  flexible: { label: 'Flexible', desc: 'Énergie ≤2, clé proche' },
  creative: { label: 'Créatif', desc: 'Énergie large, mix audacieux' },
};

function qualityIcon(q: TransitionQuality) {
  switch (q) {
    case 'perfect': return '🟢';
    case 'good': return '🟡';
    case 'risky': return '🔴';
  }
}

function qualityLabel(q: TransitionQuality) {
  switch (q) {
    case 'perfect': return 'Parfaite';
    case 'good': return 'Correcte';
    case 'risky': return 'Risquée';
  }
}

export function HarmonicMixView({ files, onBack, onPlay, onStop, playingId }: HarmonicMixViewProps) {
  const [mode, setMode] = useState<MixMode>('flexible');
  const [energyTolerance, setEnergyTolerance] = useState(2.5);
  const [showSettings, setShowSettings] = useState(false);
  const [showWheel, setShowWheel] = useState(true);
  const [isReordering, setIsReordering] = useState(false);
  const [showModulation, setShowModulation] = useState(false);
  const isNative = isNativePlatform();

  const playlist: HarmonicPlaylist = useMemo(
    () => generateHarmonicPlaylist(files, mode, energyTolerance, 'harmonic'),
    [files, mode, energyTolerance],
  );

  const eligibleCount = files.filter(f => f.energy !== null && f.camelot !== null && f.status === 'done' && f.keyStatus === 'done').length;

  const handleExportPdf = useCallback(() => {
    exportHarmonicPdf(playlist);
  }, [playlist]);

  const handleReorderFiles = useCallback(async () => {
    if (!isNative || playlist.tracks.length === 0) {
      toast.error('Renommage natif requis (Capacitor)');
      return;
    }
    setIsReordering(true);
    try {
      const filesToRename = playlist.tracks.map((track) => ({
        name: track.name,
        energy: track.energy!,
        camelot: track.camelot!,
        uri: track.safUri || track.path,
      }));
      const options = {
        format: 'numeric_energy' as const,
        sortOrder: 'asc' as const,
      };
      const res = await renameFilesNatively(filesToRename, options);
      if (res.errors.length === 0) {
        toast.success(`${res.success} fichier(s) réorganisé(s) selon le mix harmonique`);
      } else {
        toast.error(`${res.errors.length} erreur(s) lors de la réorganisation`);
      }
    } catch (e: any) {
      toast.error('Erreur: ' + (e?.message || e));
    } finally {
      setIsReordering(false);
    }
  }, [isNative, playlist.tracks]);

  if (showModulation) {
    return (
      <ModulationPathView
        files={files}
        onBack={() => setShowModulation(false)}
        onPlay={onPlay}
        onStop={onStop}
        playingId={playingId}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-30 bg-background/90 backdrop-blur-xl safe-area-top">
        <div className="flex items-center justify-between h-14 px-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="touch-target">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">
              <span className="gradient-text">Harmonic</span>{' '}
              <span className="text-foreground">Flow</span>
            </h1>
          </div>
          <div className="w-10" /> {/* spacer */}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">
        {/* Stats bar */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{playlist.tracks.length} / {eligibleCount} tracks</span>
          {playlist.transitions.length > 0 && (
            <span className="font-mono text-primary">
              Score moy: {playlist.avgScore}
            </span>
          )}
        </div>

        {/* Camelot Wheel */}
        {playlist.tracks.length > 0 && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setShowWheel(w => !w)}
              className="flex items-center justify-between w-full p-3 text-sm font-semibold"
            >
              <div className="flex items-center gap-2">
                <Circle className="h-4 w-4 text-primary" />
                Roue Camelot
              </div>
              {showWheel ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            <AnimatePresence>
              {showWheel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3">
                    <CamelotWheel tracks={playlist.tracks} transitions={playlist.transitions} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-2">
          {(['strict', 'flexible', 'creative'] as MixMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-xl py-3 px-2 text-center transition-all touch-target border ${
                mode === m
                  ? 'bg-primary/15 border-primary text-primary'
                  : 'bg-card border-border text-muted-foreground'
              }`}
            >
              <div className="text-sm font-semibold">{MODE_LABELS[m].label}</div>
              <div className="text-[10px] mt-0.5 opacity-70">{MODE_LABELS[m].desc}</div>
            </button>
          ))}
        </div>

        {/* Advanced settings toggle */}
        <button
          onClick={() => setShowSettings(s => !s)}
          className="flex items-center gap-2 text-sm text-muted-foreground w-full justify-center py-2"
        >
          <Zap className="h-3 w-3" />
          Paramètres avancés
          {showSettings ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-card rounded-xl p-4 border border-border space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Tolérance BPM</span>
                    <span className="font-mono text-primary">±{bpmTolerance} BPM</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={15}
                    value={bpmTolerance}
                    onChange={e => setBpmTolerance(Number(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleExportPdf}
            variant="outline"
            className="h-12 text-sm"
            disabled={playlist.tracks.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button
            onClick={() => {
              if (playlist.tracks.length > 0) {
                const first = playlist.tracks[0];
                onPlay(first.id, first.file);
              }
            }}
            className="h-12 text-sm"
            disabled={playlist.tracks.length === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            Lancer le mix
          </Button>
          <Button
            onClick={handleReorderFiles}
            variant="outline"
            className="h-12 text-sm col-span-2 border-primary/30 text-primary hover:bg-primary/10"
            disabled={playlist.tracks.length === 0 || isReordering}
          >
            <FolderSync className={`h-4 w-4 mr-2 ${isReordering ? 'animate-spin' : ''}`} />
            {isReordering ? 'Réorganisation…' : 'Réorganiser fichiers selon le mix'}
          </Button>
          <Button
            onClick={() => setShowModulation(true)}
            variant="outline"
            className="h-12 text-sm col-span-2 border-accent/30 text-accent hover:bg-accent/10"
            disabled={eligibleCount < 2}
          >
            <Route className="h-4 w-4 mr-2" />
            🎛️ Modulation Engine
          </Button>
        </div>

        {/* Empty state */}
        {playlist.tracks.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <Music className="h-12 w-12 text-muted-foreground mx-auto opacity-40" />
            <p className="text-muted-foreground text-sm">
              Aucun morceau éligible. Analysez d'abord le BPM et les Keys de vos fichiers.
            </p>
          </div>
        )}

        {/* Playlist */}
        <div className="space-y-0">
          {playlist.tracks.map((track, i) => {
            const transition = playlist.transitions[i - 1]; // transition leading TO this track
            const isCurrentlyPlaying = playingId === track.id;

            return (
              <div key={track.id}>
                {/* Transition indicator */}
                {transition && (
                  <div className="flex items-center gap-2 py-2 px-3">
                    <div className="flex-1 h-px bg-border" />
                    <div className="flex items-center gap-1.5 text-[11px] shrink-0">
                      <span>{qualityIcon(transition.quality)}</span>
                      <span className="text-muted-foreground">{transition.camelotRelation}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-mono text-muted-foreground">Δ{transition.bpmDelta} BPM</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-mono text-primary">{transition.score}pts</span>
                    </div>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                {/* Track card */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => {
                    if (isCurrentlyPlaying) onStop();
                    else onPlay(track.id, track.file);
                  }}
                  className={`rounded-xl p-3 border transition-all active:scale-[0.98] cursor-pointer ${
                    isCurrentlyPlaying
                      ? 'bg-primary/10 border-primary/40'
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Order number */}
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{track.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs font-mono font-bold" style={{ color: track.bpm ? (track.bpm < 90 ? 'hsl(200,80%,55%)' : track.bpm <= 125 ? 'hsl(40,90%,55%)' : 'hsl(0,80%,55%)') : undefined }}>
                          {track.bpm} BPM
                        </span>
                        {track.camelot && (
                          <span
                            className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: getKeyColor(track.camelot) + '22', color: getKeyColor(track.camelot) }}
                          >
                            {track.camelot}
                          </span>
                        )}
                        {track.key && (
                          <span className="text-[11px] text-muted-foreground">{track.key}</span>
                        )}
                        <span className="text-[11px] text-muted-foreground">{formatDuration(track.duration)}</span>
                      </div>
                    </div>

                    {/* Play indicator */}
                    <div className="shrink-0">
                      {isCurrentlyPlaying ? (
                        <Square className="h-5 w-5 text-primary" />
                      ) : (
                        <Play className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {playlist.transitions.length > 0 && (
          <div className="bg-card rounded-xl p-4 border border-border space-y-2">
            <h3 className="text-sm font-bold">Résumé du mix</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-primary">{playlist.tracks.length}</div>
                <div className="text-[11px] text-muted-foreground">Tracks</div>
              </div>
              <div>
                <div className="text-lg font-bold text-primary">{playlist.avgScore}</div>
                <div className="text-[11px] text-muted-foreground">Score moy.</div>
              </div>
              <div>
                <div className="text-lg font-bold text-primary">
                  {playlist.transitions.filter(t => t.quality === 'perfect').length}
                </div>
                <div className="text-[11px] text-muted-foreground">🟢 Parfaites</div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
              <span>🟢 {playlist.transitions.filter(t => t.quality === 'perfect').length} parfaite(s)</span>
              <span>🟡 {playlist.transitions.filter(t => t.quality === 'good').length} correcte(s)</span>
              <span>🔴 {playlist.transitions.filter(t => t.quality === 'risky').length} risquée(s)</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
