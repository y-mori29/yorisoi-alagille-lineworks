const { db } = require('../config/firebase');
const { getFamilyId, assertOwnedFamily, ageLabelFromBirthDate } = require('./familyController');

function getPatientId(req) {
    return req.query.patientId || req.headers['x-patient-id'] || req.body?.patientId || '';
}

function toIso(value) {
    if (!value) return '';
    if (typeof value === 'string') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date.toISOString();
    }
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
    return '';
}

function dateOnly(value) {
    const iso = toIso(value);
    return iso ? iso.slice(0, 10) : String(value || '').slice(0, 10);
}

function normalizeRange(source = {}) {
    const today = new Date();
    const fallbackFrom = new Date(today.getTime() - 90 * 86400000);
    const to = /^\d{4}-\d{2}-\d{2}$/.test(String(source.to || '')) ? source.to : today.toISOString().slice(0, 10);
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(source.from || '')) ? source.from : fallbackFrom.toISOString().slice(0, 10);
    if (from > to) {
        const error = new Error('from must be before to');
        error.status = 400;
        throw error;
    }
    return { from, to };
}

function withinRange(value, range) {
    const date = dateOnly(value);
    return Boolean(date && date >= range.from && date <= range.to);
}

async function loadPatientContext(req) {
    const familyId = getFamilyId(req);
    const patientId = getPatientId(req);
    if (!patientId) {
        const error = new Error('patientId required');
        error.status = 400;
        throw error;
    }
    await assertOwnedFamily(familyId, req.tenantId, req.user?.uid);
    const patientRef = db.collection('families').doc(familyId).collection('patients').doc(patientId);
    const patientSnapshot = await patientRef.get();
    if (!patientSnapshot.exists || patientSnapshot.data().tenantId !== req.tenantId || patientSnapshot.data().active === false) {
        const error = new Error('Patient not found');
        error.status = 404;
        throw error;
    }
    return { familyId, patientId, patientRef, patient: patientSnapshot.data() };
}

async function loadCollections(patientRef) {
    const [notes, labs, growth, medications, dailyLogs, questions, appointments] = await Promise.all([
        patientRef.collection('visitNotes').orderBy('visitDate', 'desc').limit(50).get(),
        patientRef.collection('labs').orderBy('testDate', 'desc').limit(50).get(),
        patientRef.collection('growthRecords').orderBy('measuredAt', 'desc').limit(100).get(),
        patientRef.collection('medications').orderBy('updatedAt', 'desc').limit(100).get(),
        patientRef.collection('dailyLogs').orderBy('occurredAt', 'desc').limit(100).get(),
        patientRef.collection('questions').orderBy('updatedAt', 'desc').limit(100).get(),
        patientRef.collection('appointments').orderBy('scheduledAt', 'asc').limit(50).get(),
    ]);
    const records = (snapshot) => snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return {
        visitNotes: records(notes), labs: records(labs), growth: records(growth), medications: records(medications),
        dailyLogs: records(dailyLogs), questions: records(questions), appointments: records(appointments),
    };
}

function sanitizeVisitNote(note) {
    return {
        id: note.id, visitDate: note.visitDate || '', clinicName: note.clinicName || '', department: note.department || '',
        summary: note.summary || '', doctorSaid: note.doctorSaid || [], nextQuestions: note.nextQuestions || [],
        medicationChanges: note.medicationChanges || [], labAndTestTopics: note.labAndTestTopics || [],
        growthNutritionTopics: note.growthNutritionTopics || [], dailyLifeTopics: note.dailyLifeTopics || [], familyMemo: note.familyMemo || '',
    };
}

function sanitizeLab(lab, patientId) {
    return {
        id: lab.id, testDate: lab.testDate || '', hospitalName: lab.hospitalName || '', department: lab.department || '',
        category: lab.category || 'blood', notes: lab.notes || '', values: (lab.values || []).map(({ name, value, unit, referenceRange, flag }) => ({ name, value, unit, referenceRange, flag })),
        photoUrl: lab.photoObject ? `/api/labs/${encodeURIComponent(lab.id)}/photo?patientId=${encodeURIComponent(patientId)}` : '',
    };
}

function sanitizeMedication(item, patientId) {
    return {
        id: item.id, name: item.name || '', dosageText: item.dosageText || '', timingText: item.timingText || '', status: item.status || 'unknown',
        startedAt: item.startedAt || '', stoppedAt: item.stoppedAt || '', memo: item.memo || '', updatedAt: toIso(item.updatedAt),
        photoUrl: item.photoObject ? `/api/medications/${encodeURIComponent(item.id)}/photo?patientId=${encodeURIComponent(patientId)}` : '',
    };
}

function sanitizeDailyLog(item, patientId) {
    return {
        id: item.id, occurredAt: item.occurredAt || '', category: item.category || 'other', title: item.title || '', memo: item.memo || '',
        media: (item.media || []).map(({ id, mediaType, contentType, originalName }) => ({ id, mediaType, contentType, originalName, url: `/api/daily-logs/${encodeURIComponent(item.id)}/media/${encodeURIComponent(id)}?patientId=${encodeURIComponent(patientId)}` })),
    };
}

const PHOTO_CATEGORY_LABELS = {
    outpatient: '外来資料',
    meal: '食事',
    lab: '検査',
    medication: 'お薬',
    growth: '成長',
    daily: '日々',
};

function buildPhotoItems(data, patientId) {
    const items = [];
    (data.labs || []).forEach((lab) => {
        if (!lab.photoObject) return;
        const category = lab.category === 'blood' ? 'lab' : 'outpatient';
        items.push({
            id: `lab:${lab.id}`,
            sourceType: 'lab',
            sourceId: lab.id,
            category,
            categoryLabel: PHOTO_CATEGORY_LABELS[category],
            date: dateOnly(lab.testDate || lab.createdAt),
            title: lab.hospitalName || (category === 'lab' ? '検査結果' : '外来資料'),
            memo: lab.notes || `${(lab.values || []).length}項目の検査値`,
            url: `/api/labs/${encodeURIComponent(lab.id)}/photo?patientId=${encodeURIComponent(patientId)}`,
            href: '/lab-tracker.html?disease=alagille',
        });
    });
    (data.medications || []).forEach((item) => {
        if (!item.photoObject) return;
        items.push({
            id: `medication:${item.id}`,
            sourceType: 'medication',
            sourceId: item.id,
            category: 'medication',
            categoryLabel: PHOTO_CATEGORY_LABELS.medication,
            date: dateOnly(item.updatedAt || item.startedAt || item.createdAt),
            title: item.name || 'お薬の写真',
            memo: [item.dosageText, item.timingText, item.memo].filter(Boolean).join(' / '),
            url: `/api/medications/${encodeURIComponent(item.id)}/photo?patientId=${encodeURIComponent(patientId)}`,
            href: '/medications.html?disease=alagille',
        });
    });
    (data.dailyLogs || []).forEach((log) => {
        (log.media || []).filter((media) => media.mediaType === 'photo').forEach((media) => {
            const category = log.category === 'meal' ? 'meal' : 'daily';
            items.push({
                id: `daily:${log.id}:${media.id}`,
                sourceType: 'daily',
                sourceId: log.id,
                mediaId: media.id,
                category,
                categoryLabel: PHOTO_CATEGORY_LABELS[category],
                date: dateOnly(log.occurredAt || log.createdAt),
                title: log.title || PHOTO_CATEGORY_LABELS[category],
                memo: log.memo || '',
                url: `/api/daily-logs/${encodeURIComponent(log.id)}/media/${encodeURIComponent(media.id)}?patientId=${encodeURIComponent(patientId)}`,
                href: '/daily-logs.html?disease=alagille',
            });
        });
    });
    return items.filter((item) => item.date).sort((a, b) => b.date.localeCompare(a.date));
}

function buildRecentItems(data) {
    const items = [];
    const note = data.visitNotes?.[0];
    if (note) items.push({ type: 'visit', date: note.visitDate || toIso(note.updatedAt), label: '診察メモ', title: note.summary || '診察内容を記録しました', detail: note.department || note.clinicName || '', href: '/simple/record.html?disease=alagille' });
    const daily = data.dailyLogs?.[0];
    if (daily) items.push({ type: 'daily', date: daily.occurredAt, label: '日々の様子', title: daily.title || daily.memo || '日々の様子を記録しました', detail: '', href: '/daily-logs.html?disease=alagille' });
    const lab = data.labs?.[0];
    if (lab) items.push({ type: 'lab', date: lab.testDate, label: '検査値', title: `${(lab.values || []).length}項目の検査結果を記録`, detail: lab.hospitalName || '', href: '/lab-tracker.html?disease=alagille' });
    const medication = data.medications?.[0];
    if (medication) items.push({ type: 'medication', date: toIso(medication.updatedAt) || medication.startedAt, label: 'お薬', title: medication.name || 'お薬を記録しました', detail: medication.status === 'stopped' ? '終了として記録' : medication.dosageText || medication.timingText || '', href: '/medications.html?disease=alagille' });
    const growth = data.growth?.[0];
    if (growth) {
        const values = [growth.heightCm !== null && growth.heightCm !== undefined ? `身長 ${growth.heightCm}cm` : '', growth.weightKg !== null && growth.weightKg !== undefined ? `体重 ${growth.weightKg}kg` : ''].filter(Boolean).join(' / ');
        items.push({ type: 'growth', date: growth.measuredAt, label: '成長', title: values || '成長を記録しました', detail: growth.memo || '', href: '/simple/growth.html?disease=alagille' });
    }
    return items.filter((item) => item.date).sort((a, b) => dateOnly(b.date).localeCompare(dateOnly(a.date))).slice(0, 8);
}

function buildDoctorView({ patientId, patient, data, range }) {
    const visitNotes = data.visitNotes.filter((item) => withinRange(item.visitDate, range)).map(sanitizeVisitNote);
    const labs = data.labs.filter((item) => withinRange(item.testDate, range)).map((item) => sanitizeLab(item, patientId));
    const growth = data.growth.filter((item) => withinRange(item.measuredAt, range)).map(({ id, measuredAt, heightCm, weightKg, headCircumferenceCm, memo }) => ({ id, measuredAt, heightCm, weightKg, headCircumferenceCm, memo: memo || '' }));
    const dailyLogs = data.dailyLogs.filter((item) => withinRange(item.occurredAt, range)).map((item) => sanitizeDailyLog(item, patientId));
    const medications = data.medications.map((item) => sanitizeMedication(item, patientId));
    const questions = data.questions.filter((item) => item.status === 'open').map(({ id, text, category, answerMemo }) => ({ id, text, category, answerMemo: answerMemo || '' }));
    const aiQuestionCandidates = visitNotes.flatMap((note) => (note.nextQuestions || []).map((text) => ({ text, sourceVisitDate: note.visitDate, sourceNoteId: note.id })));
    return {
        patient: { id: patientId, displayName: patient.displayName || '', birthDate: patient.birthDate || '', ageLabel: ageLabelFromBirthDate(patient.birthDate), avatarKey: patient.avatarKey || '' },
        selectedRange: range, visitNotes, labs, growth, medications, dailyLogs, questions, aiQuestionCandidates,
    };
}

function doctorViewToText(view, included = {}) {
    const use = (key) => included[key] !== false;
    const lines = [`【よりそい 診察共有メモ】`, `${view.patient.displayName || '健康記録の対象'} / ${view.patient.ageLabel || '年齢未登録'}`, `期間: ${view.selectedRange.from}〜${view.selectedRange.to}`];
    if (use('visitNotes') && view.visitNotes.length) view.visitNotes.forEach((note) => { lines.push('', `■ 診察メモ ${note.visitDate}`, note.summary || note.familyMemo || ''); (note.doctorSaid || []).forEach((item) => lines.push(`・${item}`)); });
    if (use('labs') && view.labs.length) view.labs.forEach((lab) => { lines.push('', `■ 検査 ${lab.testDate}`); (lab.values || []).forEach((item) => lines.push(`・${item.name}: ${item.value}${item.unit ? ` ${item.unit}` : ''}${item.flag ? ` (${item.flag})` : ''}`)); });
    if (use('growth') && view.growth.length) view.growth.forEach((item) => lines.push('', `■ 成長 ${item.measuredAt}`, [item.heightCm != null ? `身長 ${item.heightCm}cm` : '', item.weightKg != null ? `体重 ${item.weightKg}kg` : '', item.memo || ''].filter(Boolean).join(' / ')));
    if (use('medications') && view.medications.length) view.medications.forEach((item) => lines.push('', `■ お薬 ${item.name}`, [item.dosageText, item.timingText, item.memo].filter(Boolean).join(' / ')));
    if (use('dailyLogs') && view.dailyLogs.length) view.dailyLogs.forEach((item) => lines.push('', `■ 日々の様子 ${dateOnly(item.occurredAt)}`, [item.title, item.memo].filter(Boolean).join(' / ')));
    if (use('questions')) {
        const questions = [...view.questions.map((item) => item.text), ...view.aiQuestionCandidates.map((item) => `${item.text}（診察メモからの候補）`)];
        if (questions.length) { lines.push('', '■ 次に聞きたいこと'); questions.forEach((item) => lines.push(`・${item}`)); }
    }
    lines.push('', '※この資料は診断や判定ではなく、記録した内容を診察で共有するための補助です。');
    return lines.filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n').trim();
}

async function createView(req, source) {
    const context = await loadPatientContext(req);
    const data = await loadCollections(context.patientRef);
    return buildDoctorView({ patientId: context.patientId, patient: context.patient, data, range: normalizeRange(source) });
}

function sendError(res, error) { return res.status(error.status || 500).json({ ok: false, error: error.message }); }

exports.getRecentChanges = async (req, res) => {
    try {
        const context = await loadPatientContext(req);
        const data = await loadCollections(context.patientRef);
        return res.json({ ok: true, patientId: context.patientId, items: buildRecentItems(data) });
    } catch (error) { return sendError(res, error); }
};

exports.getPhotos = async (req, res) => {
    try {
        const context = await loadPatientContext(req);
        const data = await loadCollections(context.patientRef);
        return res.json({
            ok: true,
            patientId: context.patientId,
            items: buildPhotoItems(data, context.patientId),
        });
    } catch (error) { return sendError(res, error); }
};

exports.getDoctorView = async (req, res) => {
    try { return res.json({ ok: true, view: await createView(req, req.query) }); }
    catch (error) { return sendError(res, error); }
};

exports.previewDoctorView = async (req, res) => {
    try { return res.json({ ok: true, view: await createView(req, req.body) }); }
    catch (error) { return sendError(res, error); }
};

exports.exportDoctorView = async (req, res) => {
    try {
        const view = await createView(req, req.body);
        return res.json({ ok: true, text: doctorViewToText(view, req.body.included || {}) });
    } catch (error) { return sendError(res, error); }
};

module.exports.normalizeRange = normalizeRange;
module.exports.buildRecentItems = buildRecentItems;
module.exports.buildPhotoItems = buildPhotoItems;
module.exports.buildDoctorView = buildDoctorView;
module.exports.doctorViewToText = doctorViewToText;
