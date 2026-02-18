import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AudioFileInfo, formatDuration, getBpmGroup } from './audio-types';
import { isNativePlatform } from './native-file-service';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { toast } from 'sonner';

export async function exportToPdf(files: AudioFileInfo[], includeKeys = false) {
  const doc = new jsPDF();
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Title
  doc.setFontSize(20);
  doc.setTextColor(0, 229, 255);
  doc.text('BPM Analyzer — Export', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Généré le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')}`, 14, 28);
  doc.text(`${files.length} fichier(s)`, 14, 34);

  const head = includeKeys
    ? [['Fichier', 'BPM', 'Key', 'Camelot', 'Durée', 'Format']]
    : [['Fichier', 'BPM', 'Catégorie', 'Durée', 'Format']];

  const tableData = files.map((f) => {
    if (includeKeys) {
      return [
        f.name,
        f.bpm !== null ? `${f.bpm}` : '—',
        f.key || '—',
        f.camelot || '—',
        formatDuration(f.duration),
        f.format.toUpperCase(),
      ];
    }
    return [
      f.name,
      f.bpm !== null ? `${f.bpm}` : '—',
      f.bpm !== null ? getBpmGroup(f.bpm).label : '—',
      formatDuration(f.duration),
      f.format.toUpperCase(),
    ];
  });

  autoTable(doc, {
    startY: 40,
    head,
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [220, 220, 220],
      fillColor: [18, 18, 26],
    },
    headStyles: {
      fillColor: [0, 180, 210],
      textColor: [10, 10, 15],
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [22, 22, 35],
    },
    theme: 'grid',
    tableLineColor: [40, 40, 60],
    tableLineWidth: 0.1,
  });

  const fileName = `bpm_export_${dateStr}.pdf`;

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
    } catch (err: any) {
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
