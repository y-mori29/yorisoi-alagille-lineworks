const express = require('express');
const cors = require('cors');
const path = require('path');
const { verifyToken } = require('./middleware/auth');

const app = express();

// Middleware
app.use(cors({ origin: true })); // Allow all origins for dev, or configure specifically
app.use(express.json({ limit: '50mb' }));

// Health Check (Public)
app.get('/health', (req, res) => {
    res.send('OK');
});

// Import Routes
const routes = require('./routes');
// Mount API Routes - Protect with Auth if desired globally, or per-route
// app.use('/api', verifyToken, routes); 
// For migration phase, we might keep some public or mixed
app.use('/api', routes);

module.exports = app;
