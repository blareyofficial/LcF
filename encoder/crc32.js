/**
 * CRC32 Checksum Module
 * Implements standard CRC-32-CCITT polynomial
 */

// Pre-computed CRC32 lookup table
const CRC32_TABLE = new Uint32Array(256);

// Initialize CRC32 lookup table
(function initCrc32Table() {
  const POLYNOMIAL = 0xEDB88320;

  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ POLYNOMIAL;
      } else {
        crc = crc >>> 1;
      }
    }
    CRC32_TABLE[i] = crc >>> 0;
  }
})();

/**
 * Calculate CRC32 checksum of a buffer
 * @param {Buffer} data - Data to checksum
 * @param {number} initialCrc - Initial CRC value (default 0)
 * @returns {number} CRC32 checksum
 */
function crc32(data, initialCrc = 0) {
  let crc = (initialCrc ^ 0xFFFFFFFF) >>> 0;

  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    const index = (crc ^ byte) & 0xFF;
    crc = ((crc >>> 8) ^ CRC32_TABLE[index]) >>> 0;
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Verify CRC32 checksum
 * @param {Buffer} data - Data to verify
 * @param {number} expectedCrc - Expected CRC32 value
 * @returns {boolean} True if checksum matches
 */
function verifyCrc32(data, expectedCrc) {
  return crc32(data) === expectedCrc;
}

module.exports = {
  crc32,
  verifyCrc32,
  CRC32_TABLE
};
