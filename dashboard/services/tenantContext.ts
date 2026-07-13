// テナントコンテキスト＋fetchラッパー（薬局SaaS版）
//
// 暫定実装：window.fetch をラップして、API_BASE宛のリクエストに X-Tenant-Id を自動付与する。
// 既存コード（services/api.ts 等）に一切触らずにtenant対応する手段。
//
// TODO: 本番運用前にすべきこと
//   - tenantIdをJWT claimから引き、ヘッダ偽造を不可能にする
//   - api層を中央集約してapiFetchを直接使う形にリファクタ
//   - 複数tenantの薬局スタッフがログインで切り替える経路を整備

import { API_BASE } from './api';

const TENANT_KEY = 'pharmacy.tenantId';
const DEFAULT_DEMO_TENANT = 'tenant-demo-a'; // 6/12デモ用デフォルト

export function getCurrentTenantId(): string {
    return sessionStorage.getItem(TENANT_KEY) || DEFAULT_DEMO_TENANT;
}

export function setCurrentTenantId(tenantId: string) {
    sessionStorage.setItem(TENANT_KEY, tenantId);
    console.log('[tenantContext] tenantId set to:', tenantId);
}

let installed = false;
export function installTenantFetchWrapper() {
    if (installed) return;
    installed = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string'
            ? input
            : input instanceof URL
                ? input.toString()
                : (input as Request).url;

        // API_BASE宛のリクエストにだけX-Tenant-Idを付与（他のオリジンは触らない）
        const isApiCall = url.startsWith(API_BASE) || url.includes('/api/');
        if (!isApiCall) {
            return originalFetch(input, init);
        }

        const tenantId = getCurrentTenantId();
        const newInit: RequestInit = { ...(init || {}) };
        const headers = new Headers(newInit.headers || {});
        if (!headers.has('X-Tenant-Id')) {
            headers.set('X-Tenant-Id', tenantId);
        }
        newInit.headers = headers;

        return originalFetch(input, newInit);
    };

    console.log('[tenantContext] fetch wrapper installed. default tenantId:', DEFAULT_DEMO_TENANT);
}
