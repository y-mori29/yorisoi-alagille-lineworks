import { authService } from './authService';

import { API_BASE } from './api';

export const adminApi = {
    getToken: async () => {
        return await authService.getToken();
    },

    listUsers: async () => {
        const token = await adminApi.getToken();
        if (!token) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE}/admin/users`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) {
            if (res.status === 401) {
                console.warn('Unauthorized: Logging out...');
                await authService.logout();
                window.location.reload(); // Force reload to clear state/App.tsx
                throw new Error('セッション有効期限切れのためログアウトしました');
            }
            throw new Error('Failed to fetch users');
        }
        return await res.json();
    },

    createUser: async (email: string, password: string, displayName: string, role: string) => {
        const token = await adminApi.getToken();
        if (!token) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE}/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ email, password, displayName, role })
        });
        if (!res.ok) {
            if (res.status === 401) {
                await authService.logout();
                window.location.reload();
                throw new Error('セッション切れ');
            }
            const err = await res.json();
            throw new Error(err.error || 'Failed to create user');
        }
        return await res.json();
    },

    deleteUser: async (uid: string) => {
        const token = await adminApi.getToken();
        if (!token) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE}/admin/users/${uid}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error('Failed to delete user');
        return await res.json();
    }
};
