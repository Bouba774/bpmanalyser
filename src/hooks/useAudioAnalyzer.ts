import { useState, useCallback, useRef } from 'react';
import { AudioFileInfo, isAudioFile, getFileExtension } from '@/lib/audio-types';
import { analyzeAudioFile } from '@/lib/audio-analyzer';

let idCounter = 0;

export function useAudioAnalyzer() {
  const [files, setFiles] = useState<AudioFileInfo[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const abortRef = useRef(false);

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
          key: null,
          mode: null,
          camelot: null,
          energy: null,
          mood: null,
          genre: null,
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
        const result = await analyzeAudioFile(audioFiles[i].file);
        setFiles(prev =>
          prev.map(f =>
            f.id === audioFiles[i].id
              ? {
                  ...f,
                  bpm: result.bpm,
                  duration: result.duration,
                  key: result.key,
                  mode: result.mode,
                  camelot: result.camelot,
                  energy: result.energy,
                  mood: result.mood,
                  genre: result.genre,
                  status: 'done',
                }
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

  const stopAnalysis = useCallback(() => {
    abortRef.current = true;
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setProgress({ current: 0, total: 0 });
  }, []);

  return { files, isAnalyzing, progress, scanFiles, stopAnalysis, clearFiles };
}
