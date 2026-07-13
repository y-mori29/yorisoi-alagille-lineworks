import React, { useState } from 'react';
import { ClinicalData, Medication, Soap } from '../types';
import { SectionHeader } from './SectionHeader';
import { Card } from './ui/Card';
import { api } from '../services/api';
import { Loader2, Copy, Check } from 'lucide-react';

interface Props {
  data: ClinicalData;
  transcript: string;
  onChange?: (data: ClinicalData) => void;
  /** 別日の処方箋OCRなど、参考表示（画面下部。右カラムを圧迫しない） */
  recentPrescriptionReference?: {
    institutionName?: string;
    prescriptionDate?: string;
    lines: string[];
  } | null;
}

const EditableListBlock: React.FC<{
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
}> = ({ title, items, onChange }) => {
  const textValue = items ? items.join('\n') : '';

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newItems = e.target.value.split('\n');
    onChange(newItems);
  };

  return (
    <div className="mt-5">
      <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider flex items-center gap-2">
        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
        {title}
      </h4>
      <textarea
        className="w-full p-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400 focus:outline-none min-h-[80px] transition-all shadow-sm hover:border-gray-300"
        value={textValue}
        onChange={handleChange}
        placeholder="項目を改行区切りで入力..."
      />
    </div>
  );
};

const defaultPharmacy = (): ClinicalData['pharmacy_focus'] => ({
  medications: [],
  adherence: '',
  side_effects: [],
  drug_related_problems: [],
  labs_and_monitoring: [],
  patient_education: [],
  follow_up: ''
});

function formatSoapForClipboard(soap: Soap): string {
  return `【S】${soap.s || ''}\n\n【O】${soap.o || ''}\n\n【A】${soap.a || ''}\n\n【P】${soap.p || ''}`;
}

export const SoapView: React.FC<Props> = ({
  data = {} as ClinicalData,
  transcript,
  onChange,
  recentPrescriptionReference
}) => {
  const { soap = { s: '', o: '', a: '', p: '' }, pharmacy_focus = defaultPharmacy(), alerts = { red_flags: [], need_to_contact_physician: [] }, meta = { main_problems: [], note_for_pharmacy: '' } } = data;

  const updateData = (updates: Partial<ClinicalData>) => {
    if (onChange) {
      onChange({ ...data, ...updates });
    }
  };

  const updateSoap = (field: keyof typeof soap, value: string) => {
    updateData({ soap: { ...soap, [field]: value } });
  };

  const updatePharmacy = (updates: Partial<typeof pharmacy_focus>) => {
    updateData({ pharmacy_focus: { ...pharmacy_focus, ...updates } });
  };

  const updateAlerts = (updates: Partial<typeof alerts>) => {
    updateData({ alerts: { ...alerts, ...updates } });
  };

  const updateMeta = (updates: Partial<typeof meta>) => {
    updateData({ meta: { ...meta, ...updates } });
  };

  const handleAddMedication = () => {
    const newMeds = [
      ...pharmacy_focus.medications,
      { name: '', dose: '', route: '', frequency: '', status: '開始', reason_or_note: '' }
    ];
    updatePharmacy({ medications: newMeds });
  };

  const handleMedChange = (index: number, field: keyof Medication, value: string) => {
    const newMeds = [...pharmacy_focus.medications];
    newMeds[index] = { ...newMeds[index], [field]: value };
    updatePharmacy({ medications: newMeds });
  };

  const [manualText, setManualText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [soapCopied, setSoapCopied] = useState(false);

  const handleManualAnalyze = async () => {
    if (!manualText.trim()) return;
    setIsAnalyzing(true);
    setAiPreview(null);
    try {
      const res = await api.analyzeText({
        text: manualText,
        patientId: (data as any).patientId
      });
      console.log('[Dashboard] AI Analyze Response:', res);
      if (res.ok && res.data) {
        updateData(res.data);
        const simplePreview = `【S】 ${res.data.soap?.s}\n【O】 ${res.data.soap?.o}\n【A】 ${res.data.soap?.a}\n【P】 ${res.data.soap?.p}\n\n【要約】 ${res.data.report_100}`;
        setAiPreview(res.data.copy_block || simplePreview);
      }
    } catch (e) {
      alert('AI解析に失敗しました: ' + e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const soapRows: { key: keyof Soap; label: string; hint: string; ring: string }[] = [
    { key: 's', label: 'S — Subjective（主観・服薬・症状）', hint: '患者の訴え・服薬状況など', ring: 'focus:ring-sky-400/40 border-sky-100' },
    { key: 'o', label: 'O — Objective（客観・残薬・バイタル）', hint: '所見・測定値など', ring: 'focus:ring-rose-400/40 border-rose-100' },
    { key: 'a', label: 'A — Assessment（評価）', hint: '薬学的評価', ring: 'focus:ring-amber-400/40 border-amber-100' },
    { key: 'p', label: 'P — Plan（計画）', hint: '次回のフォロー', ring: 'focus:ring-emerald-400/40 border-emerald-100' }
  ];

  return (
    <div className="flex flex-col gap-6 pb-12">

      {/* ── メイン: AI入力アシスタント（縦並び・幅いっぱい） ── */}
      <Card className="border-l-4 border-l-teal-500 bg-gradient-to-br from-slate-50 to-teal-50/40 shadow-md">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-teal-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            AI入力アシスタント
          </h3>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            手書きメモやメモ書きの内容を貼り付け、「AIでSOAPに変換」で下のSOAP欄に反映します（現場で最もよく使う操作です）。
          </p>
        </div>

        <details className="group bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-4">
          <summary className="p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer text-xs font-bold text-gray-600 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              会話ログ（文字起こし）を表示
            </span>
            <svg className="w-4 h-4 transition-transform group-open:rotate-180 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </summary>
          <div className="p-3 border-t border-gray-200">
            <textarea
              readOnly
              className="w-full min-h-[120px] max-h-64 text-xs bg-gray-50 text-gray-600 rounded border-0 resize-y focus:outline-none font-mono leading-relaxed"
              value={transcript || '(録音データなし)'}
            />
            <p className="text-[10px] text-right text-gray-400 mt-1">必要な部分をコピーして、下の「手書きメモ」に貼り付けできます</p>
          </div>
        </details>

        <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
          手書きメモ / AIへの指示
          <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded text-[10px]">入力</span>
        </label>
        <textarea
          className="w-full min-h-[200px] p-4 text-sm border-2 border-teal-200 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-teal-400 focus:outline-none shadow-sm bg-white font-medium text-gray-800 leading-relaxed"
          placeholder="例：血圧120/78、残薬なし。アドヒアランス良好。アムロジピン継続。次回は副作用のむくみを確認する。"
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
        />

        <button
          type="button"
          onClick={handleManualAnalyze}
          disabled={isAnalyzing || !manualText.trim()}
          className="mt-4 w-full py-3.5 text-base bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:from-teal-600 hover:to-teal-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <><Loader2 className="animate-spin w-5 h-5" /> AI解析中...</>
          ) : (
            <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> AIでSOAPに変換</>
          )}
        </button>

        <div className="mt-6 rounded-xl border-2 border-slate-200 bg-white p-4 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <label className="text-sm font-bold text-slate-700">AI解析結果プレビュー</label>
            <button
              type="button"
              onClick={() => {
                if (aiPreview) {
                  navigator.clipboard.writeText(aiPreview);
                  alert('プレビューをコピーしました');
                }
              }}
              disabled={!aiPreview}
              className="text-xs font-bold bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-200 disabled:opacity-40"
            >
              プレビューをコピー
            </button>
          </div>
          {aiPreview ? (
            <div className="min-h-[200px] max-h-[min(50vh,420px)] overflow-y-auto bg-slate-50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-800 border border-slate-100">
              {aiPreview}
            </div>
          ) : (
            <div className="min-h-[160px] flex flex-col items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
              上にメモを入力し、「AIでSOAPに変換」を押すとここに表示されます
            </div>
          )}
          <p className="mt-3 text-[11px] text-center text-teal-700 font-bold">
            ※ 解析が成功すると、下の「SOAP 記録」欄にも自動で反映されます
          </p>
        </div>
      </Card>

      {/* 主な問題点 + Red Flags */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <h3 className="text-blue-800 font-bold text-sm mb-2">主な問題点（編集可）</h3>
          <input
            className="w-full px-3 py-2 bg-white text-blue-900 text-sm rounded border border-blue-200 shadow-sm focus:ring-1 focus:ring-blue-400 focus:outline-none mb-3"
            value={meta.main_problems.join(', ')}
            onChange={(e) => updateMeta({ main_problems: e.target.value.split(',').map(s => s.trim()) })}
            placeholder="カンマ区切りで入力..."
          />
          <div className="flex items-start gap-2">
            <span className="text-xs font-bold text-blue-600 mt-2 shrink-0">申送り:</span>
            <textarea
              className="w-full text-sm text-blue-900 bg-white/80 p-2 rounded border border-blue-200 focus:ring-1 focus:ring-blue-400 focus:outline-none min-h-[72px]"
              value={meta.note_for_pharmacy}
              onChange={(e) => updateMeta({ note_for_pharmacy: e.target.value })}
            />
          </div>
        </div>
        <div className={`rounded-xl p-4 border ${alerts.red_flags.length > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-200'}`}>
          <h3 className={`${alerts.red_flags.length > 0 ? 'text-red-700' : 'text-gray-600'} font-bold text-sm mb-2`}>Red Flags（編集可）</h3>
          <textarea
            className={`w-full min-h-[100px] text-sm p-2 rounded border focus:outline-none focus:ring-1 focus:ring-red-400 ${alerts.red_flags.length > 0 ? 'bg-white text-red-800 border-red-200' : 'bg-white text-gray-600 border-gray-200'}`}
            value={alerts.red_flags.join('\n')}
            onChange={(e) => updateAlerts({ red_flags: e.target.value.split('\n') })}
            placeholder="改行区切りで入力..."
          />
        </div>
      </div>

      {/* SOAP 一括枠 */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <SectionHeader
            title="SOAP 記録（編集可）"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(formatSoapForClipboard(soap)).then(() => {
                setSoapCopied(true);
                setTimeout(() => setSoapCopied(false), 2000);
              });
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white font-bold rounded-lg text-sm shadow hover:bg-teal-700 transition-colors"
          >
            {soapCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {soapCopied ? 'コピーしました' : 'SOAP をまとめてコピー'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4 -mt-2">各項目を編集後、ワンクリックで S〜P をまとめてクリップボードにコピーできます。</p>

        <div className="space-y-5 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
          {soapRows.map((row) => (
            <div key={row.key}>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">{row.label}</label>
              <p className="text-[10px] text-gray-400 mb-1">{row.hint}</p>
              <textarea
                className={`w-full min-h-[100px] p-3 text-sm text-gray-800 bg-white rounded-lg border-2 shadow-sm focus:outline-none focus:ring-2 resize-y ${row.ring}`}
                value={soap[row.key]}
                onChange={(e) => updateSoap(row.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </Card>

      {(data as any).changes_from_last_time && (
        <Card className="border-l-4 border-l-amber-500 bg-amber-50/30 overflow-hidden shadow-md">
          <div className="flex items-center gap-2 p-4 bg-amber-100/50 border-b border-amber-200">
            <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">Highlight</span>
            <h3 className="font-bold text-gray-800 text-sm">前回からの主要な変更点</h3>
          </div>
          <div className="p-5">
            <p className="text-gray-800 text-sm leading-relaxed font-medium whitespace-pre-wrap">
              {(data as any).changes_from_last_time}
            </p>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <SectionHeader
            title="レセコン転記用要約（100文字）"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>}
            colorClass="text-purple-600"
          />
          <button
            type="button"
            onClick={() => {
              const textToCopy = data.report_100 || data.summary || '';
              navigator.clipboard.writeText(textToCopy).then(() => alert('一括コピーしました'));
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold rounded-lg shadow-md hover:shadow-lg text-sm"
          >
            <Copy className="w-4 h-4" /> 要約をコピー
          </button>
        </div>
        <div className="relative">
          <textarea
            className="w-full p-4 bg-purple-50 rounded-xl text-gray-800 text-base leading-relaxed border-2 border-purple-100 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 focus:outline-none resize-y min-h-[120px] shadow-inner font-medium"
            value={data.report_100 || data.summary || ''}
            onChange={(e) => updateData({ report_100: e.target.value })}
            placeholder="AI要約結果がここに表示されます..."
          />
          <div className={`absolute bottom-3 right-3 text-xs font-mono font-bold px-2 py-1 rounded bg-white/80 ${(data.report_100 || data.summary || '').length > 120 ? 'text-red-600' : 'text-gray-500'}`}>
            {(data.report_100 || data.summary || '').length}文字
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await api.summarize(data);
                updateData({ report_100: res.summary });
              } catch {
                alert('要約の再生成に失敗しました');
              }
            }}
            className="text-xs text-purple-600 underline hover:text-purple-800"
          >
            内容から要約を再生成
          </button>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="薬学的介入・指導"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
          colorClass="text-indigo-500"
        />
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 min-w-[150px]">薬剤名</th>
                <th className="px-4 py-3 min-w-[150px]">用法・用量</th>
                <th className="px-4 py-3 w-[100px]">ステータス</th>
                <th className="px-4 py-3">備考</th>
              </tr>
            </thead>
            <tbody>
              {pharmacy_focus.medications.map((med, idx) => (
                <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-2 py-2">
                    <input
                      className="w-full p-1 border rounded"
                      value={med.name}
                      onChange={(e) => handleMedChange(idx, 'name', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="w-full p-1 border rounded"
                      value={`${med.dose} ${med.route} ${med.frequency}`}
                      onChange={(e) => handleMedChange(idx, 'dose', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className="w-full p-1 border rounded text-xs"
                      value={med.status}
                      onChange={(e) => handleMedChange(idx, 'status', e.target.value)}
                    >
                      <option value="開始">開始</option>
                      <option value="継続">継続</option>
                      <option value="中止">中止</option>
                      <option value="変更">変更</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="w-full p-1 border rounded"
                      value={med.reason_or_note}
                      onChange={(e) => handleMedChange(idx, 'reason_or_note', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 border-b border-dashed">
                <td
                  colSpan={4}
                  className="px-4 py-3 text-center text-xs font-bold text-teal-600 cursor-pointer hover:bg-teal-50 border-2 border-dashed border-teal-100 rounded-lg"
                  onClick={handleAddMedication}
                >
                  + 薬剤を追加
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">アドヒアランス</h4>
            <textarea
              className="w-full text-sm text-gray-800 bg-white p-2 rounded border border-gray-200 focus:ring-1 focus:ring-indigo-400 focus:outline-none min-h-[80px]"
              value={pharmacy_focus.adherence}
              onChange={(e) => updatePharmacy({ adherence: e.target.value })}
            />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">フォローアップ予定</h4>
            <textarea
              className="w-full text-sm text-gray-800 bg-white p-2 rounded border border-gray-200 focus:ring-1 focus:ring-indigo-400 focus:outline-none min-h-[80px]"
              value={pharmacy_focus.follow_up}
              onChange={(e) => updatePharmacy({ follow_up: e.target.value })}
            />
          </div>
          <div>
            <EditableListBlock title="疑義照会・薬学的問題点" items={pharmacy_focus.drug_related_problems} onChange={(items) => updatePharmacy({ drug_related_problems: items })} />
            <EditableListBlock title="副作用モニタリング" items={pharmacy_focus.side_effects} onChange={(items) => updatePharmacy({ side_effects: items })} />
          </div>
          <div>
            <EditableListBlock title="検査値・モニタリング" items={pharmacy_focus.labs_and_monitoring} onChange={(items) => updatePharmacy({ labs_and_monitoring: items })} />
            <EditableListBlock title="患者指導内容" items={pharmacy_focus.patient_education} onChange={(items) => updatePharmacy({ patient_education: items })} />
          </div>
        </div>
      </Card>

      {recentPrescriptionReference && recentPrescriptionReference.lines.length > 0 && (
        <Card className="border border-blue-100 bg-blue-50/40">
          <h3 className="font-bold text-blue-900 text-sm mb-1 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            直近の処方箋情報（参考）
          </h3>
          <p className="text-[11px] text-blue-800/80 mb-3">
            最新の処方箋OCRからの情報です。本記録の編集エリアとは別に、照合用として下部に表示しています。
          </p>
          <div className="bg-white rounded-lg border border-blue-100 p-3 text-sm text-gray-800 space-y-2">
            {(recentPrescriptionReference.institutionName || recentPrescriptionReference.prescriptionDate) && (
              <p className="text-xs text-gray-600">
                {recentPrescriptionReference.institutionName && <span className="font-bold">{recentPrescriptionReference.institutionName}</span>}
                {recentPrescriptionReference.prescriptionDate && (
                  <span className="ml-2">処方日: {recentPrescriptionReference.prescriptionDate}</span>
                )}
              </p>
            )}
            <ul className="list-disc pl-5 space-y-1">
              {recentPrescriptionReference.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <div className="bg-yellow-50 border-l-4 border-yellow-300 p-4 rounded-r shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <svg className="h-5 w-5 text-yellow-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <h3 className="text-sm font-bold text-yellow-900">医師への連絡が必要なケース</h3>
        </div>
        <textarea
          className="w-full text-sm text-yellow-900 bg-white/70 border border-yellow-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-yellow-400 min-h-[80px]"
          value={alerts.need_to_contact_physician.join('\n')}
          onChange={(e) => updateAlerts({ need_to_contact_physician: e.target.value.split('\n') })}
          placeholder="改行区切りで入力..."
        />
      </div>
    </div>
  );
};
