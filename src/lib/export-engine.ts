/**
 * Export Engine - PDF, CSV, JSON
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AudioFileInfo, formatDuration, getBpmGroup } from './audio-types';

function getDateStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function exportToPdf(files: AudioFileInfo[]) {
  const doc = new jsPDF();
  const now = new Date();

  doc.setFontSize(20);
  doc.setTextColor(0, 229, 255);
  doc.text('BPM Analyzer Pro — Export', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Généré le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')}`, 14, 28);
  doc.text(`${files.length} fichier(s)`, 14, 34);

  const tableData = files.map((f) => [
    f.name,
    f.bpm !== null ? `${f.bpm}` : '—',
    f.key && f.mode ? `${f.key} ${f.mode}` : '—',
    f.camelot || '—',
    f.energy || '—',
    f.mood || '—',
    f.genre || '—',
    formatDuration(f.duration),
    f.format.toUpperCase(),
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Fichier', 'BPM', 'Tonalité', 'Camelot', 'Énergie', 'Mood', 'Genre', 'Durée', 'Format']],
    body: tableData,
    styles: { fontSize: 7, cellPadding: 2, textColor: [220, 220, 220], fillColor: [18, 18, 26] },
    headStyles: { fillColor: [0, 180, 210], textColor: [10, 10, 15], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [22, 22, 35] },
    theme: 'grid',
    tableLineColor: [40, 40, 60],
    tableLineWidth: 0.1,
  });

  doc.save(`bpm_export_${getDateStr()}.pdf`);
}

export function exportToCsv(files: AudioFileInfo[]) {
  const headers = ['Fichier', 'BPM', 'Tonalité', 'Mode', 'Camelot', 'Énergie', 'Mood', 'Genre', 'Durée', 'Format', 'Chemin'];
  const rows = files.map(f => [
    `"${f.name.replace(/"/g, '""')}"`,
    f.bpm ?? '',
    f.key ?? '',
    f.mode ?? '',
    f.camelot ?? '',
    f.energy ?? '',
    f.mood ?? '',
    f.genre ?? '',
    formatDuration(f.duration),
    f.format,
    `"${f.path.replace(/"/g, '""')}"`,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadFile(csv, `bpm_export_${getDateStr()}.csv`, 'text/csv');
}

export function exportToJson(files: AudioFileInfo[]) {
  const data = files.map(f => ({
    name: f.name,
    path: f.path,
    bpm: f.bpm,
    key: f.key,
    mode: f.mode,
    camelot: f.camelot,
    energy: f.energy,
    mood: f.mood,
    genre: f.genre,
    duration: f.duration,
    format: f.format,
  }));

  const json = JSON.stringify({ exportDate: new Date().toISOString(), count: data.length, tracks: data }, null, 2);
  downloadFile(json, `bpm_export_${getDateStr()}.json`, 'application/json');
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
