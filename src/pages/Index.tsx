import { useMemo, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Download, Trash2, StopCircle, Activity, FolderSync } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAudioAnalyzer } from '@/hooks/useAudioAnalyzer';
import { AnalysisProgress } from '@/components/AnalysisProgress';
import { FilterBar } from '@/components/FilterBar';
import { AudioFileRow } from '@/components/AudioFileRow';
import { MiniPlayer } from '@/components/MiniPlayer';
import { RenameDialog } from '@/components/RenameDialog';
import { exportToPdf } from '@/lib/pdf-export';
import { isNativePlatform } from '@/lib/native-file-service';
import {
  AudioFileInfo,
  FilterConfig,
  SortConfig,
  BPM_GROUPS,
  getBpmColor,
} from '@/lib/audio-types';

const Index = () => {
  const { files, isAnalyzing, progress, folderUri, scanFiles, pickNativeFolder, stopAnalysis, clearFiles } = useAudioAnalyzer();
  const isNative = isNativePlatform();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<FilterConfig>({ search: '', bpmMin: null, bpmMax: null });
  const [sort, setSort] = useState<SortConfig>({ key: 'bpm', direction: 'asc' });
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingFile, setPlayingFile] = useState<File | null>(null);
  const [playingName, setPlayingName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);

  const handlePlay = useCallback((id: string, file: File) => {
    const audioFile = files.find(f => f.id === id);
    setPlayingId(id);
    setPlayingFile(file);
    setPlayingName(audioFile?.name || '');
    setIsPlaying(true);
  }, [files]);

  const handleStopPlayer = useCallback(() => {
    setPlayingId(null);
    setPlayingFile(null);
    setPlayingName('');
    setIsPlaying(false);
  }, []);

  const handleTogglePlayer = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleFolderSelect = () => {
    if (isNative) {
      pickNativeFolder();
    } else {
      folderInputRef.current?.click();
    }
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      scanFiles(e.target.files);
    }
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...files];

    // Filter
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q));
    }
    if (filter.bpmMin !== null) {
      result = result.filter(f => f.bpm !== null && f.bpm >= filter.bpmMin!);
    }
    if (filter.bpmMax !== null) {
      result = result.filter(f => f.bpm !== null && f.bpm <= filter.bpmMax!);
    }

    // Sort
    result.sort((a, b) => {
      const dir = sort.direction === 'asc' ? 1 : -1;
      switch (sort.key) {
        case 'bpm':
          return ((a.bpm ?? 999) - (b.bpm ?? 999)) * dir;
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'duration':
          return (a.duration - b.duration) * dir;
        case 'format':
          return a.format.localeCompare(b.format) * dir;
        default:
          return 0;
      }
    });

    return result;
  }, [files, filter, sort]);

  const groupedFiles = useMemo(() => {
    const groups: { label: string; color: string; files: AudioFileInfo[] }[] = BPM_GROUPS.map(g => ({
      label: g.label,
      color: getBpmColor(g.min === 0 ? 60 : g.min),
      files: [],
    }));

    filteredAndSorted.forEach(f => {
      if (f.bpm === null) return;
      if (f.bpm < 90) groups[0].files.push(f);
      else if (f.bpm <= 110) groups[1].files.push(f);
      else if (f.bpm <= 125) groups[2].files.push(f);
      else if (f.bpm <= 140) groups[3].files.push(f);
      else groups[4].files.push(f);
    });

    return groups.filter(g => g.files.length > 0);
  }, [filteredAndSorted]);

  const doneCount = files.filter(f => f.status === 'done').length;
  const hasFiles = files.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Hidden folder input */}
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        {...({ webkitdirectory: 'true', directory: 'true' } as any)}
        multiple
        onChange={handleFilesSelected}
      />

      {/* Header */}
      <header className="border-b border-border sticky top-0 z-10 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">
              <span className="gradient-text">BPM</span>{' '}
              <span className="text-foreground">Analyzer</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {hasFiles && !isAnalyzing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode(v => v === 'list' ? 'grouped' : 'list')}
                >
                  {viewMode === 'list' ? 'Grouper' : 'Liste'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRenameOpen(true)}
                  disabled={doneCount === 0}
                >
                  <FolderSync className="h-4 w-4 mr-1" />
                  Réorganiser
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToPdf(filteredAndSorted)}
                  disabled={doneCount === 0}
                >
                  <Download className="h-4 w-4 mr-1" />
                  PDF
                </Button>
                <Button variant="ghost" size="sm" onClick={clearFiles}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            {isAnalyzing && (
              <Button variant="destructive" size="sm" onClick={stopAnalysis}>
                <StopCircle className="h-4 w-4 mr-1" />
                Stop
              </Button>
            )}
            <Button onClick={handleFolderSelect} disabled={isAnalyzing} size="sm">
              <FolderOpen className="h-4 w-4 mr-1" />
              Dossier
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* Progress */}
        {progress.total > 0 && (
          <AnalysisProgress
            current={progress.current}
            total={progress.total}
            isAnalyzing={isAnalyzing}
          />
        )}

        {/* Empty State */}
        {!hasFiles && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-32 space-y-6"
          >
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center">
                <Activity className="h-10 w-10 text-primary animate-pulse-glow" />
              </div>
              <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">BPM Analyzer</h2>
              <p className="text-muted-foreground max-w-md">
                Sélectionnez un dossier contenant vos fichiers audio pour détecter automatiquement les BPM.
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                MP3 · WAV · FLAC · AAC · M4A
              </p>
            </div>
            <Button onClick={handleFolderSelect} size="lg" className="glow-border">
              <FolderOpen className="h-5 w-5 mr-2" />
              Sélectionner un dossier
            </Button>
          </motion.div>
        )}

        {/* Filters */}
        {hasFiles && (
          <FilterBar
            filter={filter}
            sort={sort}
            onFilterChange={setFilter}
            onSortChange={setSort}
          />
        )}

        {/* Stats */}
        {hasFiles && doneCount > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{filteredAndSorted.length} fichier(s)</span>
            {doneCount > 0 && (
              <span className="font-mono text-primary">
                Moy: {Math.round(
                  filteredAndSorted
                    .filter(f => f.bpm !== null)
                    .reduce((sum, f) => sum + f.bpm!, 0) /
                  (filteredAndSorted.filter(f => f.bpm !== null).length || 1)
                )} BPM
              </span>
            )}
          </div>
        )}

        {/* List View */}
        {hasFiles && viewMode === 'list' && (
          <div className="space-y-1">
            {/* Header row */}
            <div className="grid grid-cols-[28px_1fr_60px] sm:grid-cols-[28px_1fr_80px_100px_70px_auto] gap-2 sm:gap-4 px-3 sm:px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span></span>
              <span>Fichier</span>
              <span className="text-center">BPM</span>
              <span className="text-center hidden sm:block">Durée</span>
              <span className="text-center hidden sm:block">Format</span>
              <span className="text-right hidden sm:block">Catégorie</span>
            </div>
            {filteredAndSorted.map((file, i) => (
              <AudioFileRow key={file.id} file={file} index={i} playingId={playingId} onPlay={handlePlay} onStop={handleStopPlayer} />
            ))}
          </div>
        )}

        {/* Grouped View */}
        {hasFiles && viewMode === 'grouped' && (
          <div className="space-y-6">
            {groupedFiles.map((group) => (
              <div key={group.label} className="space-y-2">
                <div className="flex items-center gap-3 px-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <h3 className="text-sm font-bold" style={{ color: group.color }}>
                    {group.label}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    ({group.files.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {group.files.map((file, i) => (
                    <AudioFileRow key={file.id} file={file} index={i} playingId={playingId} onPlay={handlePlay} onStop={handleStopPlayer} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        files={files}
      />

      <MiniPlayer
        file={playingFile}
        fileName={playingName}
        isPlaying={isPlaying}
        onStop={handleStopPlayer}
        onToggle={handleTogglePlayer}
      />
    </div>
  );
};

export default Index;
