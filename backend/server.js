const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8081; // Default to 8081 as expected by Dashboard/Frontend
app.set('trust proxy', 1);

// Middleware
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// The patient UI is served from this process, so same-origin is the default.
// Cross-origin access is enabled only when an operator explicitly configures it.
const allowOrigin = (process.env.ALLOW_ORIGIN || '').trim();
if (allowOrigin) {
  app.use(cors({
    origin: allowOrigin,
    credentials: true
  }));
}
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT
  || (process.env.ALAGILLE_API_MODE === '1' ? '8mb' : '50mb');
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));

// Keep health independent from static files and API/demo access restrictions.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files from 'public' if needed (optional)
app.use(express.static(path.join(__dirname, 'public')));

// Keep copied legacy APIs outside the Alagille product boundary.
const { requireAlagilleApiAllowlist } = require('./src/middleware/alagilleApiAllowlist');
app.use('/api', requireAlagilleApiAllowlist);

const { requireSameOriginMutation } = require('./src/middleware/sameOrigin');
app.use('/api', requireSameOriginMutation);

// Tenant middleware：全 /api/* に X-Tenant-Id 必須化（health等は除外・middleware側で判定）
const { requireTenant } = require('./src/middleware/tenant');
app.use('/api', requireTenant);

// Routes
const routes = require('./src/routes/index');
app.use('/api', routes);

// Health Check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Yorisoi Backend API is running',
    version: '2.0.0 (Modular)'
  });
});

// Mock/Verification Endpoint (legacy support check)
app.get('/facilities', (req, res) => {
  res.status(410).json({ error: 'Deprecated. Use /api/facilities' });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  res.status(500).json({
    ok: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Routes mounted at /api`);
});
