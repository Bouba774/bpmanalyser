import { useEffect, useState } from 'react';
import {
  generateHarmonicPlaylist,
  EnergyMode,
  MixMode,
  HarmonicPlaylist,
} from '@/lib/harmonic-mix-engine';
import { AudioFileInfo } from '@/lib/audio-types';

interface Props {
  files: AudioFileInfo[];
}

export default function HarmonyMixView({ files }: Props) {

  /* ---------------- STATES ---------------- */

  const [energyMode, setEnergyMode] = useState<EnergyMode>('harmonic');
  const [mixMode, setMixMode] = useState<MixMode>('flexible');
  const [playlist, setPlaylist] = useState<HarmonicPlaylist | null>(null);

  /* ---------------- ENGINE ---------------- */

  useEffect(() => {
    if (!files || files.length === 0) {
      setPlaylist(null);
      return;
    }

    const result = generateHarmonicPlaylist(
      files,
      mixMode,
      8,           // bpmTolerance
      energyMode   // 🔥 harmonic | hot-cold | cold-hot
    );

    setPlaylist(result);
  }, [files, mixMode, energyMode]);

  /* ---------------- UI ---------------- */

  return (
    <div className="w-full px-3 pb-6 safe-area-bottom">

      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold glow-text">
          Harmonic Mix
        </h2>

        <span className="text-[10px] opacity-50">
          DJ Flow Engine
        </span>
      </div>

      {/* ===== ENERGY MODES ===== */}
      <div className="w-full mt-2 mb-4">

        <div className="text-xs opacity-60 mb-2">
          Mode de mix
        </div>

        <div className="flex gap-2 w-full">

          <button
            onClick={() => setEnergyMode('harmonic')}
            className={`flex-1 touch-target rounded-xl text-xs py-3 transition-all
              ${energyMode === 'harmonic'
                ? 'bg-purple-600 text-white shadow-lg glow-box'
                : 'bg-secondary text-foreground'
              }`}
          >
            🎼 Harmonic
          </button>

          <button
            onClick={() => setEnergyMode('hot-cold')}
            className={`flex-1 touch-target rounded-xl text-xs py-3 transition-all
              ${energyMode === 'hot-cold'
                ? 'bg-red-500 text-white shadow-lg glow-box'
                : 'bg-secondary text-foreground'
              }`}
          >
            🔥 Hot → Cold
          </button>

          <button
            onClick={() => setEnergyMode('cold-hot')}
            className={`flex-1 touch-target rounded-xl text-xs py-3 transition-all
              ${energyMode === 'cold-hot'
                ? 'bg-blue-500 text-white shadow-lg glow-box'
                : 'bg-secondary text-foreground'
              }`}
          >
            ❄️ Cold → Hot
          </button>

        </div>
      </div>

      {/* ===== PLAYLIST INFO ===== */}
      {playlist && (
        <div className="text-[11px] opacity-60 mb-2">
          Mode: {playlist.mode} • {playlist.tracks.length} tracks
        </div>
      )}

      {/* ===== PLAYLIST ===== */}
      <div className="flex flex-col gap-2">

        {playlist?.tracks.map((track, index) => (
          <div
            key={track.id}
            className="w-full rounded-xl bg-card px-3 py-2 glow-box"
          >
            <div className="flex justify-between items-center">

              <div className="flex flex-col overflow-hidden">

                <span className="text-xs font-medium truncate">
                  {index + 1}. {track.name}
                </span>

                <span className="text-[10px] opacity-60">
                  {track.bpm} BPM • {track.key} • {track.camelot}
                </span>

              </div>

              <div className="text-[10px] opacity-50 ml-2">
                {track.duration ? `${Math.round(track.duration)}s` : ''}
              </div>

            </div>
          </div>
        ))}

        {/* Empty state */}
        {playlist && playlist.tracks.length === 0 && (
          <div className="text-xs opacity-50 text-center py-6">
            Aucun fichier compatible (BPM + Key requis)
          </div>
        )}

      </div>
    </div>
  );
}