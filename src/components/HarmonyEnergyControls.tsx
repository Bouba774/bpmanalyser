import { EnergyMode } from '@/lib/harmonic-mix-engine';

interface Props {
  energyMode: EnergyMode;
  setEnergyMode: (mode: EnergyMode) => void;
}

export default function HarmonyEnergyControls({ energyMode, setEnergyMode }: Props) {
  return (
    <div className="w-full mt-3 px-2">

      <div className="text-xs opacity-60 mb-2">
        Mode de mix
      </div>

      <div className="flex gap-2 w-full">

        <button
          onClick={() => setEnergyMode('harmonic')}
          className={`flex-1 touch-target rounded-xl text-xs py-3 transition-all
            ${energyMode === 'harmonic'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-secondary text-foreground'
            }`}
        >
          🎼 Harmonic
        </button>

        <button
          onClick={() => setEnergyMode('hot-cold')}
          className={`flex-1 touch-target rounded-xl text-xs py-3 transition-all
            ${energyMode === 'hot-cold'
              ? 'bg-red-500 text-white shadow-lg'
              : 'bg-secondary text-foreground'
            }`}
        >
          🔥 Hot → Cold
        </button>

        <button
          onClick={() => setEnergyMode('cold-hot')}
          className={`flex-1 touch-target rounded-xl text-xs py-3 transition-all
            ${energyMode === 'cold-hot'
              ? 'bg-blue-500 text-white shadow-lg'
              : 'bg-secondary text-foreground'
            }`}
        >
          ❄️ Cold → Hot
        </button>

      </div>
    </div>
  );
}