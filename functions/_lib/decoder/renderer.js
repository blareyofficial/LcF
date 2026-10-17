/**
 * LcF Renderer Module
 * Reconstructs and renders pixel data from LcF format
 */

const filters = require('../encoder/filters');
const entropy = require('../encoder/entropy');

/**
 * Color space conversion helpers
 */
const ColorSpaces = {
  sRGB: 0,
  LinearRGB: 1,
  AdobeRGB: 2,
  DisplayP3: 3,
  Rec2020: 4,
  Lab: 5
};

/**
 * Convert sRGB to linear RGB
 * @param {number} c - sRGB component (0-255)
 * @returns {number} Linear RGB (0-1)
 */
function srgbToLinear(c) {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Convert linear RGB to sRGB
 * @param {number} c - Linear RGB (0-1)
 * @returns {number} sRGB component (0-255)
 */
function linearToSrgb(c) {
  c = Math.max(0, Math.min(1, c));
  const result = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(result * 255);
}

/**
 * Render RSTR chunk to pixel buffer
 * @param {Object} rstrData - Parsed RSTR chunk
 * @returns {Promise<Buffer>} Decompressed pixel buffer
 */
async function renderRaster(rstrData) {
  const {
    width,
    height,
    colorSpace,
    bitDepth,
    channels,
    filterMethod,
    compressionMethod,
    pixelData
  } = rstrData;

  console.log(`[Renderer] Decompressing ${width}x${height}, ${channels}-channel, ${bitDepth}-bit`);

  // Decompress
  const decompressed = await entropy.decompress(pixelData, compressionMethod);
  console.log(`[Renderer] Decompressed: ${pixelData.length} → ${decompressed.length} bytes`);

  // Reverse filters
  const reconstructed = filters.reverseFilters(decompressed, width, height, channels);
  console.log(`[Renderer] Filters reversed`);

  return reconstructed;
}

/**
 * Convert pixel buffer to RGBA
 * @param {Buffer} pixelData - Pixel buffer
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} channels - Input channels
 * @param {number} colorSpace - Color space enum
 * @returns {Buffer} RGBA buffer
 */
function toRgba(pixelData, width, height, channels, colorSpace = 0) {
  const rgba = Buffer.alloc(width * height * 4);

  if (channels === 4) {
    // Already RGBA
    pixelData.copy(rgba);
  } else if (channels === 3) {
    // RGB → RGBA
    let srcIdx = 0;
    let dstIdx = 0;
    for (let i = 0; i < width * height; i++) {
      rgba[dstIdx++] = pixelData[srcIdx++]; // R
      rgba[dstIdx++] = pixelData[srcIdx++]; // G
      rgba[dstIdx++] = pixelData[srcIdx++]; // B
      rgba[dstIdx++] = 255; // A
    }
  } else if (channels === 2) {
    // Grayscale + Alpha → RGBA
    let srcIdx = 0;
    let dstIdx = 0;
    for (let i = 0; i < width * height; i++) {
      const gray = pixelData[srcIdx++];
      const alpha = pixelData[srcIdx++];
      rgba[dstIdx++] = gray; // R
      rgba[dstIdx++] = gray; // G
      rgba[dstIdx++] = gray; // B
      rgba[dstIdx++] = alpha; // A
    }
  } else if (channels === 1) {
    // Grayscale → RGBA
    let srcIdx = 0;
    let dstIdx = 0;
    for (let i = 0; i < width * height; i++) {
      const gray = pixelData[srcIdx++];
      rgba[dstIdx++] = gray; // R
      rgba[dstIdx++] = gray; // G
      rgba[dstIdx++] = gray; // B
      rgba[dstIdx++] = 255; // A
    }
  } else {
    throw new Error(`Unsupported number of channels: ${channels}`);
  }

  return rgba;
}

/**
 * Render PREV chunk
 * @param {Object} prevData - Parsed PREV chunk
 * @returns {Promise<Buffer>} Rendered preview pixels
 */
async function renderPreview(prevData) {
  const { width, height, format, imageData } = prevData;

  if (format === 0) {
    // RSTR format - decompress
    const decompressed = await entropy.decompress(imageData, 0);
    return filters.reverseFilters(decompressed, width, height, 4);
  } else if (format === 1) {
    // JPEG - would need jpeg-js library
    throw new Error('JPEG preview format not yet supported');
  } else if (format === 2) {
    // PNG - would need pngjs library
    throw new Error('PNG preview format not yet supported');
  } else {
    throw new Error(`Unknown preview format: ${format}`);
  }
}

/**
 * Create PNG from pixel buffer
 * @param {Buffer} pixels - RGBA pixel buffer
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Buffer} PNG data
 */
function toPng(pixels, width, height) {
  const PNG = require('pngjs').PNG;
  const image = new PNG({ width, height });

  pixels.copy(image.data);
  return PNG.sync.write(image);
}

/**
 * Get color space name
 * @param {number} colorSpaceEnum - Color space enum value
 * @returns {string} Color space name
 */
function getColorSpaceName(colorSpaceEnum) {
  const names = {
    0: 'sRGB',
    1: 'Linear RGB',
    2: 'Adobe RGB',
    3: 'Display P3',
    4: 'Rec2020',
    5: 'Lab',
  };
  return names[colorSpaceEnum] || `Unknown (${colorSpaceEnum})`;
}

/**
 * Format image info for display
 * @param {Object} lcfData - Parsed LcF data
 * @returns {string} Formatted info
 */
function formatImageInfo(lcfData) {
  const { header, chunks } = lcfData;

  if (!chunks.raster) {
    return 'No raster data found';
  }

  const { width, height, channels, bitDepth, colorSpace, filterMethod, compressionMethod } = chunks.raster;

  const methodNames = {
    0: 'None',
    1: 'Sub (Paeth)',
    2: 'Average',
    3: 'Gradient (Paeth)',
    4: 'Adaptive'
  };

  const compressionNames = {
    0: 'zlib (deflate)',
    1: 'Custom Huffman'
  };

  let info = `LcF Image Information
=======================
Dimensions: ${width}×${height} pixels
Channels: ${channels} (${channels === 4 ? 'RGBA' : channels === 3 ? 'RGB' : 'Grayscale'})
Bit Depth: ${bitDepth} bits/channel
Color Space: ${getColorSpaceName(colorSpace)}
Filter Method: ${methodNames[filterMethod] || `Unknown (${filterMethod})`}
Compression: ${compressionNames[compressionMethod] || `Unknown (${compressionMethod})`}
File Flags:
  - Vector Layers: ${header.hasVectorLayers ? 'Yes' : 'No'}
  - Animation: ${header.hasAnimation ? 'Yes' : 'No'}
  - HDR: ${header.isHdr ? 'Yes' : 'No'}
  - Wide Gamut: ${header.isWideGamut ? 'Yes' : 'No'}
  - Metadata: ${header.hasMetadata ? 'Yes' : 'No'}
  - Neural Compression: ${header.hasNeuralCompression ? 'Yes' : 'No'}`;

  if (chunks.preview) {
    info += `\nPreview: ${chunks.preview.width}×${chunks.preview.height}`;
  }

  if (chunks.metadata.length > 0) {
    info += `\nMetadata blocks: ${chunks.metadata.length}`;
  }

  if (chunks.vectors.length > 0) {
    info += `\nVector layers: ${chunks.vectors.length}`;
  }

  if (chunks.animation) {
    info += `\nAnimation frames: ${chunks.animation.frameCount}`;
  }

  return info;
}

module.exports = {
  renderRaster,
  renderPreview,
  toRgba,
  toPng,
  getColorSpaceName,
  formatImageInfo,
  ColorSpaces,
  srgbToLinear,
  linearToSrgb
};
