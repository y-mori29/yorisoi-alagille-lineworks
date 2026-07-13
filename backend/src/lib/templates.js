const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '../../templates');
const MASTERS_DIR = path.join(__dirname, '../../masters');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function listTemplates() {
    if (!fs.existsSync(TEMPLATES_DIR)) return [];
    const files = fs.readdirSync(TEMPLATES_DIR).filter((file) => file.endsWith('.json'));
    return files
        .map((file) => {
            const tmpl = readJson(path.join(TEMPLATES_DIR, file));
            return {
                id: tmpl.id,
                name: tmpl.name,
                shortName: tmpl.shortName,
                description: tmpl.description || '',
                icon: tmpl.icon,
                color: tmpl.color,
                sortOrder: tmpl.sortOrder || 0,
            };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getTemplate(diseaseId) {
    const filePath = path.join(TEMPLATES_DIR, `${diseaseId}.json`);
    if (!fs.existsSync(filePath)) return null;
    return readJson(filePath);
}

function getMedicationMaster(diseaseId) {
    const tmpl = getTemplate(diseaseId);
    if (!tmpl || !tmpl.medicationMaster) return null;
    const masterPath = path.join(MASTERS_DIR, tmpl.medicationMaster);
    if (!fs.existsSync(masterPath)) return null;
    return readJson(masterPath);
}

module.exports = { listTemplates, getTemplate, getMedicationMaster };

