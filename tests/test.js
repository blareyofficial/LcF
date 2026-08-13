/**
 * LcF Test Suite
 * Comprehensive tests for encoder, decoder, and utilities
 */

const assert = require('assert');
const filters = require('../encoder/filters');
const entropy = require('../encoder/entropy');
const crc32 = require('../encoder/crc32');
const { LcfContainer, parseLcf } = require('../encoder/container');
const chunks = require('../encoder/chunks');

// Test counter
let testCount = 0;
let passCount = 0;
let failCount = 0;

/**
 * Test harness
 */
function describe(name, callback) {
  console.log(`\n${name}`);
  console.log('='.repeat(50));
  callback();
}

function it(name, callback) {
  testCount++;
  try {
    callback();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failCount++;
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
  }
}

// ============================================================
// Filter Tests
// ============================================================

describe('Predictive Filters', () => {
  it('filterNone should return identical data', () => {
    const input = Buffer.from([1, 2, 3, 4, 5]);
    const output = filters.filterNone(input);
    assert.deepEqual(output, input);
  });

  it('filterSub should apply sub predictor', () => {
    const scanline = Buffer.from([10, 20, 30, 40]);
    const filtered = filters.filterSub(scanline, 1);

    // First pixel: 10 - 0 = 10
    assert.equal(filtered[0], 10);
    // Second pixel: 20 - 10 = 10
    assert.equal(filtered[1], 10);
    // Third pixel: 30 - 20 = 10
    assert.equal(filtered[2], 10);
  });

  it('filterAverage should apply average predictor', () => {
    const scanline = Buffer.from([10, 10, 10, 10]);
    const prevScanline = Buffer.from([10, 10, 10, 10]);
    const filtered = filters.filterAverage(scanline, prevScanline, 1);

    // Each pixel: 10 - avg(10, 10) = 10 - 10 = 0
    for (const val of filtered) {
      assert.equal(val, 0);
    }
  });

  it('calculateEntropy should return 0-8 range', () => {
    const data = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
    const entropy = filters.calculateEntropy(data);
    assert(entropy >= 0 && entropy <= 8);
  });

  it('reverseFilter should undo filterSub', () => {
    const original = Buffer.from([100, 120, 140, 160]);
    const filtered = filters.filterSub(original, 1);
    const reconstructed = filters.reverseFilter(filtered, null, 1, 1);

    assert.deepEqual(reconstructed, original);
  });

  it('applyFilters should add filter type byte per scanline', () => {
    const pixelData = Buffer.alloc(16); // 4x2 RGBA
    const filtered = filters.applyFilters(pixelData, 4, 2, 4, 0);

    // Should be 2 scanlines, each with 1 filter type + 16 data bytes
    assert.equal(filtered.length, 2 * (1 + 16));
  });
});

// ============================================================
// Entropy Compression Tests
// ============================================================

describe('Entropy Compression', () => {
  it('compressZlib should reduce data size', async () => {
    const data = Buffer.from('Hello World! Hello World!');
    const compressed = await entropy.compressZlib(data);

    assert(compressed.length < data.length);
  });

  it('decompressZlib should recover original data', async () => {
    const original = Buffer.from('The quick brown fox jumps over the lazy dog');
    const compressed = await entropy.compressZlib(original);
    const decompressed = await entropy.decompressZlib(compressed);

    assert.deepEqual(decompressed, original);
  });

  it('compressHuffman should produce valid output', () => {
    const data = Buffer.from('AAABBBCCCC');
    const compressed = entropy.compressHuffman(data);

    assert(compressed.length > 0);
    assert(Buffer.isBuffer(compressed));
  });

  it('decompressHuffman should recover original data', () => {
    const original = Buffer.from('AAABBBCCCC');
    const compressed = entropy.compressHuffman(original);
    const decompressed = entropy.decompressHuffman(compressed);

    assert.deepEqual(decompressed, original);
  });
});

// ============================================================
// CRC32 Tests
// ============================================================

describe('CRC32 Checksum', () => {
  it('crc32 should compute valid checksums', () => {
    const data = Buffer.from('Hello');
    const checksum = crc32.crc32(data);

    assert(typeof checksum === 'number');
    assert(checksum >= 0 && checksum <= 0xFFFFFFFF);
  });

  it('crc32 should match for identical data', () => {
    const data = Buffer.from('Test data');
    const crc1 = crc32.crc32(data);
    const crc2 = crc32.crc32(data);

    assert.equal(crc1, crc2);
  });

  it('verifyCrc32 should validate checksums', () => {
    const data = Buffer.from('Verify');
    const checksum = crc32.crc32(data);

    assert(crc32.verifyCrc32(data, checksum));
    assert(!crc32.verifyCrc32(data, checksum + 1));
  });
});

// ============================================================
// Chunk Tests
// ============================================================

describe('Chunk Operations', () => {
  it('createChunk should build valid chunk', () => {
    const data = Buffer.from('Test chunk data');
    const chunk = chunks.createChunk('TEST', data);

    assert(Buffer.isBuffer(chunk));
    assert(chunk.length >= 16 + data.length);
  });

  it('parseChunk should extract chunk data', () => {
    const data = Buffer.from('Test data');
    const chunk = chunks.createChunk('RSTR', data);
    const parsed = chunks.parseChunk(chunk, 0);

    assert.equal(parsed.type, 'RSTR');
    assert.deepEqual(parsed.data, data);
  });

  it('parseChunk should verify CRC32', () => {
    const data = Buffer.from('Test');
    const chunk = chunks.createChunk('TEST', data);

    // Should not throw
    chunks.parseChunk(chunk, 0);

    // Corrupt the data
    chunk[10] ^= 0xFF;

    assert.throws(() => chunks.parseChunk(chunk, 0), /CRC32 mismatch/);
  });

  it('createRstrChunk should create valid RSTR chunk', () => {
    const pixelData = Buffer.alloc(100);
    const chunk = chunks.createRstrChunk({
      pixelData,
      width: 10,
      height: 10,
      colorSpace: 0,
      bitDepth: 8,
      channels: 4
    });

    assert(Buffer.isBuffer(chunk));
    assert(chunk.toString('ascii', 0, 4) === 'RSTR');
  });

  it('parseRstrChunk should extract raster info', () => {
    const pixelData = Buffer.alloc(50);
    const chunk = chunks.createRstrChunk({
      pixelData,
      width: 5,
      height: 5,
      colorSpace: 1,
      bitDepth: 16,
      channels: 3
    });

    const parsed = chunks.parseRstrChunk(chunk.slice(8, 8 + chunk.readUInt32LE(4)));
    assert.equal(parsed.width, 5);
    assert.equal(parsed.height, 5);
    assert.equal(parsed.colorSpace, 1);
    assert.equal(parsed.bitDepth, 16);
    assert.equal(parsed.channels, 3);
  });
});

// ============================================================
// Container Tests
// ============================================================

describe('LcF Container', () => {
  it('LcfContainer should build valid LCF file', () => {
    const container = new LcfContainer();
    const pixelData = Buffer.alloc(100);

    container.addRaster({
      pixelData,
      width: 10,
      height: 10,
      channels: 4
    });

    const lcfData = container.build();

    assert(Buffer.isBuffer(lcfData));
    assert.equal(lcfData.toString('ascii', 0, 4), 'LCF0');
    assert.equal(lcfData[4], 1); // Version
  });

  it('parseLcf should parse container correctly', () => {
    const container = new LcfContainer();
    const pixelData = Buffer.alloc(100);

    container.addRaster({
      pixelData,
      width: 10,
      height: 10,
      channels: 4
    });

    const lcfData = container.build();
    const parsed = parseLcf(lcfData);

    assert.equal(parsed.header.version, 1);
    assert.equal(parsed.header.chunkCount, 1);
    assert.equal(parsed.chunks.raster.width, 10);
    assert.equal(parsed.chunks.raster.height, 10);
  });

  it('LcfContainer should support multiple chunks', () => {
    const container = new LcfContainer();

    container.addRaster({
      pixelData: Buffer.alloc(100),
      width: 10,
      height: 10,
      channels: 4
    });

    container.addPreview({
      imageData: Buffer.alloc(50),
      width: 5,
      height: 5
    });

    const lcfData = container.build();
    const parsed = parseLcf(lcfData);

    assert.equal(parsed.header.chunkCount, 2);
    assert(parsed.chunks.raster !== null);
    assert(parsed.chunks.preview !== null);
  });

  it('LcfContainer flags should reflect added chunks', () => {
    const container = new LcfContainer();

    container.addRaster({
      pixelData: Buffer.alloc(100),
      width: 10,
      height: 10
    });

    container.addVector({
      layerId: 1,
      layerName: 'Test'
    });

    const lcfData = container.build();
    const parsed = parseLcf(lcfData);

    assert(parsed.header.hasVectorLayers);
  });
});

// ============================================================
// Integration Tests
// ============================================================

describe('Integration', () => {
  it('full encode-decode cycle should recover pixel data', async () => {
    // Create test data
    const testData = Buffer.alloc(100);
    for (let i = 0; i < testData.length; i++) {
      testData[i] = i % 256;
    }

    // Encode
    const filtered = filters.applyFilters(testData, 5, 5, 4, 0);
    const compressed = await entropy.compress(filtered, 0);

    // Create container
    const container = new LcfContainer();
    container.addRaster({
      pixelData: compressed,
      width: 5,
      height: 5,
      channels: 4,
      filterMethod: 0,
      compressionMethod: 0
    });

    const lcfData = container.build();

    // Decode
    const parsed = parseLcf(lcfData);
    const decompressed = await entropy.decompress(
      parsed.chunks.raster.pixelData,
      parsed.chunks.raster.compressionMethod
    );
    const reconstructed = filters.reverseFilters(
      decompressed,
      parsed.chunks.raster.width,
      parsed.chunks.raster.height,
      parsed.chunks.raster.channels
    );

    assert.deepEqual(reconstructed, testData);
  });

  it('POST /api/encode should return a valid LCF payload', async () => {
    const { app } = require('../server');
    const server = app.listen(0);

    try {
      const port = server.address().port;
      const body = {
        width: 2,
        height: 2,
        channels: 4,
        bitDepth: 8,
        colorSpace: 0,
        data: [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]
      };

      const response = await fetch(`http://127.0.0.1:${port}/api/encode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      assert.equal(response.status, 200);
      const buffer = Buffer.from(await response.arrayBuffer());
      assert.equal(buffer.toString('ascii', 0, 4), 'LCF0');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('POST /api/decode should decode LCF back to image data', async () => {
    const { app } = require('../server');
    const encoder_module = require('../encoder');
    const server = app.listen(0);

    try {
      const port = server.address().port;
      const testData = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255];

      // First encode
      const lcfData = await encoder_module.encodeBuffer(Buffer.from(testData), {
        width: 2,
        height: 2,
        channels: 4,
        bitDepth: 8,
        colorSpace: 0
      });

      // Then decode via API
      const response = await fetch(`http://127.0.0.1:${port}/api/decode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: lcfData
      });

      assert.equal(response.status, 200);
      const decoded = await response.json();
      
      assert.equal(decoded.width, 2);
      assert.equal(decoded.height, 2);
      assert.equal(decoded.channels, 4);
      assert.deepEqual(decoded.data, testData);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

// ============================================================
// Test Summary
// ============================================================

console.log('\n' + '='.repeat(50));
console.log('Test Summary');
console.log('='.repeat(50));
console.log(`Total tests: ${testCount}`);
console.log(`Passed: ${passCount} ✓`);
console.log(`Failed: ${failCount} ✗`);
console.log(`Pass rate: ${((passCount/testCount)*100).toFixed(1)}%`);

process.exit(failCount > 0 ? 1 : 0);
