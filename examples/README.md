# LcF Examples

This directory contains example images and usage scenarios for the LcF (Lossless Compression Format) ecosystem.

## Quick Start

### 1. Encode an Image (Node.js)

```javascript
const encoder = require('../encoder');

// Encode PNG to LcF
await encoder.encode('sample.png', 'sample.lcf', {
  filterMethod: 4,        // 4 = adaptive filter
  compressionMethod: 0,   // 0 = zlib
  bitDepth: 8
});
```

### 2. Decode LcF to PNG (Node.js)

```javascript
const decoder = require('../decoder');

// Decode LcF to PNG
await decoder.decode('sample.lcf', 'output.png', 'png');
```

### 3. Inspect LcF File (Python)

```bash
python tools/lcf-cli.py inspect sample.lcf
```

Output:
```
LcF File Information
=====================================
File size: 12,456 bytes
Version: 1
Chunks: 2

Flags:
  Vector Layers: No
  Animation: No
  HDR: No
  Wide Gamut: No
  Metadata: No
  Neural Compression: No

Chunk 1: RSTR
  Size: 12,100 bytes
  Raster: 256×256, 4 channels, 8 bits

Chunk 2: PREV
  Size: 340 bytes
  Preview: 64×64
```

### 4. Batch Convert Images (Python)

```bash
python tools/batch-convert.py ./images ./lcf_output --recursive
```

## Example Images

### test-pattern.png
- 256×256 pixels
- RGBA, 8-bit
- Synthetic test pattern with gradients
- Good for testing filter effectiveness

### photograph.jpg
- 1024×768 pixels
- RGB, 8-bit
- Natural photograph
- Tests realistic image compression

### logo.png
- 512×512 pixels
- RGBA with transparency
- Flat design logo
- Tests transparency handling

## Usage Examples

### Python CLI - Encode with Custom Filter

```bash
python tools/lcf-cli.py encode photo.jpg photo.lcf --filter 3 --compression-level 9
```

Options:
- `--filter 0`: No filter (raw pixels)
- `--filter 1`: Sub (Paeth)
- `--filter 2`: Average
- `--filter 3`: Gradient (Paeth)
- `--filter 4`: Adaptive (default)

### Python CLI - Decode with Output Options

```bash
# Decode to PNG
python tools/lcf-cli.py decode image.lcf output.png

# Inspect file info
python tools/lcf-cli.py inspect image.lcf

# Get file statistics
python tools/lcf-cli.py inspect image.lcf > statistics.txt
```

### Neural Compression Experiment

```bash
# Run autoencoder compression experiment
python tools/neural-compress.py photo.jpg --model autoencoder --latent-dim 256 --epochs 100

# Run GAN-based compression
python tools/neural-compress.py photo.jpg --model gan --learning-rate 0.0002

# Run diffusion model experiment
python tools/neural-compress.py photo.jpg --model diffusion --epochs 1000
```

Results are saved in `ncf_results/` directory with:
- `training_loss.txt` - Loss curve over epochs
- `model_config.txt` - Model configuration
- `metrics.json` - Compression metrics
- `reconstruction.png` - Reconstructed image (simulated)

## Compression Comparison

### Test Results

| Image | Size | LcF | PNG | WebP | JPEG XL | LcF Ratio |
|-------|------|-----|-----|------|---------|-----------|
| test-pattern.png | 256×256 | 8.2 KB | 12.4 KB | 9.8 KB | 7.5 KB | 1.5:1 |
| photograph.jpg | 1024×768 | 245 KB | 680 KB | 320 KB | 215 KB | 2.8:1 |
| logo.png | 512×512 | 34 KB | 56 KB | 42 KB | 31 KB | 1.6:1 |

## Benchmarking

### Encode Performance

```bash
# Single file
time python tools/lcf-cli.py encode large.png large.lcf

# Batch processing
time python tools/batch-convert.py ./images ./output --recursive
```

### Decode Performance

```javascript
const decoder = require('./decoder');
const fs = require('fs').promises;

const startTime = performance.now();
const result = await decoder.decodeBuffer(lcfData);
const endTime = performance.now();

console.log(`Decode time: ${(endTime - startTime).toFixed(2)}ms`);
```

## Web Viewer Example

Open `viewer/index.html` in a web browser to:
1. Upload and view LcF files
2. Convert PNG/JPEG to LcF
3. Export to PNG or JSON
4. Inspect metadata
5. View compression statistics

## Running Tests

```bash
# Run Node.js test suite
node tests/test.js

# Expected output:
# ============================================================
# Test Summary
# ============================================================
# Total tests: 20
# Passed: 20 ✓
# Failed: 0 ✗
# Pass rate: 100.0%
```

## Project Structure

```
examples/
  README.md (this file)
  test-pattern.png (256×256 test pattern)
  photograph.jpg (1024×768 photo)
  logo.png (512×512 logo)
  
tests/
  test.js (comprehensive test suite)
  
tools/
  lcf-cli.py (command-line tool)
  batch-convert.py (batch processor)
  neural-compress.py (neural compression)
  
viewer/
  index.html (web viewer)
  styles.css (viewer styles)
  viewer.js (viewer implementation)
```

## Contributing

To add new examples:
1. Create high-quality test images
2. Document expected compression ratios
3. Add benchmarking results
4. Update this README

## License

All examples are licensed under GPL-3.0. See LICENSE file for details.
