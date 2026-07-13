const API_BASE = "";

let _idToken = null;
let _userId = null;
let _patientId = null;
let _isDemoMode = false;
let _diseaseId = null;
let _template = null;

function getCurrentDiseaseId() {
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get("disease");
  if (fromUrl) {
    localStorage.setItem("yorisoi_disease", fromUrl);
    localStorage.setItem("yorisoi_setup_done", "1");
    return fromUrl;
  }
  return localStorage.getItem("yorisoi_disease") || "alagille";
}

async function startPatientSession(idToken) {
  try {
    const sessionRes = await fetch(`${API_BASE}/api/patients/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (sessionRes.ok) {
      const session = await sessionRes.json();
      _patientId = session.patientId || null;
      if (_patientId) localStorage.setItem("yorisoi_patient_id", _patientId);
      return;
    }
  } catch (e) {
    console.warn("patient session error:", e.message);
  }
  _patientId = localStorage.getItem("yorisoi_patient_id") || "demo-user";
}

async function initLiff() {
  _diseaseId = getCurrentDiseaseId();
  try {
    const res = await fetch(`${API_BASE}/api/config?disease=${encodeURIComponent(_diseaseId)}`);
    if (res.ok) _template = await res.json();
  } catch (err) {
    console.warn("config fetch skipped:", err.message);
  }

  const liffId = _template && _template.liff_id ? _template.liff_id : "";
  const serverSaysDemo = !!(_template && _template.isDemoMode);
  if (typeof liff === "undefined" || !liffId || serverSaysDemo) {
    _isDemoMode = true;
    _idToken = "demo-token";
    _userId = "demo-user";
  } else {
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) { liff.login(); return; }
    _idToken = liff.getIDToken();
    const profile = await liff.getProfile();
    _userId = profile.userId;
  }

  _patientId = localStorage.getItem("yorisoi_patient_id") || null;
  startPatientSession(_idToken);

  const p = location.pathname;
  const isHome = p === "/" || p === "/index.html";
  const isSimplePath = p.startsWith("/simple/");
  const isSetup = p === "/setup.html";
  if (!isHome && !isSimplePath && !isSetup) {
    try { attachSimpleBackBadge(); } catch (_) {}
  }

  return { idToken: _idToken, userId: _userId, patientId: _patientId, diseaseId: _diseaseId, template: _template };
}

function getTemplate() { return _template; }
function getDiseaseId() { return _diseaseId || getCurrentDiseaseId(); }
function getPatientId() { return _patientId || localStorage.getItem("yorisoi_patient_id") || "demo-user"; }

function getCurrentMode() {
  const stored = localStorage.getItem("yorisoi_mode");
  if (stored === "simple" || stored === "detail") return stored;
  return localStorage.getItem("yorisoi_setup_done") === "1" ? "detail" : "simple";
}

function setMode(mode) {
  if (mode !== "simple" && mode !== "detail") return;
  localStorage.setItem("yorisoi_mode", mode);
}

async function apiFetch(path, options = {}) {
  const disease = getDiseaseId();
  const patientId = getPatientId();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${_idToken || "demo-token"}`,
    "X-Disease-Id": disease,
    ...(options.headers || {}),
  };
  if (patientId) headers["X-Patient-Id"] = patientId;
  const url = new URL(`${API_BASE}${path}`, location.origin);
  if (!url.searchParams.has("disease")) url.searchParams.set("disease", disease);
  if (patientId && !url.searchParams.has("patientId")) url.searchParams.set("patientId", patientId);
  const res = await fetch(url.toString(), { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

function apiGet(path) { return apiFetch(path); }
function apiPost(path, data) { return apiFetch(path, { method: "POST", body: JSON.stringify(data) }); }
function apiPut(path, data) { return apiFetch(path, { method: "PUT", body: JSON.stringify(data) }); }
function apiDelete(path) { return apiFetch(path, { method: "DELETE" }); }

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatYearMonth(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

function getCategoryLabels() {
  if (!_template || !_template.timelineCategories) return CATEGORY_LABELS;
  const map = { ...CATEGORY_LABELS };
  _template.timelineCategories.forEach((c) => { map[c.id] = c.label; });
  return map;
}

let _medCategoryLabels = null;
async function getMedCategoryLabels() {
  if (_medCategoryLabels) return _medCategoryLabels;
  try {
    const master = await apiGet("/api/master/medications");
    _medCategoryLabels = {};
    if (master.categories) master.categories.forEach((c) => { _medCategoryLabels[c.id] = c.name; });
    return _medCategoryLabels;
  } catch {
    return MED_CATEGORY_LABELS;
  }
}

const CATEGORY_LABELS = {
  diagnosis: "診断",
  hospitalization: "入院",
  medication_change: "薬の変更",
  exam: "検査",
  treatment_change: "治療方針の変更",
  self_log: "家族メモ",
  "self-log": "家族メモ",
  other: "その他",
};

const MED_CATEGORY_LABELS = {
  "5-ASA": "5-ASA製剤",
  steroid: "ステロイド",
  immunomodulator: "免疫調整薬",
  biologic: "生物学的製剤",
  jak_inhibitor: "JAK阻害薬",
  other: "その他",
};

function showLoading(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p class="mt-8 text-sm text-muted">読み込み中...</p></div>';
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function getBackHref() {
  const disease = getDiseaseId();
  return "/?disease=" + encodeURIComponent(disease || "alagille");
}

function attachSimpleBackBadge() {
  const back = document.querySelector(".header-back");
  if (back) {
    back.innerHTML = "←";
    back.title = "ホームに戻る";
    back.onclick = () => { location.href = getBackHref(); };
  }
  const header = document.querySelector(".header");
  if (header && !header.querySelector(".simple-mode-badge")) {
    const badge = document.createElement("a");
    badge.className = "simple-mode-badge";
    badge.href = getBackHref();
    badge.style.cssText = "margin-left:auto; padding:4px 10px; background:rgba(255,255,255,0.2); color:#fff; font-size:11px; border-radius:12px; text-decoration:none; font-weight:600; display:inline-flex; align-items:center; gap:4px;";
    badge.innerHTML = "← ホームに戻る";
    header.appendChild(badge);
  }
}

function renderMenuGrid(containerId) {
  if (!_template || !_template.modules) return;
  const container = document.getElementById(containerId);
  if (!container) return;
  const diseaseParam = `disease=${encodeURIComponent(getDiseaseId() || "alagille")}`;
  container.innerHTML = _template.modules.filter((m) => m.enabled).map((mod) => {
    const href = mod.page + (mod.page.includes("?") ? "&" : "?") + diseaseParam;
    const fullWidth = mod.fullWidth ? ' style="grid-column: 1 / -1;"' : "";
    return `
      <a href="/${href}" class="menu-card"${fullWidth}>
        <div class="menu-icon"><span class="material-symbols-outlined">${mod.icon}</span></div>
        <div class="menu-label">${escapeHtml(mod.label)}</div>
        <div class="menu-desc">${escapeHtml(mod.description)}</div>
      </a>`;
  }).join("");
}