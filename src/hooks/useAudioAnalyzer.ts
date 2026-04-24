import { useState, useCallback, useRef } from 'react';
import { AudioFileInfo, isAudioFile, getFileExtension } from '@/lib/audio-types';
import { detectKeyAndEnergy, detectKeyAndEnergyFromArrayBuffer } from '@/lib/key-detector';
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

  const createFileInfo = (
    name: string,
    path: string,
    size: number,
    file: File | null,
    safUri?: string,
  ): AudioFileInfo => ({
    id: `file-${++idCounter}`,
    name,
    path,
    format: getFileExtension(name),
    size,
    duration: 0,
    key: null,
    camelot: null,
    keyConfidence: null,
    keyStatus: 'pending',
    energy: null,
    energyLevel: null,
    status: 'pending',
    file: file as File,
    safUri,
  });

  const applyResult = (
    id: string,
    res: Awaited<ReturnType<typeof detectKeyAndEnergy>>,
  ) =>
    setFiles(prev =>
      prev.map(f =>
        f.id === id
          ? {
              ...f,
              key: res.key,
              camelot: res.camelot,
              keyConfidence: res.confidence,
              keyStatus: 'done',
              energy: res.energy.energy,
              energyLevel: res.energy.level,
              duration: res.duration,
              status: 'done',
            }
          : f,
      ),
    );

  // Web-based file scanning
  const scanFiles = useCallback(async (fileList: FileList) => {
    const audioFiles: AudioFileInfo[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (isAudioFile(file.name)) {
        audioFiles.push(
          createFileInfo(
            file.name,
            (file as any).webkitRelativePath || file.name,
            file.size,
            file,
          ),
        );
      }
    }

    setFiles(audioFiles);
    setIsAnalyzing(true);
    setProgress({ current: 0, total: audioFiles.length });
    abortRef.current = false;

    for (let i = 0; i < audioFiles.length; i++) {
      if (abortRef.current) break;
      const target = audioFiles[i];
      setFiles(prev =>
        prev.map(f =>
          f.id === target.id ? { ...f, status: 'analyzing', keyStatus: 'analyzing' } : f,
        ),
      );

      try {
        const res = await detectKeyAndEnergy(target.file);
        applyResult(target.id, res);
      } catch (err) {
        setFiles(prev =>
          prev.map(f =>
            f.id === target.id
              ? { ...f, status: 'error', keyStatus: 'error', error: (err as Error).message }
              : f,
          ),
        );
      }
      setProgress({ current: i + 1, total: audioFiles.length });
    }
    setIsAnalyzing(false);
  }, []);

  // Native SAF folder picker
  const pickNativeFolder = useCallback(async () => {
    if (!isNativePlatform()) {
      toast.error("Le sélecteur de dossier natif nécessite l'application Android.");
      return;
    }
    toast.info('Ouverture du sélecteur de dossier...');

    try {
      const result = await SAFFolderPicker.pickFolder();
      setFolderUri(result.folderUri);
      toast.success(
        `Dossier "${result.folderName}" sélectionné — ${result.files.length} fichier(s) audio`,
      );

      const audioFiles: AudioFileInfo[] = result.files.map((f: SAFFile) =>
        createFileInfo(f.name, f.uri, f.size, null as any, f.uri),
      );

      setFiles(audioFiles);
      setIsAnalyzing(true);
      setProgress({ current: 0, total: audioFiles.length });
      abortRef.current = false;

      for (let i = 0; i < audioFiles.length; i++) {
        if (abortRef.current) break;
        const target = audioFiles[i];
        setFiles(prev =>
          prev.map(f =>
            f.id === target.id ? { ...f, status: 'analyzing', keyStatus: 'analyzing' } : f,
          ),
        );

        try {
          const content = await SAFFolderPicker.readFileContent({ uri: target.path });
          const binaryStr = atob(content.data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);
          const res = await detectKeyAndEnergyFromArrayBuffer(bytes.buffer);
          applyResult(target.id, res);
        } catch (err) {
          setFiles(prev =>
            prev.map(f =>
              f.id === target.id
                ? { ...f, status: 'error', keyStatus: 'error', error: (err as Error).message }
                : f,
            ),
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
