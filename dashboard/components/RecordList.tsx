import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import { api } from '../services/api';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { PatientCareTimeline } from './PatientCareTimeline';

interface Props {
    patient: Patient;
    onSelectRecord: (id: string) => void;
}

export const RecordList: React.FC<Props> = ({ patient, onSelectRecord }) => {
    const [activeTab, setActiveTab] = useState<'RECORDS' | 'KNOWLEDGE' | 'TIMELINE'>('RECORDS');
    const [knowledgeList, setKnowledgeList] = useState<any[]>([]);
    const [isLoadingKw, setIsLoadingKw] = useState(false);

    // Knowledge Creation
    const [newKwContent, setNewKwContent] = useState('');
    const [isAddingKw, setIsAddingKw] = useState(false);

    useEffect(() => {
        if (activeTab === 'KNOWLEDGE') {
            loadKnowledge();
        }
    }, [activeTab, patient.id]);

    const loadKnowledge = async () => {
        setIsLoadingKw(true);
        try {
            const list = await api.fetchPatientKnowledge(patient.id);
            setKnowledgeList(list);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingKw(false);
        }
    };

    const handleAddKnowledge = async () => {
        if (!newKwContent.trim()) return;
        setIsAddingKw(true);
        try {
            await api.addPatientKnowledge(patient.id, newKwContent, 'memo');
            setNewKwContent('');
            loadKnowledge();
        } catch (e) {
            alert('追加に失敗しました');
        } finally {
            setIsAddingKw(false);
        }
    };

    const handleDeleteKnowledge = async (id: string) => {
        if (!confirm('削除しますか？')) return;
        try {
            await api.deletePatientKnowledge(patient.id, id);
            loadKnowledge();
        } catch (e) {
            alert('削除に失敗しました');
        }
    };

    return (
        <div className="flex-1 overflow-y-auto min-h-0 w-full max-w-6xl mx-auto p-4 md:p-8 animate-fadeIn text-left">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-white">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-md"
                            style={{ backgroundColor: patient.avatarColor }}
                        >
                            {patient.kana.charAt(0)}
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 font-medium mb-1">{patient.kana}</div>
                            <h2 className="text-2xl font-bold text-gray-800 leading-none">{patient.name} <span className="text-lg font-normal text-gray-500 ml-2">({patient.age}歳)</span></h2>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                                <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200">ID: {patient.id.toUpperCase()}</span>
                                <span><i className="fa fa-birthday-cake"></i> {patient.birthDate.replace(/-/g, '/')} 生まれ</span>
                                <span className="text-teal-500 font-medium">{patient.gender === 'male' ? '男性' : '女性'}</span>
                                {patient.room_number && (
                                    <span className="text-gray-500">{patient.room_number}号室</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap border-b border-gray-200 bg-white px-4 md:px-6 gap-x-4 gap-y-0">
                    <button
                        onClick={() => setActiveTab('RECORDS')}
                        className={`py-4 px-1 font-bold text-sm border-b-2 transition-colors ${activeTab === 'RECORDS' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        診療記録 ({patient.records.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('TIMELINE')}
                        className={`py-4 px-1 font-bold text-sm border-b-2 transition-colors ${activeTab === 'TIMELINE' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        経過・時系列
                    </button>
                    <button
                        onClick={() => setActiveTab('KNOWLEDGE')}
                        className={`py-4 px-1 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'KNOWLEDGE' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        個別ナレッジ / メモ
                        <div className="bg-orange-100 text-orange-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">AI参照</div>
                    </button>
                </div>

                <div className="p-6 bg-gray-50 min-h-[300px]">
                    {activeTab === 'TIMELINE' && (
                        <PatientCareTimeline
                            patient={patient}
                            onSelectRecord={(id) => onSelectRecord(id)}
                        />
                    )}
                    {activeTab === 'RECORDS' && (
                        <>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex justify-between items-center">
                                <span>記録一覧</span>
                            </h3>
                            <div className="grid gap-4">
                                {patient.records.map((record) => (
                                    <button
                                        key={record.id}
                                        onClick={() => onSelectRecord(record.id)}
                                        className="w-full text-left bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-teal-200 transition-all group"
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg font-bold text-gray-800">
                                                    {record.date ? new Date(record.date).toLocaleString('ja-JP', {
                                                        year: 'numeric', month: '2-digit', day: '2-digit',
                                                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                                                    }) : '-'}
                                                </span>
                                                {record.status === 'approved' ? (
                                                    <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs font-bold rounded-full border border-green-100 flex items-center gap-1">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                        承認済
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-xs font-bold rounded-full border border-orange-100 flex items-center gap-1">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        要確認
                                                    </span>
                                                )}
                                                {record.source === 'OCR' && (
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-full border border-blue-100 flex items-center gap-1">
                                                        処方箋OCR
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-gray-400 group-hover:text-teal-400 transition-colors">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 line-clamp-1">
                                            {record.source === 'OCR' ? `処方情報: ${record.data?.institutionName || ''}` : (record.clinicalData?.soap?.s ?? '')}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {activeTab === 'KNOWLEDGE' && (
                        <div className="animate-fadeIn">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                                    個別ナレッジ・メモ
                                </h3>
                                <p className="text-xs text-gray-400">
                                    ※ ここに入力した情報は、この患者のAI要約生成時のみプロンプトに含まれます。
                                </p>
                            </div>

                            {/* Add Form */}
                            <div className="bg-white p-4 rounded-xl border border-teal-100 mb-6 shadow-sm">
                                <label className="block text-xs font-bold text-teal-600 mb-2">新規メモを追加</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        placeholder="例：〇〇薬にアレルギーあり。ご家族は××について心配している。"
                                        value={newKwContent}
                                        onChange={e => setNewKwContent(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleAddKnowledge() }}
                                    />
                                    <button
                                        onClick={handleAddKnowledge}
                                        disabled={isAddingKw || !newKwContent.trim()}
                                        className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {isAddingKw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        追加
                                    </button>
                                </div>
                            </div>

                            {/* List */}
                            {isLoadingKw ? (
                                <div className="flex justify-center p-8 text-gray-400">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                </div>
                            ) : knowledgeList.length > 0 ? (
                                <div className="space-y-3">
                                    {knowledgeList.map((item) => (
                                        <div key={item.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex justify-between items-start group">
                                            <div>
                                                <p className="text-gray-800 font-medium whitespace-pre-wrap">{item.content}</p>
                                                <p className="text-xs text-gray-400 mt-2">
                                                    {new Date(item.createdAt).toLocaleString('ja-JP')}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteKnowledge(item.id)}
                                                className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center p-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                                    登録された情報はありません
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
