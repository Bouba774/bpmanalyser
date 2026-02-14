import { useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Download, Trash2, StopCircle, Activity, FileJson, FileSpreadsheet, LayoutDashboard, List, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAudioAnalyzer } from '@/hooks/useAudioAnalyzer';
import { AnalysisProgress } from '@/components/AnalysisProgress';
import { FilterBar } from '@/components/FilterBar';
import { AudioFileRow } from '@/components/AudioFileRow';
import { Dashboard } from '@/components/Dashboard';
import { exportToPdf, exportToCsv, exportToJson } from '@/lib/export-engine';
import {
  AudioFileInfo,
  FilterConfig,
  SortConfig,
  BPM_GROUPS,
  getBpmColor,
  ClusterMode,
  getEnergyColor,
  getMoodColor,
} from '@/lib/audio-types';
import { getCamelotColor } from '@/lib/camelot';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ViewMode = 'list' | 'grouped' | 'dashboard';

const ENERGY_ORDER = { low: 0, medium: 1, high: 2 };

const Index = () => {
  const { files, isAnalyzing, progress, scanFiles, stopAnalysis, clearFiles } = useAudioAnalyzer();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<FilterConfig>({ search: '', bpmMin: null, bpmMax: null, energy: null, mood: null, key: null, genre: null });
  const [sort, setSort] = useState<SortConfig>({ key: 'bpm', direction: 'asc' });
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [clusterMode, setClusterMode] = useState<ClusterMode>('bpm');

  const handleFolderSelect = () => folderInputRef.current?.click();
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) scanFiles(e.target.files);
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...files];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q));
    }
    if (filter.bpmMin !== null) result = result.filter(f => f.bpm !== null && f.bpm >= filter.bpmMin!);
    if (filter.bpmMax !== null) result = result.filter(f => f.bpm !== null && f.bpm <= filter.bpmMax!);
    if (filter.energy) result = result.filter(f => f.energy === filter.energy);
    if (filter.mood) result = result.filter(f => f.mood === filter.mood);
    if (filter.key) result = result.filter(f => f.key === filter.key);
    if (filter.genre) result = result.filter(f => f.genre === filter.genre);

    result.sort((a, b) => {
      const dir = sort.direction === 'asc' ? 1 : -1;
      switch (sort.key) {
        case 'bpm': return ((a.bpm ?? 999) - (b.bpm ?? 999)) * dir;
        case 'name': return a.name.localeCompare(b.name) * dir;
        case 'duration': return (a.duration - b.duration) * dir;
        case 'format': return a.format.localeCompare(b.format) * dir;
        case 'key': return (a.camelot || 'ZZ').localeCompare(b.camelot || 'ZZ') * dir;
        case 'energy': return ((ENERGY_ORDER[a.energy || 'low']) - (ENERGY_ORDER[b.energy || 'low'])) * dir;
        case 'mood': return (a.mood || '').localeCompare(b.mood || '') * dir;
        case 'genre': return (a.genre || '').localeCompare(b.genre || '') * dir;
        default: return 0;
      }
    });
    return result;
  }, [files, filter, sort]);

  const clusteredGroups = useMemo(() => {
    const groups: { label: string; color: string; files: AudioFileInfo[] }[] = [];
    const doneFiles = filteredAndSorted.filter(f => f.status === 'done');

    if (clusterMode === 'bpm') {
      const bpmGroups = BPM_GROUPS.map(g => ({ label: g.label, color: getBpmColor(g.min === 0 ? 60 : g.min), files: [] as AudioFileInfo[] }));
      doneFiles.forEach(f => {
        if (!f.bpm) return;
        if (f.bpm < 90) bpmGroups[0].files.push(f);
        else if (f.bpm <= 110) bpmGroups[1].files.push(f);
        else if (f.bpm <= 125) bpmGroups[2].files.push(f);
        else if (f.bpm <= 140) bpmGroups[3].files.push(f);
        else bpmGroups[4].files.push(f);
      });
      return bpmGroups.filter(g => g.files.length > 0);
    }

    if (clusterMode === 'energy') {
      const map: Record<string, AudioFileInfo[]> = {};
      doneFiles.forEach(f => { if (f.energy) (map[f.energy] ||= []).push(f); });
      return Object.entries(map).map(([k, v]) => ({ label: k.toUpperCase(), color: getEnergyColor(k as any), files: v }));
    }

    if (clusterMode === 'mood') {
      const map: Record<string, AudioFileInfo[]> = {};
      doneFiles.forEach(f => { if (f.mood) (map[f.mood] ||= []).push(f); });
      return Object.entries(map).map(([k, v]) => ({ label: k, color: getMoodColor(k as any), files: v }));
    }

    if (clusterMode === 'key') {
      const map: Record<string, AudioFileInfo[]> = {};
      doneFiles.forEach(f => { if (f.camelot) (map[f.camelot] ||= []).push(f); });
      return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ label: k, color: getCamelotColor(k), files: v }));
    }

    if (clusterMode === 'genre') {
      const map: Record<string, AudioFileInfo[]> = {};
      doneFiles.forEach(f => { if (f.genre) (map[f.genre] ||= []).push(f); });
      return Object.entries(map).map(([k, v]) => ({ label: k.toUpperCase(), color: 'hsl(var(--primary))', files: v }));
    }

    // hybrid: group by energy then sort by BPM within
    const map: Record<string, AudioFileInfo[]> = {};
    doneFiles.forEach(f => {
      const key = `${f.energy || 'unknown'} / ${f.mood || 'unknown'}`;
      (map[key] ||= []).push(f);
    });
    return Object.entries(map).map(([k, v]) => ({ label: k, color: 'hsl(var(--primary))', files: v.sort((a, b) => (a.bpm ?? 0) - (b.bpm ?? 0)) }));
  }, [filteredAndSorted, clusterMode]);

  const doneCount = files.filter(f => f.status === 'done').length;
  const hasFiles = files.length > 0;

  const clusterOptions: { value: ClusterMode; label: string }[] = [
    { value: 'bpm', label: 'BPM' },
    { value: 'energy', label: 'Énergie' },
    { value: 'mood', label: 'Mood' },
    { value: 'key', label: 'Tonalité' },
    { value: 'genre', label: 'Genre' },
    { value: 'hybrid', label: 'Hybride' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <input ref={folderInputRef} type="file" className="hidden" {...({ webkitdirectory: 'true', directory: 'true' } as any)} multiple onChange={handleFilesSelected} />

      {/* Header */}
      <header className="border-b border-border sticky top-0 z-10 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">
              <span className="gradient-text">BPM</span>{' '}
              <span className="text-foreground">Analyzer Pro</span>
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            {hasFiles && !isAnalyzing && (
              <>
                {/* View mode buttons */}
                <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')} className="h-8 w-8 p-0">
                  <List className="h-3.5 w-3.5" />
                </Button>
                <Button variant={viewMode === 'grouped' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('grouped')} className="h-8 w-8 p-0">
                  <Layers className="h-3.5 w-3.5" />
                </Button>
                <Button variant={viewMode === 'dashboard' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('dashboard')} className="h-8 w-8 p-0">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                </Button>

                {/* Cluster mode (for grouped view) */}
                {viewMode === 'grouped' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs h-8">
                        {clusterOptions.find(c => c.value === clusterMode)?.label}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {clusterOptions.map(c => (
                        <DropdownMenuItem key={c.value} onClick={() => setClusterMode(c.value)}>{c.label}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Export menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={doneCount === 0} className="h-8">
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => exportToPdf(filteredAndSorted)}>
                      <Download className="h-3.5 w-3.5 mr-2" /> PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportToCsv(filteredAndSorted)}>
                      <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportToJson(filteredAndSorted)}>
                      <FileJson className="h-3.5 w-3.5 mr-2" /> JSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="ghost" size="sm" onClick={clearFiles} className="h-8 w-8 p-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {isAnalyzing && (
              <Button variant="destructive" size="sm" onClick={stopAnalysis} className="h-8">
                <StopCircle className="h-3.5 w-3.5 mr-1" /> Stop
              </Button>
            )}
            <Button onClick={handleFolderSelect} disabled={isAnalyzing} size="sm" className="h-8">
              <FolderOpen className="h-3.5 w-3.5 mr-1" /> Dossier
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-4 space-y-4">
        {progress.total > 0 && <AnalysisProgress current={progress.current} total={progress.total} isAnalyzing={isAnalyzing} />}

        {/* Empty State */}
        {!hasFiles && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-32 space-y-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center">
                <Activity className="h-10 w-10 text-primary animate-pulse-glow" />
              </div>
              <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">BPM Analyzer Pro</h2>
              <p className="text-muted-foreground max-w-md">
                Analyse complète : BPM, tonalité, énergie, mood, genre, Camelot.
              </p>
              <p className="text-xs text-muted-foreground font-mono">MP3 · WAV · FLAC · AAC · M4A</p>
            </div>
            <Button onClick={handleFolderSelect} size="lg" className="glow-border">
              <FolderOpen className="h-5 w-5 mr-2" /> Sélectionner un dossier
            </Button>
          </motion.div>
        )}

        {hasFiles && <FilterBar filter={filter} sort={sort} onFilterChange={setFilter} onSortChange={setSort} />}

        {/* Stats */}
        {hasFiles && doneCount > 0 && viewMode !== 'dashboard' && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{filteredAndSorted.length} fichier(s)</span>
            <span className="font-mono text-primary">
              Moy: {Math.round(filteredAndSorted.filter(f => f.bpm !== null).reduce((sum, f) => sum + f.bpm!, 0) / (filteredAndSorted.filter(f => f.bpm !== null).length || 1))} BPM
            </span>
          </div>
        )}

        {/* Dashboard View */}
        {hasFiles && viewMode === 'dashboard' && <Dashboard files={filteredAndSorted} />}

        {/* List View */}
        {hasFiles && viewMode === 'list' && (
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_60px_70px_50px_60px_70px_70px_60px_auto] gap-3 px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <span>Fichier</span>
              <span className="text-center">BPM</span>
              <span className="text-center">Tonalité</span>
              <span className="text-center">NRJ</span>
              <span className="text-center">Mood</span>
              <span className="text-center">Genre</span>
              <span className="text-center">Durée</span>
              <span className="text-center">Fmt</span>
              <span className="text-right">Cat.</span>
            </div>
            {filteredAndSorted.map((file, i) => <AudioFileRow key={file.id} file={file} index={i} />)}
          </div>
        )}

        {/* Grouped View */}
        {hasFiles && viewMode === 'grouped' && (
          <div className="space-y-5">
            {clusteredGroups.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                  <h3 className="text-sm font-bold capitalize" style={{ color: group.color }}>{group.label}</h3>
                  <span className="text-xs text-muted-foreground">({group.files.length})</span>
                </div>
                <div className="space-y-1">
                  {group.files.map((file, i) => <AudioFileRow key={file.id} file={file} index={i} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
