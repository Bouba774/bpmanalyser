import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  FilterConfig, SortConfig, SortKey,
  ALL_ENERGIES, ALL_MOODS, ALL_GENRES, ALL_KEYS,
  EnergyLevel, MoodTag, GenreTag, MusicalKey,
} from '@/lib/audio-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FilterBarProps {
  filter: FilterConfig;
  sort: SortConfig;
  onFilterChange: (filter: FilterConfig) => void;
  onSortChange: (sort: SortConfig) => void;
}

const sortOptions: { value: string; label: string }[] = [
  { value: 'bpm-asc', label: 'BPM ↑' },
  { value: 'bpm-desc', label: 'BPM ↓' },
  { value: 'name-asc', label: 'Nom A-Z' },
  { value: 'name-desc', label: 'Nom Z-A' },
  { value: 'key-asc', label: 'Tonalité ↑' },
  { value: 'key-desc', label: 'Tonalité ↓' },
  { value: 'energy-asc', label: 'Énergie ↑' },
  { value: 'energy-desc', label: 'Énergie ↓' },
  { value: 'duration-asc', label: 'Durée ↑' },
  { value: 'duration-desc', label: 'Durée ↓' },
];

export function FilterBar({ filter, sort, onFilterChange, onSortChange }: FilterBarProps) {
  const handleSortChange = (value: string) => {
    const [key, direction] = value.split('-') as [SortKey, 'asc' | 'desc'];
    onSortChange({ key, direction });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher..."
          value={filter.search}
          onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
          className="pl-10 bg-secondary border-border focus:ring-primary"
        />
      </div>

      {/* BPM Range */}
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <Input
          type="number"
          placeholder="Min"
          value={filter.bpmMin ?? ''}
          onChange={(e) => onFilterChange({ ...filter, bpmMin: e.target.value ? Number(e.target.value) : null })}
          className="w-16 bg-secondary border-border text-center font-mono text-xs"
        />
        <span className="text-muted-foreground text-xs">–</span>
        <Input
          type="number"
          placeholder="Max"
          value={filter.bpmMax ?? ''}
          onChange={(e) => onFilterChange({ ...filter, bpmMax: e.target.value ? Number(e.target.value) : null })}
          className="w-16 bg-secondary border-border text-center font-mono text-xs"
        />
      </div>

      {/* Energy filter */}
      <Select
        value={filter.energy || 'all'}
        onValueChange={(v) => onFilterChange({ ...filter, energy: v === 'all' ? null : v as EnergyLevel })}
      >
        <SelectTrigger className="w-[100px] bg-secondary border-border text-xs">
          <SelectValue placeholder="Énergie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Énergie</SelectItem>
          {ALL_ENERGIES.map(e => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Mood filter */}
      <Select
        value={filter.mood || 'all'}
        onValueChange={(v) => onFilterChange({ ...filter, mood: v === 'all' ? null : v as MoodTag })}
      >
        <SelectTrigger className="w-[110px] bg-secondary border-border text-xs">
          <SelectValue placeholder="Mood" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Mood</SelectItem>
          {ALL_MOODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Genre filter */}
      <Select
        value={filter.genre || 'all'}
        onValueChange={(v) => onFilterChange({ ...filter, genre: v === 'all' ? null : v as GenreTag })}
      >
        <SelectTrigger className="w-[100px] bg-secondary border-border text-xs">
          <SelectValue placeholder="Genre" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Genre</SelectItem>
          {ALL_GENRES.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select value={`${sort.key}-${sort.direction}`} onValueChange={handleSortChange}>
        <SelectTrigger className="w-[120px] bg-secondary border-border text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
