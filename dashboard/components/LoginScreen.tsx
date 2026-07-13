import React, { useState } from 'react';
import { authService } from '../services/authService';
import { Lock, UserRound, KeyRound } from 'lucide-react';

export const LoginScreen = () => {
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await authService.login(employeeId, password);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'ログインに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-teal-600 mb-2">よりそいPro</h1>
                    <p className="text-gray-500 text-xs">医療・介護向け管理システム</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded text-sm text-center font-bold">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">職員ID (6桁)</label>
                        <div className="relative">
                            <UserRound className="absolute left-3 top-2.5 text-gray-400" size={20} />
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="\d{6}"
                                maxLength={6}
                                required
                                value={employeeId}
                                onChange={e => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    setEmployeeId(val);
                                }}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all font-mono text-lg tracking-widest"
                                placeholder="000000"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">パスワード (数字)</label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-2.5 text-gray-400" size={20} />
                            <input
                                type="password"
                                inputMode="numeric"
                                pattern="\d*"
                                required
                                value={password}
                                onChange={e => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    setPassword(val);
                                }}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all font-mono text-lg tracking-widest"
                                placeholder="••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || employeeId.length !== 6 || password.length === 0}
                        className="w-full py-3 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? '認証中...' : 'ログイン'}
                    </button>

                    <p className="text-center text-xs text-gray-400 mt-4">
                        ※ IDとパスワードは管理者にお問い合わせください
                    </p>
                </form>
            </div>
        </div>
    );
};
