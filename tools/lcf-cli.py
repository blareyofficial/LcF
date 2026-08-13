#!/usr/bin/env python3
"""
LcF CLI Tool
Command-line encoder/decoder for Lossless Compression Format
"""

import argparse
import sys
import struct
import zlib
import os
from pathlib import Path
from datetime import datetime

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("Error: PIL (Pillow) and numpy are required.")
    print("Install with: pip install Pillow numpy")
    sys.exit(1)


class LcfCli:
    """LcF Command-Line Interface"""

    # LcF Constants
    MAGIC = b'LCF0'
    VERSION = 1
    RSTR_TYPE = b'RSTR'
    PREV_TYPE = b'PREV'
    META_TYPE = b'META'
    VCTR_TYPE = b'VCTR'
    ANIM_TYPE = b'ANIM'
    COMP_TYPE = b'COMP'

    # Filter methods
    FILTER_NONE = 0
    FILTER_SUB = 1
    FILTER_AVERAGE = 2
    FILTER_PAETH = 3
    FILTER_ADAPTIVE = 4

    COLOR_SPACES = {
        'srgb': 0,
        'linear': 1,
        'adobe': 2,
        'display_p3': 3,
        'rec2020': 4,
        'lab': 5
    }

    @staticmethod
    def crc32(data):
        """Calculate CRC32 checksum"""
        return zlib.crc32(data) & 0xFFFFFFFF

    def encode(self, input_path, output_path, args):
        """Encode image to LcF format"""
        print(f"[Encoder] Reading image: {input_path}")
        
        try:
            # Load image
            img = Image.open(input_path)
            
            # Convert to RGBA
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            width, height = img.size
            img_data = np.array(img, dtype=np.uint8)
            
            print(f"[Encoder] Image size: {width}×{height}")
            print(f"[Encoder] Pixel data: {img_data.size} bytes")
            
            # Apply predictive filters
            filtered_data = self.apply_filters(img_data, args.filter)
            print(f"[Encoder] After filtering: {len(filtered_data)} bytes")
            
            # Compress
            compressed_data = zlib.compress(filtered_data, args.compression_level)
            print(f"[Encoder] After compression: {len(compressed_data)} bytes")
            
            # Build LcF container
            lcf_data = self.build_lcf_container(
                compressed_data=compressed_data,
                width=width,
                height=height,
                color_space=self.COLOR_SPACES.get(args.color_space, 0),
                bit_depth=args.bit_depth,
                channels=4,
                filter_method=args.filter,
                compression_method=args.compression_method,
                original_image=img_data,
                args=args
            )
            
            # Write output
            print(f"[Encoder] Writing LcF: {output_path}")
            with open(output_path, 'wb') as f:
                f.write(lcf_data)
            
            file_size = len(lcf_data)
            original_size = width * height * 4
            ratio = original_size / file_size if file_size > 0 else 0
            
            print(f"[Encoder] Complete!")
            print(f"  Original size: {original_size:,} bytes")
            print(f"  Compressed size: {file_size:,} bytes")
            print(f"  Compression ratio: {ratio:.2f}:1")
            print(f"  Savings: {(1 - file_size/original_size)*100:.1f}%")
            
        except Exception as e:
            print(f"[Error] Encoding failed: {e}")
            return False
        
        return True

    def decode(self, input_path, output_path):
        """Decode LcF to PNG"""
        print(f"[Decoder] Reading LcF: {input_path}")
        
        try:
            # Read LcF file
            with open(input_path, 'rb') as f:
                lcf_data = f.read()
            
            # Parse header
            if len(lcf_data) < 16:
                raise ValueError("File too short for LcF header")
            
            magic = lcf_data[0:4]
            if magic != self.MAGIC:
                raise ValueError(f"Invalid magic bytes: {magic}")
            
            version = lcf_data[4]
            flags = struct.unpack('<H', lcf_data[5:7])[0]
            chunk_count = struct.unpack('<I', lcf_data[8:12])[0]
            
            print(f"[Decoder] Version: {version}, Chunks: {chunk_count}")
            
            # Parse RSTR chunk
            offset = 16
            rstr_data = None
            
            for _ in range(chunk_count):
                if offset + 8 > len(lcf_data):
                    break
                
                chunk_type = lcf_data[offset:offset+4]
                chunk_length = struct.unpack('<I', lcf_data[offset+4:offset+8])[0]
                chunk_data = lcf_data[offset+8:offset+8+chunk_length]
                
                if chunk_type == self.RSTR_TYPE:
                    rstr_data = self.parse_rstr(chunk_data)
                    break
                
                offset += 16 + chunk_length
            
            if not rstr_data:
                raise ValueError("No RSTR chunk found")
            
            # Decompress
            print(f"[Decoder] Decompressing...")
            decompressed = zlib.decompress(rstr_data['pixel_data'])
            
            # Reverse filters
            print(f"[Decoder] Reversing filters...")
            pixels = self.reverse_filters(
                decompressed,
                rstr_data['width'],
                rstr_data['height'],
                rstr_data['channels']
            )
            
            # Create image
            img_array = np.frombuffer(pixels, dtype=np.uint8)
            img_array = img_array.reshape((rstr_data['height'], rstr_data['width'], 4))
            img = Image.fromarray(img_array, mode='RGBA')
            
            # Save
            print(f"[Decoder] Writing PNG: {output_path}")
            img.save(output_path)
            
            print(f"[Decoder] Complete! Image size: {rstr_data['width']}×{rstr_data['height']}")
            
        except Exception as e:
            print(f"[Error] Decoding failed: {e}")
            return False
        
        return True

    def inspect(self, file_path):
        """Inspect LcF file without decoding"""
        print(f"[Inspector] Reading LcF: {file_path}")
        
        try:
            with open(file_path, 'rb') as f:
                lcf_data = f.read()
            
            if len(lcf_data) < 16:
                raise ValueError("File too short")
            
            magic = lcf_data[0:4]
            version = lcf_data[4]
            flags = struct.unpack('<H', lcf_data[5:7])[0]
            chunk_count = struct.unpack('<I', lcf_data[8:12])[0]
            
            file_size = len(lcf_data)
            
            print(f"\nLcF File Information")
            print(f"{'='*40}")
            print(f"File size: {file_size:,} bytes")
            print(f"Version: {version}")
            print(f"Chunks: {chunk_count}")
            print(f"\nFlags:")
            print(f"  Vector Layers: {'Yes' if flags & (1<<0) else 'No'}")
            print(f"  Animation: {'Yes' if flags & (1<<1) else 'No'}")
            print(f"  HDR: {'Yes' if flags & (1<<2) else 'No'}")
            print(f"  Wide Gamut: {'Yes' if flags & (1<<3) else 'No'}")
            print(f"  Metadata: {'Yes' if flags & (1<<4) else 'No'}")
            print(f"  Neural Compression: {'Yes' if flags & (1<<5) else 'No'}")
            
            # Parse chunks
            offset = 16
            for i in range(chunk_count):
                if offset + 8 > len(lcf_data):
                    break
                
                chunk_type = lcf_data[offset:offset+4].decode('ascii', errors='ignore')
                chunk_length = struct.unpack('<I', lcf_data[offset+4:offset+8])[0]
                
                print(f"\nChunk {i+1}: {chunk_type}")
                print(f"  Size: {chunk_length:,} bytes")
                
                if chunk_type == 'RSTR':
                    rstr = self.parse_rstr(lcf_data[offset+8:offset+8+chunk_length])
                    print(f"  Raster: {rstr['width']}×{rstr['height']}, {rstr['channels']} channels, {rstr['bit_depth']} bits")
                
                offset += 16 + chunk_length
            
        except Exception as e:
            print(f"[Error] Inspection failed: {e}")
            return False
        
        return True

    def apply_filters(self, img_data, filter_method):
        """Apply predictive filters to image data"""
        height, width, channels = img_data.shape
        scanline_size = width * channels
        filtered = bytearray()
        
        for y in range(height):
            scanline = img_data[y]
            prev_scanline = img_data[y-1] if y > 0 else None
            
            if filter_method == self.FILTER_PAETH or filter_method == self.FILTER_ADAPTIVE:
                filter_type = self.FILTER_PAETH
                filtered_line = self.paeth_filter(scanline, prev_scanline, channels)
            elif filter_method == self.FILTER_AVERAGE:
                filter_type = self.FILTER_AVERAGE
                filtered_line = self.average_filter(scanline, prev_scanline, channels)
            elif filter_method == self.FILTER_SUB:
                filter_type = self.FILTER_SUB
                filtered_line = self.sub_filter(scanline, channels)
            else:
                filter_type = self.FILTER_NONE
                filtered_line = scanline.copy()
            
            filtered.append(filter_type)
            filtered.extend(filtered_line)
        
        return bytes(filtered)

    def paeth_filter(self, scanline, prev_scanline, channels):
        """Paeth predictor filter"""
        result = bytearray()
        for x in range(len(scanline)):
            left = scanline[x - channels] if x >= channels else 0
            above = prev_scanline[x] if prev_scanline is not None else 0
            above_left = prev_scanline[x - channels] if prev_scanline is not None and x >= channels else 0
            
            p = left + above - above_left
            pa = abs(p - left)
            pb = abs(p - above)
            pc = abs(p - above_left)
            
            if pa <= pb and pa <= pc:
                predictor = left
            elif pb <= pc:
                predictor = above
            else:
                predictor = above_left
            
            result.append((scanline[x] - predictor) & 0xFF)
        
        return result

    def average_filter(self, scanline, prev_scanline, channels):
        """Average predictor filter"""
        result = bytearray()
        for x in range(len(scanline)):
            left = scanline[x - channels] if x >= channels else 0
            above = prev_scanline[x] if prev_scanline is not None else 0
            predictor = (left + above) // 2
            result.append((scanline[x] - predictor) & 0xFF)
        return result

    def sub_filter(self, scanline, channels):
        """Sub predictor filter"""
        result = bytearray()
        for x in range(len(scanline)):
            left = scanline[x - channels] if x >= channels else 0
            result.append((scanline[x] - left) & 0xFF)
        return result

    def reverse_filters(self, filtered_data, width, height, channels):
        """Reverse predictive filters"""
        scanline_size = width * channels
        pixels = bytearray()
        
        offset = 0
        for y in range(height):
            filter_type = filtered_data[offset]
            offset += 1
            
            scanline = filtered_data[offset:offset+scanline_size]
            offset += scanline_size
            
            if filter_type == self.FILTER_PAETH:
                reconstructed = self.paeth_reverse(scanline, pixels[-scanline_size:] if y > 0 else None, channels)
            elif filter_type == self.FILTER_AVERAGE:
                reconstructed = self.average_reverse(scanline, pixels[-scanline_size:] if y > 0 else None, channels)
            elif filter_type == self.FILTER_SUB:
                reconstructed = self.sub_reverse(scanline, channels)
            else:
                reconstructed = scanline
            
            pixels.extend(reconstructed)
        
        return bytes(pixels)

    def paeth_reverse(self, filtered, prev_line, channels):
        """Reverse Paeth filter"""
        result = bytearray()
        for x in range(len(filtered)):
            left = result[x - channels] if x >= channels else 0
            above = prev_line[x] if prev_line else 0
            above_left = prev_line[x - channels] if prev_line and x >= channels else 0
            
            p = left + above - above_left
            pa = abs(p - left)
            pb = abs(p - above)
            pc = abs(p - above_left)
            
            if pa <= pb and pa <= pc:
                predictor = left
            elif pb <= pc:
                predictor = above
            else:
                predictor = above_left
            
            result.append((filtered[x] + predictor) & 0xFF)
        
        return result

    def average_reverse(self, filtered, prev_line, channels):
        """Reverse average filter"""
        result = bytearray()
        for x in range(len(filtered)):
            left = result[x - channels] if x >= channels else 0
            above = prev_line[x] if prev_line else 0
            predictor = (left + above) // 2
            result.append((filtered[x] + predictor) & 0xFF)
        return result

    def sub_reverse(self, filtered, channels):
        """Reverse sub filter"""
        result = bytearray()
        for x in range(len(filtered)):
            left = result[x - channels] if x >= channels else 0
            result.append((filtered[x] + left) & 0xFF)
        return result

    def parse_rstr(self, data):
        """Parse RSTR chunk data"""
        width = struct.unpack('<I', data[0:4])[0]
        height = struct.unpack('<I', data[4:8])[0]
        color_space = data[8]
        bit_depth = data[9]
        channels = data[10]
        filter_method = data[11]
        compression_method = data[12]
        pixel_data = data[16:]
        
        return {
            'width': width,
            'height': height,
            'color_space': color_space,
            'bit_depth': bit_depth,
            'channels': channels,
            'filter_method': filter_method,
            'compression_method': compression_method,
            'pixel_data': pixel_data
        }

    def build_lcf_container(self, compressed_data, width, height, color_space, 
                           bit_depth, channels, filter_method, compression_method,
                           original_image, args):
        """Build complete LcF file"""
        # Build RSTR chunk
        rstr_data = struct.pack('<II', width, height)
        rstr_data += struct.pack('BBBBBB',
            color_space, bit_depth, channels, filter_method, compression_method, 0)
        rstr_data += compressed_data
        
        rstr_chunk = self.RSTR_TYPE
        rstr_chunk += struct.pack('<I', len(rstr_data))
        rstr_chunk += rstr_data
        rstr_chunk += struct.pack('<I', self.crc32(rstr_data))
        
        chunks = [rstr_chunk]
        
        # Build header
        flags = 0
        header = self.MAGIC
        header += struct.pack('B', self.VERSION)
        header += struct.pack('<H', flags)
        header += struct.pack('B', 0)  # Reserved
        header += struct.pack('<I', len(chunks))
        
        # Calculate header CRC
        header_crc = self.crc32(header)
        header += struct.pack('<I', header_crc)
        
        return header + b''.join(chunks)


def main():
    parser = argparse.ArgumentParser(
        description='LcF - Lossless Compression Format CLI Tool',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  lcf-cli.py encode image.png image.lcf
  lcf-cli.py decode image.lcf image.png
  lcf-cli.py inspect image.lcf
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Encode command
    encode_parser = subparsers.add_parser('encode', help='Encode image to LcF')
    encode_parser.add_argument('input', help='Input image (PNG, JPEG, etc.)')
    encode_parser.add_argument('output', help='Output LcF file')
    encode_parser.add_argument('--filter', type=int, default=4, choices=[0, 1, 2, 3, 4],
                              help='Filter method (0=none, 1=sub, 2=avg, 3=paeth, 4=adaptive)')
    encode_parser.add_argument('--color-space', default='srgb',
                              choices=list(LcfCli.COLOR_SPACES.keys()),
                              help='Color space')
    encode_parser.add_argument('--bit-depth', type=int, default=8, choices=[8, 10, 12, 16],
                              help='Bits per channel')
    encode_parser.add_argument('--compression-level', type=int, default=9, choices=range(10),
                              help='Compression level (0-9)')
    encode_parser.add_argument('--compression-method', type=int, default=0, choices=[0, 1],
                              help='Compression method (0=zlib, 1=huffman)')
    
    # Decode command
    decode_parser = subparsers.add_parser('decode', help='Decode LcF to PNG')
    decode_parser.add_argument('input', help='Input LcF file')
    decode_parser.add_argument('output', help='Output PNG file')
    
    # Inspect command
    inspect_parser = subparsers.add_parser('inspect', help='Inspect LcF file')
    inspect_parser.add_argument('input', help='LcF file to inspect')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    cli = LcfCli()
    
    if args.command == 'encode':
        success = cli.encode(args.input, args.output, args)
    elif args.command == 'decode':
        success = cli.decode(args.input, args.output)
    elif args.command == 'inspect':
        success = cli.inspect(args.input)
    else:
        print(f"Unknown command: {args.command}")
        return 1
    
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
