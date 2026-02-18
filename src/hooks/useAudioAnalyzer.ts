import { useState, useCallback, useRef } from 'react';
import { AudioFileInfo, isAudioFile, getFileExtension } from '@/lib/audio-types';
import { detectBpm, detectBpmFromArrayBuffer } from '@/lib/bpm-detector';
import { detectKey, detectKeyFromArrayBuffer } from '@/lib/key-detector';
import { isNativePlatform } from '@/lib/native-file-service';
import SAFFolderPicker, { SAFFile } from '@/plugins/saf-folder-picker';
import { toast } from 'sonner';

let idCounter = 0;

export function useAudioAnalyzer() {
  const [files, setFiles] = useState<AudioFileInfo[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingKeys, setIsAnalyzingKeys] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [keyProgress, setKeyProgress] = useState({ current: 0, total: 0 });
  const [folderUri, setFolderUri] = useState<string | null>(null);
  const abortRef = useRef(false);
  const abortKeyRef = useRef(false);
  // Cache ArrayBuffers for native files so key analysis doesn't re-read
  const nativeBufferCache = useRef<Map<string, ArrayBuffer>>(new Map());

  const createFileInfo = (name: string, path: string, size: number, file: File | null, safUri?: string): AudioFileInfo => ({
    id: `file-${++idCounter}`,
    name,
    path,
    format: getFileExtension(name),
    size,
    duration: 0,
    bpm: null,
    key: null,
    camelot: null,
    keyConfidence: null,
    keyStatus: 'idle',
    status: 'pending',
    file: file as File,
    safUri,
  });

  // Web-based file scanning
  const scanFiles = useCallback(async (fileList: FileList) => {
    const audioFiles: AudioFileInfo[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (isAudioFile(file.name)) {
        audioFiles.push(createFileInfo(
          file.name,
          (file as any).webkitRelativePath || file.name,
          file.size,
          file,
        ));
      }
    }

    setFiles(audioFiles);
    setIsAnalyzing(true);
    setProgress({ current: 0, total: audioFiles.length });
    abortRef.current = false;

    for (let i = 0; i < audioFiles.length; i++) {
      if (abortRef.current) break;
      setFiles(prev => prev.map(f => f.id === audioFiles[i].id ? { ...f, status: 'analyzing' } : f));

      try {
        const result = await detectBpm(audioFiles[i].file);
        setFiles(prev => prev.map(f =>
          f.id === audioFiles[i].id ? { ...f, bpm: result.bpm, duration: result.duration, status: 'done', keyStatus: 'analyzing' } : f
        ));
        // Auto key detection right after BPM
        try {
          const keyResult = await detectKey(audioFiles[i].file);
          setFiles(prev => prev.map(f =>
            f.id === audioFiles[i].id ? { ...f, key: keyResult.key, camelot: keyResult.camelot, keyConfidence: keyResult.confidence, keyStatus: 'done' } : f
          ));
        } catch {
          setFiles(prev => prev.map(f =>
            f.id === audioFiles[i].id ? { ...f, keyStatus: 'error' } : f
          ));
        }
      } catch (err) {
        setFiles(prev => prev.map(f =>
          f.id === audioFiles[i].id ? { ...f, status: 'error', error: (err as Error).message } : f
        ));
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
    nativeBufferCache.current.clear();

    try {
      const result = await SAFFolderPicker.pickFolder();
      setFolderUri(result.folderUri);
      toast.success(`Dossier "${result.folderName}" sélectionné — ${result.files.length} fichier(s) audio`);

      const audioFiles: AudioFileInfo[] = result.files.map((f: SAFFile) =>
        createFileInfo(f.name, f.uri, f.size, null as any, f.uri)
      );

      setFiles(audioFiles);
      setIsAnalyzing(true);
      setProgress({ current: 0, total: audioFiles.length });
      abortRef.current = false;

      for (let i = 0; i < audioFiles.length; i++) {
        if (abortRef.current) break;
        setFiles(prev => prev.map(f => f.id === audioFiles[i].id ? { ...f, status: 'analyzing' } : f));

        try {
          const content = await SAFFolderPicker.readFileContent({ uri: audioFiles[i].path });
          const binaryStr = atob(content.data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let j = 0; j < binaryStr.length; j++) {
            bytes[j] = binaryStr.charCodeAt(j);
          }
          const arrayBuffer = bytes.buffer;
          // Cache buffer for key analysis
          nativeBufferCache.current.set(audioFiles[i].id, arrayBuffer.slice(0));

          const bpmResult = await detectBpmFromArrayBuffer(arrayBuffer);
          setFiles(prev => prev.map(f =>
            f.id === audioFiles[i].id ? { ...f, bpm: bpmResult.bpm, duration: bpmResult.duration, status: 'done', keyStatus: 'analyzing' } : f
          ));
          // Auto key detection right after BPM
          try {
            const cachedBuf = nativeBufferCache.current.get(audioFiles[i].id);
            const keyResult = await detectKeyFromArrayBuffer(cachedBuf || arrayBuffer);
            setFiles(prev => prev.map(f =>
              f.id === audioFiles[i].id ? { ...f, key: keyResult.key, camelot: keyResult.camelot, keyConfidence: keyResult.confidence, keyStatus: 'done' } : f
            ));
          } catch {
            setFiles(prev => prev.map(f =>
              f.id === audioFiles[i].id ? { ...f, keyStatus: 'error' } : f
            ));
          }
        } catch (err) {
          setFiles(prev => prev.map(f =>
            f.id === audioFiles[i].id ? { ...f, status: 'error', error: (err as Error).message } : f
          ));
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
    }
  }, []);

  // Key analysis — runs on files that already have BPM done
  const analyzeKeys = useCallback(async () => {
    const isNative = isNativePlatform();
    setIsAnalyzingKeys(true);
    abortKeyRef.current = false;

    // Get current files snapshot
    const currentFiles = await new Promise<AudioFileInfo[]>(resolve => {
      setFiles(prev => {
        resolve(prev);
        return prev;
      });
    });

    const eligibleFiles = currentFiles.filter(f => f.status === 'done' && f.keyStatus !== 'done');
    setKeyProgress({ current: 0, total: eligibleFiles.length });

    for (let i = 0; i < eligibleFiles.length; i++) {
      if (abortKeyRef.current) break;
      const fileInfo = eligibleFiles[i];

      setFiles(prev => prev.map(f => f.id === fileInfo.id ? { ...f, keyStatus: 'analyzing' } : f));

      try {
        let keyResult;

        if (isNative && fileInfo.safUri) {
          // Try cached buffer first
          let buffer = nativeBufferCache.current.get(fileInfo.id);
          if (!buffer) {
            const content = await SAFFolderPicker.readFileContent({ uri: fileInfo.safUri });
            const binaryStr = atob(content.data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);
            buffer = bytes.buffer;
          }
          keyResult = await detectKeyFromArrayBuffer(buffer);
        } else {
          keyResult = await detectKey(fileInfo.file);
        }

        setFiles(prev => prev.map(f =>
          f.id === fileInfo.id ? {
            ...f,
            key: keyResult.key,
            camelot: keyResult.camelot,
            keyConfidence: keyResult.confidence,
            keyStatus: 'done',
          } : f
        ));
      } catch (err) {
        setFiles(prev => prev.map(f =>
          f.id === fileInfo.id ? { ...f, keyStatus: 'error', keyError: (err as Error).message } : f
        ));
      }

      setKeyProgress({ current: i + 1, total: eligibleFiles.length });
    }

    setIsAnalyzingKeys(false);
    // Clear cache to free memory
    nativeBufferCache.current.clear();
  }, []);

  const stopAnalysis = useCallback(() => {
    abortRef.current = true;
    abortKeyRef.current = true;
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setProgress({ current: 0, total: 0 });
    setKeyProgress({ current: 0, total: 0 });
    setFolderUri(null);
    nativeBufferCache.current.clear();
  }, []);

  return {
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
  };
}
