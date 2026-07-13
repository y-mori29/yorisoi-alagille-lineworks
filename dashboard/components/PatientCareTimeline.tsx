import React, { useMemo } from 'react';
import { Patient } from '../types';
import {
  sortRecordsChronological,
  extractMedicationNames,
  diffMedicationNames,
  oneLineSummary,
} from '../utils/patientTimeline';
import { GitBranch, Pill, FileText, Stethoscope } from 'lucide-react';

interface Props {
  patient: Patient;
  /** タイムラインの項目クリックでその記録を開く */
  onSelectRecord?: (recordId: string) => void;
}

export const PatientCareTimeline: React.FC<Props> = ({ patient, onSelectRecord }) => {
  const events = useMemo(() => {
    const chronological = sortRecordsChronological(patient.records);
    return chronological.map((rec, idx) => {
      const prev = idx > 0 ? chronological[idx - 1] : null;
      const prevMeds = prev ? extractMedicationNames(prev) : [];
      const currMeds = extractMedicationNames(rec);
      const { added, removed } = prev ? diffMedicationNames(prevMeds, currMeds) : { added: currMeds, removed: [] as string[] };
      const changesText =
        (rec.clinicalData as { changes_from_last_time?: string } | undefined)?.changes_from_last_time ||
        (rec as { changes_from_last_time?: string }).changes_from_last_time;

      return {
        rec,
        idx,
        added,
        removed,
        isFirst: idx === 0,
        changesText: changesText?.trim() || '',
      };
    });
  }, [patient.records]);

  if (events.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80 p-10 text-center text-gray-500 text-sm">
        <GitBranch className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="font-medium text-gray-600">まだ記録がありません</p>
        <p className="text-xs mt-2 text-gray-400">診療記録や処方箋OCRが登録されると、ここに時系列で表示されます。</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="mb-6 rounded-xl bg-teal-50/80 border border-teal-100 p-4">
        <div className="flex items-start gap-3">
          <GitBranch className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-teal-900 text-sm">経過・時系列（患者ジャーニー）</h3>
            <p className="text-xs text-teal-800/90 mt-1 leading-relaxed">
              記録を古い順に並べ、薬剤の追加・削除の変化を表示しています。個別の記録を開くには、各カードをクリックしてください。
            </p>
          </div>
        </div>
      </div>

      <div className="relative pl-6 border-l-2 border-teal-200 ml-2 space-y-8">
        {events.map(({ rec, added, removed, isFirst, changesText }) => {
          const currMeds = extractMedicationNames(rec);
          const dateLabel = rec.date
            ? new Date(rec.date).toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '日付未設定';

          return (
            <div key={rec.id} className="relative">
              <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-teal-500 ring-4 ring-white border border-teal-600" />

              <button
                type="button"
                disabled={!onSelectRecord}
                onClick={() => onSelectRecord?.(rec.id)}
                className={`w-full text-left rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all ${
                  onSelectRecord ? 'hover:border-teal-300 hover:shadow-md cursor-pointer' : 'cursor-default'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-gray-800">{dateLabel}</span>
                  {rec.source === 'OCR' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> 処方箋OCR
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                      <Stethoscope className="w-3 h-3" /> 訪問・録音
                    </span>
                  )}
                  {rec.status === 'approved' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">承認済</span>
                  )}
                </div>

                <p className="text-sm text-gray-700 leading-relaxed mb-3">{oneLineSummary(rec)}</p>

                {changesText && (
                  <div className="mb-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-950">
                    <span className="font-bold text-amber-800">前回からの変更点: </span>
                    {changesText}
                  </div>
                )}

                {!isFirst && (added.length > 0 || removed.length > 0) && (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-2">
                      <Pill className="w-3.5 h-3.5" />
                      お薬の変化（前の記録との比較）
                    </div>
                    {added.length > 0 && (
                      <ul className="text-xs text-emerald-800 space-y-1 mb-2">
                        {added.map((name) => (
                          <li key={`a-${name}`}>＋ 追加: {name}</li>
                        ))}
                      </ul>
                    )}
                    {removed.length > 0 && (
                      <ul className="text-xs text-rose-800 space-y-1">
                        {removed.map((name) => (
                          <li key={`r-${name}`}>− 削除/中止: {name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {isFirst && currMeds.length > 0 && (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-slate-700">
                    <span className="font-bold text-slate-600">この時点のお薬: </span>
                    {currMeds.join('、')}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};