import { motion } from 'framer-motion';

interface AnalysisProgressProps {
  current: number;
  total: number;
  isAnalyzing: boolean;
}

export function AnalysisProgress({ current, total, isAnalyzing }: AnalysisProgressProps) {
  if (total === 0) return null;
  
  const percent = total > 0 ? (current / total) * 100 : 0;
  const isDone = current === total && !isAnalyzing;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {isDone ? 'Analyse terminée' : 'Analyse en cours...'}
        </span>
        <span className="font-mono text-primary">
          {current}/{total}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            boxShadow: isAnalyzing ? '0 0 12px hsl(187, 100%, 45%, 0.6)' : 'none',
          }}
        />
      </div>
    </div>
  );
}
