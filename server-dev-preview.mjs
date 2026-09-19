import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 5173;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API stubs for demo
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'running' } });
});

// Serve static files from dist/client
app.use(express.static(join(__dirname, 'dist/client')));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist/client/index.html'));
});

app.listen(port, () => {
  console.log(`\n✅ IA Conect running at http://localhost:${port}`);
  console.log(`📱 Open the preview in Claude to explore the app\n`);
});
