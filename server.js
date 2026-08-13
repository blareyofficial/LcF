const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'viewer', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'viewer')));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    name: 'LcF',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/info', (req, res) => {
  res.json({
    name: 'LcF',
    description: 'Lossless Compression Format',
    runtime: 'node',
    status: 'ready'
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`LcF server running on port ${PORT}`);
});
