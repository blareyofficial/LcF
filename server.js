const express = require('express');
const path = require('path');
const encoder = require('./encoder');

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

app.post('/api/encode', async (req, res) => {
  try {
    const { width, height, channels, bitDepth, colorSpace, data } = req.body;

    // Validate required fields
    if (!width || !height || !channels || !data) {
      return res.status(400).json({ error: 'Missing required fields: width, height, channels, data' });
    }

    // Convert array to Buffer
    const pixelBuffer = Buffer.from(data);

    // Encode to LCF
    const lcfData = await encoder.encodeBuffer(pixelBuffer, {
      width,
      height,
      channels,
      bitDepth: bitDepth || 8,
      colorSpace: colorSpace !== undefined ? colorSpace : 0
    });

    // Send as binary file
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="image.lcf"');
    res.send(lcfData);
  } catch (error) {
    console.error('[API] Encode error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`LcF server running on port ${PORT}`);
});

module.exports = { app };
