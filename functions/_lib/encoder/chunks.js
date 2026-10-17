/**
 * LcF Chunk Module
 * Handles reading and writing LcF chunk data structures
 */

const crc32 = require('./crc32');

/**
 * Create a chunk with type, data, and CRC32 checksum
 * @param {string} type - 4-byte chunk type (e.g., "RSTR")
 * @param {Buffer} data - Chunk data
 * @returns {Buffer} Complete chunk (type + length + data + CRC32)
 */
function createChunk(type, data) {
  if (type.length !== 4) {
    throw new Error(`Chunk type must be exactly 4 bytes, got: ${type}`);
  }

  const chunk = Buffer.alloc(16 + data.length);
  chunk.write(type, 0, 4, 'ascii');
  chunk.writeUInt32LE(data.length, 4);
  data.copy(chunk, 8);

  // Calculate CRC32 of data only
  const crcValue = crc32.crc32(data);
  chunk.writeUInt32LE(crcValue, 8 + data.length);

  return chunk;
}

/**
 * Parse a chunk from a buffer
 * @param {Buffer} buffer - Buffer containing chunk data
 * @param {number} offset - Offset to start reading from
 * @returns {Object} { type, data, crc, nextOffset }
 */
function parseChunk(buffer, offset = 0) {
  if (offset + 8 > buffer.length) {
    throw new Error('Insufficient data to read chunk header');
  }

  const type = buffer.toString('ascii', offset, offset + 4);
  const length = buffer.readUInt32LE(offset + 4);

  if (offset + 8 + length + 4 > buffer.length) {
    throw new Error(`Insufficient data for chunk ${type}: expected ${length} bytes`);
  }

  const data = buffer.slice(offset + 8, offset + 8 + length);
  const storedCrc = buffer.readUInt32LE(offset + 8 + length);

  // Verify CRC
  const calculatedCrc = crc32.crc32(data);
  if (storedCrc !== calculatedCrc) {
    throw new Error(`CRC32 mismatch in chunk ${type}: expected ${calculatedCrc}, got ${storedCrc}`);
  }

  return {
    type,
    data,
    crc: storedCrc,
    nextOffset: offset + 16 + length
  };
}

/**
 * Create RSTR (Raster) chunk
 * @param {Object} options - Raster options
 * @returns {Buffer} RSTR chunk
 */
function createRstrChunk(options) {
  const {
    pixelData,
    width,
    height,
    colorSpace = 0, // sRGB
    bitDepth = 8,
    channels = 4, // RGBA
    filterMethod = 4, // Adaptive
    compressionMethod = 0 // zlib
  } = options;

  const data = Buffer.alloc(16 + pixelData.length);
  data.writeUInt32LE(width, 0);
  data.writeUInt32LE(height, 4);
  data[8] = colorSpace;
  data[9] = bitDepth;
  data[10] = channels;
  data[11] = filterMethod;
  data[12] = compressionMethod;
  data[13] = 0; // Reserved
  data[14] = 0; // Reserved
  data[15] = 0; // Reserved
  pixelData.copy(data, 16);

  return createChunk('RSTR', data);
}

/**
 * Parse RSTR chunk
 * @param {Buffer} data - Chunk data
 * @returns {Object} Parsed raster info
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
 * Create PREV (Preview) chunk
 * @param {Object} options - Preview options
 * @returns {Buffer} PREV chunk
 */
function createPrevChunk(options) {
  const {
    imageData,
    width,
    height,
    format = 0 // 0=RSTR, 1=JPEG, 2=PNG
  } = options;

  const data = Buffer.alloc(12 + imageData.length);
  data.writeUInt32LE(width, 0);
  data.writeUInt32LE(height, 4);
  data[8] = format;
  data[9] = 0; // Reserved
  data[10] = 0; // Reserved
  data[11] = 0; // Reserved
  imageData.copy(data, 12);

  return createChunk('PREV', data);
}

/**
 * Parse PREV chunk
 * @param {Buffer} data - Chunk data
 * @returns {Object} Parsed preview info
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
 * Create META (Metadata) chunk
 * @param {Object} options - Metadata options
 * @returns {Buffer} META chunk
 */
function createMetaChunk(options) {
  const {
    metadata,
    metaType = 0 // 0=EXIF, 1=ICC, 2=C2PA, 3=XMP
  } = options;

  const data = Buffer.alloc(8 + metadata.length);
  data[0] = metaType;
  data[1] = 0; // Reserved
  data[2] = 0; // Reserved
  data[3] = 0; // Reserved
  data.writeUInt32LE(metadata.length, 4);
  metadata.copy(data, 8);

  return createChunk('META', data);
}

/**
 * Parse META chunk
 * @param {Buffer} data - Chunk data
 * @returns {Object} Parsed metadata info
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
 * Create VCTR (Vector) chunk
 * @param {Object} options - Vector options
 * @returns {Buffer} VCTR chunk
 */
function createVctrChunk(options) {
  const {
    layerId = 0,
    layerName = 'Layer',
    paths = []
  } = options;

  // Serialize paths
  let pathData = Buffer.alloc(0);
  for (const path of paths) {
    pathData = Buffer.concat([pathData, serializePath(path)]);
  }

  const data = Buffer.alloc(72 + pathData.length);
  data.writeUInt32LE(layerId, 0);
  data.write(layerName.slice(0, 64), 4, 64, 'utf8');
  data.writeUInt32LE(paths.length, 68);
  pathData.copy(data, 72);

  return createChunk('VCTR', data);
}

/**
 * Serialize a single path
 * @param {Object} path - Path object
 * @returns {Buffer} Serialized path
 */
function serializePath(path) {
  const {
    pathType = 0,
    points = [],
    strokeWidth = 1,
    fillColor = 0xFF000000,
    strokeColor = 0x000000FF
  } = path;

  const data = Buffer.alloc(1 + 4 + points.length * 8 + 4 + 4 + 4);
  let offset = 0;

  data[offset++] = pathType;
  data.writeUInt32LE(points.length, offset);
  offset += 4;

  for (const point of points) {
    data.writeFloatLE(point.x, offset);
    offset += 4;
    data.writeFloatLE(point.y, offset);
    offset += 4;
  }

  data.writeFloatLE(strokeWidth, offset);
  offset += 4;
  data.writeUInt32LE(fillColor, offset);
  offset += 4;
  data.writeUInt32LE(strokeColor, offset);

  return data;
}

/**
 * Create ANIM (Animation) chunk
 * @param {Object} options - Animation options
 * @returns {Buffer} ANIM chunk
 */
function createAnimChunk(options) {
  const {
    frameCount = 1,
    duration = 1000,
    loopMode = 1, // 0=once, 1=loop, 2=ping-pong
    frames = []
  } = options;

  let frameData = Buffer.alloc(0);
  for (const frame of frames) {
    frameData = Buffer.concat([frameData, serializeFrame(frame)]);
  }

  const data = Buffer.alloc(12 + frameData.length);
  data.writeUInt32LE(frameCount, 0);
  data.writeUInt32LE(duration, 4);
  data[8] = loopMode;
  data[9] = 0; // Reserved
  data[10] = 0; // Reserved
  data[11] = 0; // Reserved
  frameData.copy(data, 12);

  return createChunk('ANIM', data);
}

/**
 * Serialize a keyframe
 * @param {Object} frame - Frame object
 * @returns {Buffer} Serialized frame
 */
function serializeFrame(frame) {
  const {
    frameIndex = 0,
    timestamp = 0,
    layerId = 0,
    transform = {}
  } = frame;

  const {
    scaleX = 1,
    scaleY = 1,
    rotateDeg = 0,
    translateX = 0,
    translateY = 0,
    opacity = 1
  } = transform;

  const data = Buffer.alloc(12 + 24);
  data.writeUInt32LE(frameIndex, 0);
  data.writeUInt32LE(timestamp, 4);
  data.writeUInt32LE(layerId, 8);

  data.writeFloatLE(scaleX, 12);
  data.writeFloatLE(scaleY, 16);
  data.writeFloatLE(rotateDeg, 20);
  data.writeFloatLE(translateX, 24);
  data.writeFloatLE(translateY, 28);
  data.writeFloatLE(opacity, 32);

  return data;
}

/**
 * Parse VCTR chunk
 * @param {Buffer} data - Chunk data
 * @returns {Object} Parsed vector info
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
 * @returns {Object} Parsed animation info
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

module.exports = {
  createChunk,
  parseChunk,
  createRstrChunk,
  parseRstrChunk,
  createPrevChunk,
  parsePrevChunk,
  createMetaChunk,
  parseMetaChunk,
  createVctrChunk,
  parseVctrChunk,
  createAnimChunk,
  parseAnimChunk,
  serializePath,
  serializeFrame
};
