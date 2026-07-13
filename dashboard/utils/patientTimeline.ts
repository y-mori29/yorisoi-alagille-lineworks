import type { Record as PatientRecord } from '../types';

export function normalizeMedKey(name: string): string {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** 記録から薬剤名の一覧を取得（OCR は data.medications、通常は pharmacy_focus） */
export function extractMedicationNames(rec: PatientRecord): string[] {
  if (rec.source === 'OCR' && rec.data?.medications?.length) {
    return (rec.data.medications as { name?: string }[]).map((m) => m.name || '').filter(Boolean);
  }
  const meds = rec.clinicalData?.pharmacy_focus?.medications || [];
  return meds.map((m) => m.name || '').filter(Boolean);
}

export function diffMedicationNames(prev: string[], curr: string[]) {
  const prevK = new Set(prev.map(normalizeMedKey));
  const currK = new Set(curr.map(normalizeMedKey));
  const added = curr.filter((c) => !prevK.has(normalizeMedKey(c)));
  const removed = prev.filter((p) => !currK.has(normalizeMedKey(p)));
  return { added, removed };
}

export function recordSortKey(rec: PatientRecord): string {
  return rec.date || '';
}

/** 時系列表示用: 古い順 */
export function sortRecordsChronological(records: PatientRecord[]): PatientRecord[] {
  return [...records].sort((a, b) => recordSortKey(a).localeCompare(recordSortKey(b)));
}

/** サイドバー用: 新しい順 */
export function sortRecordsNewestFirst(records: PatientRecord[]): PatientRecord[] {
  return [...records].sort((a, b) => recordSortKey(b).localeCompare(recordSortKey(a)));
}

export function oneLineSummary(rec: PatientRecord): string {
  if (rec.source === 'OCR') {
    const inst = rec.data?.institutionName || '';
    return inst ? `処方箋: ${inst}` : '処方箋OCR';
  }
  const s = rec.clinicalData?.soap?.s?.trim();
  if (s) return s.length > 80 ? `${s.slice(0, 80)}…` : s;
  return '診療記録';
}
