const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed data
const DEFAULT_ADMIN = {
    uid: '000001',
    email: '000001@yorisoi.local',
    displayName: '管理者',
    role: 'admin',
    createdAt: new Date().toISOString()
};

const loadUsers = () => {
    if (!fs.existsSync(USERS_FILE)) {
        // Create with default admin if not exists (Auto-Seed)
        const passwordHash = bcrypt.hashSync('123', 10);
        const initialData = [{ ...DEFAULT_ADMIN, passwordHash }];
        fs.writeFileSync(USERS_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Error reading DB:', e);
        return [];
    }
};

const saveUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

module.exports = {
    getAll: () => loadUsers(),
    getById: (uid) => loadUsers().find(u => u.uid === uid),
    create: (user) => {
        const users = loadUsers();
        if (users.find(u => u.uid === user.uid)) throw new Error('User already exists');
        users.push(user);
        saveUsers(users);
        return user;
    },
    delete: (uid) => {
        let users = loadUsers();
        users = users.filter(u => u.uid !== uid);
        saveUsers(users);
    }
};
