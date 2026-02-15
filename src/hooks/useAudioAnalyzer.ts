import { useState, useCallback, useRef } from 'react';
import { AudioFileInfo, isAudioFile, getFileExtension } from '@/lib/audio-types';
import { detectBpm, detectBpmFromArrayBuffer } from '@/lib/bpm-detector';
import { isNativePlatform } from '@/lib/native-file-service';
import SAFFolderPicker, { SAFFile } from '@/plugins/saf-folder-picker';
import { toast } from 'sonner';

let idCounter = 0;

export function useAudioAnalyzer() {
  const [files, setFiles] = useState<AudioFileInfo[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [folderUri, setFolderUri] = useState<string | null>(null);
  const abortRef = useRef(false);

  // Web-based file scanning (fallback for non-native)
  const scanFiles = useCallback(async (fileList: FileList) => {
    const audioFiles: AudioFileInfo[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (isAudioFile(file.name)) {
        audioFiles.push({
          id: `file-${++idCounter}`,
          name: file.name,
          path: (file as any).webkitRelativePath || file.name,
          format: getFileExtension(file.name),
          size: file.size,
          duration: 0,
          bpm: null,
          status: 'pending',
          file,
        });
      }
    }

    setFiles(audioFiles);
    setIsAnalyzing(true);
    setProgress({ current: 0, total: audioFiles.length });
    abortRef.current = false;

    for (let i = 0; i < audioFiles.length; i++) {
      if (abortRef.current) break;

      setFiles(prev =>
        prev.map(f => f.id === audioFiles[i].id ? { ...f, status: 'analyzing' } : f)
      );

      try {
        const result = await detectBpm(audioFiles[i].file);
        setFiles(prev =>
          prev.map(f =>
            f.id === audioFiles[i].id
              ? { ...f, bpm: result.bpm, duration: result.duration, status: 'done' }
              : f
          )
        );
      } catch (err) {
        setFiles(prev =>
          prev.map(f =>
            f.id === audioFiles[i].id
              ? { ...f, status: 'error', error: (err as Error).message }
              : f
          )
        );
      }

      setProgress({ current: i + 1, total: audioFiles.length });
    }

    setIsAnalyzing(false);
  }, []);

  // Native SAF folder picker
  const pickNativeFolder = useCallback(async () => {
    if (!isNativePlatform()) {
      toast.error('Le sélecteur de dossier natif nécessite l\'application Android.');
      return;
    }

    toast.info('Ouverture du sélecteur de dossier...');

    try {
      const result = await SAFFolderPicker.pickFolder();
      setFolderUri(result.folderUri);
      toast.success(`Dossier "${result.folderName}" sélectionné — ${result.files.length} fichier(s) audio`);

      const audioFiles: AudioFileInfo[] = result.files.map((f: SAFFile) => ({
        id: `file-${++idCounter}`,
        name: f.name,
        path: f.uri,
        format: getFileExtension(f.name),
        size: f.size,
        duration: 0,
        bpm: null,
        status: 'pending' as const,
        file: null as any,
        safUri: f.uri,
      }));

      setFiles(audioFiles);
      setIsAnalyzing(true);
      setProgress({ current: 0, total: audioFiles.length });
      abortRef.current = false;

      for (let i = 0; i < audioFiles.length; i++) {
        if (abortRef.current) break;

        setFiles(prev =>
          prev.map(f => f.id === audioFiles[i].id ? { ...f, status: 'analyzing' } : f)
        );

        try {
          const content = await SAFFolderPicker.readFileContent({ uri: audioFiles[i].path });
          const binaryStr = atob(content.data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let j = 0; j < binaryStr.length; j++) {
            bytes[j] = binaryStr.charCodeAt(j);
          }
          const arrayBuffer = bytes.buffer;

          const bpmResult = await detectBpmFromArrayBuffer(arrayBuffer);
          setFiles(prev =>
            prev.map(f =>
              f.id === audioFiles[i].id
                ? { ...f, bpm: bpmResult.bpm, duration: bpmResult.duration, status: 'done' }
                : f
            )
          );
        } catch (err) {
          setFiles(prev =>
            prev.map(f =>
              f.id === audioFiles[i].id
                ? { ...f, status: 'error', error: (err as Error).message }
                : f
            )
          );
        }

        setProgress({ current: i + 1, total: audioFiles.length });
      }

      setIsAnalyzing(false);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('annulée') || msg.includes('cancel')) {
        toast.info('Sélection de dossier annulée.');
      } else {
        toast.error(`Erreur SAF: ${msg}`);
      }
      console.error('SAF folder pick error:', err);
    }
  }, []);

  const stopAnalysis = useCallback(() => {
    abortRef.current = true;
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setProgress({ current: 0, total: 0 });
    setFolderUri(null);
  }, []);

  return {
    files,
    isAnalyzing,
    progress,
    folderUri,
    scanFiles,
    pickNativeFolder,
    stopAnalysis,
    clearFiles,
  };
}
