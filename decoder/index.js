/**
 * LcF Decoder
 * Decodes LcF format to PNG or raw RGBA buffers
 */

const fs = require('fs').promises;
const path = require('path');
const parser = require('./parser');
const renderer = require('./renderer');

/**
 * Decode LcF buffer
 * @param {Buffer} lcfData - LcF file data
 * @returns {Promise<Object>} Decoded image data
 */
async function decodeBuffer(lcfData) {
  console.log('[Decoder] Parsing LcF file...');
  const parsedLcf = parser.parseLcf(lcfData);

  if (!parsedLcf.chunks.raster) {
    throw new Error('No raster data found in LcF file');
  }

  console.log('[Decoder] Rendering raster...');
  const pixelData = await renderer.renderRaster(parsedLcf.chunks.raster);

  const { width, height, channels } = parsedLcf.chunks.raster;
  const rgba = renderer.toRgba(pixelData, width, height, channels);

  return {
    pixels: rgba,
    width,
    height,
    channels: 4,
    lcfData: parsedLcf
  };
}

/**
 * Decode LcF file to PNG
 * @param {string} lcfPath - Path to LcF file
 * @param {string} pngPath - Path to output PNG
 * @returns {Promise<void>}
 */
async function decodeToPng(lcfPath, pngPath) {
  console.log(`[Decoder] Reading LcF: ${lcfPath}`);
  const lcfData = await fs.readFile(lcfPath);

  const decoded = await decodeBuffer(lcfData);
  console.log(`[Decoder] Decoded ${decoded.width}×${decoded.height} image`);

  console.log(`[Decoder] Converting to PNG...`);
  const pngData = renderer.toPng(decoded.pixels, decoded.width, decoded.height);

  console.log(`[Decoder] Writing PNG: ${pngPath}`);
  await fs.writeFile(pngPath, pngData);
}

/**
 * Decode LcF file
 * @param {string} lcfPath - Path to LcF file
 * @param {string} outputPath - Path to output file
 * @param {string} format - Output format (png, raw, info)
 * @returns {Promise<void>}
 */
async function decode(lcfPath, outputPath, format = 'png') {
  const lcfData = await fs.readFile(lcfPath);
  const decoded = await decodeBuffer(lcfData);

  switch (format.toLowerCase()) {
    case 'png':
      console.log(`[Decoder] Writing PNG: ${outputPath}`);
      const pngData = renderer.toPng(decoded.pixels, decoded.width, decoded.height);
      await fs.writeFile(outputPath, pngData);
      break;

    case 'raw':
      console.log(`[Decoder] Writing raw RGBA: ${outputPath}`);
      await fs.writeFile(outputPath, decoded.pixels);
      break;

    case 'info':
      const info = renderer.formatImageInfo(decoded.lcfData);
      console.log(info);
      await fs.writeFile(outputPath, info);
      break;

    default:
      throw new Error(`Unknown output format: ${format}`);
  }
}

/**
 * Inspect LcF file without decoding
 * @param {string} lcfPath - Path to LcF file
 * @returns {Promise<string>} Formatted file information
 */
async function inspect(lcfPath) {
  console.log(`[Inspector] Reading LcF: ${lcfPath}`);
  const lcfData = await fs.readFile(lcfPath);
  const parsed = parser.parseLcf(lcfData);
  return renderer.formatImageInfo(parsed);
}

module.exports = {
  decode,
  decodeBuffer,
  decodeToPng,
  inspect,
  parser,
  renderer
};
