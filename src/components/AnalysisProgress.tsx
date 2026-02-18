import { motion } from 'framer-motion';

interface AnalysisProgressProps {
  current: number;
  total: number;
  isAnalyzing: boolean;
  label?: string;
  color?: string;
}

export function AnalysisProgress({ current, total, isAnalyzing, label, color }: AnalysisProgressProps) {
  if (total === 0) return null;

  const percent = total > 0 ? (current / total) * 100 : 0;
  const isDone = current === total && !isAnalyzing;
  const barColor = color || 'hsl(var(--primary))';
  const defaultLabel = label || 'BPM';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {isDone ? `${defaultLabel} — Terminé` : `${defaultLabel} — Analyse en cours...`}
        </span>
        <span className="font-mono text-primary">
          {current}/{total}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
