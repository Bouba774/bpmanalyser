import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDuration } from './audio-types';
import { isNativePlatform } from './native-file-service';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { toast } from 'sonner';
import { HarmonicPlaylist } from './harmonic-mix-engine';

export async function exportHarmonicPdf(playlist: HarmonicPlaylist) {
  const doc = new jsPDF();
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  doc.setFontSize(20);
  doc.setTextColor(0, 229, 255);
  doc.text('Harmonic Flow — Setlist DJ', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Généré le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')}`, 14, 28);
  doc.text(`${playlist.tracks.length} track(s) — Score moyen: ${playlist.avgScore}`, 14, 34);

  const head = [['#', 'Fichier', 'BPM', 'Key', 'Camelot', 'Durée', 'Transition', 'Score']];

  const tableData = playlist.tracks.map((track, i) => {
    const transition = playlist.transitions[i - 1];
    return [
      `${i + 1}`,
      track.name,
      track.bpm !== null ? `${track.bpm}` : '—',
      track.key || '—',
      track.camelot || '—',
      formatDuration(track.duration),
      transition ? `${transition.camelotRelation} (Δ${transition.bpmDelta})` : '— Start —',
      transition ? `${transition.score}` : '—',
    ];
  });

  autoTable(doc, {
    startY: 40,
    head,
    body: tableData,
    styles: {
      fontSize: 7,
      cellPadding: 2.5,
      textColor: [220, 220, 220],
      fillColor: [18, 18, 26],
    },
    headStyles: {
      fillColor: [0, 180, 210],
      textColor: [10, 10, 15],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [22, 22, 35],
    },
    theme: 'grid',
    tableLineColor: [40, 40, 60],
    tableLineWidth: 0.1,
    columnStyles: {
      0: { cellWidth: 8 },
      6: { cellWidth: 32 },
      7: { cellWidth: 14 },
    },
  });

  const fileName = `harmonic_mix_${dateStr}.pdf`;

  if (isNativePlatform()) {
    try {
      const base64 = doc.output('datauristring').split(',')[1];
      await Filesystem.writeFile({
        path: `Download/${fileName}`,
        data: base64,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
      toast.success(`PDF exporté dans Download/${fileName}`);
    } catch {
      try {
        const base64 = doc.output('datauristring').split(',')[1];
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
          recursive: true,
        });
        toast.success(`PDF exporté dans Documents/${fileName}`);
      } catch (err2: any) {
        toast.error('Erreur export PDF: ' + (err2?.message || err2));
      }
    }
  } else {
    doc.save(fileName);
  }
}
