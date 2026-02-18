import { Search, SlidersHorizontal, Music } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FilterConfig, SortConfig, SortKey } from '@/lib/audio-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ALL_CAMELOT_CODES } from '@/lib/key-utils';

interface FilterBarProps {
  filter: FilterConfig;
  sort: SortConfig;
  onFilterChange: (filter: FilterConfig) => void;
  onSortChange: (sort: SortConfig) => void;
  hasKeys?: boolean;
}

const sortOptions: { value: string; label: string }[] = [
  { value: 'bpm-asc', label: 'BPM ↑' },
  { value: 'bpm-desc', label: 'BPM ↓' },
  { value: 'name-asc', label: 'Nom A-Z' },
  { value: 'name-desc', label: 'Nom Z-A' },
  { value: 'duration-asc', label: 'Durée ↑' },
  { value: 'duration-desc', label: 'Durée ↓' },
  { value: 'key-asc', label: 'Key A-Z' },
  { value: 'key-desc', label: 'Key Z-A' },
  { value: 'camelot-asc', label: 'Camelot ↑' },
  { value: 'camelot-desc', label: 'Camelot ↓' },
];

export function FilterBar({ filter, sort, onFilterChange, onSortChange, hasKeys }: FilterBarProps) {
  const handleSortChange = (value: string) => {
    const [key, direction] = value.split('-') as [SortKey, 'asc' | 'desc'];
    onSortChange({ key, direction });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un fichier..."
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
          onChange={(e) =>
            onFilterChange({ ...filter, bpmMin: e.target.value ? Number(e.target.value) : null })
          }
          className="w-20 bg-secondary border-border text-center font-mono text-sm"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="number"
          placeholder="Max"
          value={filter.bpmMax ?? ''}
          onChange={(e) =>
            onFilterChange({ ...filter, bpmMax: e.target.value ? Number(e.target.value) : null })
          }
          className="w-20 bg-secondary border-border text-center font-mono text-sm"
        />
      </div>

      {/* Mode Filter */}
      {hasKeys && (
        <Select
          value={filter.modeFilter ?? 'all'}
          onValueChange={(v) => onFilterChange({ ...filter, modeFilter: v === 'all' ? null : v as 'major' | 'minor' })}
        >
          <SelectTrigger className="w-[110px] bg-secondary border-border">
            <Music className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="major">Major</SelectItem>
            <SelectItem value="minor">Minor</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Camelot Filter */}
      {hasKeys && (
        <Select
          value={filter.camelotFilter ?? 'all'}
          onValueChange={(v) => onFilterChange({ ...filter, camelotFilter: v === 'all' ? null : v })}
        >
          <SelectTrigger className="w-[100px] bg-secondary border-border">
            <SelectValue placeholder="Camelot" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Camelot</SelectItem>
            {ALL_CAMELOT_CODES.map(code => (
              <SelectItem key={code} value={code}>{code}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Sort */}
      <Select value={`${sort.key}-${sort.direction}`} onValueChange={handleSortChange}>
        <SelectTrigger className="w-[140px] bg-secondary border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
