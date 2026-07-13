const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const { verifyLineIdToken } = require('../services/lineAuth');

// Tenant強制の鉄則：
// - 書き込み doc には req.tenantId を必ず付与（リクエストbodyからは受け取らない＝偽造防止）
// - 読み取りクエリには where('tenantId','==', req.tenantId) を必ず付与
// - 単体取得は doc取得後に tenantId 一致を検証。不一致なら 404（存在を隠す）

// LIFF設定の配布（患者LIFFが liff.init に使う。LIFF IDは秘密ではない）。
// リッチメニュー等には素のLIFF URL（パラメータなし）を貼る運用を許容するため、
// デフォルトのtenant/facilityもここで配る。マルチテナント本番ではLIFFアプリを
// テナント毎に分けるか、起動URLパラメータ必須に戻す。
exports.getLiffConfig = async (req, res) => {
    res.json({
        liffId: process.env.LIFF_ID || null,
        defaultTenant: process.env.DEFAULT_TENANT_ID || 'general-patient',
        defaultFacility: process.env.DEFAULT_FACILITY_ID || null,
    });
};

// 患者セッション確立（患者LIFF専用）。
// 仕様 §8: LIFFの idToken をサーバーで検証し、LINE userId を患者本人の利用者キーとして扱う。
// 追加の本人確認・同意画面は行わない。初回アクセス時は患者docを自動作成する。
exports.createPatientSession = async (req, res) => {
    try {
        const { idToken, facilityId } = req.body;
        if (!idToken) {
            return res.status(400).json({ error: 'idToken is required' });
        }

        let verified;
        if (idToken === 'demo-token' && (process.env.DEMO_MODE === '1' || !process.env.LINE_LOGIN_CHANNEL_ID)) {
            verified = { lineUserId: 'demo-user', displayName: 'デモ利用者' };
        } else {
            try {
                verified = await verifyLineIdToken(idToken);
            } catch (e) {
                console.error('[PatientSession] idToken verify failed:', e.message);
                return res.status(401).json({ error: 'LINE authentication failed' });
            }
        }
        const { lineUserId, displayName } = verified;

        // 既存患者（このテナント × このLINE userId）を探す
        const snap = await db.collection('patients')
            .where('tenantId', '==', req.tenantId)
            .where('lineUserId', '==', lineUserId)
            .limit(1)
            .get();

        if (!snap.empty) {
            const doc = snap.docs[0];
            const data = doc.data();
            // LINE表示名の変更に追従（薬局側で名前を編集する機能を作る際は同期方針を見直す）
            if (displayName && data.name !== displayName) {
                await doc.ref.update({ name: displayName, updatedAt: new Date().toISOString() });
            }
            return res.json({ patientId: doc.id, name: displayName || data.name || '' });
        }

        // 初回: LINE userId をキーに患者を自動プロビジョニング
        const patientId = uuidv4();
        const now = new Date().toISOString();
        await db.collection('patients').doc(patientId).set({
            id: patientId,
            tenantId: req.tenantId,
            lineUserId,
            lineLinkedAt: now,
            lineLinkSource: 'LIFF',
            name: displayName || 'LINE利用者',
            kana: '',
            facilityId: facilityId || null,
            status: 'active',
            createdVia: 'LIFF',
            createdAt: now,
            updatedAt: now,
        });
        console.log(`[PatientSession] provisioned new patient ${patientId} (tenant=${req.tenantId})`);
        res.status(201).json({ patientId, name: displayName || '' });
    } catch (error) {
        console.error('[PatientSession] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Create Patient
exports.createPatient = async (req, res) => {
    try {
        const { name, kana, dob, gender, facilityId, roomNumber } = req.body;

        if (!name || !facilityId) {
            return res.status(400).json({ error: 'Name and Facility ID are required' });
        }

        // facility の所有テナント検証：他テナントのfacilityIdに患者を紐付けようとしたら拒否
        const facDoc = await db.collection('facilities').doc(facilityId).get();
        if (!facDoc.exists || facDoc.data().tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Facility not found' });
        }

        const patientId = uuidv4();
        const newPatient = {
            id: patientId,
            tenantId: req.tenantId,
            name,
            kana: kana || '',
            dob: dob || null,
            gender: gender || 'unknown',
            facilityId,
            roomNumber: roomNumber || '',
            status: 'incomplete',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await db.collection('patients').doc(patientId).set(newPatient);

        res.status(201).json({ patientId, ...newPatient });
    } catch (error) {
        console.error("Create Patient Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// List Patients (tenant強制絞り、必要に応じてfacility追加絞り)
exports.listPatients = async (req, res) => {
    try {
        const { facilityId } = req.query;

        let query = db.collection('patients').where('tenantId', '==', req.tenantId);
        if (facilityId) {
            query = query.where('facilityId', '==', facilityId);
        }
        const patSnapshot = await query.get();
        let patients = patSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch Occupancies & Rooms (このテナントのfacilityサブのみ)
        try {
            const tenantFacIds = patients.map(p => p.facilityId).filter(Boolean);
            const uniqueFacIds = [...new Set(tenantFacIds)];

            const occupancies = [];
            const roomNameMap = {};

            for (const fId of uniqueFacIds) {
                // facilityサブコレクションは親facilityがtenant絞りで守られていれば構造的に安全。
                // ただし collectionGroup は使わない（テナント越境リスク）。
                const occSnap = await db.collection(`facilities/${fId}/occupancies`).get();
                const roomSnap = await db.collection(`facilities/${fId}/rooms`).get();
                occSnap.forEach(d => occupancies.push(d.data()));
                roomSnap.forEach(d => {
                    const data = d.data();
                    roomNameMap[d.id] = data.name || data.roomNumber || '';
                });
            }

            const patientRoomMap = {};
            occupancies.forEach(occ => {
                if (occ.patientId && occ.roomId) {
                    patientRoomMap[occ.patientId] = occ.roomId;
                }
            });

            patients.forEach(p => {
                const rId = patientRoomMap[p.id];
                if (rId) {
                    p.roomNumber = roomNameMap[rId] || '';
                    p.roomId = rId;
                } else {
                    p.roomNumber = p.roomNumber || '';
                }
            });
        } catch (err) {
            console.warn("Failed to fetch auxiliary/occupancy data", err);
        }

        // Fetch Encounters (Records) & Map to ClinicalData
        await Promise.all(patients.map(async (p) => {
            try {
                // encountersはpatientサブだが、念のためtenant絞りも入れる（親patientがtenant絞りで守られていれば実質越境不可だが二重防壁）
                const encSnap = await db.collection(`patients/${p.id}/encounters`)
                    .where('tenantId', '==', req.tenantId).get();

                let records = [];
                encSnap.forEach(doc => {
                    const data = doc.data();
                    const clinicalData = {
                        patient_view: data.patient_view || null,
                        soap: data.soap || { s: '', o: '', a: '', p: '' },
                        home_visit: data.home_visit || {
                            basic_info: '', chief_complaint: '', observation_treatment: '',
                            medication_instruction: '', next_plan_handover: ''
                        },
                        pharmacy_focus: data.pharmacy_focus || {
                            medications: [], adherence: '', side_effects: [],
                            drug_related_problems: [], labs_and_monitoring: [],
                            patient_education: [], follow_up: ''
                        },
                        alerts: data.alerts || { red_flags: [], need_to_contact_physician: [] },
                        meta: data.meta || { main_problems: [], note_for_pharmacy: '' },
                        family_share: data.family_share || { rephrased_content: data.report_100 || data.summaries?.medical || '' },
                        // processingController はトップレベル summary / report_100 に書く。
                        // summaries.* は旧スキーマ（常に空）なのでフォールバックに格下げ。
                        summary: data.summary || data.summaries?.internal || '',
                        report_100: data.report_100 || data.soap?.report_100 || data.summaries?.medical || '',
                        patientMemo: data.patientMemo || ''
                    };

                    records.push({
                        id: doc.id,
                        date: data.date || data.createdAt,
                        transcript: data.transcript || '',
                        clinicalData: clinicalData,
                        source: data.source || 'RECORDING',
                        data: data.data || null,
                        recordedByName: data.recordedByName || null,
                        recordedById: data.recordedById || null,
                        patientMemo: data.patientMemo || '',
                        lineDeliveryStatus: data.lineDeliveryStatus || null,
                        encounterStatus: data.status || null, // COMPLETED/PROCESSING/ANALYZING/FAILED
                        status: 'pending'
                    });
                });

                records.sort((a, b) => {
                    const dateA = a.date || '';
                    const dateB = b.date || '';
                    return dateB.localeCompare(dateA);
                });

                p.records = records;
            } catch (e) {
                console.warn(`Failed to fetch encounters for ${p.id}`, e);
                p.records = [];
            }
        }));

        res.json({ ok: true, patients });
    } catch (error) {
        console.error("List Patients Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Get Single Patient (tenant検証で越境を404に隠す)
exports.getPatient = async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await db.collection('patients').doc(id).get();

        if (!doc.exists || doc.data().tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        res.json(doc.data());
    } catch (error) {
        console.error("Get Patient Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Delete Patient
exports.deletePatient = async (req, res) => {
    try {
        const { id } = req.params;

        const patientDoc = await db.collection('patients').doc(id).get();
        if (!patientDoc.exists || patientDoc.data().tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        const patientData = patientDoc.data();
        const facilityId = patientData.facilityId;

        if (facilityId) {
            try {
                const occupancyRef = db.collection(`facilities/${facilityId}/occupancies`).doc(id);
                await occupancyRef.delete().catch(() => {});

                const staysRef = db.collection(`facilities/${facilityId}/stays`);
                const staysSnapshot = await staysRef.where('patientId', '==', id).get();
                const deleteStayPromises = staysSnapshot.docs.map(doc => doc.ref.delete());
                await Promise.all(deleteStayPromises);
            } catch (err) {
                console.warn(`Failed to delete occupancy/stay for patient ${id}:`, err);
            }
        }

        try {
            const encountersRef = db.collection(`patients/${id}/encounters`);
            const encountersSnapshot = await encountersRef.get();
            const deleteEncounterPromises = encountersSnapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deleteEncounterPromises);
        } catch (err) {
            console.warn(`Failed to delete encounters for patient ${id}:`, err);
        }

        await db.collection('patients').doc(id).delete();
        res.json({ success: true });
    } catch (error) {
        console.error("Delete Patient Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Delete Record (Encounter)
exports.deleteRecord = async (req, res) => {
    try {
        const { patientId, recordId } = req.params;
        // 親patientの所有テナント検証
        const patDoc = await db.collection('patients').doc(patientId).get();
        if (!patDoc.exists || patDoc.data().tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        await db.collection('patients').doc(patientId).collection('encounters').doc(recordId).delete();
        res.json({ success: true });
    } catch (error) {
        console.error("Delete Record Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Update Record (Encounter)
exports.updateRecord = async (req, res) => {
    try {
        const { patientId, recordId } = req.params;
        const updates = req.body;

        const patDoc = await db.collection('patients').doc(patientId).get();
        if (!patDoc.exists || patDoc.data().tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const encounterRef = db.collection('patients').doc(patientId).collection('encounters').doc(recordId);
        updates.updatedAt = new Date().toISOString();
        // tenantIdの上書きは禁止（既存値を保つ）
        delete updates.tenantId;

        await encounterRef.set(updates, { merge: true });
        res.json({ success: true });
    } catch (error) {
        console.error("Update Record Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// --- Patient Knowledge Methods ---

exports.addPatientKnowledge = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, category } = req.body;

        if (!content) return res.status(400).json({ error: 'Content is required' });

        const patDoc = await db.collection('patients').doc(id).get();
        if (!patDoc.exists || patDoc.data().tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const knowledgeRef = db.collection('patients').doc(id).collection('knowledge').doc();
        const newKnowledge = {
            id: knowledgeRef.id,
            tenantId: req.tenantId,
            content,
            category: category || 'memo',
            createdAt: new Date().toISOString()
        };
        await knowledgeRef.set(newKnowledge);
        res.json(newKnowledge);
    } catch (error) {
        console.error("Add Patient Knowledge Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getPatientKnowledge = async (req, res) => {
    try {
        const { id } = req.params;
        const patDoc = await db.collection('patients').doc(id).get();
        if (!patDoc.exists || patDoc.data().tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        const snapshot = await db.collection('patients').doc(id).collection('knowledge').orderBy('createdAt', 'desc').get();
        const list = snapshot.docs.map(doc => doc.data());
        res.json({ list });
    } catch (error) {
        console.error("Get Patient Knowledge Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.deletePatientKnowledge = async (req, res) => {
    try {
        const { id, knowledgeId } = req.params;
        const patDoc = await db.collection('patients').doc(id).get();
        if (!patDoc.exists || patDoc.data().tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        await db.collection('patients').doc(id).collection('knowledge').doc(knowledgeId).delete();
        res.json({ success: true });
    } catch (error) {
        console.error("Delete Patient Knowledge Error:", error);
        res.status(500).json({ error: error.message });
    }
};
