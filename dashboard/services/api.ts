
const getApiBase = () => {
    // Priority 1: Injected environment variable from build process
    const url = (import.meta as any).env.VITE_API_BASE_URL;
    if (url) return url;

    // Fallback for local development
    return 'http://localhost:8081/api';
};

export const API_BASE = getApiBase();

export interface Room {
    roomId: string;
    roomNumber: string;
    label: string;
    patients: PatientCard[];
}

export interface PatientCard {
    patientId: string;
    displayName: string;
    alerts: string[];
    stayType: 'LONG' | 'SHORT';
    stayId: string;
    occupancyId: string;
}

export interface FacilityBoard {
    facility: any;
    lanes: {
        unassigned: PatientCard[];
        awayHospital: PatientCard[];
    };
    rooms: Room[];
}

export interface Job {
    jobId: string;
    mtime?: string;
    patientId?: string;
    patientName?: string;
    facilityId?: string;
    facilityName?: string;
}

export interface JobDetail {
    status: 'RUNNING' | 'DONE';
    transcript?: string;
    summary?: any;
    detailUrl?: string; // HTML URL
    patientId?: string;
    patientName?: string;
    facilityId?: string;
    facilityName?: string;
}

export const api = {
    fetchFacilities: async (): Promise<any[]> => {
        const res = await fetch(`${API_BASE}/facilities`);
        if (!res.ok) return [];
        const json = await res.json();
        return json.facilities || [];
    },

    createFacility: async (name: string, type: string): Promise<any> => {
        const res = await fetch(`${API_BASE}/facilities`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, type })
        });
        const json = await res.json();
        return { id: json.facilityId, name, type };
    },

    fetchPatients: async (): Promise<any[]> => {
        const res = await fetch(`${API_BASE}/patients`);
        if (!res.ok) return [];
        const json = await res.json();
        return json.patients || [];
    },

    createPatient: async (name: string, facilityId: string, dob: string, roomNumber: string, kana?: string, gender?: string): Promise<any> => {
        // This is legacy generic creation. 
        const res = await fetch(`${API_BASE}/patients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, facilityId, dob, kana, gender })
        });
        const json = await res.json();
        return { id: json.patientId, name, facilityId, dob, roomNumber, kana, gender };
    },

    // New: Admit Patient (Creates Stay/Occupancy immediately)
    // Now supports existingPatientId to link an existing patient instead of creating new
    admitPatient: async (facilityId: string, name?: string, kana?: string, dob?: string, gender?: string, existingPatientId?: string): Promise<any> => {
        const res = await fetch(`${API_BASE}/facilities/${facilityId}/stays`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patient: {
                    displayName: name || '',
                    kana: kana || '',
                    dob: dob || null,
                    gender: gender || 'unknown'
                },
                existingPatientId, // Optional: if provided, links existing patient
                type: 'LONG', // Default
                startAt: new Date().toISOString()
            })
        });
        if (!res.ok) throw new Error('Failed to admit patient');
        return await res.json();
    },

    deletePatient: async (patientId: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/patients/${patientId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete patient');
    },

    deleteFacility: async (facilityId: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/facilities/${facilityId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete facility');
    },

    reorderFacilities: async (orders: { id: string, sortIndex: number }[]): Promise<void> => {
        const res = await fetch(`${API_BASE}/facilities/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orders })
        });
        if (!res.ok) throw new Error('Failed to reorder facilities');
    },

    fetchBoard: async (facilityId: string): Promise<FacilityBoard> => {
        const res = await fetch(`${API_BASE}/facilities/${facilityId}/board`);
        if (!res.ok) throw new Error('Failed to fetch board');
        return await res.json();
    },

    moveOccupancy: async (facilityId: string, patientId: string, to: any): Promise<any> => {
        const res = await fetch(`${API_BASE}/facilities/${facilityId}/occupancies:move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientId, to })
        });
        if (!res.ok) throw new Error('Move failed');
        return await res.json();
    },

    createRooms: async (facilityId: string, rooms: { label: string }[]): Promise<any> => {
        const res = await fetch(`${API_BASE}/facilities/${facilityId}/rooms:bulkUpsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rooms })
        });
        if (!res.ok) throw new Error('Failed to create rooms');
        return await res.json();
    },

    fetchRecentJobs: async (): Promise<Job[]> => {
        return [];
    },

    fetchJob: async (jobId: string): Promise<JobDetail | null> => {
        return null;
    },

    regenerateSummary: async (jobId: string, customPrompt: string, transcript?: string): Promise<any> => {
        // Implement real call if needed, or keeping dummy if logic moved to components
        return null;
    },

    deleteRecord: async (patientId: string, recordId: string) => {
        const res = await fetch(`${API_BASE}/patients/${patientId}/records/${recordId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete record');
        return res.json();
    },

    summarize: async (data: any): Promise<any> => {
        // backend: processingController.summarizeContent expects { content }
        const res = await fetch(`${API_BASE}/recordings/summarize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: data })
        });
        if (!res.ok) throw new Error('Failed to summarize');
        return res.json();
    },

    analyzeText: async (params: { text: string; patientId?: string; pastHistory?: string; ocrData?: string; knowledgeBase?: string }) => {
        const res = await fetch(`${API_BASE}/recordings/analyze-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        if (!res.ok) throw new Error('Failed to analyze text');
        return res.json();
    },

    // --- Knowledge Base (RAG) ---
    fetchKnowledge: async (): Promise<any[]> => {
        const res = await fetch(`${API_BASE}/knowledge`);
        if (!res.ok) return [];
        const json = await res.json();
        return json.list || [];
    },

    processOCR: async (file: File, patientId?: string): Promise<any> => {
        const formData = new FormData();
        formData.append('image', file);
        if (patientId) formData.append('patientId', patientId);
        const res = await fetch(`${API_BASE}/ocr/prescription`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('OCR failed');
        return await res.json();
    },

    uploadKnowledge: async (file: File, patientId?: string): Promise<any> => {
        const formData = new FormData();
        formData.append('file', file);
        if (patientId) formData.append('patientId', patientId);
        const res = await fetch(`${API_BASE}/knowledge/upload`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Upload failed: ${res.status} ${res.statusText}`);
        }
        return await res.json();
    },

    deleteKnowledge: async (id: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/knowledge/${id}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Deletion failed');
    },

    chatWithAI: async (patientId: string, message: string, history: any[]) => {
        const res = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientId, message, history })
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Chat failed: ${res.status}`);
        }
        return await res.json();
    },

    // --- New Record Updates & Patient Knowledge ---
    updateRecord: async (patientId: string, recordId: string, data: any) => {
        const res = await fetch(`${API_BASE}/patients/${patientId}/records/${recordId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update record');
        return res.json();
    },

    fetchPatientKnowledge: async (patientId: string): Promise<any[]> => {
        const res = await fetch(`${API_BASE}/patients/${patientId}/knowledge`);
        if (!res.ok) return [];
        const json = await res.json();
        return json.list || [];
    },

    addPatientKnowledge: async (patientId: string, content: string, category: string = 'memo'): Promise<any> => {
        const res = await fetch(`${API_BASE}/patients/${patientId}/knowledge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, category })
        });
        if (!res.ok) throw new Error('Failed to add knowledge');
        return res.json();
    },

    deletePatientKnowledge: async (patientId: string, knowledgeId: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/patients/${patientId}/knowledge/${knowledgeId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete knowledge');
    }
};
