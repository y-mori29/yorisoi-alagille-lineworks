import React, { useMemo } from 'react';
import { Patient } from '../types';
import { sortRecordsNewestFirst, oneLineSummary } from '../utils/patientTimeline';
import { ChevronRight } from 'lucide-react';

interface Props {
  patient: Patient;
  selectedRecordId: string;
  onSelectRecord: (id: string) => void;
}

export const RecordNavSidebar: React.FC<Props> = ({ patient, selectedRecordId, onSelectRecord }) => {
  const sorted = useMemo(() => sortRecordsNewestFirst(patient.records), [patient.records]);

  return (
    <aside className="w-full max-h-[40vh] md:max-h-none md:w-[min(100%,20rem)] shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50 flex flex-col min-h-0 min-w-0 md:min-w-[260px]">
      <div className="p-3 border-b border-gray-200 bg-white">
        <p className="text-xs font-bold text-gray-700">記録一覧</p>
        <p className="text-[11px] text-gray-500 mt-0.5">新しい日付が上です。切り替えて内容を表示します。</p>
      </div>
      <ul className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {sorted.map((r) => {
          const active = r.id === selectedRecordId;
          const dateStr = r.date
            ? new Date(r.date).toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '日付なし';
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelectRecord(r.id)}
                className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors border ${
                  active
                    ? 'bg-teal-50 border-teal-300 text-teal-900 shadow-sm ring-1 ring-teal-200/60'
                    : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-mono text-gray-500 mb-0.5">{dateStr}</div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {r.source === 'OCR' ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">OCR</span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800">録音</span>
                      )}
                      {r.status === 'approved' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-50 text-green-700">承認</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2 leading-snug">{oneLineSummary(r)}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 mt-0.5 ${active ? 'text-teal-600' : 'text-gray-300'}`} />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};
