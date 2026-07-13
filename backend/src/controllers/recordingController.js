const { bucket } = require('../config/gcs');
const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

// 録音セッションの事前作成。
// 設計意図: 旧フローは「初回チャンクのsign-upload応答」でrecordingIdを確定していたが、
// 短時間録音では複数チャンクが recordingId 未確定のまま並行発行され、recordingが分裂する
// race があった。録音開始前にIDを確定させることで構造的に解消する。
exports.initRecording = async (req, res) => {
    try {
        const {
            patientId,
            facilityId,
            contentType,
            recordedById,
            recordedByName,
            recordedByRole,
            recordType,
            inputMode,
            clinicId,
            facilityName,
            department,
            visitDate,
            diseaseId,
        } = req.body;

        if (patientId) {
            const patDoc = await db.collection('patients').doc(patientId).get();
            if (!patDoc.exists || patDoc.data().tenantId !== req.tenantId) {
                return res.status(404).json({ error: 'Patient not found' });
            }
        }
        if (facilityId) {
            const facDoc = await db.collection('facilities').doc(facilityId).get();
            if (!facDoc.exists || facDoc.data().tenantId !== req.tenantId) {
                return res.status(404).json({ error: 'Facility not found' });
            }
        }

        const recordingId = uuidv4();
        const now = new Date().toISOString();
        const doc = {
            recordingId,
            tenantId: req.tenantId,
            status: 'RECORDING',
            contentType: contentType || null,
            createdAt: now,
            updatedAt: now,
        };
        if (patientId) doc.patientId = patientId;
        if (facilityId) doc.facilityId = facilityId;
        if (recordType) doc.recordType = recordType;
        if (inputMode) doc.inputMode = inputMode;
        if (clinicId) doc.clinicId = clinicId;
        if (facilityName) doc.facilityName = facilityName;
        if (department) doc.department = department;
        if (visitDate) doc.visitDate = visitDate;
        if (diseaseId) doc.diseaseId = diseaseId;
        if (recordedById) doc.recordedById = recordedById;
        if (recordedByName) doc.recordedByName = recordedByName;
        if (recordedByRole) doc.recordedByRole = recordedByRole;

        await db.collection('recordings').doc(recordingId).set(doc);
        res.status(201).json({ recordingId });
    } catch (error) {
        console.error('InitRecording error:', error);
        res.status(500).json({ error: error.message });
    }
};

// 1録音あたりの上限（コスト悪用・無限録音の防止）
const MAX_CHUNKS_PER_RECORDING = 360; // 10秒チャンク×360 = 最大60分

// Sign Upload URL (Chunk Support) - tenant強制版
exports.signUpload = async (req, res) => {
    try {
        const {
            recordingId,
            seq,
            contentType,
            patientId,
            facilityId,
            recordedById,
            recordedByName,
            recordedByRole,
            recordType,
            inputMode,
            clinicId,
            facilityName,
            department,
            visitDate,
            diseaseId,
        } = req.body;

        const currentRecordingId = recordingId || uuidv4();
        const sequence = seq || 1;

        if (sequence > MAX_CHUNKS_PER_RECORDING) {
            return res.status(413).json({ error: 'Recording too long' });
        }

        // 既存recordingに追記する場合：所有テナント検証（他テナントのrecordingに紛れ込み禁止）
        if (recordingId) {
            const existing = await db.collection('recordings').doc(recordingId).get();
            if (existing.exists && existing.data().tenantId !== req.tenantId) {
                return res.status(404).json({ error: 'Recording not found' });
            }
        }

        // patientIdが指定されていれば、所有テナント検証
        if (patientId) {
            const patDoc = await db.collection('patients').doc(patientId).get();
            if (!patDoc.exists || patDoc.data().tenantId !== req.tenantId) {
                return res.status(404).json({ error: 'Patient not found' });
            }
        }
        // facilityIdも同様
        if (facilityId) {
            const facDoc = await db.collection('facilities').doc(facilityId).get();
            if (!facDoc.exists || facDoc.data().tenantId !== req.tenantId) {
                return res.status(404).json({ error: 'Facility not found' });
            }
        }

        let extension = 'webm';
        if (contentType === 'application/octet-stream') {
            extension = 'raw';
        } else if (contentType) {
            extension = contentType.split('/')[1] || 'webm';
        }

        // GCSパスは sessions/{recordingId}/... のまま（recordingIdはUUIDで衝突なし）。
        // テナント分離は Firestore recordings doc の tenantId と signUpload 時の所有検証で担保。
        // 物理パスへの tenantId 埋め込みは将来強化（processingController全体の改修と同期が必要）。
        const gcsPath = `sessions/${currentRecordingId}/chunk-${String(sequence).padStart(5, '0')}.${extension}`;
        const file = bucket.file(gcsPath);

        const [signedUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000,
            contentType: contentType || 'application/octet-stream',
        });

        const docRef = db.collection('recordings').doc(currentRecordingId);

        const updateData = {
            recordingId: currentRecordingId,
            tenantId: req.tenantId,
            status: 'UPLOADING',
            lastChunkSeq: sequence,
            contentType: contentType || null,
            updatedAt: new Date().toISOString()
        };

        if (patientId) updateData.patientId = patientId;
        if (facilityId) updateData.facilityId = facilityId;
        if (recordType) updateData.recordType = recordType;
        if (inputMode) updateData.inputMode = inputMode;
        if (clinicId) updateData.clinicId = clinicId;
        if (facilityName) updateData.facilityName = facilityName;
        if (department) updateData.department = department;
        if (visitDate) updateData.visitDate = visitDate;
        if (diseaseId) updateData.diseaseId = diseaseId;
        if (recordedById) updateData.recordedById = recordedById;
        if (recordedByName) updateData.recordedByName = recordedByName;
        if (recordedByRole) updateData.recordedByRole = recordedByRole;
        if (!recordingId) {
            updateData.createdAt = new Date().toISOString();
        }

        await docRef.set(updateData, { merge: true });

        res.json({
            recordingId: currentRecordingId,
            uploadUrl: signedUrl,
            gcsPath: `gs://${bucket.name}/${gcsPath}`,
            seq: sequence
        });

    } catch (error) {
        console.error('SignUpload error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getStatus = async (req, res) => {
    try {
        const { recordingId } = req.params;
        const recDoc = await db.collection('recordings').doc(recordingId).get();

        if (!recDoc.exists || recDoc.data().tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Recording not found' });
        }

        const recData = recDoc.data();
        let encounter = null;

        if (recData.patientId && recData.encounterId) {
            const encDoc = await db
                .collection('patients')
                .doc(recData.patientId)
                .collection('encounters')
                .doc(recData.encounterId)
                .get();

            if (encDoc.exists) {
                const encData = encDoc.data();
                encounter = {
                    id: encDoc.id,
                    status: encData.status || null,
                    lineDeliveryStatus: encData.lineDeliveryStatus || null,
                    updatedAt: encData.updatedAt || null,
                };
            }
        }

        res.json({
            ok: true,
            recordingId,
            status: recData.status || null,
            patientId: recData.patientId || null,
            encounterId: recData.encounterId || null,
            lineDeliveryStatus: recData.lineDeliveryStatus || encounter?.lineDeliveryStatus || null,
            updatedAt: recData.updatedAt || recData.processedAt || null,
            encounter,
        });
    } catch (error) {
        console.error('Recording status error:', error);
        res.status(500).json({ error: error.message });
    }
};
