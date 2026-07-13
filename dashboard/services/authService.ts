export interface User {
    uid: string;
    displayName: string;
    email?: string;
    role?: string;
}

// STORAGE KEYS
const TOKEN_KEY = 'YORISOI_AUTH_TOKEN';
const USER_KEY = 'YORISOI_AUTH_USER';

import { API_BASE } from './api';

let currentUser: User | null = null;
let listeners: ((user: User | null) => void)[] = [];

// Load from persistence
const storedUser = localStorage.getItem(USER_KEY);
if (storedUser) {
    currentUser = JSON.parse(storedUser);
}

const notifyListeners = () => {
    listeners.forEach(l => l(currentUser));
};

export const authService = {
    // Backend Login
    login: async (employeeId: string, password: string): Promise<User> => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: employeeId, password })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || '認証に失敗しました');
        }

        const data = await res.json();
        const user = data.user;
        const token = data.token;

        if (user.role === 'companion') {
            throw new Error('同行者アカウントはダッシュボードにログインできません');
        }

        // Persist
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));

        currentUser = user;
        notifyListeners();
        return user;
    },

    logout: async () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        currentUser = null;
        notifyListeners();
    },

    onAuthStateChanged: (callback: (user: User | null) => void) => {
        listeners.push(callback);
        callback(currentUser);
        return () => {
            listeners = listeners.filter(l => l !== callback);
        };
    },

    getToken: async () => {
        return localStorage.getItem(TOKEN_KEY);
    },
};
