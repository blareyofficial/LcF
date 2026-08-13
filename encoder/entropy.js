/**
 * LcF Entropy Compression Module
 * Implements zlib and custom Huffman entropy coding
 */

const zlib = require('zlib');

/**
 * Compress data using zlib deflate (Method 0)
 * @param {Buffer} data - Raw data to compress
 * @param {number} level - Compression level (0-9, default 9)
 * @returns {Promise<Buffer>} Compressed data
 */
async function compressZlib(data, level = 9) {
  return new Promise((resolve, reject) => {
    zlib.deflate(data, { level }, (err, compressed) => {
      if (err) reject(err);
      else resolve(compressed);
    });
  });
}

/**
 * Decompress zlib deflated data
 * @param {Buffer} compressed - Compressed data
 * @returns {Promise<Buffer>} Decompressed data
 */
async function decompressZlib(compressed) {
  return new Promise((resolve, reject) => {
    zlib.inflate(compressed, (err, decompressed) => {
      if (err) reject(err);
      else resolve(decompressed);
    });
  });
}

/**
 * Huffman Tree Node
 */
class HuffmanNode {
  constructor(symbol = null, freq = 0, left = null, right = null) {
    this.symbol = symbol;
    this.freq = freq;
    this.left = left;
    this.right = right;
  }

  isLeaf() {
    return this.symbol !== null;
  }
}

/**
 * Build Huffman tree from frequency map
 * @param {Map<number, number>} frequencies - Symbol frequencies
 * @returns {HuffmanNode} Root of Huffman tree
 */
function buildHuffmanTree(frequencies) {
  if (frequencies.size === 0) {
    throw new Error('No data to compress');
  }

  // Create leaf nodes
  const nodes = [];
  for (const [symbol, freq] of frequencies) {
    nodes.push(new HuffmanNode(symbol, freq));
  }

  // Sort by frequency
  nodes.sort((a, b) => a.freq - b.freq);

  // Build tree bottom-up
  while (nodes.length > 1) {
    const left = nodes.shift();
    const right = nodes.shift();
    const parent = new HuffmanNode(null, left.freq + right.freq, left, right);
    nodes.push(parent);
    nodes.sort((a, b) => a.freq - b.freq);
  }

  return nodes[0];
}

/**
 * Generate Huffman codes from tree
 * @param {HuffmanNode} root - Root of Huffman tree
 * @param {Map<number, string>} codes - Output code map (symbol -> binary string)
 * @param {string} code - Current code path
 */
function generateCodes(root, codes = new Map(), code = '') {
  if (!root) return codes;

  if (root.isLeaf()) {
    codes.set(root.symbol, code || '0'); // Single symbol case
  } else {
    if (root.left) generateCodes(root.left, codes, code + '0');
    if (root.right) generateCodes(root.right, codes, code + '1');
  }

  return codes;
}

/**
 * Serialize Huffman tree for storage
 * @param {HuffmanNode} root - Root of Huffman tree
 * @returns {Buffer} Serialized tree
 */
function serializeTree(root) {
  const chunks = [];

  function traverse(node) {
    if (node.isLeaf()) {
      chunks.push(Buffer.from([1])); // Leaf marker
      chunks.push(Buffer.from([node.symbol])); // Symbol value
    } else {
      chunks.push(Buffer.from([0])); // Internal node marker
      traverse(node.left);
      traverse(node.right);
    }
  }

  traverse(root);
  return Buffer.concat(chunks);
}

/**
 * Deserialize Huffman tree
 * @param {Buffer} data - Serialized tree data
 * @returns {Object} { root, bytesRead }
 */
function deserializeTree(data) {
  let pos = 0;

  function traverse() {
    if (pos >= data.length) {
      throw new Error('Invalid Huffman tree data');
    }

    const marker = data[pos++];
    if (marker === 1) {
      // Leaf
      const symbol = data[pos++];
      return new HuffmanNode(symbol, 0);
    } else {
      // Internal node
      const left = traverse();
      const right = traverse();
      return new HuffmanNode(null, 0, left, right);
    }
  }

  const root = traverse();
  return { root, bytesRead: pos };
}

/**
 * Encode data using Huffman coding (Method 1)
 * @param {Buffer} data - Raw data to compress
 * @returns {Buffer} Compressed data with tree header
 */
function compressHuffman(data) {
  // Calculate frequencies
  const frequencies = new Map();
  for (const byte of data) {
    frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
  }

  // Build Huffman tree
  const tree = buildHuffmanTree(frequencies);
  const codes = generateCodes(tree);

  // Serialize tree
  const serializedTree = serializeTree(tree);

  // Encode data
  let bitString = '';
  for (const byte of data) {
    bitString += codes.get(byte);
  }

  // Convert bit string to bytes
  const encoded = [];
  for (let i = 0; i < bitString.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8 && i + j < bitString.length; j++) {
      if (bitString[i + j] === '1') {
        byte |= 1 << (7 - j);
      }
    }
    encoded.push(byte);
  }

  // Combine tree, original length, bits used, and encoded data
  const header = Buffer.alloc(8);
  header.writeUInt32LE(data.length, 0); // Original length
  header.writeUInt32LE(bitString.length % 8 || 8, 4); // Bits used in last byte

  return Buffer.concat([
    Buffer.from([serializedTree.length >> 8, serializedTree.length & 0xFF]),
    serializedTree,
    header,
    Buffer.from(encoded)
  ]);
}

/**
 * Decode Huffman-encoded data
 * @param {Buffer} data - Huffman-encoded data
 * @returns {Buffer} Decompressed original data
 */
function decompressHuffman(data) {
  let pos = 0;

  // Read tree size
  const treeSize = (data[pos] << 8) | data[pos + 1];
  pos += 2;

  // Deserialize tree
  const treeData = data.slice(pos, pos + treeSize);
  const { root } = deserializeTree(treeData);
  pos += treeSize;

  // Read header
  const originalLength = data.readUInt32LE(pos);
  const bitsInLastByte = data.readUInt32LE(pos + 4);
  pos += 8;

  // Decode bits
  const encoded = data.slice(pos);
  let bitString = '';
  for (let i = 0; i < encoded.length; i++) {
    const byte = encoded[i];
    const bitsToRead = i === encoded.length - 1 ? bitsInLastByte : 8;
    for (let j = 0; j < bitsToRead; j++) {
      bitString += (byte >> (7 - j)) & 1;
    }
  }

  // Traverse tree to decode
  const decoded = [];
  let node = root;
  for (const bit of bitString) {
    if (bit === '0') {
      node = node.left;
    } else {
      node = node.right;
    }

    if (node.isLeaf()) {
      decoded.push(node.symbol);
      if (decoded.length === originalLength) break;
      node = root;
    }
  }

  return Buffer.from(decoded);
}

/**
 * Compress data with automatic method selection
 * @param {Buffer} data - Raw data
 * @param {number} method - Compression method (0=zlib, 1=huffman)
 * @returns {Promise<Buffer>} Compressed data
 */
async function compress(data, method = 0) {
  if (method === 0) {
    return compressZlib(data);
  } else if (method === 1) {
    return Promise.resolve(compressHuffman(data));
  } else {
    throw new Error(`Unknown compression method: ${method}`);
  }
}

/**
 * Decompress data
 * @param {Buffer} data - Compressed data
 * @param {number} method - Compression method
 * @returns {Promise<Buffer>} Decompressed data
 */
async function decompress(data, method = 0) {
  if (method === 0) {
    return decompressZlib(data);
  } else if (method === 1) {
    return Promise.resolve(decompressHuffman(data));
  } else {
    throw new Error(`Unknown compression method: ${method}`);
  }
}

module.exports = {
  compressZlib,
  decompressZlib,
  compressHuffman,
  decompressHuffman,
  compress,
  decompress
};
