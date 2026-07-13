import React, { useState, useEffect } from 'react';
import { SimpleModal } from './SimpleModal';
import { Facility } from '../types';
import { api } from '../services/api';

interface FacilityManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    facilities: Facility[];
    onUpdate: () => void;
}

export const FacilityManagerModal: React.FC<FacilityManagerModalProps> = ({
    isOpen,
    onClose,
    facilities,
    onUpdate
}) => {
    const [localFacilities, setLocalFacilities] = useState<Facility[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setLocalFacilities(facilities);
    }, [facilities, isOpen]);

    const handleMove = (index: number, direction: 'up' | 'down') => {
        const newList = [...localFacilities];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newList.length) return;

        [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
        setLocalFacilities(newList);
    };

    const handleSaveOrder = async () => {
        setSaving(true);
        try {
            const orders = localFacilities.map((f, index) => ({
                id: f.id,
                sortIndex: index
            }));
            await api.reorderFacilities(orders);
            onUpdate();
            onClose();
        } catch (e) {
            console.error(e);
            alert("並び替えの保存に失敗しました");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`施設「${name}」を削除しますか？\nこの操作は取り消せません。\n施設内の患者データもアクセスできなくなる可能性があります。`)) {
            return;
        }

        try {
            await api.deleteFacility(id);
            // Remove from local list immediately for UI feedback
            setLocalFacilities(prev => prev.filter(f => f.id !== id));
            onUpdate(); // Refresh parent
        } catch (e) {
            console.error(e);
            alert("削除に失敗しました");
        }
    };

    return (
        <SimpleModal
            isOpen={isOpen}
            onClose={onClose}
            title="施設管理"
        >
            <div className="space-y-4">
                <p className="text-sm text-gray-500">
                    施設の並び替えや削除を行えます。並び替えた後は「保存」ボタンを押してください。
                </p>

                <div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded">
                    {localFacilities.map((fac, index) => (
                        <div key={fac.id} className="flex items-center justify-between p-2 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <span className="font-bold text-gray-700">{fac.name}</span>

                            <div className="flex items-center gap-2">
                                <div className="flex flex-col gap-0.5">
                                    <button
                                        onClick={() => handleMove(index, 'up')}
                                        disabled={index === 0}
                                        className="text-xs text-gray-400 hover:text-teal-600 disabled:opacity-30"
                                    >
                                        ▲
                                    </button>
                                    <button
                                        onClick={() => handleMove(index, 'down')}
                                        disabled={index === localFacilities.length - 1}
                                        className="text-xs text-gray-400 hover:text-teal-600 disabled:opacity-30"
                                    >
                                        ▼
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleDelete(fac.id, fac.name)}
                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded bg-white border border-gray-200"
                                    title="削除"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                    {localFacilities.length === 0 && (
                        <div className="p-4 text-center text-gray-400 text-sm">施設がありません</div>
                    )}
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSaveOrder}
                        disabled={saving}
                        className="px-4 py-2 bg-teal-600 text-white font-bold rounded hover:bg-teal-700 disabled:opacity-50"
                    >
                        {saving ? '保存中...' : '並び順を保存'}
                    </button>
                </div>
            </div>
        </SimpleModal>
    );
};
