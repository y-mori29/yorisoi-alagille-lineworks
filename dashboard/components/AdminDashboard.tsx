import React, { useEffect, useState } from 'react';
import { adminApi } from '../services/adminApi';
import { User, Trash2, Plus, ShieldAlert } from 'lucide-react';

interface UserData {
    uid: string;
    email: string;
    displayName: string;
    disabled: boolean;
    password?: string;
    role?: string;
}

export const AdminDashboard = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Form State
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('admin');

    const fetchUsers = async () => {
        try {
            const data = await adminApi.listUsers();
            setUsers(data.users);
        } catch (e) {
            console.error(e);
            alert('ユーザー一覧の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail || !newPassword) return;

        // Convert ID to Email for Backend
        const emailPayload = `${newEmail}@yorisoi.local`;

        try {
            await adminApi.createUser(emailPayload, newPassword, newName, newRole);
            alert('ユーザーを作成しました');
            setIsAddOpen(false);
            setNewName('');
            setNewEmail(''); // Reset ID
            setNewPassword('');
            setNewRole('admin');
            fetchUsers();
        } catch (e: any) {
            alert(`作成失敗: ${e.message}`);
        }
    };

    const handleDelete = async (uid: string) => {
        if (!confirm('本当にこのユーザーを削除しますか？')) return;
        try {
            await adminApi.deleteUser(uid);
            fetchUsers();
        } catch (e) {
            alert('削除に失敗しました');
        }
    };

    if (loading) return <div className="p-10 text-center">Loading Admin...</div>;

    return (
        <div className="p-6 bg-gray-50 h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <ShieldAlert className="text-teal-600" /> アカウント管理
                    </h2>
                    <button
                        onClick={() => setIsAddOpen(true)}
                        className="px-4 py-2 bg-teal-600 text-white rounded shadow hover:bg-teal-700 font-bold flex items-center gap-1"
                    >
                        <Plus size={18} /> ユーザー追加
                    </button>
                </div>

                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100 border-b border-gray-200">
                            <tr>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">ユーザー名</th>
                                {/* <th className="p-3 text-xs font-bold text-gray-500 uppercase">Email</th> */}
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">Password</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">Role</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">UID</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map(user => (
                                <tr key={user.uid} className="hover:bg-gray-50">
                                    <td className="p-3 font-bold text-gray-700 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                            <User size={16} />
                                        </div>
                                        {user.displayName || '(No Name)'}
                                    </td>
                                    {/* <td className="p-3 text-sm text-gray-600">{user.email}</td> */}
                                    <td className="p-3 text-sm text-gray-600 font-mono tracking-widest">
                                        {user.password || '••••••'}
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 text-xs font-bold rounded ${user.role === 'companion' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                                            {user.role === 'companion' ? '同行者' : '管理者'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-xs text-gray-400 font-mono">{user.uid}</td>
                                    <td className="p-3 text-right">
                                        <button
                                            onClick={() => handleDelete(user.uid)}
                                            className="text-red-400 hover:text-red-600 p-1"
                                            title="削除"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400">ユーザーがいません</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add User Modal */}
            {isAddOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                        <h3 className="font-bold text-lg mb-4">新規ユーザー作成</h3>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">表示名</label>
                                <input className="w-full border p-2 rounded" value={newName} onChange={e => setNewName(e.target.value)} placeholder="スタッフ名" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">職員ID (6桁)</label>
                                <input
                                    className="w-full border p-2 rounded font-mono"
                                    type="text"
                                    maxLength={6}
                                    pattern="\d{6}"
                                    required
                                    value={newEmail} // reusing state variable for ID input
                                    onChange={e => {
                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                        setNewEmail(val);
                                    }}
                                    placeholder="000000"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Pass (数字)</label>
                                <input className="w-full border p-2 rounded font-mono" type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="数字推奨" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">権限 (ロール)</label>
                                <select className="w-full border p-2 rounded font-bold" value={newRole} onChange={e => setNewRole(e.target.value)}>
                                    <option value="admin">管理者 (全権限)</option>
                                    <option value="companion">同行者 (アプリ録音のみ)</option>
                                </select>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setIsAddOpen(false)} className="flex-1 py-2 bg-gray-100 rounded text-gray-600 font-bold">キャンセル</button>
                                <button type="submit" className="flex-1 py-2 bg-teal-600 text-white rounded font-bold hover:bg-teal-700">作成</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
