require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 8082;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NewBackend] Server listening on port ${PORT}`);
});
