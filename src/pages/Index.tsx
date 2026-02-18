import { useMemo, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Download, Trash2, StopCircle, Activity, FolderSync, RefreshCw, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAudioAnalyzer } from '@/hooks/useAudioAnalyzer';
import { AnalysisProgress } from '@/components/AnalysisProgress';
import { FilterBar } from '@/components/FilterBar';
import { AudioFileRow } from '@/components/AudioFileRow';
import { MiniPlayer } from '@/components/MiniPlayer';
import { RenameDialog } from '@/components/RenameDialog';
import { exportToPdf } from '@/lib/pdf-export';
import { isNativePlatform } from '@/lib/native-file-service';
import { camelotSortValue } from '@/lib/key-utils';
import SAFFolderPicker from '@/plugins/saf-folder-picker';
import { toast } from 'sonner';
import {
  AudioFileInfo,
  FilterConfig,
  SortConfig,
  BPM_GROUPS,
  getBpmColor,
} from '@/lib/audio-types';

const Index = () => {
  const {
    files, isAnalyzing, isAnalyzingKeys, progress, keyProgress,
    folderUri, scanFiles, pickNativeFolder, analyzeKeys, stopAnalysis, clearFiles,
  } = useAudioAnalyzer();
  const isNative = isNativePlatform();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<FilterConfig>({ search: '', bpmMin: null, bpmMax: null, keyFilter: null, modeFilter: null, camelotFilter: null });
  const [sort, setSort] = useState<SortConfig>({ key: 'bpm', direction: 'asc' });
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingFile, setPlayingFile] = useState<File | null>(null);
  const [playingName, setPlayingName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const hasKeys = files.some(f => f.keyStatus === 'done');
  const bpmDoneCount = files.filter(f => f.status === 'done').length;
  const canAnalyzeKeys = bpmDoneCount > 0 && !isAnalyzing && !isAnalyzingKeys;

  const handleScanMediaStore = useCallback(async () => {
    if (!folderUri) { toast.error('Aucun dossier sélectionné'); return; }
    setIsScanning(true);
    try {
      const result = await SAFFolderPicker.scanFolder({ folderUri });
      toast.success(`${result.scannedCount} fichier(s) synchronisé(s) avec le MediaStore`);
    } catch (e: any) {
      toast.error('Erreur de scan: ' + (e?.message || e));
    } finally {
      setIsScanning(false);
    }
  }, [folderUri]);

  const handlePlay = useCallback(async (id: string, file: File) => {
    const audioFile = files.find(f => f.id === id);
    if (!audioFile) return;

    if (isNative && audioFile.safUri && (!file || file.size === 0)) {
      try {
        const content = await SAFFolderPicker.readFileContent({ uri: audioFile.safUri });
        const binaryStr = atob(content.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);
        const mimeType = audioFile.format === 'mp3' ? 'audio/mpeg' : `audio/${audioFile.format}`;
        const blob = new Blob([bytes], { type: mimeType });
        const nativeFile = new File([blob], audioFile.name, { type: mimeType });
        setPlayingId(id);
        setPlayingFile(nativeFile);
        setPlayingName(audioFile.name);
        setIsPlaying(true);
      } catch {
        toast.error('Impossible de lire le fichier audio');
      }
      return;
    }

    setPlayingId(id);
    setPlayingFile(file);
    setPlayingName(audioFile?.name || '');
    setIsPlaying(true);
  }, [files, isNative]);

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
    if (isNative) pickNativeFolder();
    else folderInputRef.current?.click();
  };

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
    if (filter.modeFilter) result = result.filter(f => f.key?.includes(filter.modeFilter!));
    if (filter.camelotFilter) result = result.filter(f => f.camelot === filter.camelotFilter);

    result.sort((a, b) => {
      const dir = sort.direction === 'asc' ? 1 : -1;
      switch (sort.key) {
        case 'bpm': return ((a.bpm ?? 999) - (b.bpm ?? 999)) * dir;
        case 'name': return a.name.localeCompare(b.name) * dir;
        case 'duration': return (a.duration - b.duration) * dir;
        case 'format': return a.format.localeCompare(b.format) * dir;
        case 'key': return (a.key || 'ZZZ').localeCompare(b.key || 'ZZZ') * dir;
        case 'camelot': return (camelotSortValue(a.camelot || '') - camelotSortValue(b.camelot || '')) * dir;
        default: return 0;
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

  const hasFiles = files.length > 0;

  const headerGridCols = hasKeys
    ? 'grid-cols-[28px_1fr_60px] sm:grid-cols-[28px_1fr_70px_80px_50px_90px_70px]'
    : 'grid-cols-[28px_1fr_60px] sm:grid-cols-[28px_1fr_80px_100px_70px_auto]';

  return (
    <div className="min-h-screen bg-background">
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
            {hasFiles && !isAnalyzing && !isAnalyzingKeys && (
              <>
                {canAnalyzeKeys && !hasKeys && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={analyzeKeys}
                    className="border-accent/50 text-accent hover:bg-accent/10"
                  >
                    <Music className="h-4 w-4 mr-1" />
                    Keys
                  </Button>
                )}
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
                  disabled={bpmDoneCount === 0}
                >
                  <FolderSync className="h-4 w-4 mr-1" />
                  Réorganiser
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToPdf(filteredAndSorted, hasKeys)}
                  disabled={bpmDoneCount === 0}
                >
                  <Download className="h-4 w-4 mr-1" />
                  PDF
                </Button>
                {isNative && folderUri && (
                  <Button variant="outline" size="sm" onClick={handleScanMediaStore} disabled={isScanning}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${isScanning ? 'animate-spin' : ''}`} />
                    Sync
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={clearFiles}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            {(isAnalyzing || isAnalyzingKeys) && (
              <Button variant="destructive" size="sm" onClick={stopAnalysis}>
                <StopCircle className="h-4 w-4 mr-1" />
                Stop
              </Button>
            )}
            <span className="text-xs text-muted-foreground italic">By ALPHA FX</span>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* BPM Progress */}
        {progress.total > 0 && (
          <AnalysisProgress
            current={progress.current}
            total={progress.total}
            isAnalyzing={isAnalyzing}
            label="BPM"
          />
        )}

        {/* Key Progress */}
        {keyProgress.total > 0 && (
          <AnalysisProgress
            current={keyProgress.current}
            total={keyProgress.total}
            isAnalyzing={isAnalyzingKeys}
            label="Key"
            color="hsl(var(--accent))"
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
                Sélectionnez un dossier contenant vos fichiers audio pour détecter automatiquement les BPM et tonalités.
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
            hasKeys={hasKeys}
          />
        )}

        {/* Stats */}
        {hasFiles && bpmDoneCount > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span>{filteredAndSorted.length} fichier(s)</span>
            <span className="font-mono text-primary">
              Moy: {Math.round(
                filteredAndSorted.filter(f => f.bpm !== null).reduce((sum, f) => sum + f.bpm!, 0) /
                (filteredAndSorted.filter(f => f.bpm !== null).length || 1)
              )} BPM
            </span>
            {hasKeys && (
              <span className="font-mono text-accent">
                {files.filter(f => f.keyStatus === 'done').length} key(s) détectée(s)
              </span>
            )}
          </div>
        )}

        {/* List View */}
        {hasFiles && viewMode === 'list' && (
          <div className="space-y-1">
            <div className={`grid ${headerGridCols} gap-2 sm:gap-3 px-3 sm:px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider`}>
              <span></span>
              <span>Fichier</span>
              <span className="text-center">BPM</span>
              {hasKeys && <span className="text-center hidden sm:block">Camelot</span>}
              {hasKeys && <span className="text-center hidden sm:block">Key</span>}
              <span className="text-center hidden sm:block">Durée</span>
              <span className="text-center hidden sm:block">Format</span>
              {!hasKeys && <span className="text-right hidden sm:block">Catégorie</span>}
            </div>
            {filteredAndSorted.map((file, i) => (
              <AudioFileRow key={file.id} file={file} index={i} playingId={playingId} onPlay={handlePlay} onStop={handleStopPlayer} showKey={hasKeys} />
            ))}
          </div>
        )}

        {/* Grouped View */}
        {hasFiles && viewMode === 'grouped' && (
          <div className="space-y-6">
            {groupedFiles.map((group) => (
              <div key={group.label} className="space-y-2">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                  <h3 className="text-sm font-bold" style={{ color: group.color }}>{group.label}</h3>
                  <span className="text-xs text-muted-foreground">({group.files.length})</span>
                </div>
                <div className="space-y-1">
                  {group.files.map((file, i) => (
                    <AudioFileRow key={file.id} file={file} index={i} playingId={playingId} onPlay={handlePlay} onStop={handleStopPlayer} showKey={hasKeys} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <RenameDialog open={renameOpen} onOpenChange={setRenameOpen} files={files} />
      <MiniPlayer file={playingFile} fileName={playingName} isPlaying={isPlaying} onStop={handleStopPlayer} onToggle={handleTogglePlayer} />
    </div>
  );
};

export default Index;
