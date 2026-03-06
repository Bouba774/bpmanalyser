import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Route, ChevronDown, Play, Square, Sliders, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AudioFileInfo, formatDuration } from '@/lib/audio-types';
import { getKeyColor } from '@/lib/key-utils';
import {
  buildModulationPath,
  ModulationPath,
  modulationIcon,
  modulationLabel,
  modulationColor,
} from '@/lib/harmonic-modulation-engine';

interface ModulationPathViewProps {
  files: AudioFileInfo[];
  onBack: () => void;
  onPlay: (id: string, file: File) => void;
  onStop: () => void;
  playingId: string | null;
}

export function ModulationPathView({ files, onBack, onPlay, onStop, playingId }: ModulationPathViewProps) {
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [maxPivots, setMaxPivots] = useState(4);
  const [bpmTolerance, setBpmTolerance] = useState(10);
  const [showSettings, setShowSettings] = useState(false);

  const eligible = useMemo(
    () => files.filter(f => f.bpm !== null && f.camelot !== null && f.status === 'done' && f.keyStatus === 'done'),
    [files]
  );

  const fromTrack = eligible.find(f => f.id === fromId) || null;
  const toTrack = eligible.find(f => f.id === toId) || null;

  const modulation: ModulationPath | null = useMemo(() => {
    if (!fromTrack || !toTrack || fromTrack.id === toTrack.id) return null;
    return buildModulationPath(fromTrack, toTrack, eligible, maxPivots, bpmTolerance);
  }, [fromTrack, toTrack, eligible, maxPivots, bpmTolerance]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border sticky top-0 z-30 bg-background/90 backdrop-blur-xl safe-area-top">
        <div className="flex items-center justify-between h-14 px-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="touch-target">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">
              <span className="gradient-text">Modulation</span>{' '}
              <span className="text-foreground">Engine</span>
            </h1>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">
        {/* Track selectors */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Track de départ</label>
          <TrackSelector
            tracks={eligible}
            selectedId={fromId}
            onSelect={setFromId}
            excludeId={toId}
            playingId={playingId}
            onPlay={onPlay}
            onStop={onStop}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Track d'arrivée</label>
          <TrackSelector
            tracks={eligible}
            selectedId={toId}
            onSelect={setToId}
            excludeId={fromId}
            playingId={playingId}
            onPlay={onPlay}
            onStop={onStop}
          />
        </div>

        {/* Settings */}
        <button
          onClick={() => setShowSettings(s => !s)}
          className="flex items-center gap-2 text-sm text-muted-foreground w-full justify-center py-2"
        >
          <Sliders className="h-3 w-3" />
          Paramètres
          <ChevronDown className={`h-3 w-3 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-card rounded-xl p-4 border border-border space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Pivots max</span>
                    <span className="font-mono text-primary">{maxPivots}</span>
                  </div>
                  <input type="range" min={1} max={6} value={maxPivots}
                    onChange={e => setMaxPivots(Number(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Tolérance BPM</span>
                    <span className="font-mono text-primary">±{bpmTolerance} BPM</span>
                  </div>
                  <input type="range" min={3} max={20} value={bpmTolerance}
                    onChange={e => setBpmTolerance(Number(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!fromTrack || !toTrack ? (
          <div className="text-center py-12 space-y-3">
            <Route className="h-12 w-12 text-muted-foreground mx-auto opacity-40" />
            <p className="text-muted-foreground text-sm">
              Sélectionnez un track de départ et un track d'arrivée pour calculer le chemin harmonique.
            </p>
          </div>
        ) : !modulation ? (
          <div className="text-center py-12 space-y-3">
            <Music className="h-12 w-12 text-destructive mx-auto opacity-60" />
            <p className="text-muted-foreground text-sm">
              Aucun chemin harmonique trouvé. Augmentez le nombre de pivots max.
            </p>
          </div>
        ) : (
          <>
            {/* Quality badge */}
            <div className="flex items-center justify-center gap-3">
              <span className="text-lg">{modulationIcon(modulation.quality)}</span>
              <span className="text-sm font-bold" style={{ color: modulationColor(modulation.quality) }}>
                Modulation {modulationLabel(modulation.quality)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({modulation.totalDistance} étape{modulation.totalDistance > 1 ? 's' : ''})
              </span>
            </div>

            {/* Modulation path */}
            <div className="space-y-0">
              {modulation.steps.map((step, i) => {
                const isFirst = i === 0;
                const isLast = i === modulation.steps.length - 1;
                const isPlaying = step.track && playingId === step.track.id;

                return (
                  <div key={i}>
                    {/* Connector */}
                    {!isFirst && (
                      <div className="flex items-center gap-2 py-1 px-3">
                        <div className="w-8 flex justify-center">
                          <div className="w-0.5 h-6 bg-border" />
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-muted-foreground">{step.relation}</span>
                        </div>
                      </div>
                    )}

                    {/* Step card */}
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => {
                        if (!step.track) return;
                        if (isPlaying) onStop();
                        else onPlay(step.track.id, step.track.file);
                      }}
                      className={`rounded-xl p-3 border transition-all cursor-pointer ${
                        isFirst || isLast
                          ? 'bg-primary/10 border-primary/40'
                          : step.track
                            ? 'bg-card border-border hover:border-primary/30'
                            : 'bg-card/50 border-dashed border-border opacity-60'
                      } ${isPlaying ? 'ring-2 ring-primary' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Step indicator */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isFirst || isLast ? 'bg-primary/20' : 'bg-secondary'
                        }`}>
                          {isFirst ? (
                            <span className="text-[10px] font-bold text-primary">A</span>
                          ) : isLast ? (
                            <span className="text-[10px] font-bold text-primary">B</span>
                          ) : (
                            <span className="text-[10px] font-bold text-muted-foreground">P{i}</span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          {step.track ? (
                            <>
                              <p className="text-sm font-medium truncate">{step.track.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-mono font-bold" style={{
                                  color: step.track.bpm
                                    ? step.track.bpm < 90 ? 'hsl(200,80%,55%)' : step.track.bpm <= 125 ? 'hsl(40,90%,55%)' : 'hsl(0,80%,55%)'
                                    : undefined
                                }}>
                                  {step.track.bpm} BPM
                                </span>
                                <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: getKeyColor(step.camelot) + '22',
                                    color: getKeyColor(step.camelot),
                                  }}>
                                  {step.camelot}
                                </span>
                                <span className="text-[11px] text-muted-foreground">{formatDuration(step.track.duration)}</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground italic">Aucun track en</span>
                              <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: getKeyColor(step.camelot) + '22',
                                  color: getKeyColor(step.camelot),
                                }}>
                                {step.camelot}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Play */}
                        {step.track && (
                          <div className="shrink-0">
                            {isPlaying ? (
                              <Square className="h-5 w-5 text-primary" />
                            ) : (
                              <Play className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="bg-card rounded-xl p-4 border border-border space-y-2">
              <h3 className="text-sm font-bold">Résumé modulation</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-primary">{modulation.steps.length}</div>
                  <div className="text-[11px] text-muted-foreground">Étapes</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-primary">{modulation.pivotTracks.length}</div>
                  <div className="text-[11px] text-muted-foreground">Pivots</div>
                </div>
                <div>
                  <div className="text-lg font-bold" style={{ color: modulationColor(modulation.quality) }}>
                    {modulationIcon(modulation.quality)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{modulationLabel(modulation.quality)}</div>
                </div>
              </div>
              {modulation.steps.some((s, i) => i > 0 && i < modulation.steps.length - 1 && !s.track) && (
                <p className="text-[11px] text-destructive/80 text-center pt-2 border-t border-border">
                  ⚠️ Pivots manquants — ajoutez des tracks dans ces tonalités pour un chemin complet
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* ---- Track Selector ---- */

function TrackSelector({
  tracks,
  selectedId,
  onSelect,
  excludeId,
  playingId,
  onPlay,
  onStop,
}: {
  tracks: AudioFileInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  excludeId: string | null;
  playingId: string | null;
  onPlay: (id: string, file: File) => void;
  onStop: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = tracks.find(t => t.id === selectedId);
  const filtered = tracks.filter(t => t.id !== excludeId);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full rounded-xl p-3 border border-border bg-card text-left flex items-center gap-3 transition-all hover:border-primary/30"
      >
        {selected ? (
          <>
            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: getKeyColor(selected.camelot || '') + '22',
                color: getKeyColor(selected.camelot || ''),
              }}>
              {selected.camelot}
            </span>
            <span className="text-sm truncate flex-1">{selected.name}</span>
            <span className="text-xs text-muted-foreground font-mono">{selected.bpm} BPM</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Sélectionner un track…</span>
        )}
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-1 rounded-xl border border-border bg-card max-h-48 overflow-y-auto">
              {filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onSelect(t.id); setOpen(false); }}
                  className={`w-full p-2.5 text-left flex items-center gap-2 text-sm hover:bg-secondary/50 transition-colors ${
                    t.id === selectedId ? 'bg-primary/10' : ''
                  }`}
                >
                  <span className="text-[10px] font-mono font-bold px-1 py-0.5 rounded shrink-0"
                    style={{
                      backgroundColor: getKeyColor(t.camelot || '') + '22',
                      color: getKeyColor(t.camelot || ''),
                    }}>
                    {t.camelot}
                  </span>
                  <span className="truncate flex-1">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">{t.bpm}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
