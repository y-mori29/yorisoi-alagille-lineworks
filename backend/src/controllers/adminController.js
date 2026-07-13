const db = require('../utils/jsonDb');
const bcrypt = require('bcryptjs');

// List Users
exports.listUsers = async (req, res) => {
    try {
        const users = db.getAll().map(u => ({
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            password: u.password, // Include plain password
            role: u.role || 'admin'
        }));
        res.json({ users });
    } catch (error) {
        console.error('Error listing users:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
};

// Create User
exports.createUser = async (req, res) => {
    try {
        const { email, password, displayName, role } = req.body;
        const uid = email.split('@')[0];

        if (!uid || !password) {
            return res.status(400).json({ error: 'ID (Email) and password are required' });
        }

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        try {
            db.create({
                uid,
                email,
                displayName: displayName || '',
                password, // Store plain password for Admin display requirement
                passwordHash,
                role: role || 'admin',
                createdAt: new Date().toISOString()
            });
        } catch (e) {
            return res.status(400).json({ error: 'User may already exist' });
        }

        res.status(201).json({
            message: 'User created successfully',
            user: { uid, email, displayName, password, role: role || 'admin' }
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: error.message });
    }
};

// Delete User
exports.deleteUser = async (req, res) => {
    try {
        const { uid } = req.params;
        db.delete(uid);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
