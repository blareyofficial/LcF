/**
 * LcF Encoder
 * Encodes PNG, JPEG, WebP to LcF format
 */

const fs = require('fs').promises;
const path = require('path');
const filters = require('./filters');
const entropy = require('./entropy');
const { LcfContainer } = require('./container');

/**
 * Encode image buffer to LcF format
 * @param {Buffer} imageBuffer - Raw pixel buffer (RGBA)
 * @param {Object} options - Encoding options
 * @returns {Promise<Buffer>} Encoded LcF data
 */
async function encodeBuffer(imageBuffer, options = {}) {
  const {
    width = 256,
    height = 256,
    channels = 4,
    colorSpace = 0, // sRGB
    bitDepth = 8,
    filterMethod = 4, // Adaptive
    compressionMethod = 0, // zlib
    hdr = false,
    wideGamut = false
  } = options;

  // Validate dimensions
  const expectedSize = width * height * channels;
  if (imageBuffer.length !== expectedSize) {
    throw new Error(
      `Buffer size mismatch: expected ${expectedSize} bytes for ${width}x${height}, ` +
      `got ${imageBuffer.length}`
    );
  }

  // Apply predictive filters
  console.log('[Encoder] Applying predictive filters...');
  const filteredData = filters.applyFilters(imageBuffer, width, height, channels, filterMethod);

  // Apply entropy compression
  console.log('[Encoder] Applying entropy compression...');
  const compressedData = await entropy.compress(filteredData, compressionMethod);

  console.log(
    `[Encoder] Compression: ${imageBuffer.length} → ${filteredData.length} → ${compressedData.length} bytes`
  );

  // Create LcF container
  const container = new LcfContainer();
  container.addRaster({
    pixelData: compressedData,
    width,
    height,
    colorSpace,
    bitDepth,
    channels,
    filterMethod,
    compressionMethod
  });

  // Add thumbnail (PREV chunk)
  const thumbnailSize = Math.min(256, Math.max(width, height));
  const thumbWidth = Math.floor((width * thumbnailSize) / Math.max(width, height));
  const thumbHeight = Math.floor((height * thumbnailSize) / Math.max(width, height));
  const thumbnailBuffer = downscaleImage(imageBuffer, width, height, thumbWidth, thumbHeight, channels);

  const thumbFiltered = filters.applyFilters(thumbnailBuffer, thumbWidth, thumbHeight, channels, 3);
  const thumbCompressed = await entropy.compress(thumbFiltered, compressionMethod);

  container.addPreview({
    imageData: thumbCompressed,
    width: thumbWidth,
    height: thumbHeight,
    format: 0 // RSTR format
  });

  // Build and return LcF file
  return container.build({ version: 1, hdr, wideGamut });
}

/**
 * Downscale image buffer
 * @param {Buffer} src - Source pixel buffer
 * @param {number} srcWidth - Source width
 * @param {number} srcHeight - Source height
 * @param {number} dstWidth - Destination width
 * @param {number} dstHeight - Destination height
 * @param {number} channels - Number of channels
 * @returns {Buffer} Downscaled pixel buffer
 */
function downscaleImage(src, srcWidth, srcHeight, dstWidth, dstHeight, channels) {
  const dst = Buffer.alloc(dstWidth * dstHeight * channels);

  const scaleX = srcWidth / dstWidth;
  const scaleY = srcHeight / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.floor(x * scaleX);
      const srcY = Math.floor(y * scaleY);

      const srcIdx = (srcY * srcWidth + srcX) * channels;
      const dstIdx = (y * dstWidth + x) * channels;

      for (let c = 0; c < channels; c++) {
        dst[dstIdx + c] = src[srcIdx + c];
      }
    }
  }

  return dst;
}

/**
 * Encode PNG file to LcF
 * @param {string} pngPath - Path to input PNG
 * @param {string} lcfPath - Path to output LcF
 * @param {Object} options - Encoding options
 * @returns {Promise<void>}
 */
async function encodePng(pngPath, lcfPath, options = {}) {
  const png = require('pngjs').PNG;

  console.log(`[Encoder] Reading PNG: ${pngPath}`);
  const pngData = await fs.readFile(pngPath);
  const image = png.sync.read(pngData);

  console.log(`[Encoder] PNG size: ${image.width}x${image.height}, ${image.data.length} bytes`);

  // Convert PNG data to RGBA if needed
  const pixelBuffer = Buffer.from(image.data);

  const lcfData = await encodeBuffer(pixelBuffer, {
    width: image.width,
    height: image.height,
    channels: 4, // pngjs always outputs RGBA
    ...options
  });

  console.log(`[Encoder] Writing LcF: ${lcfPath} (${lcfData.length} bytes)`);
  await fs.writeFile(lcfPath, lcfData);
}

/**
 * Encode JPEG file to LcF
 * @param {string} jpegPath - Path to input JPEG
 * @param {string} lcfPath - Path to output LcF
 * @param {Object} options - Encoding options
 * @returns {Promise<void>}
 */
async function encodeJpeg(jpegPath, lcfPath, options = {}) {
  const jpeg = require('jpeg-js');

  console.log(`[Encoder] Reading JPEG: ${jpegPath}`);
  const jpegData = await fs.readFile(jpegPath);
  const image = jpeg.decode(jpegData);

  console.log(`[Encoder] JPEG size: ${image.width}x${image.height}, ${image.data.length} bytes`);

  // Ensure RGBA
  let pixelBuffer;
  if (image.data.length === image.width * image.height * 3) {
    // RGB → RGBA
    pixelBuffer = Buffer.alloc(image.width * image.height * 4);
    let srcIdx = 0;
    let dstIdx = 0;
    for (let i = 0; i < image.width * image.height; i++) {
      pixelBuffer[dstIdx++] = image.data[srcIdx++]; // R
      pixelBuffer[dstIdx++] = image.data[srcIdx++]; // G
      pixelBuffer[dstIdx++] = image.data[srcIdx++]; // B
      pixelBuffer[dstIdx++] = 255; // A
    }
  } else {
    pixelBuffer = Buffer.from(image.data);
  }

  const lcfData = await encodeBuffer(pixelBuffer, {
    width: image.width,
    height: image.height,
    channels: 4,
    ...options
  });

  console.log(`[Encoder] Writing LcF: ${lcfPath} (${lcfData.length} bytes)`);
  await fs.writeFile(lcfPath, lcfData);
}

/**
 * Encode any image file format
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to output LcF
 * @param {Object} options - Encoding options
 * @returns {Promise<void>}
 */
async function encode(inputPath, outputPath, options = {}) {
  const ext = path.extname(inputPath).toLowerCase();

  switch (ext) {
    case '.png':
      return encodePng(inputPath, outputPath, options);
    case '.jpg':
    case '.jpeg':
      return encodeJpeg(inputPath, outputPath, options);
    default:
      throw new Error(`Unsupported format: ${ext}`);
  }
}

module.exports = {
  encode,
  encodePng,
  encodeJpeg,
  encodeBuffer
};
