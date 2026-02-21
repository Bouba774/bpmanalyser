import { useMemo, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen, Download, Trash2, StopCircle, Activity,
  FolderSync, RefreshCw, Music, Headphones
} from 'lucide-react';

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
  BPM_GROUPS,
  getBpmColor,
} from '@/lib/audio-types';

const Index = () => {
  const {
    files,
    isAnalyzing,
    isAnalyzingKeys,
    progress,
    keyProgress,
    folderUri,
    scanFiles,
    pickNativeFolder,
    analyzeKeys,
    stopAnalysis,
    clearFiles,
  } = useAudioAnalyzer();

  const isNative = isNativePlatform();
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [filter, setFilter] = useState<FilterConfig>({
    search: '',
    bpmMin: null,
    bpmMax: null,
    keyFilter: null,
    modeFilter: null,
    camelotFilter: null
  });

  const [sort, setSort] = useState<SortConfig>({ key: 'bpm', direction: 'asc' });
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingFile, setPlayingFile] = useState<File | null>(null);
  const [playingName, setPlayingName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  const [renameOpen, setRenameOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showHarmonicMix, setShowHarmonicMix] = useState(false);

  const hasKeys = files.some(f => f.keyStatus === 'done');
  const bpmDoneCount = files.filter(f => f.status === 'done').length;
  const canAnalyzeKeys = bpmDoneCount > 0 && !isAnalyzing && !isAnalyzingKeys;

  /* ===================== MEDIASTORE SYNC ===================== */
  const handleScanMediaStore = useCallback(async () => {
    if (!folderUri) {
      toast.error('Aucun dossier sélectionné');
      return;
    }
    setIsScanning(true);
    try {
      const result = await SAFFolderPicker.scanFolder({ folderUri });
      toast.success(`${result.scannedCount} fichier(s) synchronisé(s)`);
    } catch (e: any) {
      toast.error('Erreur scan : ' + (e?.message || e));
    } finally {
      setIsScanning(false);
    }
  }, [folderUri]);

  /* ===================== PLAYER ===================== */
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
        toast.error('Lecture impossible');
      }
      return;
    }

    setPlayingId(id);
    setPlayingFile(file);
    setPlayingName(audioFile.name);
    setIsPlaying(true);
  }, [files, isNative]);

  const handleStopPlayer = useCallback(() => {
    setPlayingId(null);
    setPlayingFile(null);
    setPlayingName('');
    setIsPlaying(false);
  }, []);

  const handleTogglePlayer = useCallback(() => {
    setIsPlaying(p => !p);
  }, []);

  /* ===================== FOLDER ===================== */
  const handleFolderSelect = () => {
    if (isNative) pickNativeFolder();
    else folderInputRef.current?.click();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) scanFiles(e.target.files);
  };

  /* ===================== FILTER + SORT ===================== */
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
        case 'camelot':
          return (camelotSortValue(a.camelot || '') - camelotSortValue(b.camelot || '')) * dir;
        default: return 0;
      }
    });

    return result;
  }, [files, filter, sort]);

  /* ===================== GROUPED BPM ===================== */
  const groupedFiles = useMemo(() => {
    const groups: { label: string; color: string; files: AudioFileInfo[] }[] =
      BPM_GROUPS.map(g => ({
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
  const isWorking = isAnalyzing || isAnalyzingKeys;

  /* ===================== HARMONIC MIX VIEW ===================== */
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

        <MiniPlayer
          file={playingFile}
          fileName={playingName}
          isPlaying={isPlaying}
          onStop={handleStopPlayer}
          onToggle={handleTogglePlayer}
        />
      </>
    );
  }

  /* ===================== MAIN VIEW ===================== */
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

      {/* HEADER */}
      <header className="border-b border-border sticky top-0 z-30 bg-background/90 backdrop-blur-xl safe-area-top">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">
              <span className="gradient-text">BPM</span> Analyzer
            </h1>
          </div>
          <span className="text-xs text-muted-foreground italic">By ALPHA FX</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">
        {/* PROGRESS */}
        {progress.total > 0 && (
          <AnalysisProgress current={progress.current} total={progress.total} isAnalyzing={isAnalyzing} label="BPM" />
        )}

        {keyProgress.total > 0 && (
          <AnalysisProgress current={keyProgress.current} total={keyProgress.total} isAnalyzing={isAnalyzingKeys} label="Key" color="hsl(var(--accent))" />
        )}

        {/* EMPTY */}
        {!hasFiles && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 space-y-6">
            <Button onClick={handleFolderSelect} size="lg" className="glow-border w-full max-w-xs h-14">
              <FolderOpen className="h-5 w-5 mr-2" />
              Sélectionner un dossier
            </Button>
          </motion.div>
        )}

        {/* ACTIONS */}
        {hasFiles && !isWorking && (
          <div className="grid grid-cols-2 gap-2">
            {canAnalyzeKeys && !hasKeys && (
              <Button onClick={analyzeKeys} variant="outline" className="col-span-2">
                <Music className="h-4 w-4 mr-2" /> Analyser les tonalités
              </Button>
            )}

            {hasKeys && (
              <Button onClick={() => setShowHarmonicMix(true)} className="col-span-2 bg-primary/90">
                <Headphones className="h-4 w-4 mr-2" /> 🎧 Harmonic Mix
              </Button>
            )}

            <Button variant="outline" onClick={() => setViewMode(v => v === 'list' ? 'grouped' : 'list')}>
              {viewMode === 'list' ? 'Grouper BPM' : 'Vue liste'}
            </Button>

            <Button variant="outline" onClick={() => setRenameOpen(true)} disabled={bpmDoneCount === 0}>
              <FolderSync className="h-4 w-4 mr-2" /> Réorganiser
            </Button>

            <Button variant="outline" onClick={() => exportToPdf(filteredAndSorted, hasKeys)} disabled={bpmDoneCount === 0}>
              <Download className="h-4 w-4 mr-2" /> Export PDF
            </Button>

            {isNative && folderUri && (
              <Button variant="outline" onClick={handleScanMediaStore} disabled={isScanning}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                Sync MediaStore
              </Button>
            )}

            <Button variant="outline" className="text-destructive" onClick={clearFiles}>
              <Trash2 className="h-4 w-4 mr-2" /> Effacer
            </Button>

            <Button variant="outline" onClick={handleFolderSelect}>
              <FolderOpen className="h-4 w-4 mr-2" /> Changer dossier
            </Button>
          </div>
        )}

        {isWorking && (
          <Button variant="destructive" className="w-full" onClick={stopAnalysis}>
            <StopCircle className="h-4 w-4 mr-2" /> Arrêter l'analyse
          </Button>
        )}

        {/* FILTERS */}
        {hasFiles && (
          <FilterBar
            filter={filter}
            sort={sort}
            onFilterChange={setFilter}
            onSortChange={setSort}
            hasKeys={hasKeys}
          />
        )}

        {/* LIST */}
        {hasFiles && viewMode === 'list' && (
          <div className="space-y-2">
            {filteredAndSorted.map((file, i) => (
              <AudioFileRow
                key={file.id}
                file={file}
                index={i}
                playingId={playingId}
                onPlay={handlePlay}
                onStop={handleStopPlayer}
                showKey={hasKeys}
              />
            ))}
          </div>
        )}

        {/* GROUPED */}
        {hasFiles && viewMode === 'grouped' && (
          <div className="space-y-6">
            {groupedFiles.map(group => (
              <div key={group.label} className="space-y-2">
                <h3 className="font-bold" style={{ color: group.color }}>
                  {group.label} ({group.files.length})
                </h3>
                {group.files.map((file, i) => (
                  <AudioFileRow
                    key={file.id}
                    file={file}
                    index={i}
                    playingId={playingId}
                    onPlay={handlePlay}
                    onStop={handleStopPlayer}
                    showKey={hasKeys}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      <RenameDialog open={renameOpen} onOpenChange={setRenameOpen} files={files} />

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