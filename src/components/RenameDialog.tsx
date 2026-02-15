import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FolderSync, ChevronDown, ChevronUp, ArrowRight, Shield, RotateCcw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AudioFileInfo, getBpmColor } from '@/lib/audio-types';
import {
  RenameFormat,
  SortOrder,
  RenameOptions,
  generateNewName,
  renameFilesNatively,
  isNativePlatform,
  getBackupLogs,
  rollbackRename,
  RenameLog,
} from '@/lib/native-file-service';

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: AudioFileInfo[];
}

type Step = 'config' | 'preview' | 'processing' | 'result' | 'rollback';

export function RenameDialog({ open, onOpenChange, files }: RenameDialogProps) {
  const [step, setStep] = useState<Step>('config');
  const [format, setFormat] = useState<RenameFormat>('numeric_bpm');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [customTemplate, setCustomTemplate] = useState('{index}_{bpm}_{nom}');
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [backupLogs, setBackupLogs] = useState<RenameLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const isNative = isNativePlatform();

  const analyzedFiles = useMemo(
    () => files.filter(f => f.status === 'done' && f.bpm !== null),
    [files]
  );

  const options: RenameOptions = { format, sortOrder, customTemplate };

  const preview = useMemo(() => {
    const sorted = [...analyzedFiles].sort((a, b) =>
      sortOrder === 'asc' ? (a.bpm ?? 0) - (b.bpm ?? 0) : (b.bpm ?? 0) - (a.bpm ?? 0)
    );
    return sorted.map((f, i) => ({
      original: f.name,
      newName: generateNewName(f.name, f.bpm!, i, sorted.length, options),
      bpm: f.bpm!,
    }));
  }, [analyzedFiles, format, sortOrder, customTemplate]);

  const handleRename = async () => {
    setStep('processing');
    setIsProcessing(true);

    const filesToRename = analyzedFiles
      .filter(f => f.bpm !== null)
      .map(f => ({
        name: f.name,
        bpm: f.bpm!,
        uri: (f.file as any).uri || f.path,
      }));

    const res = await renameFilesNatively(filesToRename, options);
    setResult({ success: res.success, errors: res.errors });
    setIsProcessing(false);
    setStep('result');
  };

  const handleShowRollback = async () => {
    const logs = await getBackupLogs();
    setBackupLogs(logs);
    setStep('rollback');
  };

  const handleRollback = async (log: RenameLog) => {
    setIsProcessing(true);
    const res = await rollbackRename(log);
    setResult({ success: res.success, errors: res.errors });
    setIsProcessing(false);
    setStep('result');
  };

  const handleClose = () => {
    setStep('config');
    setResult(null);
    onOpenChange(false);
  };

  const formatLabels: Record<RenameFormat, { label: string; example: string }> = {
    numeric: { label: 'Numérique simple', example: '001_nom.mp3' },
    numeric_bpm: { label: 'Numérique + BPM', example: '001_124BPM_nom.mp3' },
    bpm_only: { label: 'BPM seul', example: '124BPM_nom.mp3' },
    custom: { label: 'Custom', example: customTemplate.replace('{index}', '001').replace('{bpm}', '124').replace('{nom}', 'track') + '.mp3' },
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="fixed inset-2 top-2 bottom-2 left-2 right-2 translate-x-0 translate-y-0 max-w-none w-auto h-auto max-h-none flex flex-col bg-card border-border p-4 rounded-xl overflow-hidden sm:inset-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-w-lg sm:w-full sm:h-auto sm:max-h-[85vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderSync className="h-5 w-5 text-primary" />
            Réorganiser par BPM
          </DialogTitle>
          {!isNative && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-destructive">
                Renommage natif requis. Compilez avec Capacitor.
              </span>
            </div>
          )}
          <DialogDescription className="text-muted-foreground text-xs">
            {analyzedFiles.length} fichier(s) analysé(s) prêt(s)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          {/* Step: Config */}
          {step === 'config' && (
            <div className="space-y-3">
              {/* Format */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Format de renommage</Label>
                <RadioGroup value={format} onValueChange={(v) => setFormat(v as RenameFormat)} className="space-y-1">
                  {(Object.keys(formatLabels) as RenameFormat[]).map(key => (
                    <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                      <RadioGroupItem value={key} id={key} />
                      <Label htmlFor={key} className="flex-1 cursor-pointer">
                        <span className="text-xs font-medium">{formatLabels[key].label}</span>
                        <span className="block text-[10px] font-mono text-muted-foreground">{formatLabels[key].example}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                {format === 'custom' && (
                  <input
                    type="text"
                    value={customTemplate}
                    onChange={e => setCustomTemplate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="{index}_{bpm}_{nom}"
                  />
                )}
              </div>

              {/* Sort Order */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Classement</Label>
                <RadioGroup value={sortOrder} onValueChange={v => setSortOrder(v as SortOrder)} className="flex gap-2">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors flex-1">
                    <RadioGroupItem value="asc" id="asc" />
                    <Label htmlFor="asc" className="cursor-pointer flex items-center gap-1 text-xs">
                      <ChevronUp className="h-3 w-3" /> Croissant
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors flex-1">
                    <RadioGroupItem value="desc" id="desc" />
                    <Label htmlFor="desc" className="cursor-pointer flex items-center gap-1 text-xs">
                      <ChevronDown className="h-3 w-3" /> Décroissant
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Security badge */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10 text-[10px] text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Backup auto • Rollback • Zéro perte</span>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-3">
              <div className="space-y-1">
                {preview.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded bg-secondary/30 text-[11px]">
                    <span className="font-mono truncate flex-1 text-muted-foreground">{p.original}</span>
                    <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                    <span className="font-mono truncate flex-1 font-medium text-foreground">{p.newName}</span>
                    <span className="font-mono font-bold shrink-0" style={{ color: getBpmColor(p.bpm) }}>{p.bpm}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step: Processing */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              >
                <FolderSync className="h-10 w-10 text-primary" />
              </motion.div>
              <p className="text-sm text-muted-foreground">Renommage en cours…</p>
            </div>
          )}

          {/* Step: Result */}
          {step === 'result' && result && (
            <div className="space-y-4">
              {result.errors.length === 0 ? (
                <div className="flex flex-col items-center py-6 space-y-3">
                  <CheckCircle2 className="h-12 w-12 text-primary" />
                  <p className="text-sm font-medium">{result.success} fichier(s) renommé(s)</p>
                  <p className="text-xs text-muted-foreground">Backup sauvegardé automatiquement</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="text-sm font-medium">{result.success} succès, {result.errors.length} erreur(s)</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive font-mono px-2 py-1 bg-destructive/10 rounded">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Rollback */}
          {step === 'rollback' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {backupLogs.length === 0 ? 'Aucun historique.' : `${backupLogs.length} opération(s)`}
              </p>
              <div className="space-y-2">
                {backupLogs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border/50">
                    <div>
                      <p className="text-xs font-medium">{log.entries.length} fichier(s)</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleRollback(log)} disabled={isProcessing} className="text-xs h-7">
                      <RotateCcw className="h-3 w-3 mr-1" /> Restaurer
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fixed footer buttons */}
        <div className="shrink-0 pt-2 border-t border-border flex gap-2 justify-between">
          {step === 'config' && (
            <>
              <Button variant="outline" size="sm" onClick={handleShowRollback} className="text-xs h-8">
                <RotateCcw className="h-3 w-3 mr-1" /> Historique
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs h-8">Annuler</Button>
                <Button size="sm" onClick={() => setStep('preview')} disabled={analyzedFiles.length === 0} className="text-xs h-8">
                  Aperçu
                </Button>
              </div>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStep('config')} className="text-xs h-8">Retour</Button>
              <Button size="sm" onClick={handleRename} disabled={!isNative} className="text-xs h-8 bg-primary text-primary-foreground">
                <FolderSync className="h-3.5 w-3.5 mr-1" />
                Renommer {preview.length}
              </Button>
            </>
          )}
          {step === 'result' && (
            <div className="flex justify-end w-full">
              <Button size="sm" onClick={handleClose} className="text-xs h-8">Fermer</Button>
            </div>
          )}
          {step === 'rollback' && (
            <div className="flex justify-end w-full">
              <Button variant="ghost" size="sm" onClick={() => setStep('config')} className="text-xs h-8">Retour</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
