import { useMemo, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Download, Trash2, StopCircle, Activity, FolderSync, RefreshCw, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAudioAnalyzer } from '@/hooks/useAudioAnalyzer';
import { AnalysisProgress } from '@/components/AnalysisProgress';
import { FilterBar } from '@/components/FilterBar';
import { AudioFileRow } from '@/components/AudioFileRow';
import { MiniPlayer } from '@/components/MiniPlayer';
import { RenameDialog } from '@/components/RenameDialog';
import { HarmonicMixView } from '@/components/HarmonicMixView';
import { exportToPdf } from '@/lib/pdf-export';
import { isNativePlatform } from '@/lib/native-file-service';
import { camelotSortValue } from '@/lib/key-utils';
import SAFFolderPicker from '@/plugins/saf-folder-picker';
import { toast } from 'sonner';
import {
  AudioFileInfo,
  FilterConfig,
  SortConfig,
  ENERGY_GROUPS,
} from '@/lib/audio-types';
import { energyColor } from '@/lib/energy-detector';

const Index = () => {
  const {
    files, isAnalyzing, progress,
    folderUri, scanFiles, pickNativeFolder, stopAnalysis, clearFiles,
  } = useAudioAnalyzer();
  const isNative = isNativePlatform();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<FilterConfig>({ search: '', energyMin: null, energyMax: null, keyFilter: null, modeFilter: null, camelotFilter: null });
  const [sort, setSort] = useState<SortConfig>({ key: 'energy', direction: 'asc' });
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingFile, setPlayingFile] = useState<File | null>(null);
  const [playingName, setPlayingName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showHarmonicMix, setShowHarmonicMix] = useState(false);

  const hasKeys = files.some(f => f.keyStatus === 'done');
  const doneCount = files.filter(f => f.status === 'done').length;

  const handleScanMediaStore = useCallback(async () => {
    if (!folderUri) { toast.error('Aucun dossier sélectionné'); return; }
    setIsScanning(true);
    try {
      const result = await SAFFolderPicker.scanFolder({ folderUri });
      toast.success(`${result.scannedCount} fichier(s) synchronisé(s)`);
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

  const handleTogglePlayer = useCallback(() => setIsPlaying(p => !p), []);

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
    if (filter.energyMin !== null) result = result.filter(f => f.energy !== null && f.energy >= filter.energyMin!);
    if (filter.energyMax !== null) result = result.filter(f => f.energy !== null && f.energy <= filter.energyMax!);
    if (filter.modeFilter) result = result.filter(f => f.key?.includes(filter.modeFilter!));
    if (filter.camelotFilter) result = result.filter(f => f.camelot === filter.camelotFilter);

    result.sort((a, b) => {
      const dir = sort.direction === 'asc' ? 1 : -1;
      switch (sort.key) {
        case 'energy': return ((a.energy ?? 99) - (b.energy ?? 99)) * dir;
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
    const groups: { label: string; color: string; files: AudioFileInfo[] }[] = ENERGY_GROUPS.map(g => ({
      label: g.label,
      color: energyColor(g.min === 0 ? 1 : g.min + 0.1),
      files: [],
    }));

    filteredAndSorted.forEach(f => {
      if (f.energy === null) return;
      if (f.energy < 3) groups[0].files.push(f);
      else if (f.energy < 5.5) groups[1].files.push(f);
      else if (f.energy < 8) groups[2].files.push(f);
      else groups[3].files.push(f);
    });

    return groups.filter(g => g.files.length > 0);
  }, [filteredAndSorted]);

  const hasFiles = files.length > 0;

  if (showHarmonicMix) {
    return (
      <>
        <HarmonicMixView
          files={files}
          onBack={() => setShowHarmonicMix(false)}
          onPlay={handlePlay}
          onStop={handleStopPlayer}
          playingId={playingId}
        />
        <MiniPlayer file={playingFile} fileName={playingName} isPlaying={isPlaying} onStop={handleStopPlayer} onToggle={handleTogglePlayer} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        {...({ webkitdirectory: 'true', directory: 'true' } as any)}
        multiple
        onChange={handleFilesSelected}
      />

      <header className="border-b border-border sticky top-0 z-30 bg-background/90 backdrop-blur-xl safe-area-top">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">
              <span className="gradient-text">Key</span>{' '}
              <span className="text-foreground">& Energy</span>
            </h1>
          </div>
          <span className="text-xs text-muted-foreground italic">By ALPHA FX</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">
        {progress.total > 0 && (
          <AnalysisProgress
            current={progress.current}
            total={progress.total}
            isAnalyzing={isAnalyzing}
            label="Key + Énergie"
          />
        )}

        {!hasFiles && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 space-y-6"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
                <Activity className="h-9 w-9 text-primary animate-pulse-glow" />
              </div>
              <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
            </div>
            <div className="text-center space-y-2 px-4">
              <h2 className="text-xl font-bold">Key & Energy Analyzer</h2>
              <p className="text-muted-foreground text-sm">
                Sélectionnez un dossier pour détecter les tonalités et l'énergie de vos fichiers audio.
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                MP3 · WAV · FLAC · AAC · M4A
              </p>
            </div>
            <Button onClick={handleFolderSelect} size="lg" className="glow-border w-full max-w-xs h-14 text-base">
              <FolderOpen className="h-5 w-5 mr-2" />
              Sélectionner un dossier
            </Button>
          </motion.div>
        )}

        {hasFiles && !isAnalyzing && (
          <div className="grid grid-cols-2 gap-2">
            {hasKeys && (
              <Button
                onClick={() => setShowHarmonicMix(true)}
                className="h-12 text-sm col-span-2 bg-primary/90 hover:bg-primary"
              >
                <Headphones className="h-4 w-4 mr-2" />
                🎧 Harmonic Mix
              </Button>
            )}
            <Button
              variant="outline"
              className="h-12 text-sm"
              onClick={() => setViewMode(v => v === 'list' ? 'grouped' : 'list')}
            >
              {viewMode === 'list' ? 'Grouper par énergie' : 'Vue liste'}
            </Button>
            <Button
              variant="outline"
              className="h-12 text-sm"
              onClick={() => setRenameOpen(true)}
              disabled={doneCount === 0}
            >
              <FolderSync className="h-4 w-4 mr-2" />
              Réorganiser
            </Button>
            <Button
              variant="outline"
              className="h-12 text-sm"
              onClick={() => exportToPdf(filteredAndSorted, hasKeys)}
              disabled={doneCount === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            {isNative && folderUri && (
              <Button
                variant="outline"
                className="h-12 text-sm"
                onClick={handleScanMediaStore}
                disabled={isScanning}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                Sync MediaStore
              </Button>
            )}
            <Button
              variant="outline"
              className="h-12 text-sm text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={clearFiles}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Effacer
            </Button>
            <Button
              variant="outline"
              className="h-12 text-sm"
              onClick={handleFolderSelect}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Changer dossier
            </Button>
          </div>
        )}

        {isAnalyzing && (
          <Button variant="destructive" className="w-full h-12 text-sm" onClick={stopAnalysis}>
            <StopCircle className="h-4 w-4 mr-2" />
            Arrêter l'analyse
          </Button>
        )}

        {hasFiles && (
          <FilterBar
            filter={filter}
            sort={sort}
            onFilterChange={setFilter}
            onSortChange={setSort}
            hasKeys={hasKeys}
          />
        )}

        {hasFiles && doneCount > 0 && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span>{filteredAndSorted.length} fichier(s)</span>
            {(() => {
              const withE = filteredAndSorted.filter(f => f.energy !== null);
              const avg = withE.length > 0 ? withE.reduce((s, f) => s + (f.energy ?? 0), 0) / withE.length : 0;
              return (
                <span className="font-mono text-primary">
                  Énergie moy: {avg.toFixed(1)}
                </span>
              );
            })()}
            {hasKeys && (
              <span className="font-mono text-accent">
                {files.filter(f => f.keyStatus === 'done').length} key(s)
              </span>
            )}
          </div>
        )}

        {hasFiles && viewMode === 'list' && (
          <div className="space-y-2">
            {filteredAndSorted.map((file, i) => (
              <AudioFileRow key={file.id} file={file} index={i} playingId={playingId} onPlay={handlePlay} onStop={handleStopPlayer} />
            ))}
          </div>
        )}

        {hasFiles && viewMode === 'grouped' && (
          <div className="space-y-6">
            {groupedFiles.map((group) => (
              <div key={group.label} className="space-y-2">
                <div className="flex items-center gap-3 px-1">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                  <h3 className="text-sm font-bold" style={{ color: group.color }}>{group.label}</h3>
                  <span className="text-xs text-muted-foreground">({group.files.length})</span>
                </div>
                <div className="space-y-2">
                  {group.files.map((file, i) => (
                    <AudioFileRow key={file.id} file={file} index={i} playingId={playingId} onPlay={handlePlay} onStop={handleStopPlayer} />
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
