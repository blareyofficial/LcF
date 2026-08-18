const express = require('express');
const path = require('path');
const encoder = require('./encoder');
const decoder = require('./decoder');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '20mb' }));
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

app.post('/api/decode', async (req, res) => {
  try {
    // req.body is already a Buffer from express.raw middleware
    const lcfData = req.body;

    if (!lcfData || lcfData.length === 0) {
      return res.status(400).json({ error: 'No LCF data provided' });
    }

    // Decode LCF
    const decoded = await decoder.decodeBuffer(lcfData);

    // Convert pixel buffer to array for JSON serialization
    const pixelArray = Array.from(decoded.pixels);

    res.json({
      width: decoded.width,
      height: decoded.height,
      channels: decoded.channels,
      data: pixelArray
    });
  } catch (error) {
    console.error('[API] Decode error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/convert', async (req, res) => {
  try {
    const { width, height, channels, bitDepth, colorSpace, data, toFormat } = req.body;

    if (!width || !height || !channels || !data || !toFormat) {
      return res.status(400).json({ 
        error: 'Missing required fields: width, height, channels, data, toFormat' 
      });
    }

    const pixelBuffer = Buffer.from(data);

    if (toFormat === 'lcf') {
      // Convert to LCF format
      const lcfData = await encoder.encodeBuffer(pixelBuffer, {
        width,
        height,
        channels,
        bitDepth: bitDepth || 8,
        colorSpace: colorSpace !== undefined ? colorSpace : 0
      });

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="converted.lcf"');
      res.send(lcfData);
    } else {
      res.status(400).json({ error: `Unsupported format: ${toFormat}` });
    }
  } catch (error) {
    console.error('[API] Convert error:', error);
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

const bodyParser = require("body-parser");
const axios = require("axios");

app.use(bodyParser.urlencoded({ extended: true }));

app.post("/submit", async (req, res) => {
  const token = req.body["g-recaptcha-response"];
  const secret = process.env.RECAPTCHA_SECRET;

  if (!token) {
    return res.status(400).send("Captcha missing");
  }

  try {
    const googleURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`;
    const response = await axios.post(googleURL);

    if (response.data.success) {
      return res.send("Captcha passed!");
    } else {
      return res.status(400).send("Captcha failed");
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send("Verification error");
  }
});

