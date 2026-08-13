# LcF — Lossless Compression Format
LcF (Lossless Compression Format) is an open‑source, next‑generation lossless image format designed to outperform PNG, WebP‑lossless, AVIF‑lossless, and JPEG XL.  
LcF is fully open‑source under the GPL‑3.0 license, ensuring that all forks and modifications remain open and free forever.

---

## Overview
LcF is a chunk‑based binary container format that supports:

- True lossless raster compression
- Optional vector layers
- Optional animation frames
- Full alpha transparency
- HDR + wide‑gamut color
- Metadata blocks (EXIF, ICC, C2PA)
- Predictive filtering + entropy coding
- Optional neural compression blocks

LcF is designed to be modular, extensible, and easy to implement across multiple languages and platforms.

---

## Project Goals
- Create a modern, efficient, open lossless image format
- Provide a complete specification for developers
- Offer a reference encoder and decoder in Node.js
- Provide a browser‑based viewer for LcF files
- Provide Python tooling for batch conversion and neural compression research
- Ensure the format remains open‑source forever via GPL‑3.0

---

## Repository Structure
/spec  
 lcf-spec.md — Full technical specification of the LcF format

/encoder  
 index.js — Main encoder entry point  
 filters.js — Predictive filters  
 entropy.js — Entropy compression  
 chunks.js — Chunk writer  
 container.js — Binary container builder

/decoder  
 index.js — Main decoder entry point  
 parser.js — Binary parser  
 renderer.js — Pixel reconstruction  
 chunks.js — Chunk reader

/viewer  
 index.html — Browser viewer UI  
 viewer.js — LcF rendering logic  
 styles.css — Viewer styling

/tools  
 lcf-cli.py — Command‑line encoder/decoder  
 neural-compress.py — Neural compression experiments  
 batch-convert.py — Batch conversion utilities

README.md  
LICENSE (GPL‑3.0)

---

## LcF File Structure
LcF uses a chunk‑based binary container similar to PNG and JPEG XL.

### Header
Magic: "LCF0"  
Version: 1 byte  
Flags: 2 bytes  
ChunkCount: 4 bytes

### Chunk Format
Type: 4 ASCII bytes  
Length: 4 bytes  
Data: N bytes  
CRC32: 4 bytes

### Chunk Types
RSTR — Raster data  
VCTR — Vector layer  
ANIM — Animation timeline  
META — Metadata  
COMP — Neural compression block  
PREV — Preview thumbnail

---

## Encoder (Node.js)
The reference encoder:

- Accepts PNG/JPEG/WebP input
- Converts to raw pixel buffers
- Applies predictive filters
- Applies lossless entropy compression
- Writes LcF chunks
- Outputs .lcf files
- Provides REST endpoints:
  - /encode
  - /decode
  - /inspect

---

## Decoder (Node.js)
The reference decoder:

- Reads .lcf files
- Parses header and chunks
- Reconstructs pixel buffers
- Reverses predictive filters
- Decompresses entropy‑coded data
- Outputs PNG or raw RGBA buffers
- Supports animation playback
- Supports vector layer rendering

---

## Viewer (HTML/JS)
The browser viewer:

- Loads .lcf files
- Displays raster layers
- Displays vector layers
- Plays animations
- Shows metadata
- Converts PNG → LcF → PNG
- Uses <canvas> for rendering

---

## Python Tools
Python tooling includes:

- CLI encoder/decoder
- Batch conversion utilities
- Neural compression experiments
- Automated tests
- Compression benchmarking

---

## License
LcF is licensed under the **GNU General Public License v3.0 (GPL‑3.0)**.

This ensures:
- No closed‑source forks
- No proprietary versions
- All modifications remain open‑source
- All distributed versions include source code

---

## Contributing
Contributions are welcome.  
All contributions must be licensed under GPL‑3.0 to maintain compatibility with the project.

---

## Status
LcF is currently in active development.  
The specification, encoder, decoder, viewer, and tools will evolve as the project grows.

---

## Goals for Future Versions
- Hardware‑accelerated decoding
- Browser plugin for native LcF support
- Neural compression improvements
- Cross‑language implementations (Rust, C++, Go)
- LcF → AVIF/JPEG XL bridge tools

---

## Contact
For questions, suggestions, or contributions, open an issue or pull request on the repository.
