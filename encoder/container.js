/**
 * LcF Container Module
 * Builds the complete LcF binary container format
 */

const crc32Module = require('./crc32');
const chunks = require('./chunks');

/**
 * LcF Container Builder
 */
class LcfContainer {
  constructor() {
    this.chunkList = [];
    this.flags = 0;
  }

  /**
   * Add RSTR chunk
   * @param {Object} options - Raster options
   * @returns {this}
   */
  addRaster(options) {
    const chunk = chunks.createRstrChunk(options);
    this.chunkList.push(chunk);
    return this;
  }

  /**
   * Add PREV chunk
   * @param {Object} options - Preview options
   * @returns {this}
   */
  addPreview(options) {
    const chunk = chunks.createPrevChunk(options);
    this.chunkList.push(chunk);
    return this;
  }

  /**
   * Add META chunk
   * @param {Object} options - Metadata options
   * @returns {this}
   */
  addMetadata(options) {
    const chunk = chunks.createMetaChunk(options);
    this.chunkList.push(chunk);
    this.flags |= (1 << 4); // Set META flag
    return this;
  }

  /**
   * Add VCTR chunk
   * @param {Object} options - Vector options
   * @returns {this}
   */
  addVector(options) {
    const chunk = chunks.createVctrChunk(options);
    this.chunkList.push(chunk);
    this.flags |= (1 << 0); // Set vector flag
    return this;
  }

  /**
   * Add ANIM chunk
   * @param {Object} options - Animation options
   * @returns {this}
   */
  addAnimation(options) {
    const chunk = chunks.createAnimChunk(options);
    this.chunkList.push(chunk);
    this.flags |= (1 << 1); // Set animation flag
    return this;
  }

  /**
   * Build the complete LcF file
   * @param {Object} options - Header options
   * @returns {Buffer} Complete LcF file
   */
  build(options = {}) {
    const {
      version = 1,
      hdr = false,
      wideGamut = false,
      neuralCompression = false
    } = options;

    // Set additional flags
    if (hdr) this.flags |= (1 << 2);
    if (wideGamut) this.flags |= (1 << 3);
    if (neuralCompression) this.flags |= (1 << 5);

    // Build header (16 bytes)
    const header = Buffer.alloc(16);
    header.write('LCF0', 0, 4, 'ascii');
    header[4] = version;
    header.writeUInt16LE(this.flags, 5);
    header[7] = 0; // Reserved
    header.writeUInt32LE(this.chunkList.length, 8);

    // Calculate header CRC32 (first 12 bytes)
    const headerCrc = crc32Module.crc32(header.slice(0, 12));
    header.writeUInt32LE(headerCrc, 12);

    // Combine header and all chunks
    return Buffer.concat([header, ...this.chunkList]);
  }

  /**
   * Get number of chunks
   * @returns {number}
   */
  getChunkCount() {
    return this.chunkList.length;
  }

  /**
   * Clear all chunks
   * @returns {this}
   */
  clear() {
    this.chunkList = [];
    this.flags = 0;
    return this;
  }
}

/**
 * Parse complete LcF file
 * @param {Buffer} data - LcF file data
 * @returns {Object} Parsed LcF structure
 */
function parseLcf(data) {
  if (data.length < 16) {
    throw new Error('File too short for LcF header');
  }

  // Parse header
  const magic = data.toString('ascii', 0, 4);
  if (magic !== 'LCF0') {
    throw new Error(`Invalid magic bytes: ${magic}`);
  }

  const version = data[4];
  const flags = data.readUInt16LE(5);
  const reserved = data[7];
  const chunkCount = data.readUInt32LE(8);
  const headerCrc = data.readUInt32LE(12);

  // Verify header CRC
  const calculatedHeaderCrc = crc32Module.crc32(data.slice(0, 12));
  if (headerCrc !== calculatedHeaderCrc) {
    throw new Error(`Header CRC32 mismatch: expected ${calculatedHeaderCrc}, got ${headerCrc}`);
  }

  const parsedChunks = {
    raster: null,
    preview: null,
    metadata: [],
    vectors: [],
    animation: null,
    neural: []
  };

  // Parse chunks
  let offset = 16;
  for (let i = 0; i < chunkCount && offset < data.length; i++) {
    const { type, data: chunkData, nextOffset } = chunks.parseChunk(data, offset);

    switch (type) {
      case 'RSTR':
        parsedChunks.raster = chunks.parseRstrChunk(chunkData);
        break;
      case 'PREV':
        parsedChunks.preview = chunks.parsePrevChunk(chunkData);
        break;
      case 'META':
        parsedChunks.metadata.push(chunks.parseMetaChunk(chunkData));
        break;
      case 'VCTR':
        parsedChunks.vectors.push(chunks.parseVctrChunk(chunkData));
        break;
      case 'ANIM':
        parsedChunks.animation = chunks.parseAnimChunk(chunkData);
        break;
      case 'COMP':
        parsedChunks.neural.push(chunkData);
        break;
      default:
        // Unknown chunk type - skip gracefully
        break;
    }

    offset = nextOffset;
  }

  return {
    header: {
      version,
      flags,
      chunkCount,
      hasVectorLayers: (flags & (1 << 0)) !== 0,
      hasAnimation: (flags & (1 << 1)) !== 0,
      isHdr: (flags & (1 << 2)) !== 0,
      isWideGamut: (flags & (1 << 3)) !== 0,
      hasMetadata: (flags & (1 << 4)) !== 0,
      hasNeuralCompression: (flags & (1 << 5)) !== 0
    },
    chunks: parsedChunks
  };
}

module.exports = {
  LcfContainer,
  parseLcf
};
