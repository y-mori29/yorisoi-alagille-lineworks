import React, { useState, useEffect, useRef, useMemo } from 'react';
import { sortRecordsNewestFirst } from '../utils/patientTimeline';
import { Patient, Record, ClinicalData } from '../types';
import { SoapView } from './SoapView';
import { api } from '../services/api';
import { PatientChatBot } from './PatientChatBot';
import { clinicalDataToEncounterUpdate } from '../utils/clinicalToEncounter';
import { RecordNavSidebar } from './RecordNavSidebar';

interface Props {
    patient: Patient;
    record: Record;
    onBack: () => void;
    onClose: () => void;
    /** 左レールから別の記録を選択 */
    onSelectRecord: (recordId: string) => void;
    onUpdateRecord: (data: ClinicalData) => void;
    /** 記録削除後など、サーバー状態を親で再取得する */
    onRecordsMutated?: () => void;
}

const PrescriptionView: React.FC<{ data: any }> = ({ data }) => {
    const info = data || {};
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-teal-100 border-l-4 border-l-teal-500">
                <h3 className="text-teal-700 font-bold mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    処方箋 解析結果
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-400 font-bold block mb-1">医療機関名</label>
                        <p className="text-lg font-bold text-gray-800">{info.institutionName || '-'}</p>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-bold block mb-1">処方日</label>
                        <p className="text-lg font-bold text-gray-800">{info.prescriptionDate || '-'}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <h4 className="font-bold text-gray-700">薬剤一覧</h4>
                </div>
                <div className="p-0">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left">薬品名</th>
                                <th className="px-6 py-3 text-left">分量</th>
                                <th className="px-6 py-3 text-left">用法・期間</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(info.medications || []).map((med: any, idx: number) => (
                                <tr key={idx} className="hover:bg-teal-50/30 transition-colors">
                                    <td className="px-6 py-4 font-bold text-teal-700">{med.name}</td>
                                    <td className="px-6 py-4 text-gray-700">{med.dosage}</td>
                                    <td className="px-6 py-4 text-gray-600">
                                        <div className="font-medium">{med.usage}</div>
                                        <div className="text-xs text-gray-400">{med.duration}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {info.rawText && (
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">OCR 解析テキスト要約</h4>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{info.rawText}</p>
                </div>
            )}
        </div>
    );
};

const emptyClinical = (): ClinicalData => ({
    soap: { s: '', o: '', a: '', p: '' },
    home_visit: {
        basic_info: '', chief_complaint: '', observation_treatment: '',
        medication_instruction: '', next_plan_handover: ''
    },
    pharmacy_focus: {
        medications: [], adherence: '', side_effects: [], drug_related_problems: [],
        labs_and_monitoring: [], patient_education: [], follow_up: ''
    },
    alerts: { red_flags: [], need_to_contact_physician: [] },
    meta: { main_problems: [], note_for_pharmacy: '' }
});

export const PatientRecordDetail: React.FC<Props> = ({ patient, record, onBack, onClose, onSelectRecord, onUpdateRecord, onRecordsMutated }) => {
    // Experiment State
    const [isRegenModalOpen, setIsRegenModalOpen] = useState(false);
    const [regenPrompt, setRegenPrompt] = useState<string>('');
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regenResult, setRegenResult] = useState<any>(null);
    // isOcrOpen no longer needed as main display is always open

    const handleOpenRegen = () => {
        // Default Prompt
        // Updated Prompt to match processingController.js
        setRegenPrompt(`あなたは訪問薬局の薬剤師業務を支援するAIパートナーです。
入力される【会話（文字起こし）】から、以下のJSON形式に従って、業務判断を支援するための構造化データを出力してください。
音声から情報が読み取れない項目は、空文字 "" または空配列 [] としてください。推測で補完しないでください。

【出力JSON形式】
{
  "soap": {
    "s": "主訴・自覚症状",
    "o": "客観的所見",
    "a": "アセスメント",
    "p": "プラン"
  },
  "home_visit": {
    "basic_info": "", "chief_complaint": "", "observation_treatment": "",
    "medication_instruction": "", "next_plan_handover": ""
  },
  "pharmacy_focus": {
    "medications": [
      {
        "name": "薬剤名", "dose": "用量", "route": "用法", "frequency": "頻度",
        "status": "開始/継続/変更/中止", "reason_or_note": "備考"
      }
    ], 
    "adherence": "", "side_effects": [], "drug_related_problems": [],
    "labs_and_monitoring": [], "patient_education": [], "follow_up": ""
  },
  "alerts": { "red_flags": [], "need_to_contact_physician": [] },
  "meta": { "main_problems": [], "note_for_pharmacy": "" },
  "family_share": { "rephrased_content": "" },
  "summaries": { "internal": "", "medical": "" }
}

【文字起こし】
<<TRANSCRIPT>>`);
        setIsRegenModalOpen(true);
        setRegenResult(null);
    };

    // 編集内容を Firestore に反映（ローカル state のみだとリロードで消える）
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clinicalForSave = useMemo(() => {
        if (record.source === 'OCR') return null;
        return record.clinicalData ?? emptyClinical();
    }, [record.source, record.clinicalData]);
    useEffect(() => {
        if (record.source === 'OCR' || !clinicalForSave) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            const payload = clinicalDataToEncounterUpdate(clinicalForSave);
            api.updateRecord(patient.id, record.id, payload).catch((e) => console.error('[PatientRecordDetail] save failed', e));
        }, 900);
        return () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
        };
    }, [patient.id, record.id, record.source, clinicalForSave]);

    /** 診療記録閲覧時のみ：最新の処方箋OCRを参考として Soap 下部に表示（右カラムを圧迫しない） */
    const recentPrescriptionReference = useMemo(() => {
        if (record.source === 'OCR') return null;
        const withOcr = patient.records.filter((r) => r.source === 'OCR' && r.data?.medications?.length);
        if (withOcr.length === 0) return null;
        const latest = sortRecordsNewestFirst(withOcr)[0];
        const d = latest.data || {};
        const lines = (d.medications || []).map((m: { name?: string; dosage?: string; usage?: string; duration?: string }) =>
            [m.name, m.dosage, m.usage, m.duration].filter(Boolean).join('　')
        ).filter(Boolean);
        if (lines.length === 0) return null;
        return {
            institutionName: d.institutionName as string | undefined,
            prescriptionDate: d.prescriptionDate as string | undefined,
            lines
        };
    }, [patient.records, record.source]);

    const handlePerformRegenerate = async () => {
        setIsRegenerating(true);
        try {
            // "rec_{jobId}" -> "{jobId}"
            const realJobId = record.id.startsWith('rec_') ? record.id.slice(4) : record.id;

            const summary = await api.regenerateSummary(realJobId, regenPrompt, record.transcript);
            if (summary == null) {
                alert('AI再生成APIが未接続です。バックエンドに再生成エンドポイントを実装してください。');
                return;
            }
            setRegenResult(summary);
        } catch (e) {
            alert('再生成に失敗しました: ' + e);
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleApplyResult = () => {
        if (!regenResult) return;

        onUpdateRecord({
            ...record.clinicalData,
            soap: regenResult.soap,
            report_100: regenResult.report_100,
            summary: regenResult.report_100, // Legacy support
            family_share: regenResult.family_share,
            home_visit: regenResult.home_visit
        });
        setIsRegenModalOpen(false);
    };

    const handleDeleteRecord = async () => {
        if (!confirm('本当にこの記録を削除しますか？\nこの操作は取り消せません。')) return;
        try {
            await api.deleteRecord(patient.id, record.id);
            alert('削除しました');
            onRecordsMutated?.();
            onClose();
        } catch (e) {
            alert('削除に失敗しました');
        }
    };

    return (
        <div className="flex flex-1 flex-col md:flex-row min-h-0 w-full animate-fadeIn">
            <RecordNavSidebar patient={patient} selectedRecordId={record.id} onSelectRecord={onSelectRecord} />
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24">
            <div className="flex items-center gap-4 mb-4">
                <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-teal-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    記録一覧に戻る
                </button>
                <div className="flex-1"></div>
                {/* Close Button requested */}
                <button
                    onClick={onClose}
                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
                >
                    ✕ 閉じる (ボードへ戻る)
                </button>
                <div className="w-px h-6 bg-gray-200 mx-2"></div>
                <button
                    onClick={handleDeleteRecord}
                    className="flex items-center gap-1 text-sm text-red-400 hover:text-red-600"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    削除
                </button>
            </div>
            <div className="mb-6">
                <div className="text-sm text-gray-500 mb-1 flex items-center gap-2">
                    <span className="font-mono">
                        {record.date ? new Date(record.date).toLocaleString('ja-JP', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                        }) : '-'}
                    </span>
                    {record.status === 'approved' && <span className="text-green-600 text-xs font-bold px-1.5 py-0.5 bg-green-50 border border-green-100 rounded">承認済</span>}
                    {record.source === 'OCR' && <span className="text-blue-600 text-xs font-bold px-1.5 py-0.5 bg-blue-50 border border-blue-100 rounded">処方箋OCR</span>}
                    {record.recordedByName && (
                        <span className="text-purple-600 text-xs font-bold px-1.5 py-0.5 bg-purple-50 border border-purple-100 rounded">
                            録音者: {record.recordedByName} ({
                                { admin: '管理者', staff: '一般', companion: '同行者' }[record.recordedByRole || ''] || record.recordedByRole || '同行者'
                            })
                        </span>
                    )}
                </div>
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800 leading-none">{patient.name} 様 <span className="text-sm font-normal text-gray-500 ml-2">
                        {record.source === 'OCR' ? '処方箋 解析詳細' : '診療記録詳細'}
                    </span></h2>

                    {record.source !== 'OCR' && (
                        <button
                            onClick={handleOpenRegen}
                            className="text-xs bg-teal-50 text-teal-600 px-3 py-1.5 rounded border border-teal-200 hover:bg-teal-100 transition-colors flex items-center gap-1 font-bold"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            AI再生成
                        </button>
                    )}
                </div>
            </div>

            {record.source === 'OCR' ? (
                <PrescriptionView data={record.data} />
            ) : (
                <div className="w-full">
                    <SoapView
                        data={record.clinicalData ?? emptyClinical()}
                        transcript={record.transcript}
                        onChange={onUpdateRecord}
                        recentPrescriptionReference={recentPrescriptionReference}
                    />
                </div>
            )}

            {/* Experiment Modal */}
            {isRegenModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-gray-800">🧪 プロンプト実験室</h3>
                            <button onClick={() => setIsRegenModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            {/* Left: Prompt Editor */}
                            <div className="md:w-1/2 p-4 flex flex-col border-r">
                                <label className="text-xs font-bold text-gray-500 mb-2">プロンプト編集 ({"<<TRANSCRIPT>>"} は文字起こしに置換)</label>
                                <textarea
                                    className="flex-1 w-full p-3 border rounded font-mono text-sm focus:ring-2 focus:ring-teal-500 resize-none"
                                    value={regenPrompt}
                                    onChange={e => setRegenPrompt(e.target.value)}
                                />
                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={handlePerformRegenerate}
                                        disabled={isRegenerating}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isRegenerating ? '生成中...' : '✨ 生成実行'}
                                    </button>
                                </div>
                            </div>

                            {/* Right: Result Preview */}
                            <div className="md:w-1/2 p-4 flex flex-col bg-gray-50 overflow-y-auto">
                                <label className="text-xs font-bold text-gray-500 mb-2">生成結果プレビュー</label>
                                {regenResult ? (
                                    <div className="flex-1 overflow-y-auto">
                                        <pre className="text-xs bg-white p-3 rounded border whitespace-pre-wrap font-mono">
                                            {JSON.stringify(regenResult, null, 2)}
                                        </pre>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                                        左側の「生成実行」を押してください
                                    </div>
                                )}
                                {regenResult && (
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={handleApplyResult}
                                            className="bg-teal-600 text-white px-4 py-2 rounded font-bold hover:bg-teal-700"
                                        >
                                            この結果を画面に反映
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* AI Chat Bot Assistant */}
            <PatientChatBot patientId={patient.id} patientName={patient.name} />
        </div>
            </div>
        </div>
    );
};
