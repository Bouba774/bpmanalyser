import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AudioFileInfo, formatDuration, getBpmGroup } from './audio-types';

export function exportToPdf(files: AudioFileInfo[]) {
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

  const tableData = files.map((f) => [
    f.name,
    f.bpm !== null ? `${f.bpm}` : '—',
    f.bpm !== null ? getBpmGroup(f.bpm).label : '—',
    formatDuration(f.duration),
    f.format.toUpperCase(),
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Fichier', 'BPM', 'Catégorie', 'Durée', 'Format']],
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

  doc.save(`bpm_export_${dateStr}.pdf`);
}
