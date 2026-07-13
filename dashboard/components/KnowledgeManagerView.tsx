import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Card } from './ui/Card';
import { FileText, Trash2, Upload, Loader2, BookOpen, AlertCircle, Sparkles } from 'lucide-react';

export const KnowledgeManagerView: React.FC = () => {
    const [list, setList] = useState<any[]>([]);
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedPatientId, setSelectedPatientId] = useState<string>("");

    const loadData = async () => {
        setLoading(true);
        try {
            const [kList, pList] = await Promise.all([
                api.fetchKnowledge(),
                api.fetchPatients()
            ]);
            setList(kList);
            setPatients(pList);
        } catch (e) {
            setError('データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError(null);
        try {
            await api.uploadKnowledge(file, selectedPatientId || undefined);
            await loadData();
            setSelectedPatientId(""); // Reset
        } catch (e: any) {
            console.error(e);
            setError(`エラー: ${e.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('この資料を削除しますか？AIの知識から除外されます。')) return;
        try {
            await api.deleteKnowledge(id);
            await loadData();
        } catch (e) {
            setError('削除に失敗しました');
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <BookOpen className="text-teal-600" />
                            AI学習資料室 (マニュアル・患者個別資料)
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            アップロードされた資料は、AIが回答を生成する際の「知識」として活用されます。
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-gray-400 ml-1">対象患者を指定（任意）</span>
                            <select
                                value={selectedPatientId}
                                onChange={(e) => setSelectedPatientId(e.target.value)}
                                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none min-w-[200px]"
                            >
                                <option value="">施設共通（全患者共通）</option>
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} 様</option>
                                ))}
                            </select>
                        </div>

                        <label className={`flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg font-bold shadow-md hover:bg-teal-700 cursor-pointer transition-all h-[38px] mt-auto ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                            {uploading ? <Loader2 className="animate-spin w-4 h-4" /> : <Upload size={18} />}
                            {uploading ? '解析中...' : '資料をアップロード'}
                            <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx,.docx,.pdf,.txt,.md" />
                        </label>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-lg flex items-center gap-2 text-sm font-medium">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                        <Loader2 className="animate-spin w-8 h-8" />
                        <p className="text-sm">資料を読み込み中...</p>
                    </div>
                ) : list.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-20 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="text-gray-300" size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-700 mb-2">資料が登録されていません</h3>
                        <p className="text-sm text-gray-500 max-w-xs mx-auto">
                            ExcelやWordなどのファイルをアップロードすると、AIが内容を理解し、業務をサポートします。
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {list.map((item) => {
                            const linkedPatient = patients.find(p => p.id === item.patientId);
                            return (
                                <Card key={item.id} className={`group hover:shadow-lg transition-all border-l-4 ${item.patientId || item.targetPatientName ? 'border-l-amber-500 shadow-sm' : 'border-l-teal-500'}`}>
                                    <div className="p-5">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${item.patientId || item.targetPatientName ? 'bg-amber-50 text-amber-600' : 'bg-teal-50 text-teal-600'}`}>
                                                    <FileText size={20} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-gray-800 truncate text-sm" title={item.filename}>
                                                        {item.filename}
                                                    </h4>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                                            {new Date(item.createdAt).toLocaleDateString('ja-JP')}
                                                        </span>
                                                        {item.targetPatientName && !linkedPatient && (
                                                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <Sparkles size={8} /> AI判定: {item.targetPatientName}
                                                            </span>
                                                        )}
                                                        {linkedPatient && (
                                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                指定患者: {linkedPatient.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                                                title="削除"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1.5 flex items-center justify-between">
                                                <span>AI解析内容の要約</span>
                                                {(item.patientId || item.targetPatientName) && (
                                                    <span className="text-amber-500 flex items-center gap-0.5">
                                                        <AlertCircle size={10} />
                                                        個別資料
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-gray-600 line-clamp-4 leading-relaxed whitespace-pre-wrap">
                                                {item.parsedContent}
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
