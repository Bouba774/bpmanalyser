import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, CheckCircle, Smartphone, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center space-y-8"
      >
        <div className="relative mx-auto w-24 h-24">
          <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center">
            <Activity className="h-10 w-10 text-primary" />
          </div>
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold">
            <span className="gradient-text">BPM</span> Analyzer
          </h1>
          <p className="text-muted-foreground">
            Installez l'application sur votre appareil pour une utilisation 100% offline.
          </p>
        </div>

        {isInstalled ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-primary">
              <CheckCircle className="h-6 w-6" />
              <span className="font-medium">Application installée !</span>
            </div>
            <Button onClick={() => navigate('/')} size="lg" className="w-full">
              Ouvrir l'application
            </Button>
          </div>
        ) : deferredPrompt ? (
          <Button onClick={handleInstall} size="lg" className="w-full glow-border">
            <Download className="h-5 w-5 mr-2" />
            Installer l'application
          </Button>
        ) : (
          <div className="space-y-4 text-sm text-muted-foreground">
            <Smartphone className="h-8 w-8 mx-auto text-primary/60" />
            <div className="space-y-2">
              <p className="font-medium text-foreground">Comment installer :</p>
              <p><strong>iPhone / iPad :</strong> Safari → Partager → « Sur l'écran d'accueil »</p>
              <p><strong>Android :</strong> Chrome → Menu ⋮ → « Installer l'application »</p>
              <p><strong>Desktop :</strong> Cliquez sur l'icône d'installation dans la barre d'adresse</p>
            </div>
          </div>
        )}

        <Button variant="ghost" onClick={() => navigate('/')} className="text-muted-foreground">
          Continuer dans le navigateur
        </Button>
      </motion.div>
    </div>
  );
};

export default Install;
