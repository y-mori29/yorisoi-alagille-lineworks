import type { ClinicalData } from '../types';

/** Firestore encounter ドキュメント用（patientController.updateRecord の merge） */
export function clinicalDataToEncounterUpdate(data: ClinicalData): Record<string, unknown> {
  const out: Record<string, unknown> = {
    soap: data.soap,
    home_visit: data.home_visit,
    pharmacy_focus: data.pharmacy_focus,
    alerts: data.alerts,
    meta: data.meta,
    summaries: {
      internal: data.summary ?? '',
      medical: data.report_100 ?? ''
    }
  };
  if (data.family_share) out.family_share = data.family_share;
  if (data.changes_from_last_time) out.changes_from_last_time = data.changes_from_last_time;
  return out;
}
