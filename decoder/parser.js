/**
 * LcF Parser Module
 * Parses and validates LcF file structure
 */

const crc32Module = require('../encoder/crc32');

/**
 * Parse LcF header
 * @param {Buffer} data - LcF file data
 * @param {number} offset - Offset to start reading (default 0)
 * @returns {Object} Parsed header info
 */
function parseHeader(data, offset = 0) {
  if (data.length - offset < 16) {
    throw new Error('Insufficient data for LcF header');
  }

  const magic = data.toString('ascii', offset, offset + 4);
  if (magic !== 'LCF0') {
    throw new Error(`Invalid magic bytes: ${magic}`);
  }

  const version = data[offset + 4];
  const flags = data.readUInt16LE(offset + 5);
  const reserved = data[offset + 7];
  const chunkCount = data.readUInt32LE(offset + 8);
  const storedCrc = data.readUInt32LE(offset + 12);

  // Verify header CRC
  const headerData = data.slice(offset, offset + 12);
  const calculatedCrc = crc32Module.crc32(headerData);
  if (storedCrc !== calculatedCrc) {
    throw new Error(`Header CRC32 mismatch: expected ${calculatedCrc}, got ${storedCrc}`);
  }

  return {
    version,
    flags,
    chunkCount,
    // Flag interpretations
    hasVectorLayers: (flags & (1 << 0)) !== 0,
    hasAnimation: (flags & (1 << 1)) !== 0,
    isHdr: (flags & (1 << 2)) !== 0,
    isWideGamut: (flags & (1 << 3)) !== 0,
    hasMetadata: (flags & (1 << 4)) !== 0,
    hasNeuralCompression: (flags & (1 << 5)) !== 0,
    nextOffset: offset + 16
  };
}

/**
 * Parse a single chunk
 * @param {Buffer} data - Complete file data
 * @param {number} offset - Offset to chunk start
 * @returns {Object} Parsed chunk
 */
function parseChunk(data, offset) {
  if (data.length - offset < 8) {
    throw new Error('Insufficient data for chunk header');
  }

  const type = data.toString('ascii', offset, offset + 4);
  const length = data.readUInt32LE(offset + 4);

  if (data.length - offset - 8 < length + 4) {
    throw new Error(`Insufficient data for chunk ${type}: need ${length + 4} bytes, have ${data.length - offset - 8}`);
  }

  const chunkData = data.slice(offset + 8, offset + 8 + length);
  const storedCrc = data.readUInt32LE(offset + 8 + length);

  // Verify CRC
  const calculatedCrc = crc32Module.crc32(chunkData);
  if (storedCrc !== calculatedCrc) {
    throw new Error(`CRC32 mismatch in chunk ${type}: expected ${calculatedCrc}, got ${storedCrc}`);
  }

  return {
    type,
    length,
    data: chunkData,
    crc: storedCrc,
    nextOffset: offset + 16 + length
  };
}

/**
 * Parse RSTR chunk
 * @param {Buffer} data - Chunk data
 * @returns {Object} Parsed RSTR info
 */
function parseRstrChunk(data) {
  if (data.length < 16) {
    throw new Error('RSTR chunk data too short');
  }

  return {
    width: data.readUInt32LE(0),
    height: data.readUInt32LE(4),
    colorSpace: data[8],
    bitDepth: data[9],
    channels: data[10],
    filterMethod: data[11],
    compressionMethod: data[12],
    pixelData: data.slice(16)
  };
}

/**
 * Parse PREV chunk
 * @param {Buffer} data - Chunk data
 * @returns {Object} Parsed PREV info
 */
function parsePrevChunk(data) {
  if (data.length < 12) {
    throw new Error('PREV chunk data too short');
  }

  return {
    width: data.readUInt32LE(0),
    height: data.readUInt32LE(4),
    format: data[8],
    imageData: data.slice(12)
  };
}

/**
 * Parse META chunk
 * @param {Buffer} data - Chunk data
 * @returns {Object} Parsed META info
 */
function parseMetaChunk(data) {
  if (data.length < 8) {
    throw new Error('META chunk data too short');
  }

  return {
    metaType: data[0],
    size: data.readUInt32LE(4),
    metadata: data.slice(8)
  };
}

/**
 * Parse VCTR chunk
 * @param {Buffer} data - Chunk data
 * @returns {Object} Parsed VCTR info
 */
function parseVctrChunk(data) {
  if (data.length < 72) {
    throw new Error('VCTR chunk data too short');
  }

  return {
    layerId: data.readUInt32LE(0),
    layerName: data.toString('utf8', 4, 68).replace(/\0/g, ''),
    numPaths: data.readUInt32LE(68),
    pathData: data.slice(72)
  };
}

/**
 * Parse ANIM chunk
 * @param {Buffer} data - Chunk data
 * @returns {Object} Parsed ANIM info
 */
function parseAnimChunk(data) {
  if (data.length < 12) {
    throw new Error('ANIM chunk data too short');
  }

  return {
    frameCount: data.readUInt32LE(0),
    duration: data.readUInt32LE(4),
    loopMode: data[8],
    frameData: data.slice(12)
  };
}

/**
 * Complete LcF file parser
 * @param {Buffer} data - Complete LcF file data
 * @returns {Object} Parsed LcF structure
 */
function parseLcf(data) {
  const header = parseHeader(data, 0);

  const chunks = {
    raster: null,
    preview: null,
    metadata: [],
    vectors: [],
    animation: null,
    neural: []
  };

  let offset = header.nextOffset;

  for (let i = 0; i < header.chunkCount; i++) {
    if (offset >= data.length) {
      console.warn(`[Parser] Expected ${header.chunkCount} chunks, but only found ${i}`);
      break;
    }

    try {
      const chunk = parseChunk(data, offset);

      switch (chunk.type) {
        case 'RSTR':
          chunks.raster = parseRstrChunk(chunk.data);
          break;
        case 'PREV':
          chunks.preview = parsePrevChunk(chunk.data);
          break;
        case 'META':
          chunks.metadata.push(parseMetaChunk(chunk.data));
          break;
        case 'VCTR':
          chunks.vectors.push(parseVctrChunk(chunk.data));
          break;
        case 'ANIM':
          chunks.animation = parseAnimChunk(chunk.data);
          break;
        case 'COMP':
          chunks.neural.push(chunk.data);
          break;
        default:
          console.warn(`[Parser] Unknown chunk type: ${chunk.type}`);
      }

      offset = chunk.nextOffset;
    } catch (error) {
      console.error(`[Parser] Error parsing chunk at offset ${offset}: ${error.message}`);
      break;
    }
  }

  return {
    header,
    chunks
  };
}

module.exports = {
  parseHeader,
  parseChunk,
  parseRstrChunk,
  parsePrevChunk,
  parseMetaChunk,
  parseVctrChunk,
  parseAnimChunk,
  parseLcf
};
