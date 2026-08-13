/**
 * LcF Predictive Filters Module
 * Implements PNG-style predictor filters for scanline encoding
 */

/**
 * Apply Paeth predictor filter to a scanline
 * @param {Buffer} scanline - Pixel data for one scanline
 * @param {Buffer} prevScanline - Pixel data from previous scanline (or null for first)
 * @param {number} bytesPerPixel - Bytes per pixel (3 for RGB, 4 for RGBA)
 * @returns {Buffer} Filtered scanline
 */
function filterPaeth(scanline, prevScanline, bytesPerPixel) {
  const filtered = Buffer.alloc(scanline.length);

  for (let x = 0; x < scanline.length; x++) {
    const left = x >= bytesPerPixel ? scanline[x - bytesPerPixel] : 0;
    const above = prevScanline ? prevScanline[x] : 0;
    const aboveLeft = prevScanline && x >= bytesPerPixel ? prevScanline[x - bytesPerPixel] : 0;

    // Paeth predictor
    const p = left + above - aboveLeft;
    const pa = Math.abs(p - left);
    const pb = Math.abs(p - above);
    const pc = Math.abs(p - aboveLeft);

    let predictor;
    if (pa <= pb && pa <= pc) {
      predictor = left;
    } else if (pb <= pc) {
      predictor = above;
    } else {
      predictor = aboveLeft;
    }

    filtered[x] = (scanline[x] - predictor) & 0xFF;
  }

  return filtered;
}

/**
 * Apply Average predictor filter
 * @param {Buffer} scanline - Pixel data for one scanline
 * @param {Buffer} prevScanline - Pixel data from previous scanline
 * @param {number} bytesPerPixel - Bytes per pixel
 * @returns {Buffer} Filtered scanline
 */
function filterAverage(scanline, prevScanline, bytesPerPixel) {
  const filtered = Buffer.alloc(scanline.length);

  for (let x = 0; x < scanline.length; x++) {
    const left = x >= bytesPerPixel ? scanline[x - bytesPerPixel] : 0;
    const above = prevScanline ? prevScanline[x] : 0;
    const predictor = Math.floor((left + above) / 2);

    filtered[x] = (scanline[x] - predictor) & 0xFF;
  }

  return filtered;
}

/**
 * Apply Sub (Paeth) filter
 * @param {Buffer} scanline - Pixel data for one scanline
 * @param {number} bytesPerPixel - Bytes per pixel
 * @returns {Buffer} Filtered scanline
 */
function filterSub(scanline, bytesPerPixel) {
  const filtered = Buffer.alloc(scanline.length);

  for (let x = 0; x < scanline.length; x++) {
    const left = x >= bytesPerPixel ? scanline[x - bytesPerPixel] : 0;
    filtered[x] = (scanline[x] - left) & 0xFF;
  }

  return filtered;
}

/**
 * Apply no filter
 * @param {Buffer} scanline - Pixel data for one scanline
 * @returns {Buffer} Unmodified scanline
 */
function filterNone(scanline) {
  return Buffer.from(scanline);
}

/**
 * Calculate entropy (average information content) of a buffer
 * Lower entropy = better compression potential
 * @param {Buffer} buffer - Data to analyze
 * @returns {number} Entropy value (0-8 for bytes)
 */
function calculateEntropy(buffer) {
  const frequencies = new Uint32Array(256);
  for (const byte of buffer) {
    frequencies[byte]++;
  }

  let entropy = 0;
  const length = buffer.length;
  for (let i = 0; i < 256; i++) {
    if (frequencies[i] > 0) {
      const probability = frequencies[i] / length;
      entropy -= probability * Math.log2(probability);
    }
  }

  return entropy;
}

/**
 * Adaptively choose the best filter for a scanline
 * @param {Buffer} scanline - Current scanline pixels
 * @param {Buffer} prevScanline - Previous scanline pixels (or null)
 * @param {number} bytesPerPixel - Bytes per pixel
 * @returns {Object} { filterType: number, filtered: Buffer }
 */
function adaptiveFilter(scanline, prevScanline, bytesPerPixel) {
  const filters = [
    { type: 0, name: 'none', data: filterNone(scanline) },
    { type: 1, name: 'sub', data: filterSub(scanline, bytesPerPixel) },
    { type: 2, name: 'average', data: filterAverage(scanline, prevScanline, bytesPerPixel) },
    { type: 3, name: 'paeth', data: filterPaeth(scanline, prevScanline, bytesPerPixel) }
  ];

  // Choose filter with lowest entropy
  let bestFilter = filters[0];
  let bestEntropy = calculateEntropy(filters[0].data);

  for (let i = 1; i < filters.length; i++) {
    const entropy = calculateEntropy(filters[i].data);
    if (entropy < bestEntropy) {
      bestEntropy = entropy;
      bestFilter = filters[i];
    }
  }

  return {
    filterType: bestFilter.type,
    filtered: bestFilter.data
  };
}

/**
 * Apply filters to entire pixel buffer per scanline
 * @param {Buffer} pixelData - Raw pixel buffer
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {number} bytesPerPixel - Bytes per pixel (3 for RGB, 4 for RGBA)
 * @param {number} filterMethod - Which filter to use (0=none, 1=sub, 2=avg, 3=paeth, 4=adaptive)
 * @returns {Buffer} Filtered data with filter type byte prepended to each scanline
 */
function applyFilters(pixelData, width, height, bytesPerPixel, filterMethod = 4) {
  const scanlineSize = width * bytesPerPixel;
  const outputSize = height * (1 + scanlineSize); // +1 for filter type byte
  const output = Buffer.alloc(outputSize);

  let outputPos = 0;

  for (let y = 0; y < height; y++) {
    const scanlineStart = y * scanlineSize;
    const scanline = pixelData.slice(scanlineStart, scanlineStart + scanlineSize);
    const prevScanline = y > 0 ? pixelData.slice(scanlineStart - scanlineSize, scanlineStart) : null;

    let filterType;
    let filtered;

    if (filterMethod === 4) {
      // Adaptive
      const result = adaptiveFilter(scanline, prevScanline, bytesPerPixel);
      filterType = result.filterType;
      filtered = result.filtered;
    } else {
      // Fixed filter method
      filterType = filterMethod;
      switch (filterMethod) {
        case 0:
          filtered = filterNone(scanline);
          break;
        case 1:
          filtered = filterSub(scanline, bytesPerPixel);
          break;
        case 2:
          filtered = filterAverage(scanline, prevScanline, bytesPerPixel);
          break;
        case 3:
          filtered = filterPaeth(scanline, prevScanline, bytesPerPixel);
          break;
        default:
          throw new Error(`Unknown filter method: ${filterMethod}`);
      }
    }

    output[outputPos++] = filterType;
    filtered.copy(output, outputPos);
    outputPos += scanlineSize;
  }

  return output;
}

/**
 * Reverse filter to reconstruct scanline
 * @param {Buffer} filtered - Filtered scanline data
 * @param {Buffer} prevScanline - Previous reconstructed scanline (or null)
 * @param {number} bytesPerPixel - Bytes per pixel
 * @param {number} filterType - Filter type (0-3)
 * @returns {Buffer} Reconstructed scanline
 */
function reverseFilter(filtered, prevScanline, bytesPerPixel, filterType) {
  const reconstructed = Buffer.alloc(filtered.length);

  switch (filterType) {
    case 0: // None
      return Buffer.from(filtered);

    case 1: // Sub
      for (let x = 0; x < filtered.length; x++) {
        const left = x >= bytesPerPixel ? reconstructed[x - bytesPerPixel] : 0;
        reconstructed[x] = (filtered[x] + left) & 0xFF;
      }
      break;

    case 2: // Average
      for (let x = 0; x < filtered.length; x++) {
        const left = x >= bytesPerPixel ? reconstructed[x - bytesPerPixel] : 0;
        const above = prevScanline ? prevScanline[x] : 0;
        const predictor = Math.floor((left + above) / 2);
        reconstructed[x] = (filtered[x] + predictor) & 0xFF;
      }
      break;

    case 3: // Paeth
      for (let x = 0; x < filtered.length; x++) {
        const left = x >= bytesPerPixel ? reconstructed[x - bytesPerPixel] : 0;
        const above = prevScanline ? prevScanline[x] : 0;
        const aboveLeft = prevScanline && x >= bytesPerPixel ? prevScanline[x - bytesPerPixel] : 0;

        const p = left + above - aboveLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - above);
        const pc = Math.abs(p - aboveLeft);

        let predictor;
        if (pa <= pb && pa <= pc) {
          predictor = left;
        } else if (pb <= pc) {
          predictor = above;
        } else {
          predictor = aboveLeft;
        }

        reconstructed[x] = (filtered[x] + predictor) & 0xFF;
      }
      break;

    default:
      throw new Error(`Unknown filter type: ${filterType}`);
  }

  return reconstructed;
}

/**
 * Reverse filters from entire pixel buffer
 * @param {Buffer} filteredData - Data with filter type bytes per scanline
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {number} bytesPerPixel - Bytes per pixel
 * @returns {Buffer} Reconstructed pixel buffer
 */
function reverseFilters(filteredData, width, height, bytesPerPixel) {
  const scanlineSize = width * bytesPerPixel;
  const pixelData = Buffer.alloc(height * scanlineSize);

  let inputPos = 0;

  for (let y = 0; y < height; y++) {
    const filterType = filteredData[inputPos++];
    const filtered = filteredData.slice(inputPos, inputPos + scanlineSize);
    inputPos += scanlineSize;

    const prevScanline = y > 0 ? pixelData.slice((y - 1) * scanlineSize, y * scanlineSize) : null;
    const reconstructed = reverseFilter(filtered, prevScanline, bytesPerPixel, filterType);

    reconstructed.copy(pixelData, y * scanlineSize);
  }

  return pixelData;
}

module.exports = {
  filterNone,
  filterSub,
  filterAverage,
  filterPaeth,
  adaptiveFilter,
  applyFilters,
  reverseFilter,
  reverseFilters,
  calculateEntropy
};
