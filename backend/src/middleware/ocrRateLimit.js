const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_PER_CLIENT_LIMIT = 8;
const DEFAULT_DAILY_LIMIT = 100;
const DEFAULT_CONCURRENCY_LIMIT = 2;

const clients = new Map();
let dayKey = '';
let dailyCount = 0;
let activeCount = 0;

function readPositiveInt(name, fallback) {
    const value = Number.parseInt(process.env[name], 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function currentDayKey(now) {
    return new Date(now).toISOString().slice(0, 10);
}

function getClientKey(req) {
    return String(req.user?.uid || req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 120);
}

function sendLimit(res, message, retryAfterSeconds) {
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({ ok: false, error: message, retryAfterSeconds });
}

function pruneClients(now) {
    for (const [key, value] of clients) {
        if (value.resetAt <= now) clients.delete(key);
    }
}

function requireOcrCapacity(req, res, next) {
    if (process.env.LAB_OCR_MODE !== 'gemini') {
        return next();
    }

    const now = Date.now();
    const today = currentDayKey(now);
    if (today !== dayKey) {
        dayKey = today;
        dailyCount = 0;
        clients.clear();
    }
    pruneClients(now);

    const dailyLimit = readPositiveInt('OCR_DAILY_LIMIT', DEFAULT_DAILY_LIMIT);
    if (dailyCount >= dailyLimit) {
        return sendLimit(res, '本日の読み取り上限に達しました。時間をおいてお試しください。', 3600);
    }

    const concurrencyLimit = readPositiveInt('OCR_CONCURRENCY_LIMIT', DEFAULT_CONCURRENCY_LIMIT);
    if (activeCount >= concurrencyLimit) {
        return sendLimit(res, 'ただいま読み取りが混み合っています。少し待ってからお試しください。', 10);
    }

    const windowMs = readPositiveInt('OCR_WINDOW_MS', DEFAULT_WINDOW_MS);
    const perClientLimit = readPositiveInt('OCR_PER_ACCOUNT_LIMIT', DEFAULT_PER_CLIENT_LIMIT);
    const clientKey = getClientKey(req);
    const current = clients.get(clientKey);
    const bucket = current && current.resetAt > now
        ? current
        : { count: 0, resetAt: now + windowMs };

    if (bucket.count >= perClientLimit) {
        return sendLimit(
            res,
            '短時間の読み取り上限に達しました。少し待ってからお試しください。',
            Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        );
    }

    bucket.count += 1;
    clients.set(clientKey, bucket);
    dailyCount += 1;
    activeCount += 1;

    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        activeCount = Math.max(0, activeCount - 1);
    };
    res.once('finish', release);
    res.once('close', release);
    res.set('X-OCR-RateLimit-Remaining', String(Math.max(0, perClientLimit - bucket.count)));
    return next();
}

function resetForTests() {
    clients.clear();
    dayKey = '';
    dailyCount = 0;
    activeCount = 0;
}

module.exports = { requireOcrCapacity, resetForTests };
