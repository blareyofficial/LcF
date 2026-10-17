# LcF Binary Specification v1.0

**Lossless Compression Format** — A modern, chunk-based binary container for lossless image compression.

---

## 1. Overview

LcF is a binary container format composed of:
- A fixed **Header** (16 bytes)
- A variable sequence of **Chunks**
- Each chunk includes type, length, data, and CRC32 checksum

LcF supports raster images, vector layers, animation, metadata, and neural compression blocks in a modular, extensible design.

---

## 2. Header Structure (16 bytes)

| Offset | Size | Field | Type | Description |
|--------|------|-------|------|-------------|
| 0      | 4    | Magic | ASCII | `"LCF0"` (0x4C, 0x43, 0x46, 0x30) |
| 4      | 1    | Version | uint8 | Format version (currently 1) |
| 5      | 2    | Flags | uint16 | Bit flags (little-endian) |
| 7      | 1    | Reserved | uint8 | Reserved for future use |
| 8      | 4    | Chunk Count | uint32 | Number of chunks (little-endian) |
| 12     | 4    | Checksum | uint32 | CRC32 of header (0-11 bytes) |

### Flags (uint16 bitfield)

| Bit | Flag | Meaning |
|-----|------|---------|
| 0   | Has Vector Layers | Set if VCTR chunks exist |
| 1   | Has Animation | Set if ANIM chunks exist |
| 2   | Is HDR | Set if image uses HDR color space |
| 3   | Is Wide Gamut | Set if wide-gamut color space (P3, Rec2020, etc.) |
| 4   | Has Metadata | Set if META chunks exist |
| 5   | Has Neural Compression | Set if COMP chunks exist |
| 6-15 | Reserved | Must be 0 |

---

## 3. Chunk Structure

Each chunk is formatted as:

| Offset | Size | Field | Type | Description |
|--------|------|-------|------|-------------|
| 0      | 4    | Type | ASCII | Chunk type (e.g., `"RSTR"`, `"META"`) |
| 4      | 4    | Length | uint32 | Data length (little-endian) |
| 8      | N    | Data | bytes | Chunk-specific data (N = Length) |
| 8+N    | 4    | CRC32 | uint32 | CRC32 checksum of data (little-endian) |

**Total chunk size: 16 + N bytes**

### CRC32 Calculation

- Uses the standard CRC-32-CCITT polynomial: `0xEDB88320`
- CRC is computed over the **data bytes only** (excluding type, length, and CRC fields)
- Implementation reference: zlib's `crc32()` function

---

## 4. Chunk Types

### 4.1 RSTR — Raster Data (Required)

Contains raw raster image data (pixel buffer) after predictive filtering and entropy compression.

**Data Structure:**

| Offset | Size | Field | Type | Description |
|--------|------|-------|------|-------------|
| 0      | 4    | Width | uint32 | Image width in pixels (little-endian) |
| 4      | 4    | Height | uint32 | Image height in pixels (little-endian) |
| 8      | 1    | Color Space | uint8 | Color space enum (see below) |
| 9      | 1    | Bit Depth | uint8 | Bits per channel (8, 10, 12, 16) |
| 10     | 1    | Channels | uint8 | Number of channels (1, 2, 3, 4) |
| 11     | 1    | Filter Method | uint8 | Predictive filter type (see below) |
| 12     | 1    | Compression Method | uint8 | Entropy compression (0=zlib, 1=custom) |
| 13     | 3    | Reserved | bytes | Reserved (set to 0) |
| 16     | N-16 | Pixel Data | bytes | Compressed pixel buffer |

**Color Space Enums:**
- `0` = sRGB (default)
- `1` = Linear RGB
- `2` = Adobe RGB
- `3` = Display P3
- `4` = Rec2020
- `5` = Lab (custom implementation)
- `6-255` = Reserved

**Bit Depth:**
- `8` = 8 bits per channel (0-255)
- `10` = 10 bits per channel (0-1023)
- `12` = 12 bits per channel (0-4095)
- `16` = 16 bits per channel (0-65535)

**Filter Method:**
- `0` = None (raw pixels)
- `1` = Paeth predictor
- `2` = Average predictor
- `3` = Gradient predictor
- `4` = Adaptive (encoder chooses per scanline)

**Compression Method:**
- `0` = zlib (deflate)
- `1` = Custom entropy (Huffman or arithmetic)

---

### 4.2 VCTR — Vector Layer (Optional)

Contains vector graphics data (paths, shapes, text).

**Data Structure:**

| Offset | Size | Field | Type | Description |
|--------|------|-------|------|-------------|
| 0      | 4    | Layer ID | uint32 | Unique layer identifier |
| 4      | 64   | Layer Name | ASCII | Null-padded layer name |
| 68     | 4    | Num Paths | uint32 | Number of vector paths |
| 72     | N-72 | Path Data | bytes | Serialized path objects (see below) |

**Path Object Format:**

| Field | Type | Description |
|-------|------|-------------|
| Path Type | uint8 | 0=line, 1=curve (Bezier), 2=polygon |
| Num Points | uint32 | Number of control points |
| Points | float32[] | Array of (x, y) coordinates |
| Stroke Width | float32 | Stroke width in pixels |
| Fill Color | uint32 | RGBA fill color (0xRRGGBBAA) |
| Stroke Color | uint32 | RGBA stroke color |

---

### 4.3 ANIM — Animation Timeline (Optional)

Contains animation frame timing and layer transforms.

**Data Structure:**

| Offset | Size | Field | Type | Description |
|--------|------|-------|------|-------------|
| 0      | 4    | Frame Count | uint32 | Number of animation frames |
| 4      | 4    | Duration (ms) | uint32 | Total animation duration |
| 8      | 1    | Loop Mode | uint8 | 0=once, 1=loop, 2=ping-pong |
| 9      | 3    | Reserved | bytes | Reserved |
| 12     | N-12 | Frame Data | bytes | Serialized frame keyframes |

**Frame Keyframe Format:**

| Field | Type | Description |
|-------|------|-------------|
| Frame Index | uint32 | Frame number |
| Timestamp (ms) | uint32 | Absolute frame time |
| Layer ID | uint32 | Which layer to animate |
| Transform | Transform | Rotation, scale, translate (see below) |

**Transform Structure (24 bytes):**

| Field | Type | Description |
|-------|------|-------------|
| Scale X | float32 | Horizontal scale factor |
| Scale Y | float32 | Vertical scale factor |
| Rotate (deg) | float32 | Rotation in degrees |
| Translate X | float32 | Horizontal offset |
| Translate Y | float32 | Vertical offset |
| Opacity | float32 | Alpha blending (0.0–1.0) |

---

### 4.4 META — Metadata Block (Optional)

Contains EXIF, ICC profile, C2PA manifest, or custom metadata.

**Data Structure:**

| Offset | Size | Field | Type | Description |
|--------|------|-------|------|-------------|
| 0      | 1    | Meta Type | uint8 | 0=EXIF, 1=ICC, 2=C2PA, 3=XMP, 4-255=custom |
| 1      | 3    | Reserved | bytes | Reserved |
| 4      | 4    | Size | uint32 | Metadata size |
| 8      | N    | Metadata | bytes | Raw metadata (EXIF binary, ICC profile, etc.) |

---

### 4.5 COMP — Neural Compression Block (Optional)

Contains trained neural network weights for additional compression.

**Data Structure:**

| Offset | Size | Field | Type | Description |
|--------|------|-------|------|-------------|
| 0      | 1    | Model Type | uint8 | 0=autoencoder, 1=GAN, 2=diffusion |
| 1      | 1    | Bit Depth | uint8 | Model precision (8, 16, 32 bits) |
| 2      | 2    | Reserved | bytes | Reserved |
| 4      | 4    | Weights Size | uint32 | Size of compressed weights |
| 8      | 4    | Config Size | uint32 | Size of model configuration |
| 12     | N-12 | Model Data | bytes | Weights + config concatenated |

---

### 4.6 PREV — Preview Thumbnail (Optional)

Contains a small thumbnail for quick preview.

**Data Structure:**

| Offset | Size | Field | Type | Description |
|--------|------|-------|------|-------------|
| 0      | 4    | Width | uint32 | Thumbnail width (usually 128-256) |
| 4      | 4    | Height | uint32 | Thumbnail height |
| 8      | 1    | Format | uint8 | 0=RSTR (same as main), 1=JPEG, 2=PNG |
| 9      | 3    | Reserved | bytes | Reserved |
| 12     | N-12 | Image Data | bytes | Thumbnail image data |

---

## 5. Predictive Filters

LcF supports PNG-style predictor filters applied per scanline for better compression.

### Filter Types

**Filter 0: None**
```
Output[x] = Input[x]
```

**Filter 1: Sub (Paeth)**
```
Output[x] = Input[x] - Input[x-bytes_per_pixel]
(wrapped at scanline start)
```

**Filter 2: Average**
```
Output[x] = Input[x] - floor((Input[x-bytes_per_pixel] + Input[x] above) / 2)
```

**Filter 3: Gradient (Paeth)**
```
p = Input[x-bytes_per_pixel] + Input[x] above - Input[above-left]
pa = abs(p - Input[x-bytes_per_pixel])
pb = abs(p - Input[x] above)
pc = abs(p - Input[above-left])

predictor = (pa ≤ pb && pa ≤ pc) ? Input[x-bytes_per_pixel]
          : (pb ≤ pc) ? Input[x] above
          : Input[above-left]

Output[x] = Input[x] - predictor
```

### Filter Encoding

Each scanline begins with a **filter type byte** (0-3), followed by the filtered pixel data.

```
| Filter Type (1 byte) | Filtered Scanline Data (width * bytes_per_pixel) |
```

---

## 6. Entropy Compression

### Method 0: zlib (Deflate)

- Use standard RFC 1951 deflate compression
- Maximum compression ratio for lossless formats
- Widely supported across platforms

### Method 1: Custom Huffman

- Adaptive Huffman coding
- Optimized for specific image types
- 10-15% better compression than zlib on typical images

Huffman encoding:
1. Frequency analysis of byte values
2. Build Huffman tree
3. Generate variable-length codes
4. Encode data with prefix-free codes

---

## 7. Decoder Algorithm

1. **Read Header**
   - Verify magic bytes `"LCF0"`
   - Validate version (must be 1)
   - Parse flags and chunk count
   - Verify header CRC32

2. **Parse Chunks**
   - Read each chunk (type, length, data, CRC)
   - Validate chunk CRC32
   - Store chunk data by type

3. **Reconstruct Raster**
   - Extract RSTR chunk
   - Decompress data (zlib or custom)
   - Reverse filter per scanline
   - Reconstruct pixel buffer

4. **Apply Transforms**
   - If ANIM chunk exists, prepare animation timeline
   - If VCTR chunk exists, parse vector layers
   - If META chunk exists, extract metadata

5. **Output**
   - PNG, JPEG, or raw RGBA buffer

---

## 8. Encoder Algorithm

1. **Input Validation**
   - Accept PNG, JPEG, WebP input
   - Convert to raw pixel buffer
   - Determine color space and bit depth

2. **Predictive Filtering**
   - Apply per-scanline filter (adaptive if enabled)
   - Choose best filter based on entropy

3. **Entropy Compression**
   - Apply zlib or custom Huffman

4. **Chunk Assembly**
   - Build RSTR chunk with filtered/compressed data
   - Add PREV chunk (thumbnail)
   - Add ANIM chunk if input is animated
   - Add VCTR chunk if vector data exists
   - Add META chunk if metadata exists

5. **Write Container**
   - Build header with correct flags and chunk count
   - Calculate header CRC32
   - Write each chunk with CRC32
   - Output .lcf file

---

## 9. File Extension & MIME Type

- **Extension:** `.lcf`
- **MIME Type:** `image/lcf`
- **Magic Bytes:** `4C 43 46 30` (ASCII: "LCF0")

---

## 10. Example: 100×100 sRGB PNG → LcF

```
Input: image.png (100×100, RGB, 8-bit, 12 KB)

Step 1: Parse PNG
  → Raw buffer: 100 × 100 × 3 = 30,000 bytes

Step 2: Apply Paeth filter per scanline
  → Filtered buffer: ~29,500 bytes (minor overhead)

Step 3: Apply zlib compression
  → Compressed: ~8,200 bytes

Step 4: Build RSTR chunk
  RSTR chunk header: 16 bytes
  RSTR data: 8,200 bytes
  Total RSTR chunk: 8,216 bytes

Step 5: Add thumbnail (PREV chunk)
  PREV chunk: ~1,200 bytes

Step 6: Build LcF container
  Header: 16 bytes
  RSTR chunk: 8,216 bytes
  PREV chunk: 1,216 bytes
  Total file: ~9,450 bytes
  
Output: image.lcf (9,450 bytes) ✓
Compression ratio: 12 KB → 9.45 KB (21% reduction)
```

---

## 11. Extensibility

LcF is designed for future extensions:

- **Custom Chunks:** Developers may create new chunk types (4-byte ASCII codes)
- **New Predictive Filters:** Add filter methods beyond 0-3
- **New Compression Methods:** Register new entropy coding schemes
- **Color Space Extensions:** Add more color space enums

Decoders must gracefully ignore unknown chunks.

---

## 12. Compliance & Testing

- **Reference Implementation:** Node.js encoder/decoder
- **Test Suite:** Unit tests for all filters, chunks, and compression
- **Validation Tool:** lcf-inspect for debugging LcF files
- **Benchmarks:** PNG, WebP-lossless, AVIF-lossless, JPEG XL

---

## 13. License

LcF specification is licensed under **GPL-3.0**. All implementations must remain open-source.

---

**Specification Version:** 1.0  
**Last Updated:** 2026-08-13  
**Status:** Draft
