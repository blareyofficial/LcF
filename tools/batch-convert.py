#!/usr/bin/env python3
"""
LcF Batch Converter
Batch convert images to LcF format
"""

import argparse
import sys
import os
from pathlib import Path
from datetime import datetime
import time

# Import the CLI tool
from lcf_cli import LcfCli


class LcfBatchConverter:
    """Batch conversion tool for LcF format"""

    def __init__(self, args):
        self.input_dir = Path(args.input_dir)
        self.output_dir = Path(args.output_dir)
        self.formats = args.formats.split(',')
        self.recursive = args.recursive
        self.filter_method = args.filter
        self.compression_level = args.compression_level
        self.cli = LcfCli()
        self.stats = {
            'total': 0,
            'success': 0,
            'failed': 0,
            'original_size': 0,
            'compressed_size': 0,
            'start_time': None,
            'end_time': None
        }

    def run(self):
        """Execute batch conversion"""
        print(f"[Batch Converter] Starting batch conversion")
        print(f"  Input directory: {self.input_dir}")
        print(f"  Output directory: {self.output_dir}")
        print(f"  Formats: {', '.join(self.formats)}")
        print(f"  Recursive: {self.recursive}")
        print()

        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Start timer
        self.stats['start_time'] = time.time()

        # Find all matching files
        if self.recursive:
            pattern = '**/*'
        else:
            pattern = '*'

        for format_ext in self.formats:
            for file_path in self.input_dir.glob(f'{pattern}.{format_ext}'):
                if file_path.is_file():
                    self.convert_file(file_path)

        # End timer
        self.stats['end_time'] = time.time()

        # Print summary
        self.print_summary()

    def convert_file(self, file_path):
        """Convert a single file"""
        self.stats['total'] += 1

        # Calculate output path
        relative_path = file_path.relative_to(self.input_dir)
        output_path = self.output_dir / relative_path.with_suffix('.lcf')

        # Create parent directory if needed
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            print(f"[{self.stats['total']}] Converting: {file_path.name}", end=' ')
            sys.stdout.flush()

            # Get original file size
            original_size = file_path.stat().st_size
            self.stats['original_size'] += original_size

            # Encode using CLI
            args_obj = type('Args', (), {
                'filter': self.filter_method,
                'color_space': 'srgb',
                'bit_depth': 8,
                'compression_method': 0,
                'compression_level': self.compression_level
            })()

            success = self.cli.encode(str(file_path), str(output_path), args_obj)

            if success:
                compressed_size = output_path.stat().st_size
                self.stats['compressed_size'] += compressed_size

                ratio = original_size / compressed_size if compressed_size > 0 else 0
                savings = (1 - compressed_size / original_size) * 100 if original_size > 0 else 0

                print(f"✓ ({original_size:,} → {compressed_size:,} bytes, {ratio:.2f}:1, {savings:.1f}% savings)")
                self.stats['success'] += 1
            else:
                print("✗ Failed")
                self.stats['failed'] += 1

        except Exception as e:
            print(f"✗ Error: {e}")
            self.stats['failed'] += 1

    def print_summary(self):
        """Print conversion summary"""
        duration = self.stats['end_time'] - self.stats['start_time']

        print()
        print("=" * 60)
        print("Batch Conversion Summary")
        print("=" * 60)
        print(f"Total files processed: {self.stats['total']}")
        print(f"Successful: {self.stats['success']}")
        print(f"Failed: {self.stats['failed']}")
        print(f"Success rate: {(self.stats['success']/self.stats['total']*100 if self.stats['total'] > 0 else 0):.1f}%")
        print()
        print(f"Original total size: {self.stats['original_size']:,} bytes ({self.stats['original_size']/1024/1024:.2f} MB)")
        print(f"Compressed total size: {self.stats['compressed_size']:,} bytes ({self.stats['compressed_size']/1024/1024:.2f} MB)")

        if self.stats['original_size'] > 0:
            overall_ratio = self.stats['original_size'] / self.stats['compressed_size'] if self.stats['compressed_size'] > 0 else 0
            overall_savings = (1 - self.stats['compressed_size'] / self.stats['original_size']) * 100
            print(f"Overall ratio: {overall_ratio:.2f}:1")
            print(f"Overall savings: {overall_savings:.1f}%")

        print(f"\nConversion time: {duration:.2f} seconds")
        if self.stats['success'] > 0:
            print(f"Average time per file: {duration/self.stats['success']:.2f} seconds")


def main():
    parser = argparse.ArgumentParser(
        description='LcF Batch Converter - Convert multiple images to LcF format'
    )

    parser.add_argument('input_dir', help='Input directory containing images')
    parser.add_argument('output_dir', help='Output directory for LcF files')
    parser.add_argument('--formats', default='png,jpg,jpeg,webp',
                       help='Comma-separated image formats to convert (default: png,jpg,jpeg,webp)')
    parser.add_argument('--recursive', '-r', action='store_true',
                       help='Recursively process subdirectories')
    parser.add_argument('--filter', type=int, default=4, choices=[0, 1, 2, 3, 4],
                       help='Filter method (0=none, 1=sub, 2=avg, 3=paeth, 4=adaptive)')
    parser.add_argument('--compression-level', type=int, default=9, choices=range(10),
                       help='Compression level (0-9, default: 9)')

    args = parser.parse_args()

    # Validate input directory
    if not Path(args.input_dir).is_dir():
        print(f"Error: Input directory does not exist: {args.input_dir}")
        return 1

    try:
        converter = LcfBatchConverter(args)
        converter.run()
        return 0
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
