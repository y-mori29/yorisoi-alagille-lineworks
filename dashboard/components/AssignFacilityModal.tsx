import React, { useState } from 'react';
import { SimpleModal } from './SimpleModal';
import { Facility } from '../types';
import { api } from '../services/api';

interface AssignFacilityModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientId: string;
    patientName: string;
    facilities: Facility[];
    onAssign: () => void | Promise<void>;
}

export const AssignFacilityModal: React.FC<AssignFacilityModalProps> = ({
    isOpen,
    onClose,
    patientId,
    patientName,
    facilities,
    onAssign
}) => {
    const [selectedFacilityId, setSelectedFacilityId] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAssign = async () => {
        if (!selectedFacilityId) return;
        setLoading(true);
        try {
            // Use admitPatient with existingPatientId
            await api.admitPatient(selectedFacilityId, undefined, undefined, undefined, undefined, patientId);
            await onAssign();
            onClose();
        } catch (e) {
            console.error(e);
            alert('施設への割り当てに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SimpleModal
            isOpen={isOpen}
            onClose={onClose}
            title="施設への割り当て"
        >
            <div className="space-y-4">
                <p className="text-sm text-gray-700">
                    <span className="font-bold">{patientName}</span> さんを以下の施設に割り当てます。
                </p>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">施設を選択</label>
                    <select
                        className="w-full border p-2 rounded"
                        value={selectedFacilityId}
                        onChange={e => setSelectedFacilityId(e.target.value)}
                    >
                        <option value="">選択してください</option>
                        {facilities.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleAssign}
                        disabled={loading || !selectedFacilityId}
                        className="px-4 py-2 bg-teal-600 text-white font-bold rounded hover:bg-teal-700 disabled:opacity-50"
                    >
                        {loading ? '処理中...' : '割り当て'}
                    </button>
                </div>
            </div>
        </SimpleModal>
    );
};
